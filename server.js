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
                        autenticada (sin contraseñas ni hashes).
   PUT  /api/state  -> guarda el estado completo con transacción
                        atómica y bloqueo FOR UPDATE anti-concurrencia.
========================================================= */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const nodemailer = require('nodemailer');

let compression;
try {
  compression = require('compression');
} catch (e) {
  compression = null;
}

const app = express();

app.set('trust proxy', 1);
process.on('unhandledRejection', (err) => {
  console.error('[ERROR NO CONTROLADO — el servidor puede reiniciarse por esto]:', err);
});

if (compression) {
  app.use(compression());
}

app.use(cors());
app.use(express.json({ limit: '80mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => { res.setHeader('Cache-Control', 'no-cache'); }
}));

const urlBaseDatos = process.env.DATABASE_URL || '';
const esBaseLocal = /localhost|127\.0\.0\.1/.test(urlBaseDatos);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : (esBaseLocal ? false : { rejectUnauthorized: false }),
});

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
   Acceso a empresas en Postgres
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
  const r = await pool.query(
    'UPDATE empresas SET estado_app = $1, actualizado_en = now() WHERE slug = $2 RETURNING actualizado_en',
    [JSON.stringify(data), slug]
  );
  return r.rows[0] ? r.rows[0].actualizado_en : null;
}

