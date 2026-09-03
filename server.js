/* =========================================================
   PREVENGLOBAL — BACKEND (Node.js + Express + PostgreSQL)
   ---------------------------------------------------------
   Sincronización con el front-end y motor de recordatorios
   automáticos por correo para técnicos.
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
  console.error('[ERROR NO CONTROLADO]:', err);
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
   Utilidades de contraseñas
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
   Sesiones en memoria
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
   API — Tienda pública
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
    return res.status(400).json({ error: 'Faltan datos del pedido.' });
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
      return res.status(400).json({ error: 'Ninguno de los productos está disponible.' });
    }

    const total = itemsValidados.reduce((a, i) => a + (i.precio * i.cantidad), 0);
    const pedido = {
      id: Date.now(), numero: 'PED-' + String(data.pedidosTienda.length + 1).padStart(4, '0'),
      fecha: new Date().toISOString(),
      nombre: String(nombre).slice(0, 120), telefono: String(telefono).slice(0, 40),
      email: String(email || '').slice(0, 120), notas: String(notas || '').slice(0, 500),
      items: itemsValidados, total,
      estadoPago: 'Pendiente', estado: 'Recibido'
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
    res.status(500).json({ error: 'Error al procesar pedido.' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------
   Procesamiento de imágenes
--------------------------------------------------------- */
async function recortarParaLogin(buffer){
  return sharp(buffer, { failOnError: false, limitInputPixels: 400000000, animated: false })
    .rotate()
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88 })
    .toBuffer();
}

app.post('/api/imagenes/login-fondo', requireAuth, async (req, res) => {
  const { imagenBase64 } = req.body || {};
  if (!imagenBase64) return res.status(400).json({ error: 'No llegó ninguna imagen.' });
  const coincide = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(imagenBase64);
  if (!coincide) return res.status(400).json({ error: 'Archivo no válido.' });

  let buffer;
  try { buffer = Buffer.from(coincide[2], 'base64'); } catch { return res.status(400).json({ error: 'Archivo dañado.' }); }
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Imagen no válida o supera los 10MB.' });

  try {
    const procesada = await recortarParaLogin(buffer);
    return res.json({ ok: true, imagen: `data:image/jpeg;base64,${procesada.toString('base64')}` });
  } catch (errSharp) {
    try {
      const jpegIntermedio = await heicConvert({ buffer, format: 'JPEG', quality: 0.92 });
      const procesada = await recortarParaLogin(Buffer.from(jpegIntermedio));
      return res.json({ ok: true, imagen: `data:image/jpeg;base64,${procesada.toString('base64')}` });
    } catch (errHeic) {
      return res.status(422).json({ error: 'No se pudo procesar la imagen.' });
    }
  }
});

/* ---------------------------------------------------------
   Autenticación y recuperación de clave
--------------------------------------------------------- */
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) sesiones.delete(token);
  res.json({ ok: true });
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
    if (!t || !verificarPassword(password, t.passwordHash)) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    return res.json({ token: crearSesion(slug, 'tecnico', t.id), rol: 'tecnico', tecnicoId: t.id, nombreEmpresa: data.config.nombre });
  }

  const usuarioOk = usuario && data.config.adminUsuario && usuario.trim().toLowerCase() === data.config.adminUsuario.trim().toLowerCase();
  if (!usuarioOk || !verificarPassword(password, data.config.adminPasswordHash)) return res.status(401).json({ error: 'Credenciales incorrectas.' });
  res.json({ token: crearSesion(slug, 'admin', null), rol: 'admin', tecnicoId: null, nombreEmpresa: data.config.nombre });
});

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

const tokensReset = new Map();
async function enviarCorreoReset(slug, tipo, tecnicoId, email, nombreEmpresa) {
  const token = crypto.randomBytes(32).toString('hex');
  tokensReset.set(token, { slug, tipo, tecnicoId, exp: Date.now() + 60 * 60 * 1000, usado: false });
  const transportador = obtenerTransportadorCorreo();
  const enlace = `${process.env.APP_URL || ''}/?resetToken=${token}`;
  if (!transportador) return;
  try {
    await transportador.sendMail({
      from: `"${nombreEmpresa || 'Prevenglobal'}" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Restablecer contraseña — ${nombreEmpresa || 'Prevenglobal'}`,
      html: `<p>Solicitud para restablecer tu contraseña en ${nombreEmpresa || 'Prevenglobal'}.</p><p><a href="${enlace}">Crear nueva contraseña</a></p>`,
    });
  } catch (err) {
    console.error('[reset] Error enviando correo:', err.message);
  }
}

