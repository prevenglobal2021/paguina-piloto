// ===== core.js — Capa de datos, Sincronización, Temas y Acceso Seguro =====
/* =========================================================
   CATÁLOGO GLOBAL DE TEMAS METALIZADOS CLAROS MARCADOS
   (Disponible desde el inicio para evitar errores de carga)
========================================================= */
const TEMAS_CLAROS_METALIZADOS = [
  {
    nombre: 'Titanio Plateado',
    clave: 'titanio',
    acento: '#0284c7',
    fondo: '#f1f5f9',
    sidebar1: '#e2e8f0', sidebar2: '#cbd5e1',
    topbar1: '#f8fafc', topbar2: '#e2e8f0',
    panel1: '#ffffff', panel2: '#f8fafc',
    borde: '#94a3b8', texto: '#0f172a'
  },
  {
    nombre: 'Acero Platino',
    clave: 'platino',
    acento: '#2563eb',
    fondo: '#e2e8f0',
    sidebar1: '#cbd5e1', sidebar2: '#94a3b8',
    topbar1: '#f1f5f9', topbar2: '#cbd5e1',
    panel1: '#ffffff', panel2: '#f1f5f9',
    borde: '#64748b', texto: '#0f172a'
  },
  {
    nombre: 'Aluminio Azul Eléctrico',
    clave: 'aluminio',
    acento: '#0055ff',
    fondo: '#e0f2fe',
    sidebar1: '#bae6fd', sidebar2: '#7dd3fc',
    topbar1: '#f0f9ff', topbar2: '#bae6fd',
    panel1: '#ffffff', panel2: '#f0f9ff',
    borde: '#0284c7', texto: '#082f49'
  },
  {
    nombre: 'Níquel Ámbar Marcado',
    clave: 'niquel',
    acento: '#d97706',
    fondo: '#fef3c7',
    sidebar1: '#fde68a', sidebar2: '#fcd34d',
    topbar1: '#fffbeb', topbar2: '#fde68a',
    panel1: '#ffffff', panel2: '#fffbeb',
    borde: '#b45309', texto: '#451a03'
  },
  {
    nombre: 'Cromo Blanco Puro',
    clave: 'cromo',
    acento: '#0ea5e9',
    fondo: '#ffffff',
    sidebar1: '#f8fafc', sidebar2: '#e2e8f0',
    topbar1: '#ffffff', topbar2: '#f1f5f9',
    panel1: '#ffffff', panel2: '#ffffff',
    borde: '#cbd5e1', texto: '#0f172a'
  },
  {
    nombre: 'Zinc Glacial Esmeralda',
    clave: 'zinc',
    acento: '#059669',
    fondo: '#ecfdf5',
    sidebar1: '#a7f3d0', sidebar2: '#6ee7b7',
    topbar1: '#f0fdf4', topbar2: '#a7f3d0',
    panel1: '#ffffff', panel2: '#f0fdf4',
    borde: '#047857', texto: '#064e3b'
  },
  {
    nombre: 'Cobre Bronce Industrial',
    clave: 'cobre',
    acento: '#ea580c',
    fondo: '#ffedd5',
    sidebar1: '#fed7aa', sidebar2: '#fdba74',
    topbar1: '#fff7ed', topbar2: '#fed7aa',
    panel1: '#ffffff', panel2: '#fff7ed',
    borde: '#c2410c', texto: '#431407'
  },
  {
    nombre: 'Platino Amatista Marcado',
    clave: 'amatista',
    acento: '#7c3aed',
    fondo: '#f3e8ff',
    sidebar1: '#e9d5ff', sidebar2: '#d8b4fe',
    topbar1: '#faf5ff', topbar2: '#e9d5ff',
    panel1: '#ffffff', panel2: '#faf5ff',
    borde: '#6d28d9', texto: '#3b0764'
  },
  {
    nombre: 'Rojo Carmesí Metalizado',
    clave: 'carmesi',
    acento: '#dc2626',
    fondo: '#fee2e2',
    sidebar1: '#fecaca', sidebar2: '#fca5a5',
    topbar1: '#fef2f2', topbar2: '#fecaca',
    panel1: '#ffffff', panel2: '#fef2f2',
    borde: '#b91c1c', texto: '#450a0a'
  },
  {
    nombre: 'Acero Grafito Suave',
    clave: 'grafito',
    acento: '#475569',
    fondo: '#f8fafc',
    sidebar1: '#e2e8f0', sidebar2: '#94a3b8',
    topbar1: '#f1f5f9', topbar2: '#cbd5e1',
    panel1: '#ffffff', panel2: '#f8fafc',
    borde: '#475569', texto: '#0f172a'
  }
];

