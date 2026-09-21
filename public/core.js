// ===== core.js — Capa de datos, Sincronización, Dashboard Fijo y Acceso Seguro =====

function ocultarSkeletonBoot() {
  const el = document.getElementById('skeletonBoot');
  if (el) el.style.display = 'none';
}

// NOTA: aplicarConfiguracionVisual() vive en config-general.js (se cargaba
// también, con el mismo nombre, aquí en core.js — dos funciones iguales en
// archivos distintos, y la que se carga después en la página es la que de
// verdad se ejecuta siempre. Se dejó una sola versión, completa, allá.

// Identidad visual GLOBAL de la plataforma (configurable solo desde
// SuperAdmin, aplica a todas las empresas por igual): banner del menú
// lateral y su ícono. Es información pública, así que se trae una sola
// vez al arrancar, sin importar si ya hay sesión iniciada o no — para
// que esté lista desde el primer instante en que se vea el menú.
let bannerLateralIconoGlobalCache = null;
function cargarYAplicarBannerLateralGlobal(){
  fetch(API_BASE + '/api/login-config')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(cfg => {
      const wrap = document.getElementById('bannerLateralGlobalWrap');
      const img = document.getElementById('bannerLateralGlobalImg');
      if(cfg.bannerLateral && wrap && img){
        img.src = cfg.bannerLateral;
        wrap.style.display = 'block';
      }
      if(cfg.bannerLateralIcono){
        bannerLateralIconoGlobalCache = cfg.bannerLateralIcono;
        if(typeof aplicarConfiguracionVisual === 'function') aplicarConfiguracionVisual(); // reaplica ahora que ya se sabe si hay ícono global
      }
    })
    .catch(()=>{}); // sin conexión momentánea: se queda con el ícono/menú por defecto, nada se rompe
}

const DB_KEY_PREFIJO = 'prevenglobal_db_v2';
// CRÍTICO: antes esta llave era una sola, fija, para TODAS las empresas
// ('prevenglobal_db_v2') — si en el mismo navegador antes había entrado
// alguien de otra empresa, sus datos completos (clientes, órdenes, todo)
// quedaban ahí guardados y se reutilizaban por error. Ahora cada empresa
// tiene su propia llave, separada — la de una nunca pisa ni se mezcla con
// la de otra.
function claveDbLocal(){
  return empresaActual ? `${DB_KEY_PREFIJO}__${empresaActual}` : `${DB_KEY_PREFIJO}__sin_empresa`;
}

