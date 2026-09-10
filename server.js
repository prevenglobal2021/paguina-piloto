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
   Sesiones en memoria con recolección de basura automática
--------------------------------------------------------- */
const sesiones = new Map();
function crearSesion(slug, rol, tecnicoId) {
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, { slug, rol, tecnicoId: tecnicoId || null, exp: Date.now() + SESION_HORAS * 3600 * 1000 });
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
/* ---------------------------------------------------------
   API — Panel de Súper-Administrador (multiempresa)
   Todos estos endpoints exigen sesión válida CON rol='superadmin' —
   un administrador normal de una empresa (rol='admin') no puede usarlos,
   aunque conozca la URL.
--------------------------------------------------------- */
function requireSuperadmin(req, res, next) {
  if (req.rol !== 'superadmin') return res.status(403).json({ error: 'Esto solo lo puede hacer un súper-administrador.' });
  next();
}

app.get('/api/superadmin/empresas', requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const empresas = await leerEmpresas();
    const resultado = [];
    for (const e of empresas) {
      const data = await leerEstadoEmpresa(e.slug);
      resultado.push({
        slug: e.slug,
        nombre: e.nombre,
        creadoEn: e.creado_en,
        resumen: data ? contarEntidadesClave(data) : null,
      });
    }
    res.json(resultado);
  } catch (err) {
    console.error('[superadmin] Error al listar empresas:', err);
    res.status(500).json({ error: err.message || 'Error al consultar las empresas.' });
  }
});

// Creación controlada, desde el panel — distinta del registro público en
// POST /api/empresas (que sigue existiendo para el auto-registro normal).
app.post('/api/superadmin/empresas', requireAuth, requireSuperadmin, async (req, res) => {
  const { slug: slugRaw, nombre, adminUsuario, adminPassword } = req.body || {};
  const slug = (slugRaw || '').trim().toLowerCase();
  if (!slug || !nombre || !adminUsuario || !adminPassword) return res.status(400).json({ error: 'Completa todos los campos.' });
  if (!slugValido(slug)) return res.status(400).json({ error: 'El código de empresa solo puede tener letras minúsculas, números y guiones.' });
  if (await empresaExiste(slug)) return res.status(409).json({ error: 'Ya existe una empresa con ese código.' });
  if (adminPassword.length < 4) return res.status(400).json({ error: 'La contraseña del administrador es muy corta.' });
  try {
    const adminPasswordHash = hashPassword(adminPassword);
    const data = estadoSemilla(nombre.trim(), adminUsuario.trim(), adminPasswordHash);
    await crearEmpresa(slug, nombre.trim(), data);
    console.log(`[superadmin] Empresa nueva creada desde el panel: "${slug}".`);
    res.status(201).json({ ok: true, slug });
  } catch (err) {
    console.error('[superadmin] Error al crear empresa:', err);
    res.status(500).json({ error: err.message || 'Error al crear la empresa.' });
  }
});

// "Entrar a administrar" una empresa puntual: genera una sesión de
// administrador real para ESA empresa — a partir de aquí, el súper-admin
// usa exactamente la misma plataforma que cualquier administrador normal.
// Queda registrado en el log del servidor, para trazabilidad.
app.post('/api/superadmin/entrar/:slug', requireAuth, requireSuperadmin, async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const data = await leerEstadoEmpresa(slug);
    if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });
    const token = crearSesion(slug, 'admin', null);
    console.log(`[superadmin] Entrando a administrar la empresa "${slug}".`);
    res.json({ token, rol: 'admin', tecnicoId: null, nombreEmpresa: data.config.nombre, comoSuperadmin: true, slugEmpresa: slug });
  } catch (err) {
    console.error('[superadmin] Error al entrar a la empresa:', err);
    res.status(500).json({ error: err.message || 'Error al entrar a la empresa.' });
  }
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