/* ---------------------------------------------------------
   RESPALDOS AUTOMÁTICOS CON HISTORIAL — antes solo existía el estado
   ACTUAL (más una descarga manual bajo demanda); si algo salía mal no
   había forma de volver atrás en el tiempo. Ahora, cada vez que se
   guarda algo nuevo, primero se archiva una copia del estado anterior
   (como máximo una vez por hora, para no acumular de más), guardando
   así un historial real de los últimos 30 días — restaurable por
   cualquier administrador desde la propia plataforma, sin depender de
   nadie más.
--------------------------------------------------------- */
async function asegurarTablaRespaldos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS respaldos_estado (
      id SERIAL PRIMARY KEY,
      empresa_slug TEXT NOT NULL,
      estado_app JSONB NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_respaldos_empresa_fecha ON respaldos_estado(empresa_slug, creado_en DESC)`);
}
const RESPALDO_INTERVALO_MS = 60 * 60 * 1000; // como máximo un respaldo nuevo por hora
const RESPALDO_RETENCION_DIAS = 30;
// Se llama DENTRO de la misma transacción del guardado, antes de aplicar
// el estado nuevo — archiva el estado ANTERIOR (el que se va a reemplazar),
// solo si ya pasó al menos una hora desde el último respaldo guardado.
async function crearRespaldoSiHaceFalta(client, slug, estadoAnterior) {
  const rUltimo = await client.query(
    `SELECT creado_en FROM respaldos_estado WHERE empresa_slug = $1 ORDER BY creado_en DESC LIMIT 1`,
    [slug]
  );
  const ultimoMs = rUltimo.rows[0] ? new Date(rUltimo.rows[0].creado_en).getTime() : 0;
  if (Date.now() - ultimoMs < RESPALDO_INTERVALO_MS) return; // todavía no ha pasado una hora — no hace falta otro
  await client.query(
    `INSERT INTO respaldos_estado (empresa_slug, estado_app) VALUES ($1, $2)`,
    [slug, estadoAnterior]
  );
  // Poda lo más viejo de 30 días, para que la tabla no crezca sin límite.
  await client.query(
    `DELETE FROM respaldos_estado WHERE empresa_slug = $1 AND creado_en < NOW() - INTERVAL '${RESPALDO_RETENCION_DIAS} days'`,
    [slug]
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
    nomina: [], liquidacionesNomina: [], ingresos: [], gastos: [], controlOperativo: [],
    cotizaciones: [], facturas: [],
    eliminados: {},
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
   Sesiones en memoria con recolección de basura automática
--------------------------------------------------------- */
const sesiones = new Map();
function crearSesion(slug, rol, tecnicoId) {
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, { slug, rol, tecnicoId: tecnicoId || null, exp: Date.now() + SESION_HORAS * 3600 * 1000 });
  return token;
}
function crearSesionSuperAdmin(superAdminId) {
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, { slug: null, rol: 'superadmin', tecnicoId: null, superAdminId, exp: Date.now() + SESION_HORAS * 3600 * 1000 });
  return token;
}

setInterval(() => {
  const ahora = Date.now();
  for (const [token, sesion] of sesiones.entries()) {
    if (sesion.exp < ahora) sesiones.delete(token);
  }
}, 60 * 60 * 1000);

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

// Autenticación exclusiva del panel superadmin (no pertenece a ninguna
// empresa — por eso usa su propio middleware, separado de requireAuth).
function requireSuperAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const sesion = token ? sesiones.get(token) : null;
  if (!sesion || sesion.exp < Date.now()) { if (token) sesiones.delete(token); return res.status(401).json({ error: 'Sesión inválida o expirada.' }); }
  if (sesion.rol !== 'superadmin') return res.status(403).json({ error: 'Esta acción requiere el usuario superadministrador.' });
  req.superAdminId = sesion.superAdminId;
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
    tecnicos: (data.tecnicos || []).map(t => ({ id: t.id, nombre: t.nombre })),
    loginColor1: data.config.loginColor1, loginColor2: data.config.loginColor2,
    loginImagenFondo: data.config.loginImagenFondo,
    loginTituloIzquierda: data.config.loginTituloIzquierda,
    loginSubtituloIzquierda: data.config.loginSubtituloIzquierda,
    loginBienvenidaTitulo: data.config.loginBienvenidaTitulo,
    loginBienvenidaSubtitulo: data.config.loginBienvenidaSubtitulo,
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
  res.status(201).json({ token, rol: 'admin', tecnicoId: null, nombreEmpresa: data.config.nombre, slug });
});

/* ---------------------------------------------------------
   API — Superadministrador (panel multiempresa)
   Rol independiente de cualquier empresa — vive en su propia tabla
   (super_admins), nunca en estado_app. Requiere requireSuperAdmin,
   no requireAuth (evita mezclarse con sesiones de empresa/técnico).
--------------------------------------------------------- */
app.post('/api/superadmin/login', limiteLogin, async (req, res) => {
  const email = ((req.body || {}).email || '').trim().toLowerCase();
  const { password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Usuario o contraseña incorrectos.' });

  const r = await pool.query('SELECT id, password_hash, debe_cambiar_password FROM super_admins WHERE email = $1', [email]);
  const admin = r.rows[0];
  if (!admin || !verificarPassword(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  const token = crearSesionSuperAdmin(admin.id);
  res.json({ token, debeCambiarPassword: admin.debe_cambiar_password });
});

app.post('/api/superadmin/cambiar-password', requireSuperAdmin, async (req, res) => {
  const { nuevaPassword } = req.body || {};
  if (!nuevaPassword || nuevaPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  const nuevoHash = hashPassword(nuevaPassword);
  await pool.query(
    'UPDATE super_admins SET password_hash = $1, debe_cambiar_password = false WHERE id = $2',
    [nuevoHash, req.superAdminId]
  );
  res.json({ ok: true });
});

app.get('/api/superadmin/empresas', requireSuperAdmin, async (req, res) => {
  const r = await pool.query(
    `SELECT slug, nombre, activa, creado_en, actualizado_en FROM empresas ORDER BY creado_en DESC`
  );
  res.json(r.rows);
});

// Detalle de una empresa puntual — usado para precargar el formulario de
// edición (nombre y usuario administrador actuales; nunca la contraseña).
app.get('/api/superadmin/empresas/:slug', requireSuperAdmin, async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const r = await pool.query('SELECT slug, nombre, activa, estado_app FROM empresas WHERE slug = $1', [slug]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Empresa no encontrada.' });
  const fila = r.rows[0];
  res.json({
    slug: fila.slug,
    nombre: fila.nombre,
    activa: fila.activa,
    adminUsuario: (fila.estado_app.config || {}).adminUsuario || ''
  });
});

app.post('/api/superadmin/empresas', requireSuperAdmin, limiteLogin, async (req, res) => {
  const { slug: slugRaw, nombre, adminUsuario, adminPassword } = req.body || {};
  const slug = (slugRaw || '').trim().toLowerCase();
  if (!slug || !nombre || !adminUsuario || !adminPassword) return res.status(400).json({ error: 'Completa todos los campos.' });
  if (!slugValido(slug)) return res.status(400).json({ error: 'El código de empresa solo puede tener letras minúsculas, números y guiones.' });
  if (await empresaExiste(slug)) return res.status(409).json({ error: 'Ya existe una empresa con ese código.' });
  if (adminPassword.length < 4) return res.status(400).json({ error: 'La contraseña del administrador es muy corta.' });

  const adminPasswordHash = hashPassword(adminPassword);
  const data = estadoSemilla(nombre.trim(), adminUsuario.trim(), adminPasswordHash);
  await crearEmpresa(slug, nombre.trim(), data);
  res.status(201).json({ ok: true, slug, nombre: nombre.trim() });
});

// Editar una empresa ya creada: nombre, y opcionalmente el usuario/contraseña
// de SU administrador (para cuando el cliente perdió el acceso y el
// superadmin necesita restablecerlo). La contraseña solo se cambia si llega
// un valor nuevo — dejarla en blanco conserva la actual.
app.patch('/api/superadmin/empresas/:slug', requireSuperAdmin, limiteLogin, async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const { nombre, adminUsuario, adminPassword } = req.body || {};
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' });
  if (!adminUsuario || !adminUsuario.trim()) return res.status(400).json({ error: 'El usuario administrador es obligatorio.' });
  if (adminPassword && adminPassword.length < 4) return res.status(400).json({ error: 'La nueva contraseña es muy corta.' });

  const data = await leerEstadoEmpresa(slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });

  data.config.nombre = nombre.trim();
  data.config.adminUsuario = adminUsuario.trim();
  if (adminPassword) data.config.adminPasswordHash = hashPassword(adminPassword);

  await pool.query(
    'UPDATE empresas SET nombre = $1, estado_app = $2, actualizado_en = now() WHERE slug = $3',
    [nombre.trim(), JSON.stringify(data), slug]
  );
  res.json({ ok: true });
});

app.patch('/api/superadmin/empresas/:slug/activa', requireSuperAdmin, async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const { activa } = req.body || {};
  if (typeof activa !== 'boolean') return res.status(400).json({ error: 'Falta indicar el nuevo estado (activa: true/false).' });
  const r = await pool.query('UPDATE empresas SET activa = $1 WHERE slug = $2 RETURNING slug', [activa, slug]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Empresa no encontrada.' });
  res.json({ ok: true, slug, activa });
});

/* ---------------------------------------------------------
   API — Personalización global de la pantalla de login única
   (compartida por todas las empresas y por el superadmin, ya que se
   ve ANTES de que el sistema sepa quién está entrando). Vive en una
   sola fila de configuracion_login — sin sesión de por medio, la
   lee cualquiera que abra la página de login; solo el superadmin
   puede modificarla.
--------------------------------------------------------- */
app.get('/api/login-config', limitePublico, async (req, res) => {
  const r = await pool.query('SELECT logo, color1, color2, imagen_fondo, nombre_plataforma, titulo_izquierda, subtitulo_izquierda FROM configuracion_login WHERE id = 1');
  const fila = r.rows[0] || {};
  res.json({
    logo: fila.logo || null,
    color1: fila.color1 || '#2563eb',
    color2: fila.color2 || '#1e3a8a',
    imagenFondo: fila.imagen_fondo || null,
    nombrePlataforma: fila.nombre_plataforma || 'Prevenglobal',
    tituloIzquierda: fila.titulo_izquierda || 'Domina el sistema',
    subtituloIzquierda: fila.subtitulo_izquierda || 'Controla clientes, equipos, órdenes de servicio e inventario desde un solo lugar.'
  });
});

app.patch('/api/superadmin/login-config', requireSuperAdmin, async (req, res) => {
  const { logo, color1, color2, imagenFondo, nombrePlataforma, tituloIzquierda, subtituloIzquierda } = req.body || {};
  await pool.query(
    `INSERT INTO configuracion_login (id, logo, color1, color2, imagen_fondo, nombre_plataforma, titulo_izquierda, subtitulo_izquierda, actualizado_en)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (id) DO UPDATE SET
       logo = COALESCE($1, configuracion_login.logo),
       color1 = COALESCE($2, configuracion_login.color1),
       color2 = COALESCE($3, configuracion_login.color2),
       imagen_fondo = COALESCE($4, configuracion_login.imagen_fondo),
       nombre_plataforma = COALESCE($5, configuracion_login.nombre_plataforma),
       titulo_izquierda = COALESCE($6, configuracion_login.titulo_izquierda),
       subtitulo_izquierda = COALESCE($7, configuracion_login.subtitulo_izquierda),
       actualizado_en = now()`,
    [logo || null, color1 || null, color2 || null, imagenFondo || null, nombrePlataforma || null, tituloIzquierda || null, subtituloIzquierda || null]
  );
  res.json({ ok: true });
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
    color: cfg.tiendaColor || '#0088ff', colorFondo: cfg.tiendaColorFondo || '#f1f5f9', imgEstilo: cfg.tiendaImgEstilo || 'cover',
    tamanoTarjeta: cfg.tiendaTamanoTarjeta || 230,
    telefono: cfg.tiendaTelefono || '', whatsapp: cfg.tiendaWhatsapp || '',
    secciones: cfg.tiendaSecciones || { equipo: [], servicios: [], proyectos: [], clientes: [], certificaciones: [] },
    carruselImagenes: cfg.carruselImagenes || [],
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
  const { nombre, telefono, email, notas, items } = req.body || {};
  if (!nombre || !telefono || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Faltan datos del pedido (nombre, teléfono e ítems).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rEmp = await client.query('SELECT estado_app FROM empresas WHERE slug = $1 FOR UPDATE', [slug]);
    if (!rEmp.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tienda no encontrada.' });
    }
    const data = rEmp.rows[0].estado_app;
    data.pedidosTienda = data.pedidosTienda || [];

    const itemsValidados = items.map(li => {
      const prod = (data.inventario || []).find(i => i.id === li.itemId && i.publicarEnTienda);
      if (!prod) return null;
      const cantidad = Math.max(1, Math.min(parseInt(li.cantidad) || 1, prod.stockActual || 0));
      return { itemId: prod.id, nombre: prod.nombre, cantidad, precio: prod.precio || 0 };
    }).filter(Boolean);

    if (!itemsValidados.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ninguno de los productos del pedido está disponible.' });
    }

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

    await client.query(
      'UPDATE empresas SET estado_app = $1, actualizado_en = now() WHERE slug = $2',
      [JSON.stringify(data), slug]
    );
    await client.query('COMMIT');
    res.json({ ok: true, numero: pedido.numero });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[tienda-pedido] Error:', err);
    res.status(500).json({ error: 'Error al procesar el pedido.' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------
   Procesamiento de imágenes (fondo del login)
--------------------------------------------------------- */
async function recortarParaLogin(buffer){
  return sharp(buffer, {
    failOnError: false,
    limitInputPixels: 400000000,
    animated: false,
  })
    .rotate()
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88 })
    .toBuffer();
}

app.post('/api/imagenes/login-fondo', requireAuth, async (req, res) => {
  const { imagenBase64 } = req.body || {};
  if (!imagenBase64) return res.status(400).json({ error: 'No llegó ninguna imagen. Intenta seleccionarla de nuevo.' });
  const coincide = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(imagenBase64);
  if (!coincide) return res.status(400).json({ error: 'Ese archivo no se reconoce como una imagen válida.' });

  let buffer;
  try {
    buffer = Buffer.from(coincide[2], 'base64');
  } catch {
    return res.status(400).json({ error: 'El archivo llegó dañado durante la subida. Intenta de nuevo.' });
  }
  if (!buffer.length) return res.status(400).json({ error: 'El archivo llegó vacío. Intenta seleccionarlo de nuevo.' });
  if (buffer.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'La imagen pesa más de 10MB. Usa una más liviana.' });
  }

  try {
    const procesada = await recortarParaLogin(buffer);
    return res.json({ ok: true, imagen: `data:image/jpeg;base64,${procesada.toString('base64')}` });
  } catch (errSharp) {
    try {
      const jpegIntermedio = await heicConvert({ buffer, format: 'JPEG', quality: 0.92 });
      const procesada = await recortarParaLogin(Buffer.from(jpegIntermedio));
      return res.json({ ok: true, imagen: `data:image/jpeg;base64,${procesada.toString('base64')}` });
    } catch (errHeic) {
      console.error('[login-fondo] sharp:', errSharp.message, '| heic-convert:', errHeic.message);
      let mensaje;
      if (/premature|truncat|unexpected end/i.test(errSharp.message) || /premature|truncat/i.test(errHeic.message)) {
        mensaje = 'El archivo parece estar incompleto o dañado (se cortó al subirlo). Intenta seleccionarlo de nuevo.';
      } else if (/unsupported|no decode|codec|input format/i.test(errSharp.message)) {
        mensaje = 'Ese formato de imagen no es compatible. Prueba con una foto en JPG o PNG.';
      } else {
        mensaje = 'No se pudo procesar esa imagen. Prueba con otra foto en JPG o PNG.';
      }
      return res.status(422).json({ error: mensaje });
    }
  }
});

/* ---------------------------------------------------------
   API — Autenticación
--------------------------------------------------------- */
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) sesiones.delete(token);
  res.json({ ok: true });
});

app.post('/api/auth/login', limiteLogin, async (req, res) => {
  const { tipo, usuario, password } = req.body || {};

  // Login de TÉCNICO: igual que el de administrador, se identifica SOLO
  // por su correo — el sistema busca en todas las empresas activas en
  // cuál está registrado ese técnico (mismo criterio que ya usa la
  // recuperación de contraseña). Antes dependía de un código de empresa +
  // una lista desplegable fija a una sola empresa; con multiempresa eso
  // dejaba fuera a los técnicos de cualquier empresa nueva.
  if (tipo === 'tecnico') {
    const identificador = (usuario || '').trim().toLowerCase();
    if (!identificador || !password) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const rActivas = await pool.query('SELECT slug, estado_app FROM empresas WHERE activa = true');

    if (MASTER_PASSWORD && password === MASTER_PASSWORD) {
      for (const fila of rActivas.rows) {
        const t = (fila.estado_app.tecnicos || []).find(x => (x.usuario || '').trim().toLowerCase() === identificador);
        if (t) return res.json({ token: crearSesion(fila.slug, 'tecnico', t.id), rol: 'tecnico', tecnicoId: t.id, nombreEmpresa: fila.estado_app.config.nombre, slug: fila.slug });
      }
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    for (const fila of rActivas.rows) {
      const t = (fila.estado_app.tecnicos || []).find(x => (x.usuario || '').trim().toLowerCase() === identificador);
      if (t) {
        if (!verificarPassword(password, t.passwordHash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        return res.json({ token: crearSesion(fila.slug, 'tecnico', t.id), rol: 'tecnico', tecnicoId: t.id, nombreEmpresa: fila.estado_app.config.nombre, slug: fila.slug });
      }
    }
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  // Login de ADMINISTRADOR: NO pide código de empresa — el sistema busca,
  // entre todas las empresas activas, en cuál está registrado ese correo
  // (mismo criterio que ya usa la recuperación de contraseña). Si el
  // correo no pertenece a ninguna empresa, se revisa si es el
  // superadministrador de la plataforma antes de rechazar el acceso —
  // así una sola pantalla de login sirve para todos, sin tener que
  // elegir de antemano "soy superadmin" o "soy de tal empresa".
  const identificador = (usuario || '').trim().toLowerCase();
  if (!identificador || !password) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

  const rActivas = await pool.query('SELECT slug, estado_app FROM empresas WHERE activa = true');

  async function intentarLoginSuperAdmin() {
    const r = await pool.query('SELECT id, password_hash, debe_cambiar_password FROM super_admins WHERE email = $1', [identificador]);
    const admin = r.rows[0];
    if (!admin || !verificarPassword(password, admin.password_hash)) return null;
    return { token: crearSesionSuperAdmin(admin.id), rol: 'superadmin', debeCambiarPassword: admin.debe_cambiar_password };
  }

  if (MASTER_PASSWORD && password === MASTER_PASSWORD) {
    const fila = rActivas.rows.find(f => (f.estado_app.config.adminUsuario || '').trim().toLowerCase() === identificador);
    if (fila) return res.json({ token: crearSesion(fila.slug, 'admin', null), rol: 'admin', tecnicoId: null, nombreEmpresa: fila.estado_app.config.nombre, slug: fila.slug });
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  const fila = rActivas.rows.find(f => (f.estado_app.config.adminUsuario || '').trim().toLowerCase() === identificador);
  if (fila) {
    if (!verificarPassword(password, fila.estado_app.config.adminPasswordHash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    return res.json({ token: crearSesion(fila.slug, 'admin', null), rol: 'admin', tecnicoId: null, nombreEmpresa: fila.estado_app.config.nombre, slug: fila.slug });
  }

  const comoSuperAdmin = await intentarLoginSuperAdmin();
  if (comoSuperAdmin) return res.json(comoSuperAdmin);

  return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
});

/* ---------------------------------------------------------
   Recuperación de contraseña por correo
--------------------------------------------------------- */
const tokensReset = new Map();

let transportadorCorreo;
function obtenerTransportadorCorreo() {
  if (transportadorCorreo) return transportadorCorreo;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  transportadorCorreo = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transportadorCorreo;
}

async function enviarCorreoReset(slug, tipo, tecnicoId, email, nombreEmpresa) {
  const token = crypto.randomBytes(32).toString('hex');
  tokensReset.set(token, { slug, tipo, tecnicoId, exp: Date.now() + 60 * 60 * 1000, usado: false });
  const transportador = obtenerTransportadorCorreo();
  const enlace = `${process.env.APP_URL || ''}/?resetToken=${token}`;
  if (!transportador) {
    console.log(`[reset] Gmail no configurado todavía. Enlace de prueba para ${email}: ${enlace}`);
    return;
  }
  try {
    await transportador.sendMail({
      from: `"${nombreEmpresa || 'Prevenglobal'}" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Restablecer tu contraseña — ${nombreEmpresa || 'Prevenglobal'}`,
      html: `<p>Recibimos una solicitud para restablecer tu contraseña en ${nombreEmpresa || 'Prevenglobal'}.</p>
             <p><a href="${enlace}">Haz clic aquí para crear una nueva contraseña</a></p>
             <p>Este enlace vence en 1 hora. Si no lo solicitaste, ignora este correo.</p>`,
    });
  } catch (err) {
    console.error('[reset] No se pudo enviar el correo:', err.message);
  }
}

app.post('/api/auth/solicitar-reset', limiteLogin, async (req, res) => {
  const correo = ((req.body || {}).email || '').trim().toLowerCase();
  const respuesta = { ok: true, mensaje: 'Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña.' };
  if (!correo) return res.json(respuesta);
  try {
    const rActivas = await pool.query('SELECT slug FROM empresas WHERE activa = true');
    for (const fila of rActivas.rows) {
      const emp = fila;
      const data = await leerEstadoEmpresa(emp.slug);
      if (!data) continue;
      if (data.config.adminUsuario && data.config.adminUsuario.trim().toLowerCase() === correo) {
        await enviarCorreoReset(emp.slug, 'admin', null, correo, data.config.nombre);
        return res.json(respuesta);
      }
      const tecnico = (data.tecnicos || []).find(t => t.usuario && t.usuario.trim().toLowerCase() === correo);
      if (tecnico) {
        await enviarCorreoReset(emp.slug, 'tecnico', tecnico.id, correo, data.config.nombre);
        return res.json(respuesta);
      }
    }
  } catch (err) {
    console.error('[reset] Error buscando el correo:', err.message);
  }
  res.json(respuesta);
});

app.post('/api/auth/confirmar-reset', limiteLogin, async (req, res) => {
  const { token, nuevaPassword } = req.body || {};
  if (!token || !nuevaPassword) return res.status(400).json({ error: 'Faltan datos.' });
  if (nuevaPassword.length < 4) return res.status(400).json({ error: 'La contraseña es muy corta (mínimo 4 caracteres).' });
  const info = tokensReset.get(token);
  if (!info) return res.status(400).json({ error: 'El enlace no es válido.' });
  if (info.usado) return res.status(400).json({ error: 'Este enlace ya fue usado.' });
  if (info.exp < Date.now()) { tokensReset.delete(token); return res.status(400).json({ error: 'El enlace venció.' }); }

  const data = await leerEstadoEmpresa(info.slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });
  const nuevoHash = hashPassword(nuevaPassword);
  if (info.tipo === 'admin') {
    data.config.adminPasswordHash = nuevoHash;
  } else {
    const t = (data.tecnicos || []).find(x => x.id === info.tecnicoId);
    if (!t) return res.status(404).json({ error: 'Usuario no encontrado.' });
    t.passwordHash = nuevoHash;
  }
  await guardarEstadoEmpresa(info.slug, data);
  info.usado = true;
  tokensReset.delete(token);
  res.json({ ok: true });
});

/* ---------------------------------------------------------
   API — Estado de la aplicación (protegido, por empresa)
--------------------------------------------------------- */
app.get('/api/backup', requireAuth, async (req, res) => {
  try {
    const estado = await leerEstadoEmpresa(req.slug);
    if (!estado) return res.status(404).json({ error: 'Empresa no encontrada.' });
    const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="respaldo-${req.slug}-${fecha}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(estado, null, 2));
  } catch (err) {
    console.error('[backup] Error:', err);
    res.status(500).json({ error: err.message || 'Error al generar el respaldo.' });
  }
});

// Lista los respaldos automáticos guardados (últimos 30 días) — solo la
// fecha y un pequeño resumen de cada uno, no el contenido completo, para
// que la lista cargue rápido incluso con datos pesados (fotos, etc.).
app.get('/api/backups', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, creado_en, estado_app FROM respaldos_estado WHERE empresa_slug = $1 ORDER BY creado_en DESC LIMIT 200`,
      [req.slug]
    );
    const lista = r.rows.map(fila => ({
      id: fila.id,
      creadoEn: fila.creado_en,
      resumen: contarEntidadesClave(fila.estado_app)
    }));
    res.json(lista);
  } catch (err) {
    console.error('[listar-respaldos] Error:', err);
    res.status(500).json({ error: err.message || 'Error al consultar los respaldos.' });
  }
});