app.post('/api/auth/solicitar-reset', limiteLogin, async (req, res) => {
  const correo = ((req.body || {}).email || '').trim().toLowerCase();
  const respuesta = { ok: true, mensaje: 'Si el correo está registrado, te enviamos un enlace.' };
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
    console.error('[reset] Error:', err.message);
  }
  res.json(respuesta);
});

app.post('/api/auth/confirmar-reset', limiteLogin, async (req, res) => {
  const { token, nuevaPassword } = req.body || {};
  if (!token || !nuevaPassword) return res.status(400).json({ error: 'Faltan datos.' });
  const info = tokensReset.get(token);
  if (!info || info.usado || info.exp < Date.now()) return res.status(400).json({ error: 'Enlace inválido o vencido.' });

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
   API — Estado de la aplicación
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
    res.status(500).json({ error: 'Error al generar respaldo.' });
  }
});

app.get('/api/state/meta', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT actualizado_en FROM empresas WHERE slug = $1', [req.slug]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.json({ actualizadoEn: r.rows[0].actualizado_en });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar.' });
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
  return {
    clientes: (estado.clientes || []).length,
    ordenes: (estado.ordenes || []).length,
    inventario: (estado.inventario || []).length,
    plantillas: (estado.plantillas || []).length,
    nomina: (estado.liquidacionesNomina || []).length,
    total: ((estado.clientes || []).length + (estado.ordenes || []).length + (estado.inventario || []).length + (estado.plantillas || []).length + (estado.liquidacionesNomina || []).length)
  };
}

app.put('/api/state', requireAuth, async (req, res) => {
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

    const conteoAnterior = contarEntidadesClave(anterior);
    const conteoNuevo = contarEntidadesClave(nuevo);
    if (conteoAnterior.total >= 5 && conteoNuevo.total < conteoAnterior.total * 0.5 && !nuevo.confirmarSobrescritura) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        ok: false,
        posiblePerdidaDatos: true,
        error: `El guardado tiene muchos menos registros de los esperados.`,
        conteoAnterior, conteoNuevo
      });
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
    res.json({ ok: true, actualizadoEn: rUpdate.rows[0].actualizado_en });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, error: err.message || 'Error al guardar.' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------
   MOTOR DE RECORDATORIOS AUTOMÁTICOS POR CORREO
   Revisa cada 3 minutos si hay órdenes a 15-35 minutos de su cita.