// Login del súper-administrador — no está atado a ninguna empresa en
// particular. Las credenciales viven SOLO como variables de entorno en
// Railway (SUPERADMIN_USUARIO / SUPERADMIN_PASSWORD), nunca en el código.
app.post('/api/auth/login-superadmin', limiteLogin, async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!process.env.SUPERADMIN_USUARIO || !process.env.SUPERADMIN_PASSWORD) {
    return res.status(503).json({ error: 'El acceso de súper-administrador no está configurado en este servidor.' });
  }
  const usuarioOk = usuario && usuario.trim().toLowerCase() === process.env.SUPERADMIN_USUARIO.trim().toLowerCase();
  if (!usuarioOk || password !== process.env.SUPERADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  res.json({ token: crearSesion(null, 'superadmin', null), rol: 'superadmin' });
});

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
   Recuperación de contraseña por correo
   CORRECCIÓN DE FONDO: antes, los enlaces de recuperación se guardaban
   solo en la memoria del proceso (un Map de JavaScript) — si Railway
   reiniciaba el servidor por cualquier motivo (algo que puede pasar con
   cierta frecuencia en ese tipo de hosting) mientras un enlace estaba
   pendiente, se perdía sin ningún aviso, y la persona recibía un error
   de "enlace no válido" sin entender por qué, aunque lo acabara de
   recibir. Ahora los tokens se guardan en la base de datos, igual que
   todo lo demás — sobreviven un reinicio del servidor sin problema.
--------------------------------------------------------- */
async function asegurarTablaTokensReset() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tokens_reset (
      token TEXT PRIMARY KEY,
      empresa_slug TEXT NOT NULL,
      tipo TEXT NOT NULL,
      tecnico_id INTEGER,
      expira_en TIMESTAMPTZ NOT NULL,
      usado BOOLEAN NOT NULL DEFAULT FALSE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

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
  const expiraEn = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO tokens_reset (token, empresa_slug, tipo, tecnico_id, expira_en) VALUES ($1,$2,$3,$4,$5)`,
    [token, slug, tipo, tecnicoId, expiraEn]
  );
  // Aprovecha para limpiar tokens viejos (vencidos hace más de un día) — no
  // hace falta conservarlos, y así la tabla no crece sin límite.
  pool.query(`DELETE FROM tokens_reset WHERE expira_en < NOW() - INTERVAL '1 day'`).catch(()=>{});
  const transportador = obtenerTransportadorCorreo();
  const enlace = `${process.env.APP_URL || ''}/?resetToken=${token}`;
  if (!transportador) {
    console.log(`[reset] ⚠️ Gmail no está configurado (faltan GMAIL_USER / GMAIL_APP_PASSWORD) — no se envió ningún correo. Enlace de prueba para ${email}: ${enlace}`);
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
    const empresas = await leerEmpresas();
    for (const emp of empresas) {
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

// Diagnóstico simple, solo para administradores: confirma si el correo
// está configurado, sin revelar la contraseña de aplicación — así se puede
// verificar desde la propia plataforma, sin tener que revisar logs.
app.get('/api/auth/estado-correo', requireAuth, (req, res) => {
  res.json({ configurado: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) });
});

app.post('/api/auth/confirmar-reset', limiteLogin, async (req, res) => {
  const { token, nuevaPassword } = req.body || {};
  if (!token || !nuevaPassword) return res.status(400).json({ error: 'Faltan datos.' });
  if (nuevaPassword.length < 4) return res.status(400).json({ error: 'La contraseña es muy corta (mínimo 4 caracteres).' });
  const r = await pool.query('SELECT * FROM tokens_reset WHERE token = $1', [token]);
  const info = r.rows[0];
  if (!info) return res.status(400).json({ error: 'El enlace no es válido.' });
  if (info.usado) return res.status(400).json({ error: 'Este enlace ya fue usado.' });
  if (new Date(info.expira_en).getTime() < Date.now()) {
    await pool.query('DELETE FROM tokens_reset WHERE token = $1', [token]);
    return res.status(400).json({ error: 'El enlace venció. Solicita uno nuevo.' });
  }

  const data = await leerEstadoEmpresa(info.empresa_slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });
  const nuevoHash = hashPassword(nuevaPassword);
  if (info.tipo === 'admin') {
    data.config.adminPasswordHash = nuevoHash;
  } else {
    const t = (data.tecnicos || []).find(x => x.id === info.tecnico_id);
    if (!t) return res.status(404).json({ error: 'Usuario no encontrado.' });
    t.passwordHash = nuevoHash;
  }
  await guardarEstadoEmpresa(info.empresa_slug, data);
  await pool.query('UPDATE tokens_reset SET usado = true WHERE token = $1', [token]);
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
    try{
      await asegurarTablaTokensReset();
    }catch(err){
      console.error('[reset] No se pudo preparar la tabla de recuperación de contraseña — el resto de la plataforma sigue funcionando igual:', err.message);
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