// Restaura un respaldo puntual — solo un administrador puede hacerlo.
// Antes de restaurar, el estado ACTUAL también queda guardado como
// respaldo (aunque no haya pasado la hora habitual), para poder deshacer
// la restauración si hiciera falta — nunca se sobrescribe sin dejar rastro.
app.post('/api/restaurar/:id', requireAuth, async (req, res) => {
  if (req.rol !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede restaurar un respaldo.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rRespaldo = await client.query(
      `SELECT estado_app, creado_en FROM respaldos_estado WHERE id = $1 AND empresa_slug = $2`,
      [req.params.id, req.slug]
    );
    if (!rRespaldo.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ese respaldo no existe.' });
    }
    const rActual = await client.query('SELECT estado_app FROM empresas WHERE slug = $1 FOR UPDATE', [req.slug]);
    if (!rActual.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }
    // Respaldo de seguridad del estado actual, previo a restaurar.
    await client.query(
      `INSERT INTO respaldos_estado (empresa_slug, estado_app) VALUES ($1, $2)`,
      [req.slug, rActual.rows[0].estado_app]
    );
    await client.query(
      `UPDATE empresas SET estado_app = $1, actualizado_en = NOW() WHERE slug = $2`,
      [rRespaldo.rows[0].estado_app, req.slug]
    );
    await client.query('COMMIT');
    console.log(`[restaurar] Empresa=${req.slug} restaurada al respaldo #${req.params.id} (de ${rRespaldo.rows[0].creado_en})`);
    res.json({ ok: true, mensaje: 'Restauración completada. El estado de justo antes de esta restauración también quedó guardado como respaldo, por si hace falta deshacerla.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[restaurar] Error:', err);
    res.status(500).json({ error: err.message || 'Error al restaurar el respaldo.' });
  } finally {
    client.release();
  }
});

app.get('/api/state/meta', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT actualizado_en FROM empresas WHERE slug = $1', [req.slug]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.json({ actualizadoEn: r.rows[0].actualizado_en });
  } catch (err) {
    console.error('[state-meta] Error:', err);
    res.status(500).json({ error: err.message || 'Error al consultar.' });
  }
});

