// ===== core.js — Capa de datos, Sincronización, Dashboard Fijo y Acceso Seguro =====
/* =========================================================
   CATÁLOGO FIJO E INAMOVIBLE DE COLORES DE LA DASHBOARD
========================================================= */
const TEMA_DASHBOARD_FIJO = {
  nombre: 'Titanio Plateado',
  clave: 'titanio',
  acento: '#0284c7',
  fondo: '#f1f5f9',
  sidebar1: '#e2e8f0', sidebar2: '#cbd5e1',
  topbar1: '#f8fafc', topbar2: '#e2e8f0',
  panel1: '#ffffff', panel2: '#f8fafc',
  borde: '#94a3b8', texto: '#0f172a'
};

function ocultarSkeletonBoot() {
  const el = document.getElementById('skeletonBoot');
  if (el) el.style.display = 'none';
}

function aplicarConfiguracionVisual(){
  const root = document.documentElement.style;
  const t = TEMA_DASHBOARD_FIJO;

  root.setProperty('--blue-accent', t.acento);
  root.setProperty('--primary-color', t.acento);
  root.setProperty('--bg-dark', t.fondo);
  root.setProperty('--sidebar-bg-1', t.sidebar1);
  root.setProperty('--sidebar-bg-2', t.sidebar2);
  root.setProperty('--topbar-bg-1', t.topbar1);
  root.setProperty('--topbar-bg-2', t.topbar2);
  root.setProperty('--panel-bg-1', t.panel1);
  root.setProperty('--panel-bg-2', t.panel2);
  root.setProperty('--card-border', t.borde);
  root.setProperty('--text-main', t.texto);
  document.body.classList.add('modo-claro');

  const cfg = (db && db.config) ? db.config : {};
  const lblNom = document.getElementById('lblNombreEmpresa');
  if(lblNom) lblNom.innerText = cfg.nombre || 'Prevenglobal';
  const lblSub = document.getElementById('lblSubtituloEmpresa');
  if(lblSub) lblSub.innerText = cfg.subtitulo || '';
  const brand = document.getElementById('brandTitleSidebar');
  if(brand) brand.innerText = cfg.nombre || 'Prevenglobal';

  const logoNav = document.getElementById('sidebarLogo');
  const icoNav = document.getElementById('sidebarIconoDefault');
  if(logoNav && icoNav){
    if(cfg.logo){ logoNav.src = cfg.logo; logoNav.style.display = 'block'; icoNav.style.display = 'none'; }
    else { logoNav.style.display = 'none'; icoNav.style.display = 'inline'; }
  }
}

const DB_KEY = 'prevenglobal_db_v2';

function dbCargar(){
  try {
    const raw = localStorage.getItem(DB_KEY);
    if(raw) return JSON.parse(raw);
  } catch(e) {
    console.warn('Error leyendo localStorage:', e);
  }
  return {
    clientes:[], tecnicos:[], plantillas:[], ordenes:[],
    bodegas:[ { id:1, nombre:"Bodega Principal", tipo:"fija" } ],
    inventario:[], kardex:[], pedidosTienda:[],
    nomina:[], gastos:[], controlOperativo:[],
    recargoMateriales:1.3, porcentajePagoTercero:0.45, metaMensualUtilidad:5000000,
    logs:[],
    config:{
      nombre:"Prevenglobal", subtitulo:"Mantenimiento y Reparación de Equipos de Refrigeración",
      temaMetalizado: "titanio", colorAcento: "#0284c7", colorFondo: "#f1f5f9", modoClaro: true,
      tiposServicio:["Mantenimiento Preventivo","Mantenimiento Correctivo","Instalación","Diagnóstico"],
      prioridades:["Media","Alta","Baja"]
    }
  };
}

function guardarEnLocalStorage(){
  try{
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }catch(err){}
}

function dbGuardar(){
  guardarEnLocalStorage();
  sincronizarConBackend();
}

function dbGuardarInmediato(){
  guardarEnLocalStorage();
  if(!empresaActual || !sesionServidor) return Promise.resolve();
  clearTimeout(sincronizacionPendiente);
  syncEstado = 'pendiente';
  actualizarBadgeConexion();
  return enviarEstadoAlServidor().catch(err=>{ marcarErrorSync(err); throw err; });
}

