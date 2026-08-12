/* =========================================================
   PREVENGLOBAL — BACKEND (Node.js + Express + PostgreSQL)
   ---------------------------------------------------------
   Mismo comportamiento que el backend original (multiempresa,
   estado completo por empresa, contraseña maestra opcional),
   pero guardando cada empresa como una fila en Postgres en vez
   de un archivo data/<slug>.json — así los datos sobreviven a
   cada redespliegue en Railway sin necesitar volumen aparte.

   Sincronización con el front-end (sin cambios respecto a antes):
   GET  /api/state  -> devuelve el estado completo de la empresa
                        autenticada (sin contraseñas).
   PUT  /api/state  -> guarda el estado completo enviado por el
                        navegador (las contraseñas nuevas se
                        hashean aquí; si llegan vacías se conserva
                        el hash que ya existía).
========================================================= */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json({ limit: '80mb' })); // las fotos van como base64 y pueden pesar
app.use(express.static(path.join(__dirname, 'public')));

// La mayoría de los hostings con Postgres administrado (Railway, un VPS con
// Postgres propio detrás de un proxy, DigitalOcean, etc.) requieren SSL;
// solo una base de datos local (tu propia compu, o el mismo servidor sin red)
// normalmente no lo necesita. Se detecta solo, y si algún hosting da problemas
// con esto, se puede forzar con la variable de entorno DB_SSL=false.
const urlBaseDatos = process.env.DATABASE_URL || '';
const esBaseLocal = /localhost|127\.0\.0\.1/.test(urlBaseDatos);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : (esBaseLocal ? false : { rejectUnauthorized: false }),
});

// Si no defines MASTER_PASSWORD, el acceso por contraseña maestra queda
// desactivado por completo (más seguro que un valor por defecto adivinable).
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || null;
const SESION_HORAS = 12;

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de acceso. Espera unos minutos e intenta de nuevo.' },
  standardHeaders: true, legacyHeaders: false,
});
const limitePublico = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas solicitudes desde tu conexión. Espera unos minutos e intenta de nuevo.' },
  standardHeaders: true, legacyHeaders: false,
});