function dbCargar(){
  try {
    const raw = localStorage.getItem(claveDbLocal());
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
    localStorage.setItem(claveDbLocal(), JSON.stringify(db));
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
let vistaAgendaInicialAplicada = false; // controla el cambio a Calendario solo en la primera carga (ver cargarEstadoDesdeBackend)
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
      // fusionarConDeteccionDeConflictos vive en offline-sync.js — revisa
      // registro por registro si el MISMO fue editado en ambos lados
      // mientras no había conexión, y si es así nunca sobrescribe en
      // silencio (ver ese archivo para el detalle completo).
      if(typeof fusionarConDeteccionDeConflictos === 'function') await fusionarConDeteccionDeConflictos(remoto);
      else fusionarAdicionesDesdeServidor(remoto); // respaldo por si ese archivo no cargó
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
  // Deja constancia de "así quedaron los datos justo después de
  // sincronizar" — es el punto de referencia que usa el modo offline
  // para saber, la próxima vez, qué cambió y detectar choques reales.
  if(typeof guardarBaselineSincronizacion === 'function') guardarBaselineSincronizacion();
  if(typeof actualizarBadgeConflictosSync === 'function') actualizarBadgeConflictosSync();
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
    aplicarRBACaUI(); // con los datos reales ya en mano, se recalculan permisos y la barra móvil
    if(typeof guardarBaselineSincronizacion === 'function') guardarBaselineSincronizacion();
    if(typeof actualizarBadgeConflictosSync === 'function') actualizarBadgeConflictosSync();
    if(typeof renderizarAgenda === 'function') renderizarAgenda();
    if(typeof renderizarCalendario === 'function') renderizarCalendario();
    // En computador, la Agenda abre mostrando el Calendario con la
    // programación de una vez (más útil ahí que la lista, con la pantalla
    // ancha) — solo la primera vez que carga, para no forzar de vuelta al
    // Calendario si la persona ya cambió a Lista por su cuenta durante la
    // sesión. En celular/tablet se deja la Lista, más cómoda de leer.
    if(!vistaAgendaInicialAplicada){
      vistaAgendaInicialAplicada = true;
      if(window.innerWidth > 900 && typeof cambiarVistaAgenda === 'function') cambiarVistaAgenda('calendario');
    }
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
  // CRÍTICO: justo aquí, con empresaActual ya actualizado a la empresa
  // correcta, se descarta cualquier dato que hubiera en memoria (que podía
  // ser de otra empresa usada antes en este mismo navegador) y se recarga
  // SOLO lo que corresponde a esta empresa (su propio caché local, o vacío
  // si es la primera vez) — así nunca se llega a mostrar, ni por un
  // instante, información de otra cuenta antes de que lleguen los datos
  // reales del servidor.
  db = dbCargar();

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
  renderizarBottomNavMovil();
}

/* =========================================================
   BARRA INFERIOR DE LA APP MÓVIL (APK) — reorganizada para dejar
   ÚNICAMENTE estas 4 funciones, cada una mostrada solo si el usuario
   (administrador o técnico) tiene ese módulo autorizado. Se reutiliza
   el mismo sistema de permisos (tienePermiso) que ya usa el resto de
   la plataforma — nada nuevo que mantener por separado.
========================================================= */
const TABS_APP_MOVIL = [
  { id:'ordenes',    permiso:'ordenes_crear',     icono:'fa-calendar-check', etiqueta:'Órdenes',        accion:'mostrarSeccion(\'agenda\')' },
  { id:'facturas',   permiso:'contabilidad_ver',  icono:'fa-file-invoice',   etiqueta:'Facturas',       accion:'abrirCotizacionDesdeMovil()' },
  { id:'buscar-qr',  permiso:null,                icono:'fa-qrcode',        etiqueta:'Buscar QR',      accion:'irAEquiposYAbrirEscaner()' },
  { id:'agregar-eq', permiso:'equipos_gestionar', icono:'fa-plus-circle',   etiqueta:'Agregar Equipo', accion:'irAEquiposYAbrirNuevo()' }
];

function irAEquiposYAbrirEscaner(){
  mostrarSeccion('equipos');
  if(typeof abrirEscanerQR === 'function') abrirEscanerQR();
}
function irAEquiposYAbrirNuevo(){
  mostrarSeccion('equipos');
  if(typeof abrirModalEquipo === 'function') abrirModalEquipo();
}

function renderizarBottomNavMovil(){
  const nav = document.getElementById('bottomNavMovil');
  const aviso = document.getElementById('avisoSinModulosMovil');
  if(!nav) return; // esta pantalla (ej. login) todavía no tiene la barra en el DOM

  const disponibles = TABS_APP_MOVIL.filter(t => !t.permiso || tienePermiso(t.permiso));

  if(!disponibles.length){
    nav.style.display = 'none';
    nav.innerHTML = '';
    if(aviso) aviso.style.display = 'flex';
    return;
  }
  if(aviso) aviso.style.display = 'none';
  nav.style.display = '';
  nav.innerHTML = disponibles.map(t => `
    <a class="bottom-nav-item" data-nav="${t.id}" onclick="${t.accion}"><i class="fas ${t.icono}"></i><span>${t.etiqueta}</span></a>
  `).join('') + `<a class="bottom-nav-item salir" onclick="cerrarSesion()"><i class="fas fa-power-off"></i><span>Salir</span></a>`;
}

// NOTA: actualizarBadgeConexion() ya no se define aquí — vive en
// utilidades-navegacion.js (versión más completa: detecta sin-conexión,
// error de guardado con reintento, etc.), para no tener dos versiones.

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
  // Detección de si esto corre dentro del APK real (Capacitor) o en un
  // navegador normal — solo el APK debe activar la barra inferior de 4
  // funciones reorganizada; la web (PC o celular) sigue igual que siempre,
  // con todos los módulos, sin este cambio.
  const esAppNativa = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  if(esAppNativa) document.body.classList.add('modo-app-movil');

  cargarYAplicarBannerLateralGlobal();

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