/* ---------------------------------------------------------
   SINCRONIZACIÓN Y COMUNICACIÓN CON RAILWAY
--------------------------------------------------------- */
const API_BASE = '';
const EMPRESA_KEY = 'prevenglobal_empresa_v1';
const TOKEN_KEY = 'prevenglobal_token_v1';
let empresaActual = localStorage.getItem(EMPRESA_KEY) || 'prevenglobal';
let sesionServidor = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');

function headersAutenticados(extra){
  const h = Object.assign({ 'X-Empresa': empresaActual }, extra || {});
  if(sesionServidor && sesionServidor.token) h['Authorization'] = 'Bearer ' + sesionServidor.token;
  return h;
}

let sincronizacionPendiente = null;
let syncEstado = 'ok';
let syncReintentoTimer = null;

const CLAVES_FUSIONABLES = ['clientes','tecnicos','plantillas','ordenes','bodegas','inventario','kardex','pedidosTienda','liquidacionesNomina','ingresos','gastos'];

function asegurarEliminados(){
  if(!db.eliminados || typeof db.eliminados !== 'object') db.eliminados = {};
  CLAVES_FUSIONABLES.forEach(clave=>{
    if(!Array.isArray(db.eliminados[clave])) db.eliminados[clave] = [];
  });
}

function registrarEliminacion(clave, id){
  asegurarEliminados();
  if(!db.eliminados[clave].includes(id)) db.eliminados[clave].push(id);
}

function fusionarPorId(localArr, remotoArr, idsEliminadosArr){
  if(!Array.isArray(localArr) || !Array.isArray(remotoArr)) return localArr || remotoArr || [];
  const idsLocal = new Set(localArr.map(x=>x && x.id));
  const idsEliminados = new Set(idsEliminadosArr || []);
  const faltantes = remotoArr.filter(x=>x && !idsLocal.has(x.id) && !idsEliminados.has(x.id));
  return faltantes.length ? localArr.concat(faltantes) : localArr;
}

function fusionarAdicionesDesdeServidor(remoto){
  if(!remoto) return false;
  asegurarEliminados();
  let huboCambios = false;
  CLAVES_FUSIONABLES.forEach(clave=>{
    if(Array.isArray(remoto[clave])){
      const antes = (db[clave]||[]).length;
      db[clave] = fusionarPorId(db[clave]||[], remoto[clave], db.eliminados[clave]);
      if(db[clave].length !== antes) huboCambios = true;
    }
  });
  return huboCambios;
}

function fetchConLimite(url, opciones, segundos){
  const controlador = new AbortController();
  const id = setTimeout(()=>controlador.abort(), segundos*1000);
  return fetch(url, Object.assign({}, opciones, { signal: controlador.signal }))
    .catch(err=>{
      if(err.name === 'AbortError') throw new Error('Tiempo de espera agotado');
      throw err;
    })
    .finally(()=>clearTimeout(id));
}

async function fusionarConServidorAntesDeGuardar(){
  if(!empresaActual || !sesionServidor) return;
  try{
    const r = await fetchConLimite(API_BASE + '/api/state', { headers: headersAutenticados() }, 8);
    if(r.ok){
      const remoto = await r.json();
      fusionarAdicionesDesdeServidor(remoto);
    }
  }catch(e){}
}

