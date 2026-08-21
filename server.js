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
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const nodemailer = require('nodemailer');

const app = express();
// Railway (como casi toda la nube) pone el servidor detrás de un proxy, que agrega
// el encabezado X-Forwarded-For a cada petición. Sin esta línea, Express no confía
// en ese encabezado, y "express-rate-limit" (usado en login y recuperación de clave)
// lo rechaza con un error que en Node 22 tumba TODO el proceso del servidor — no solo
// esa petición. Mientras se reinicia, cualquier otra cosa falla también (por ejemplo,
// subir la imagen del login), aunque el problema real nunca fue la imagen.
app.set('trust proxy', 1);
process.on('unhandledRejection', (err) => {
  console.error('[ERROR NO CONTROLADO — el servidor puede reiniciarse por esto]:', err);
});
app.use(cors());
app.use(express.json({ limit: '80mb' })); // las fotos van como base64 y pueden pesar
app.use(express.static(path.join(__dirname, 'public'), {
  // Sin esto, algunos navegadores (sobre todo en celular) pueden quedarse con una
  // copia vieja en caché de los .js/.html incluso después de subir una versión
  // nueva al repositorio — dando la sensación de que "el código no cambió" cuando
  // en realidad sí cambió, solo que el navegador nunca fue a buscar la copia nueva.
  // setHeaders obliga a revalidar con el servidor en cada carga, sin desactivar el
  // caché del todo (los archivos que no cambiaron responden con 304, rápido igual).
  setHeaders: (res) => { res.setHeader('Cache-Control', 'no-cache'); }
}));

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
   Procesamiento de imágenes (fondo del login) — se recibe la
   imagen tal cual la subió el usuario y se devuelve ya recortada
   y redimensionada a 1080x1920 (vertical, 9:16), sin dejarlo en
   manos del navegador ni del usuario.
--------------------------------------------------------- */
// Recorta/redimensiona a 1080x1920 (vertical), corrigiendo orientación EXIF sola.
async function recortarParaLogin(buffer){
  return sharp(buffer, {
    failOnError: false,          // tolera imágenes con pequeñas imperfecciones en vez de rechazarlas de una
    limitInputPixels: 400000000, // permite fotos de muy alta resolución (celulares modernos, hasta ~400MP)
    animated: false,             // si es un formato con varios cuadros, usa solo el primero
  })
    .rotate() // corrige sola la orientación según los metadatos EXIF (fotos de celular a veces vienen "giradas")
    .resize(1080, 1920, { fit: 'cover', position: 'centre' }) // recorte centrado, sin deformar
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

  // Paso 1: se intenta directo con sharp (cubre JPG, PNG, WEBP, y algunos HEIC si el
  // servidor lo soporta de forma nativa).
  try {
    const procesada = await recortarParaLogin(buffer);
    return res.json({ ok: true, imagen: `data:image/jpeg;base64,${procesada.toString('base64')}` });
  } catch (errSharp) {
    // Paso 2: si falló, puede ser un HEIC/HEIF que el servidor no decodifica de forma
    // nativa — se convierte explícitamente a JPG con heic-convert antes de recortar,
    // en vez de pedirle al usuario que lo convierta él mismo.
    try {
      const jpegIntermedio = await heicConvert({ buffer, format: 'JPEG', quality: 0.92 });
      const procesada = await recortarParaLogin(Buffer.from(jpegIntermedio));
      return res.json({ ok: true, imagen: `data:image/jpeg;base64,${procesada.toString('base64')}` });
    } catch (errHeic) {
      console.error('[login-fondo] sharp:', errSharp.message, '| heic-convert:', errHeic.message);
      // Mensaje específico según lo que realmente pasó, no uno genérico.
      let mensaje;
      if (/premature|truncat|unexpected end/i.test(errSharp.message) || /premature|truncat/i.test(errHeic.message)) {
        mensaje = 'El archivo parece estar incompleto o dañado (se cortó al subirlo). Intenta seleccionarlo de nuevo.';
      } else if (/unsupported|no decode|codec|input format/i.test(errSharp.message)) {
        mensaje = 'Ese formato de imagen no es compatible, ni siquiera con la conversión automática. Prueba con una foto en JPG o PNG.';
      } else {
        mensaje = 'No se pudo procesar esa imagen. Prueba con otra foto, o convirtiéndola a JPG con cualquier app de tu celular.';
      }
      return res.status(422).json({ error: mensaje });
    }
  }
});