/* ---------------------------------------------------------
   Utilidades de contraseñas (hash con sal, sin dependencias)
--------------------------------------------------------- */
function hashPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}
function verificarPassword(password, almacenado) {
  if (!password || !almacenado) return false;
  const [sal, hash] = almacenado.split(':');
  if (!sal || !hash) return false;
  const hashIntento = crypto.scryptSync(password, sal, 64).toString('hex');
  const bufA = Buffer.from(hash, 'hex'), bufB = Buffer.from(hashIntento, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/* ---------------------------------------------------------
   Acceso a empresas (ahora en Postgres, antes en archivos)
--------------------------------------------------------- */
function slugValido(slug) { return /^[a-z0-9][a-z0-9-]{1,40}$/.test(slug); }

async function leerEmpresas() {
  const r = await pool.query('SELECT slug, nombre, creado_en FROM empresas ORDER BY creado_en');
  return r.rows;
}
async function empresaExiste(slug) {
  const r = await pool.query('SELECT 1 FROM empresas WHERE slug = $1', [slug]);
  return r.rowCount > 0;
}
async function leerEstadoEmpresa(slug) {
  const r = await pool.query('SELECT estado_app FROM empresas WHERE slug = $1', [slug]);
  return r.rows[0] ? r.rows[0].estado_app : null;
}
async function guardarEstadoEmpresa(slug, data) {
  await pool.query(
    'UPDATE empresas SET estado_app = $1, actualizado_en = now() WHERE slug = $2',
    [JSON.stringify(data), slug]
  );
}
async function crearEmpresa(slug, nombre, estadoInicial) {
  await pool.query(
    'INSERT INTO empresas (slug, nombre, estado_app) VALUES ($1, $2, $3)',
    [slug, nombre, JSON.stringify(estadoInicial)]
  );
}

function estadoSemilla(nombreEmpresa, adminUsuario, adminPasswordHash) {
  return {
    clientes: [], tecnicos: [], plantillas: [], ordenes: [], bodegas: [{ id: 1, nombre: 'Bodega Principal', tipo: 'fija' }],
    inventario: [], kardex: [], pedidosTienda: [],
    nomina: [], gastos: [], controlOperativo: [],
    recargoMateriales: 1.3, porcentajePagoTercero: 0.45, metaMensualUtilidad: 5000000,
    logs: [],
    config: {
      nombre: nombreEmpresa, subtitulo: 'Gestión de Clientes, Órdenes de Servicio e Inventario',
      logo: null, direccion: '', mision: '', vision: '',
      tiendaLogo: null, tiendaBanner: [], tiendaGaleria: [], tiendaTelefono: '', tiendaWhatsapp: '',
      tiendaColor: '#0088ff', tiendaImgEstilo: 'cover', tiendaTamanoTarjeta: 230,
      tiendaSecciones: { equipo: [], servicios: [], proyectos: [], clientes: [], certificaciones: [] },
      tiendaTestimonios: [],
      colorAcento: '#0088ff', colorFondo: '#0b111e', modoClaro: false,
      adminUsuario, adminPasswordHash, loginRequerido: true,
      tiposServicio: ['Mantenimiento Preventivo', 'Mantenimiento Correctivo', 'Instalación', 'Diagnóstico'],
      prioridades: ['Media', 'Alta', 'Baja'],
      plantillaWhatsApp: 'Hola {nombre_cliente}, adjuntamos el informe de la orden {numero_orden}. Cualquier duda con gusto la resolvemos. ¡Gracias por confiar en nosotros!'
    }
  };
}

/* ---------------------------------------------------------
   Sesiones en memoria (token -> {slug, rol, tecnicoId, exp})
   Igual que antes: al reiniciar el servidor se cierran todas
   las sesiones (los usuarios simplemente vuelven a entrar).
--------------------------------------------------------- */
const sesiones = new Map();
function crearSesion(slug, rol, tecnicoId) {
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, { slug, rol, tecnicoId: tecnicoId || null, exp: Date.now() + SESION_HORAS * 3600 * 1000 });
  return token;
}
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const sesion = token ? sesiones.get(token) : null;
  if (!sesion || sesion.exp < Date.now()) { if (token) sesiones.delete(token); return res.status(401).json({ error: 'Sesión inválida o expirada.' }); }
  const empresaHeader = (req.headers['x-empresa'] || '').toLowerCase();
  if (empresaHeader && empresaHeader !== sesion.slug) return res.status(401).json({ error: 'La sesión no corresponde a esta empresa.' });
  req.slug = sesion.slug; req.rol = sesion.rol; req.tecnicoId = sesion.tecnicoId;
  next();
}

/* ---------------------------------------------------------
   API — Empresas
--------------------------------------------------------- */
app.get('/api/empresas', async (req, res) => {
  const empresas = await leerEmpresas();
  res.json(empresas.map(e => ({ slug: e.slug, nombre: e.nombre })));
});
app.get('/api/empresas/:slug', async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const data = await leerEstadoEmpresa(slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });
  res.json({
    nombre: data.config.nombre, logo: data.config.logo,
    tecnicos: (data.tecnicos || []).map(t => ({ id: t.id, nombre: t.nombre }))
  });
});
app.post('/api/empresas', limiteLogin, async (req, res) => {
  const { slug: slugRaw, nombre, adminUsuario, adminPassword } = req.body || {};
  const slug = (slugRaw || '').trim().toLowerCase();
  if (!slug || !nombre || !adminUsuario || !adminPassword) return res.status(400).json({ error: 'Completa todos los campos.' });
  if (!slugValido(slug)) return res.status(400).json({ error: 'El código de empresa solo puede tener letras minúsculas, números y guiones.' });
  if (await empresaExiste(slug)) return res.status(409).json({ error: 'Ya existe una empresa con ese código.' });
  if (adminPassword.length < 4) return res.status(400).json({ error: 'La contraseña del administrador es muy corta.' });

  const adminPasswordHash = hashPassword(adminPassword);
  const data = estadoSemilla(nombre.trim(), adminUsuario.trim(), adminPasswordHash);
  await crearEmpresa(slug, nombre.trim(), data);

  const token = crearSesion(slug, 'admin', null);
  res.status(201).json({ token, rol: 'admin', tecnicoId: null, nombreEmpresa: data.config.nombre });
});