async function enviarEstadoAlServidor(){
  await fusionarConServidorAntesDeGuardar();
  const resp = await fetchConLimite(API_BASE + '/api/state', {
    method: 'PUT',
    headers: headersAutenticados({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(db)
  }, 60);
  if(!resp.ok){
    throw new Error('Error al guardar en el servidor');
  }
  syncEstado = 'ok';
  actualizarBadgeConexion();
}

function marcarErrorSync(err){
  syncEstado = 'error';
  actualizarBadgeConexion();
  clearTimeout(syncReintentoTimer);
  syncReintentoTimer = setTimeout(()=>{ if(syncEstado==='error') sincronizarConBackend(); }, 15000);
}

function sincronizarConBackend(){
  if(!empresaActual || !sesionServidor) return;
  clearTimeout(sincronizacionPendiente);
  syncEstado = 'pendiente';
  actualizarBadgeConexion();
  sincronizacionPendiente = setTimeout(()=>{
    enviarEstadoAlServidor().catch(marcarErrorSync);
  }, 400);
}

function cargarEstadoDesdeBackend(){
  if(!empresaActual || !sesionServidor) return;
  fetch(API_BASE + '/api/state', { headers: headersAutenticados() }).then(r=>{
    if(r.status===401){ forzarNuevoLogin(); throw new Error('sesión expirada'); }
    if(!r.ok) throw new Error('sin datos');
    return r.json();
  }).then(estadoServidor=>{
    if(!estadoServidor || !estadoServidor.config) return;
    db = estadoServidor;
    asegurarEliminados();
    guardarEnLocalStorage();
    aplicarConfiguracionVisual();
    if(typeof renderizarAgenda === 'function') renderizarAgenda();
    if(typeof renderizarCalendario === 'function') renderizarCalendario();
    if(typeof renderizarEquiposGlobal === 'function') renderizarEquiposGlobal('');
    if(typeof actualizarKPIs === 'function') actualizarKPIs();
    iniciarRefrescoSilencioso();
  }).catch(()=>{
    aplicarConfiguracionVisual();
  });
}

let intervaloRefrescoSilencioso = null;
function iniciarRefrescoSilencioso(){
  clearInterval(intervaloRefrescoSilencioso);
  intervaloRefrescoSilencioso = setInterval(()=>{
    if(!empresaActual || !sesionServidor || syncEstado === 'pendiente') return;
    fetch(API_BASE + '/api/state', { headers: headersAutenticados() }).then(r=>r.json()).then(remoto=>{
      const huboCambios = fusionarAdicionesDesdeServidor(remoto);
      if(huboCambios){
        guardarEnLocalStorage();
        if(typeof renderizarAgenda === 'function') renderizarAgenda();
        if(typeof renderizarCalendario === 'function') renderizarCalendario();
        if(typeof renderizarEquiposGlobal === 'function') renderizarEquiposGlobal('');
        if(typeof actualizarKPIs === 'function') actualizarKPIs();
      }
    }).catch(()=>{});
  }, 8000);
}

function forzarNuevoLogin(){
  localStorage.removeItem(TOKEN_KEY);
  sesionServidor = null;
  mostrarLogin();
}

let db = dbCargar();
asegurarEliminados();

/* =========================================================
   SESIÓN, RBAC Y APERTURA LIMPIA DE LOGIN
========================================================= */
const SESION_KEY = 'prevenglobal_sesion_v1';
let sesionActual = JSON.parse(localStorage.getItem(SESION_KEY) || 'null');

function esAdmin(){ return sesionActual && sesionActual.rol==='admin'; }

function nombreUsuarioActual(){
  if(!sesionActual) return '—';
  if(sesionActual.rol==='admin') return 'Administrador';
  const t = (db.tecnicos || []).find(x => x.id === sesionActual.tecnicoId);
  return t ? t.nombre : 'Técnico';
}

function registrarLog(accion, entidad, detalle){
  db.logs = db.logs || [];
  db.logs.push({ id:Date.now()+Math.random(), usuario:nombreUsuarioActual(), rol:sesionActual?sesionActual.rol:'—', accion, entidad, detalle, timestamp:new Date().toISOString() });
  dbGuardar();
}

function cerrarSesion(){
  const finalizarLocal = ()=>{
    localStorage.removeItem(SESION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sesionActual = null;
    sesionServidor = null;
    location.reload();
  };
  if(sesionServidor && sesionServidor.token){
    fetch(API_BASE + '/api/auth/logout', { method:'POST', headers: headersAutenticados() })
      .catch(()=>{})
      .finally(finalizarLocal);
  } else {
    finalizarLocal();
  }
}

function mostrarLogin(){
  ocultarSkeletonBoot();
  const overlay = document.getElementById('loginOverlay');
  if(overlay) overlay.style.display = 'flex';

  // Pantalla de login ÚNICA y compartida por todas las empresas y por
  // el superadmin — su apariencia (logo, colores, imagen de fondo) ya
  // NO depende de ninguna empresa en particular (no se sabe todavía
  // quién va a entrar), sino de una configuración global que solo el
  // superadmin puede cambiar.
  fetch(API_BASE + '/api/login-config')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(cfg => {
      aplicarPersonalizacionLogin(cfg);
      mostrarPasoCredenciales(cfg);
    })
    .catch(() => {
      mostrarPasoCredenciales({ nombrePlataforma: 'Prevenglobal' });
    });
}

function aplicarPersonalizacionLogin(cfg){
  const raiz = document.documentElement.style;
  if(cfg.color1) raiz.setProperty('--login-color-1', cfg.color1);
  if(cfg.color2) raiz.setProperty('--login-color-2', cfg.color2);

  const logoWrap = document.getElementById('loginLogoWrap');
  const logoImg = document.getElementById('loginLogo');
  if(cfg.logo && logoWrap && logoImg){
    logoImg.src = cfg.logo;
    logoWrap.style.display = 'flex';
  }

  const columnaIzq = document.getElementById('loginColumnaIzquierda');
  if(cfg.imagenFondo && columnaIzq){
    columnaIzq.style.backgroundImage = `url('${cfg.imagenFondo}')`;
    columnaIzq.classList.add('tiene-imagen');
  }

  const tituloIzq = document.getElementById('loginTituloIzquierdaTxt');
  if(tituloIzq && cfg.tituloIzquierda) tituloIzq.innerText = cfg.tituloIzquierda;
  const subtituloIzq = document.getElementById('loginSubtituloIzquierdaTxt');
  if(subtituloIzq && cfg.subtituloIzquierda) subtituloIzq.innerText = cfg.subtituloIzquierda;
}

function mostrarPasoCredenciales(info){
  const pasoEmpresa = document.getElementById('loginPasoEmpresa');
  const pasoNueva = document.getElementById('loginPasoEmpresaNueva');
  const pasoCred = document.getElementById('loginPasoCredenciales');
  
  if(pasoEmpresa) pasoEmpresa.style.display = 'none';
  if(pasoNueva) pasoNueva.style.display = 'none';
  if(pasoCred) pasoCred.style.display = 'block';

  const lblTit = document.getElementById('loginTituloEmpresa');
  if(lblTit) lblTit.innerHTML = `<i id="loginIconoDefault" class="fas fa-snowflake" style="color:var(--login-color-1,#7c3aed);"></i> ${info.nombrePlataforma || 'Prevenglobal'}`;

  const errEl = document.getElementById('loginError');
  if(errEl) errEl.style.display = 'none';

  // Asegura que el formulario visible coincida con lo que diga el menú
  // desplegable (por si el navegador recordó una selección previa).
  if(typeof cambiarModoAccesoLogin === 'function') cambiarModoAccesoLogin();
}

function cambiarModoAccesoLogin(){
  const modo = document.getElementById('loginModoAcceso').value;
  const bloqueTecnico = document.getElementById('loginBloqueTecnico');
  const bloqueAdmin = document.getElementById('loginBloqueAdmin');
  if(bloqueTecnico) bloqueTecnico.style.display = (modo === 'tecnico') ? 'block' : 'none';
  if(bloqueAdmin) bloqueAdmin.style.display = (modo === 'admin') ? 'block' : 'none';
  const errorEl = document.getElementById('loginError');
  if(errorEl) errorEl.style.display = 'none';
}

function iniciarSesionComo(rol){
  const errorEl = document.getElementById('loginError');
  if(errorEl) errorEl.style.display = 'none';

  // Técnico, administrador y superadministrador se identifican TODOS
  // solo por su correo — el backend busca primero entre todas las
  // empresas activas, y si el correo no pertenece a ninguna, revisa si
  // es el superadministrador de la plataforma. Así hay UNA sola pantalla
  // de login para todos, sin tener que elegir de antemano quién es.
  const payload = { tipo: rol };
  if(rol==='tecnico'){
    payload.usuario = (document.getElementById('loginTecnicoUsuario').value || '').trim();
    payload.password = document.getElementById('loginTecnicoPassword').value;
  } else {
    payload.usuario = (document.getElementById('loginAdminUsuario').value || '').trim();
    payload.password = document.getElementById('loginAdminPassword').value;
  }

  fetch(API_BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(async r=>{
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'Credenciales incorrectas');
    return data;
  }).then(resultado => {
    if(resultado.rol === 'superadmin'){
      redirigirASuperAdmin(resultado);
      return;
    }
    completarLogin(resultado);
  }).catch(err=>{
    if(errorEl){
      errorEl.innerText = err.message || 'Usuario o contraseña incorrectos.';
      errorEl.style.display = 'block';
    }
  });
}

function redirigirASuperAdmin(resultado){
  // El correo resultó ser el del superadministrador de la plataforma, no
  // el de ninguna empresa. Guardamos su sesión con la MISMA clave que ya
  // usa superadmin.html, y lo mandamos directo a su panel — sin que
  // tenga que volver a escribir su correo/contraseña ahí. Si todavía
  // tiene la contraseña temporal, avisamos para que esa pantalla lo
  // obligue a cambiarla antes de entrar (igual que si hubiera entrado
  // directo por superadmin.html).
  localStorage.setItem('prevenglobal_superadmin_token', resultado.token);
  if(resultado.debeCambiarPassword){
    localStorage.setItem('prevenglobal_superadmin_debe_cambiar', '1');
  }
  window.location.href = 'superadmin.html';
}

function completarLogin(resultado){
  // CRÍTICO: el correo puede pertenecer a cualquier empresa activa — el
  // backend ya identificó cuál es (resultado.slug) y es indispensable
  // guardarlo como la empresa activa del navegador. Sin esto, todas las
  // peticiones siguientes (guardar logo, configuración, etc.) seguían
  // usando la empresa anterior guardada en el navegador y el servidor las
  // rechazaba en silencio por no coincidir con la sesión real.
  if(resultado.slug){
    empresaActual = resultado.slug;
    localStorage.setItem(EMPRESA_KEY, empresaActual);
  }
  sesionServidor = { token: resultado.token, rol: resultado.rol, tecnicoId: resultado.tecnicoId || null, nombreEmpresa: resultado.nombreEmpresa };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(sesionServidor));
  sesionActual = { rol: resultado.rol, tecnicoId: resultado.tecnicoId || null };
  localStorage.setItem(SESION_KEY, JSON.stringify(sesionActual));
  
  const overlay = document.getElementById('loginOverlay');
  if(overlay) overlay.style.display = 'none';
  
  aplicarConfiguracionVisual();
  aplicarRBACaUI();
  if(typeof mostrarSeccion === 'function') mostrarSeccion('agenda');
  cargarEstadoDesdeBackend();
}

function tienePermiso(clave){
  if(esAdmin()) return true;
  if(!sesionActual || !sesionActual.tecnicoId) return false;
  const t = (db.tecnicos || []).find(x => x.id === sesionActual.tecnicoId);
  if(!t) return false;
  if(t.accesoTotal) return true;
  return !!(t.permisos && t.permisos[clave]);
}

function aplicarRBACaUI(){
  const lbl = document.getElementById('lblUsuarioActual');
  if(lbl) lbl.innerText = `${nombreUsuarioActual()} (${esAdmin()?'Administrador':'Personal'})`;
  document.querySelectorAll('.solo-admin').forEach(el=>{
    const permiso = el.getAttribute('data-permiso');
    el.style.display = (esAdmin() || (permiso && tienePermiso(permiso))) ? '' : 'none';
  });
}

function actualizarBadgeConexion(){
  const badge = document.getElementById('badgeConexion');
  if(!badge) return;
  badge.innerHTML = syncEstado==='ok' ? '<span style="color:#22c55e;">● En línea</span>' : '<span style="color:#f59e0b;">● Guardando...</span>';
}

// Arranque protegido
/* =========================================================
   RECUPERACIÓN DE CONTRASEÑA
   Backend ya listo (/api/auth/solicitar-reset y /api/auth/confirmar-reset,
   funciona en cualquier empresa activa, buscando el correo igual que el
   login). Aquí solo conectamos la pantalla con esas rutas.
========================================================= */
function mostrarAyudaContrasena(){
  const input = document.getElementById('resetSolicitudEmail');
  if(input) input.value = '';
  const msj = document.getElementById('resetSolicitudMensaje');
  if(msj) msj.style.display = 'none';
  abrirModal('modalSolicitarReset');
}

function enviarSolicitudReset(){
  const input = document.getElementById('resetSolicitudEmail');
  const msj = document.getElementById('resetSolicitudMensaje');
  const email = (input ? input.value : '').trim();
  if(!email){
    if(msj){ msj.style.color = 'var(--red-alert)'; msj.innerText = 'Escribe tu correo primero.'; msj.style.display = 'block'; }
    return;
  }
  fetch(API_BASE + '/api/auth/solicitar-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  }).then(r => r.json()).then(data => {
    if(msj){
      msj.style.color = 'var(--green-success)';
      msj.innerText = data.mensaje || 'Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña.';
      msj.style.display = 'block';
    }
  }).catch(() => {
    if(msj){ msj.style.color = 'var(--red-alert)'; msj.innerText = 'No se pudo enviar la solicitud. Intenta de nuevo.'; msj.style.display = 'block'; }
  });
}

let tokenResetActual = null;

function detectarEnlaceDeReset(){
  const params = new URLSearchParams(location.search);
  const token = params.get('resetToken');
  if(!token) return false;
  tokenResetActual = token;

  ocultarSkeletonBoot();
  const overlay = document.getElementById('loginOverlay');
  if(overlay) overlay.style.display = 'none';
  const resetOverlay = document.getElementById('resetPasswordOverlay');
  if(resetOverlay) resetOverlay.style.display = 'flex';

  // Limpia el token de la URL para que no quede visible ni se reintente
  // si la persona recarga la página después de cambiarla.
  const urlLimpia = location.origin + location.pathname;
  window.history.replaceState({}, document.title, urlLimpia);
  return true;
}

function confirmarNuevaPassword(){
  const msj = document.getElementById('resetConfirmarMensaje');
  const nueva = (document.getElementById('resetNuevaPassword').value || '');
  const confirmar = (document.getElementById('resetConfirmarPassword').value || '');

  const mostrarMensaje = (texto, esError) => {
    if(!msj) return;
    msj.style.color = esError ? 'var(--red-alert)' : 'var(--green-success)';
    msj.innerText = texto;
    msj.style.display = 'block';
  };

  if(nueva.length < 4) return mostrarMensaje('La contraseña debe tener al menos 4 caracteres.', true);
  if(nueva !== confirmar) return mostrarMensaje('Las dos contraseñas no coinciden.', true);
  if(!tokenResetActual) return mostrarMensaje('El enlace no es válido. Solicita uno nuevo desde el login.', true);

  fetch(API_BASE + '/api/auth/confirmar-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenResetActual, nuevaPassword: nueva })
  }).then(async r=>{
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña.');
    return data;
  }).then(() => {
    mostrarMensaje('✅ Contraseña actualizada. Ya puedes iniciar sesión con ella.', false);
    setTimeout(() => {
      const resetOverlay = document.getElementById('resetPasswordOverlay');
      if(resetOverlay) resetOverlay.style.display = 'none';
      tokenResetActual = null;
      mostrarLogin();
    }, 1800);
  }).catch(err => {
    mostrarMensaje(err.message || 'El enlace venció o ya fue usado. Solicita uno nuevo.', true);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  aplicarConfiguracionVisual();
  if(detectarEnlaceDeReset()) return; // pantalla de "crear nueva contraseña", no el login normal
  if(!sesionActual || !sesionServidor){
    mostrarLogin();
  } else {
    ocultarSkeletonBoot();
    aplicarRBACaUI();
    cargarEstadoDesdeBackend();
  }
});

let ordenReprogramarId = null;
let clienteActivoId = null, sedeActivaId = null, plantillaActivaId = null;
let mesCalendarioActual = new Date();
let logoTempBase64 = null;
let firmaTempBase64 = null;