--------------------------------------------------------- */
async function procesarRecordatoriosOrdenes() {
  try {
    const empresas = await leerEmpresas();
    const ahora = new Date();

    for (const emp of empresas) {
      const data = await leerEstadoEmpresa(emp.slug);
      if (!data || !Array.isArray(data.ordenes)) continue;

      let huboNotificaciones = false;

      for (const o of data.ordenes) {
        if (o.estado === 'Finalizado' || !o.tecnicoId || !o.fechaProgramada || !o.horaProgramada) continue;
        if (o.recordatorioAutomaticoEnviado) continue;

        const [horas, minutos] = o.horaProgramada.split(':').map(Number);
        const fechaHoraCita = new Date(`${o.fechaProgramada}T00:00:00`);
        fechaHoraCita.setHours(horas, minutos, 0, 0);

        const diferenciaMs = fechaHoraCita.getTime() - ahora.getTime();
        const minutosFaltantes = Math.round(diferenciaMs / 60000);

        // Envío automático si faltan entre 15 y 35 minutos
        if (minutosFaltantes >= 15 && minutosFaltantes <= 35) {
          const tec = (data.tecnicos || []).find(t => t.id === o.tecnicoId);
          if (!tec || !tec.usuario || !tec.usuario.includes('@')) continue;

          const cliente = (data.clientes || []).find(c => c.id === o.clienteId);
          const nombreCliente = o.esClienteNuevo ? (o.clienteNuevoNombre || 'Cliente nuevo') : (cliente ? cliente.nombre : 'Cliente');
          
          let direccion = 'Sin dirección';
          if (o.esClienteNuevo) {
            direccion = o.clienteNuevoDireccion || 'No especificada';
          } else if (cliente) {
            const sede = (cliente.sedes || []).find(s => s.id === o.sedeId);
            direccion = (sede && sede.direccion) ? sede.direccion : (cliente.direccion || 'Sin dirección');
          }

          const transportador = obtenerTransportadorCorreo();
          if (transportador) {
            try {
              await transportador.sendMail({
                from: `"${data.config.nombre || 'Prevenglobal'}" <${process.env.GMAIL_USER}>`,
                to: tec.usuario,
                subject: `⏰ RECORDATORIO: Visita en ${minutosFaltantes} minutos — Orden ${o.numero}`,
                html: `
                  <div style="font-family:sans-serif;padding:18px;color:#1e293b;max-width:550px;border:1px solid #e2e8f0;border-radius:10px;">
                    <h3 style="color:#0284c7;margin-top:0;">Recordatorio de Servicio Operativo</h3>
                    <p>Hola <strong>${tec.nombre}</strong>, tu próximo servicio está programado para iniciar en aproximadamente <strong>${minutosFaltantes} minutos</strong>.</p>
                    <table style="width:100%;border-collapse:collapse;margin:15px 0;">
                      <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;"><strong>Orden:</strong></td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${o.numero}</td></tr>
                      <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;"><strong>Servicio:</strong></td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${o.tipo} (${o.prioridad})</td></tr>
                      <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;"><strong>Cliente:</strong></td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${nombreCliente}</td></tr>
                      <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;"><strong>Dirección:</strong></td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${direccion}</td></tr>
                      <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;"><strong>Hora pactada:</strong></td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${o.horaProgramada}</td></tr>
                    </table>
                    ${o.notas ? `<p style="background:#f8fafc;padding:8px;border-radius:6px;"><strong>Notas:</strong> ${o.notas}</p>` : ''}
                    <p style="color:#64748b;font-size:12px;margin-bottom:0;">Por favor preséntate puntualmente con tus herramientas y EPP reglamentarios.</p>
                  </div>
                `
              });
              console.log(`[recordatorio-correo] Notificación enviada a ${tec.nombre} (${tec.usuario}) para orden ${o.numero}`);
            } catch (errCorreo) {
              console.error(`[recordatorio-correo] Error enviando a ${tec.usuario}:`, errCorreo.message);
            }
          }

          data.logs = data.logs || [];
          data.logs.push({
            id: Date.now() + Math.random(),
            usuario: 'Sistema Automático',
            rol: 'sistema',
            accion: 'Recordatorio Correo',
            entidad: 'OrdenServicio',
            detalle: `Enviado a ${tec.nombre} (${o.numero}) a ${minutosFaltantes} min de la cita`,
            timestamp: new Date().toISOString()
          });

          o.recordatorioAutomaticoEnviado = true;
          o.fechaHoraRecordatorioEnviado = new Date().toISOString();
          huboNotificaciones = true;
        }
      }

      if (huboNotificaciones) {
        await guardarEstadoEmpresa(emp.slug, data);
      }
    }
  } catch (err) {
    console.error('[recordatorio-correo] Error en el ciclo:', err.message);
  }
}

setInterval(procesarRecordatoriosOrdenes, 3 * 60 * 1000);

/* ---------------------------------------------------------
   Arranque y Servidor
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
  console.log(`[bootstrap] Empresa "${EMPRESA_NOMBRE}" creada.`);
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Error inesperado.' });
});

const PORT = process.env.PORT || 8080;
pool.query('SELECT 1')
  .then(() => bootstrapEmpresaInicial())
  .then(() => {
    app.listen(PORT, () => console.log(`Prevenglobal escuchando en el puerto ${PORT} — recordatorios automáticos por correo activos`));
  })
  .catch(err => {
    console.error('No se pudo conectar a PostgreSQL:', err.message);
    process.exit(1);
  });