/* ---------------------------------------------------------
   API — Tienda pública (sin sesión)
--------------------------------------------------------- */
app.get('/api/tienda/:slug', limitePublico, async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const data = await leerEstadoEmpresa(slug);
  if (!data) return res.status(404).json({ error: 'Tienda no encontrada.' });
  const cfg = data.config || {};
  res.json({
    nombre: cfg.nombre, logo: cfg.tiendaLogo || cfg.logo || null,
    banner: cfg.tiendaBanner || [], galeria: cfg.tiendaGaleria || [],
    color: cfg.tiendaColor || '#0088ff', imgEstilo: cfg.tiendaImgEstilo || 'cover',
    tamanoTarjeta: cfg.tiendaTamanoTarjeta || 230,
    telefono: cfg.tiendaTelefono || '', whatsapp: cfg.tiendaWhatsapp || '',
    secciones: cfg.tiendaSecciones || { equipo: [], servicios: [], proyectos: [], clientes: [], certificaciones: [] },
    testimonios: cfg.tiendaTestimonios || [],
    productos: (data.inventario || []).filter(it => it.publicarEnTienda).map(it => ({
      id: it.id, nombre: it.nombre, categoria: it.categoria || '',
      descripcionTienda: it.descripcionTienda || '', precio: it.precio || 0,
      stockActual: it.stockActual || 0, fotos: it.fotos || []
    }))
  });
});
app.post('/api/tienda/:slug/pedido', limitePublico, async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const data = await leerEstadoEmpresa(slug);
  if (!data) return res.status(404).json({ error: 'Tienda no encontrada.' });
  const { nombre, telefono, email, notas, items } = req.body || {};
  if (!nombre || !telefono || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Faltan datos del pedido (nombre, teléfono e ítems).' });
  }
  data.pedidosTienda = data.pedidosTienda || [];
  const itemsValidados = items.map(li => {
    const prod = (data.inventario || []).find(i => i.id === li.itemId && i.publicarEnTienda);
    if (!prod) return null;
    const cantidad = Math.max(1, Math.min(parseInt(li.cantidad) || 1, prod.stockActual || 0));
    return { itemId: prod.id, nombre: prod.nombre, cantidad, precio: prod.precio || 0 };
  }).filter(Boolean);
  if (!itemsValidados.length) return res.status(400).json({ error: 'Ninguno de los productos del pedido está disponible.' });
  const total = itemsValidados.reduce((a, i) => a + (i.precio * i.cantidad), 0);
  const pedido = {
    id: Date.now(), numero: 'PED-' + String(data.pedidosTienda.length + 1).padStart(4, '0'),
    fecha: new Date().toISOString(),
    nombre: String(nombre).slice(0, 120), telefono: String(telefono).slice(0, 40),
    email: String(email || '').slice(0, 120), notas: String(notas || '').slice(0, 500),
    items: itemsValidados, total,
    estadoPago: 'Pendiente (pasarela de pago no configurada aún)', estado: 'Recibido'
  };
  data.pedidosTienda.push(pedido);
  await guardarEstadoEmpresa(slug, data);
  res.json({ ok: true, numero: pedido.numero });
});