function ocultarSkeletonBoot() {
  const el = document.getElementById('skeletonBoot');
  if (el) el.style.display = 'none';
}

function aplicarConfiguracionVisual(){
  const cfg = (db && db.config) ? db.config : {};
  const root = document.documentElement.style;

  const claveTema = cfg.temaMetalizado || 'titanio';
  const t = TEMAS_CLAROS_METALIZADOS.find(x => x.clave === claveTema) || TEMAS_CLAROS_METALIZADOS[0];

  const acento = cfg.colorAcento || t.acento;
  root.setProperty('--blue-accent', acento);
  root.setProperty('--primary-color', acento);

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

  const slug = empresaActual || 'prevenglobal';
  fetch(API_BASE + '/api/empresas/' + encodeURIComponent(slug))
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(info => {
      mostrarPasoCredenciales(info);
    })
    .catch(() => {
      mostrarPasoCredenciales({
        nombre: db.config.nombre || 'Prevenglobal',
        logo: db.config.logo,
        tecnicos: (db.tecnicos || []).map(t => ({ id: t.id, nombre: t.nombre }))
      });
    });
}

function mostrarPasoCredenciales(info){
  const pasoEmpresa = document.getElementById('loginPasoEmpresa');
  const pasoNueva = document.getElementById('loginPasoEmpresaNueva');
  const pasoCred = document.getElementById('loginPasoCredenciales');
  
  if(pasoEmpresa) pasoEmpresa.style.display = 'none';
  if(pasoNueva) pasoNueva.style.display = 'none';
  if(pasoCred) pasoCred.style.display = 'block';

  const lblTit = document.getElementById('loginTituloEmpresa');
  if(lblTit) lblTit.innerHTML = `<i id="loginIconoDefault" class="fas fa-snowflake" style="color:var(--login-color-1,#7c3aed);"></i> ${info.nombre || 'Prevenglobal'}`;

  const selTec = document.getElementById('loginTecnicoSelect');
  if(selTec){
    const listaTecnicos = (info && info.tecnicos && info.tecnicos.length) ? info.tecnicos : (db.tecnicos || []);
    selTec.innerHTML = listaTecnicos.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('') || '<option value="">Sin técnicos registrados</option>';
  }

  const errEl = document.getElementById('loginError');
  if(errEl) errEl.style.display = 'none';
}

function iniciarSesionComo(rol){
  const errorEl = document.getElementById('loginError');
  if(errorEl) errorEl.style.display = 'none';
  
  const payload = { slug: empresaActual || 'prevenglobal', tipo: rol };
  if(rol==='tecnico'){
    const tecnicoId = parseInt(document.getElementById('loginTecnicoSelect').value);
    if(!tecnicoId){ mostrarToast('Selecciona un técnico.'); return; }
    payload.tecnicoId = tecnicoId;
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
    completarLogin(resultado);
  }).catch(err=>{
    if(errorEl){
      errorEl.innerText = err.message || 'Usuario o contraseña incorrectos.';
      errorEl.style.display = 'block';
    }
  });
}

function completarLogin(resultado){
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
window.addEventListener('DOMContentLoaded', () => {
  aplicarConfiguracionVisual();
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