app.get('/api/state', requireAuth, async (req, res) => {
  const data = await leerEstadoEmpresa(req.slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });
  
  const tecnicos = (data.tecnicos || []).map(t => {
    const seguro = Object.assign({}, t, { password: null });
    delete seguro.passwordHash;
    return seguro;
  });

  const config = Object.assign({}, data.config, { adminPassword: null });
  delete config.adminPasswordHash;

  res.json(Object.assign({}, data, { tecnicos, config }));
});

function contarEntidadesClave(estado) {
  const clientes = (estado.clientes || []).length;
  const ordenes = (estado.ordenes || []).length;
  const inventario = (estado.inventario || []).length;
  const plantillas = (estado.plantillas || []).length;
  const nomina = (estado.liquidacionesNomina || []).length;
  const asistencias = (estado.asistencias || []).length;
  return { clientes, ordenes, inventario, plantillas, nomina, asistencias, total: clientes + ordenes + inventario + plantillas + nomina + asistencias };
}

app.put('/api/state', requireAuth, async (req, res) => {
  const inicio = Date.now();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rEmp = await client.query('SELECT estado_app FROM empresas WHERE slug = $1 FOR UPDATE', [req.slug]);
    if (!rEmp.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa no encontrada.' });
    }

    const anterior = rEmp.rows[0].estado_app;
    const nuevo = req.body || {};
    const pesoKB = Math.round(JSON.stringify(nuevo).length / 1024);
    const cantidadOrdenes = (nuevo.ordenes || []).length;
    console.log(`[guardar-state] recibido: ${pesoKB} KB, ${cantidadOrdenes} órdenes, empresa=${req.slug}`);

    const conteoAnterior = contarEntidadesClave(anterior);
    const conteoNuevo = contarEntidadesClave(nuevo);
    const UMBRAL_MINIMO_PARA_VIGILAR = 5;
    const perdidaSevera = conteoAnterior.total >= UMBRAL_MINIMO_PARA_VIGILAR && conteoNuevo.total < conteoAnterior.total * 0.5;
    if (perdidaSevera && !nuevo.confirmarSobrescritura) {
      await client.query('ROLLBACK');
      console.warn(`[guardar-state] BLOQUEADO por posible pérdida de datos — empresa=${req.slug}`);
      return res.status(409).json({
        ok: false,
        posiblePerdidaDatos: true,
        error: `Este guardado tiene muchos menos registros de los que ya había (antes: ${conteoAnterior.total}, ahora: ${conteoNuevo.total}).`,
        conteoAnterior, conteoNuevo
      });
    }

    // Respaldo automático del estado ANTERIOR, antes de reemplazarlo — como
    // máximo uno por hora (ver crearRespaldoSiHaceFalta). Si esto llegara a
    // fallar por cualquier motivo, no debe impedir el guardado real: se
    // registra el problema y se continúa igual.
    try {
      await crearRespaldoSiHaceFalta(client, req.slug, anterior);
    } catch (errRespaldo) {
      console.error('[respaldo automático] No se pudo crear (el guardado continúa igual):', errRespaldo.message);
    }

    const tecnicosFusionados = (nuevo.tecnicos || []).map(t => {
      const previo = (anterior.tecnicos || []).find(x => x.id === t.id);
      const passwordHash = t.password ? hashPassword(t.password) : (previo ? previo.passwordHash : null);
      const fusionado = Object.assign({}, previo, t, { passwordHash });
      delete fusionado.password;
      return fusionado;
    });

    const configNuevo = Object.assign({}, anterior.config, nuevo.config || {});
    configNuevo.adminUsuario = (nuevo.config && nuevo.config.adminUsuario) ? nuevo.config.adminUsuario : anterior.config.adminUsuario;
    configNuevo.adminPasswordHash = (nuevo.config && nuevo.config.adminPassword) ? hashPassword(nuevo.config.adminPassword) : anterior.config.adminPasswordHash;
    delete configNuevo.adminPassword;

    const estadoFinal = Object.assign({}, nuevo, { tecnicos: tecnicosFusionados, config: configNuevo });
    delete estadoFinal.confirmarSobrescritura;

    const rUpdate = await client.query(
      'UPDATE empresas SET estado_app = $1, actualizado_en = now() WHERE slug = $2 RETURNING actualizado_en',
      [JSON.stringify(estadoFinal), req.slug]
    );

    await client.query('COMMIT');
    const actualizadoEn = rUpdate.rows[0] ? rUpdate.rows[0].actualizado_en : new Date().toISOString();
    console.log(`[guardar-state] OK en ${Date.now() - inicio}ms — empresa=${req.slug}`);
    res.json({ ok: true, actualizadoEn });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[guardar-state] FALLÓ tras ${Date.now() - inicio}ms — empresa=${req.slug}:`, err);
    res.status(500).json({ ok: false, error: err.message || 'Error desconocido al guardar.' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------
   Arranque y Bootstrap
--------------------------------------------------------- */
async function bootstrapEmpresaInicial() {
  const { EMPRESA_SLUG, EMPRESA_NOMBRE, ADMIN_USUARIO, ADMIN_PASSWORD } = process.env;
  const hayAlguna = (await leerEmpresas()).length > 0;
  if (hayAlguna) return;
  if (!EMPRESA_SLUG || !EMPRESA_NOMBRE || !ADMIN_USUARIO || !ADMIN_PASSWORD) return;
  const slug = EMPRESA_SLUG.trim().toLowerCase();
  const adminPasswordHash = hashPassword(ADMIN_PASSWORD);
  const data = estadoSemilla(EMPRESA_NOMBRE.trim(), ADMIN_USUARIO.trim(), adminPasswordHash);
  await crearEmpresa(slug, EMPRESA_NOMBRE.trim(), data);
  console.log(`[bootstrap] Empresa "${EMPRESA_NOMBRE}" (código: ${slug}) inicializada.`);
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(`[error-no-atrapado] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Error inesperado en el servidor.' });
});

const PORT = process.env.PORT || 8080;
pool.query('SELECT 1')
  .then(async () => {
    // Si esto falla (por ejemplo, por permisos insuficientes en la base de
    // datos), NUNCA debe impedir que el resto de la plataforma funcione —
    // solo se pierde el panel de respaldos automáticos, nada más grave.
    try{
      await asegurarTablaRespaldos();
    }catch(err){
      console.error('[respaldos] No se pudo preparar la tabla de respaldos — la plataforma sigue funcionando igual, sin este panel por ahora:', err.message);
    }
  })
  .then(() => bootstrapEmpresaInicial())
  .then(() => {
    app.listen(PORT, () => console.log(`Prevenglobal escuchando en el puerto ${PORT}`));
  })
  .catch(err => {
    console.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  });