/* ---------------------------------------------------------
   API — Autenticación (con soporte de contraseña maestra opcional)
--------------------------------------------------------- */
app.post('/api/auth/login', limiteLogin, async (req, res) => {
  const { slug: slugRaw, tipo, tecnicoId, usuario, password } = req.body || {};
  const slug = (slugRaw || '').trim().toLowerCase();
  const data = await leerEstadoEmpresa(slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });

  if (MASTER_PASSWORD && password && password === MASTER_PASSWORD) {
    if (tipo === 'tecnico') {
      const t = (data.tecnicos || []).find(x => x.id === tecnicoId);
      if (!t) return res.status(401).json({ error: 'Técnico no encontrado.' });
      return res.json({ token: crearSesion(slug, 'tecnico', t.id), rol: 'tecnico', tecnicoId: t.id, nombreEmpresa: data.config.nombre });
    }
    return res.json({ token: crearSesion(slug, 'admin', null), rol: 'admin', tecnicoId: null, nombreEmpresa: data.config.nombre });
  }

  if (tipo === 'tecnico') {
    const t = (data.tecnicos || []).find(x => x.id === tecnicoId);
    if (!t || !verificarPassword(password, t.passwordHash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    return res.json({ token: crearSesion(slug, 'tecnico', t.id), rol: 'tecnico', tecnicoId: t.id, nombreEmpresa: data.config.nombre });
  }

  const usuarioOk = usuario && data.config.adminUsuario && usuario.trim().toLowerCase() === data.config.adminUsuario.trim().toLowerCase();
  if (!usuarioOk || !verificarPassword(password, data.config.adminPasswordHash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  res.json({ token: crearSesion(slug, 'admin', null), rol: 'admin', tecnicoId: null, nombreEmpresa: data.config.nombre });
});

/* ---------------------------------------------------------
   API — Estado de la aplicación (protegido, por empresa)
--------------------------------------------------------- */
app.get('/api/state', requireAuth, async (req, res) => {
  const data = await leerEstadoEmpresa(req.slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });
  const tecnicos = (data.tecnicos || []).map(t => ({ id: t.id, nombre: t.nombre, telefono: t.telefono, usuario: t.usuario, password: null }));
  const config = Object.assign({}, data.config, { adminPassword: null });
  delete config.adminPasswordHash;
  res.json(Object.assign({}, data, { tecnicos, config }));
});

app.put('/api/state', requireAuth, async (req, res) => {
  try {
    const anterior = await leerEstadoEmpresa(req.slug);
    if (!anterior) return res.status(404).json({ error: 'Empresa no encontrada.' });
    const nuevo = req.body || {};

    const tecnicosFusionados = (nuevo.tecnicos || []).map(t => {
      const previo = (anterior.tecnicos || []).find(x => x.id === t.id);
      const passwordHash = t.password ? hashPassword(t.password) : (previo ? previo.passwordHash : null);
      return { id: t.id, nombre: t.nombre, telefono: t.telefono, usuario: t.usuario, passwordHash };
    });

    const configNuevo = Object.assign({}, anterior.config, nuevo.config || {});
    configNuevo.adminUsuario = (nuevo.config && nuevo.config.adminUsuario) ? nuevo.config.adminUsuario : anterior.config.adminUsuario;
    configNuevo.adminPasswordHash = (nuevo.config && nuevo.config.adminPassword) ? hashPassword(nuevo.config.adminPassword) : anterior.config.adminPasswordHash;
    delete configNuevo.adminPassword;

    const estadoFinal = Object.assign({}, nuevo, { tecnicos: tecnicosFusionados, config: configNuevo });
    await guardarEstadoEmpresa(req.slug, estadoFinal);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ---------------------------------------------------------
   Arranque: si no hay ninguna empresa creada todavía y vienen
   definidas las variables EMPRESA_SLUG/EMPRESA_NOMBRE/ADMIN_USUARIO/
   ADMIN_PASSWORD, se crea automáticamente la primera vez — así no
   hace falta escribir SQL a mano para el primer usuario admin.
--------------------------------------------------------- */
async function bootstrapEmpresaInicial() {
  const { EMPRESA_SLUG, EMPRESA_NOMBRE, ADMIN_USUARIO, ADMIN_PASSWORD } = process.env;
  const hayAlguna = (await leerEmpresas()).length > 0;
  if (hayAlguna) return;
  if (!EMPRESA_SLUG || !EMPRESA_NOMBRE || !ADMIN_USUARIO || !ADMIN_PASSWORD) {
    console.log('[bootstrap] No hay ninguna empresa creada todavía y faltan variables de entorno (EMPRESA_SLUG / EMPRESA_NOMBRE / ADMIN_USUARIO / ADMIN_PASSWORD) para crearla automáticamente. Créala manualmente con POST /api/empresas.');
    return;
  }
  const slug = EMPRESA_SLUG.trim().toLowerCase();
  const adminPasswordHash = hashPassword(ADMIN_PASSWORD);
  const data = estadoSemilla(EMPRESA_NOMBRE.trim(), ADMIN_USUARIO.trim(), adminPasswordHash);
  await crearEmpresa(slug, EMPRESA_NOMBRE.trim(), data);
  console.log(`[bootstrap] Empresa "${EMPRESA_NOMBRE}" (código: ${slug}) creada automáticamente con su usuario administrador.`);
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
pool.query('SELECT 1')
  .then(() => bootstrapEmpresaInicial())
  .then(() => {
    app.listen(PORT, () => console.log(`Prevenglobal escuchando en el puerto ${PORT}`));
  })
  .catch(err => {
    console.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  });