/* ---------------------------------------------------------
   API — Autenticación (con soporte de contraseña maestra opcional)
--------------------------------------------------------- */
app.post('/api/auth/logout', requireAuth, (req, res) => {
  // requireAuth ya validó que el token existía; aquí lo borramos de verdad
  // del servidor, para que ese token deje de servir de inmediato (antes solo
  // se "olvidaba" en el navegador, pero seguía siendo válido hasta 12h).
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
    if (!t || !verificarPassword(password, t.passwordHash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    return res.json({ token: crearSesion(slug, 'tecnico', t.id), rol: 'tecnico', tecnicoId: t.id, nombreEmpresa: data.config.nombre });
  }

  const usuarioOk = usuario && data.config.adminUsuario && usuario.trim().toLowerCase() === data.config.adminUsuario.trim().toLowerCase();
  if (!usuarioOk || !verificarPassword(password, data.config.adminPasswordHash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  res.json({ token: crearSesion(slug, 'admin', null), rol: 'admin', tecnicoId: null, nombreEmpresa: data.config.nombre });
});

/* ---------------------------------------------------------
   Recuperación de contraseña por correo (Gmail vía Nodemailer)
--------------------------------------------------------- */
const tokensReset = new Map(); // token -> {slug, tipo:'admin'|'tecnico', tecnicoId, exp, usado}

let transportadorCorreo; // se arma una sola vez y se reutiliza
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
    // Sin GMAIL_USER/GMAIL_APP_PASSWORD configurados: no se puede enviar el
    // correo real, pero se deja registro para que igual puedas probar el
    // flujo completo copiando el enlace manualmente mientras configuras Gmail.
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
             <p>Este enlace vence en 1 hora. Si tú no solicitaste esto, ignora este correo — tu contraseña actual sigue funcionando igual.</p>`,
    });
  } catch (err) {
    console.error('[reset] No se pudo enviar el correo:', err.message);
  }
}

app.post('/api/auth/solicitar-reset', limiteLogin, async (req, res) => {
  const correo = ((req.body || {}).email || '').trim().toLowerCase();
  // La respuesta es siempre la misma exista o no ese correo — así nadie puede
  // usar este formulario para averiguar qué correos están registrados.
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

app.post('/api/auth/confirmar-reset', limiteLogin, async (req, res) => {
  const { token, nuevaPassword } = req.body || {};
  if (!token || !nuevaPassword) return res.status(400).json({ error: 'Faltan datos.' });
  if (nuevaPassword.length < 4) return res.status(400).json({ error: 'La contraseña es muy corta (mínimo 4 caracteres).' });
  const info = tokensReset.get(token);
  if (!info) return res.status(400).json({ error: 'El enlace no es válido.' });
  if (info.usado) return res.status(400).json({ error: 'Este enlace ya fue usado. Solicita uno nuevo si necesitas cambiar la contraseña otra vez.' });
  if (info.exp < Date.now()) { tokensReset.delete(token); return res.status(400).json({ error: 'El enlace venció (duran 1 hora). Solicita uno nuevo.' }); }

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
// Endpoint liviano: solo dice CUÁNDO fue el último cambio guardado (unos
// bytes), sin bajar toda la información. Se usa para revisar frecuentemente
// "¿cambió algo?" sin gastar ancho de banda — solo si la respuesta indica
// que sí cambió, el frontend pide entonces el estado completo con /api/state.
app.get('/api/state/meta', requireAuth, async (req, res) => {
  try{
    const r = await pool.query('SELECT actualizado_en FROM empresas WHERE slug = $1', [req.slug]);
    if(!r.rows[0]) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.json({ actualizadoEn: r.rows[0].actualizado_en });
  }catch(err){
    console.error('[state-meta] Error:', err);
    res.status(500).json({ error: err.message || 'Error al consultar.' });
  }
});
app.get('/api/state', requireAuth, async (req, res) => {
  const data = await leerEstadoEmpresa(req.slug);
  if (!data) return res.status(404).json({ error: 'Empresa no encontrada.' });
  const tecnicos = (data.tecnicos || []).map(t => ({ id: t.id, nombre: t.nombre, telefono: t.telefono, usuario: t.usuario, password: null }));
  const config = Object.assign({}, data.config, { adminPassword: null });
  delete config.adminPasswordHash;
  res.json(Object.assign({}, data, { tecnicos, config }));
});

app.put('/api/state', requireAuth, async (req, res) => {
  // --- Registro temporal de diagnóstico: se puede quitar más adelante,
  // pero por ahora ayuda a ver EXACTAMENTE qué está pasando con cada
  // guardado (tamaño recibido, cantidad de órdenes/fotos, y el resultado). ---
  const inicio = Date.now();
  try {
    const anterior = await leerEstadoEmpresa(req.slug);
    if (!anterior) return res.status(404).json({ error: 'Empresa no encontrada.' });
    const nuevo = req.body || {};
    const pesoKB = Math.round(JSON.stringify(nuevo).length / 1024);
    const cantidadOrdenes = (nuevo.ordenes || []).length;
    console.log(`[guardar-state] recibido: ${pesoKB} KB, ${cantidadOrdenes} órdenes, empresa=${req.slug}`);

    const tecnicosFusionados = (nuevo.tecnicos || []).map(t => {
      const previo = (anterior.tecnicos || []).find(x => x.id === t.id);
      const passwordHash = t.password ? hashPassword(t.password) : (previo ? previo.passwordHash : null);
      // Antes, esta reconstrucción solo conservaba id/nombre/telefono/usuario/
      // passwordHash — cualquier otro campo (activo, rol, accesoTotal, permisos)
      // se perdía en SILENCIO cada vez que se guardaba CUALQUIER cosa en la
      // plataforma, no solo al editar Personal. Ahora se conserva todo lo que
      // ya traía el registro, y solo se actualiza lo que de verdad cambió.
      const fusionado = Object.assign({}, previo, t, { passwordHash });
      delete fusionado.password; // nunca debe quedar la clave en texto plano guardada
      return fusionado;
    });

    const configNuevo = Object.assign({}, anterior.config, nuevo.config || {});
    configNuevo.adminUsuario = (nuevo.config && nuevo.config.adminUsuario) ? nuevo.config.adminUsuario : anterior.config.adminUsuario;
    configNuevo.adminPasswordHash = (nuevo.config && nuevo.config.adminPassword) ? hashPassword(nuevo.config.adminPassword) : anterior.config.adminPasswordHash;
    delete configNuevo.adminPassword;

    const estadoFinal = Object.assign({}, nuevo, { tecnicos: tecnicosFusionados, config: configNuevo });
    const actualizadoEn = await guardarEstadoEmpresa(req.slug, estadoFinal);
    console.log(`[guardar-state] OK en ${Date.now()-inicio}ms — empresa=${req.slug}`);
    res.json({ ok: true, actualizadoEn });
  } catch (err) {
    console.error(`[guardar-state] FALLÓ tras ${Date.now()-inicio}ms — empresa=${req.slug}:`, err);
    res.status(500).json({ ok: false, error: err.message || 'Error desconocido al guardar.' });
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

// Red de seguridad final: si algo revienta ANTES de llegar a la función de
// guardado correspondiente (por ejemplo, al leer el cuerpo de una petición
// muy pesada), esto lo atrapa, lo deja registrado con detalle, y le devuelve
// al usuario un mensaje real en vez de dejarlo sin ninguna respuesta.
app.use((err, req, res, next) => {
  console.error(`[error-no-atrapado] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Error inesperado en el servidor.' });
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
