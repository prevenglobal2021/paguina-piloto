// ===== core.js — Capa de datos, Sincronización, RBAC y Login Seguro =====
/* =========================================================
   SISTEMA BASE Y CONTROL DE SKELETON
========================================================= */
function ocultarSkeletonBoot() {
  const el = document.getElementById('skeletonBoot');
  if (el) el.style.display = 'none';
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
    clientes:[
      { id: 1, nombre:"Supermercados del Norte S.A.", telefono:"3001112233", sedes:[
        { id: 11, nombre:"Sucursal Centro", direccion:"Bogotá", equipos:[
          { id:111, nombre:"Cámara Frigorífica CF-12", serie:"SN-8842", refrigerante:"R-507" }
        ]}
      ]},
      { id: 2, nombre:"Bioplástico S.A.S.", telefono:"3104567890", sedes:[
        { id: 21, nombre:"Puente Grande", direccion:"Bogotá", equipos:[
          { id:211, nombre:"Chiller Industrial Principal", serie:"BP-2201", refrigerante:"R-410A" }
        ]}
      ]}
    ],
    tecnicos:[ { id:1, nombre:"Pedro Luis Pedrozo", telefono:"3009998877", usuario:"pedro@prevenglobal.com", password:null } ],
    plantillas:[
      { id:1, nombre:"Mantenimiento Preventivo Cámaras", campos:[
        { id:11, label:"Presión de Alta (PSI)", tipo:"number" },
        { id:12, label:"Presión de Baja (PSI)", tipo:"number" },
        { id:13, label:"Temperatura de Cámara (°C)", tipo:"number" }
      ]},
      { id:2, nombre:"Mantenimiento Correctivo Chillers", campos:[
        { id:21, label:"Falla reportada", tipo:"textarea" },
        { id:22, label:"Voltaje L1-L2", tipo:"number" },
        { id:23, label:"Fuga detectada", tipo:"checkbox" }
      ]}
    ],
    ordenes:[
      { id:1, numero:"OS-2026-0001", clienteId:1, sedeId:11, equipoId:111, tecnicoId:1, tipo:"Mantenimiento Correctivo", prioridad:"Alta", plantillaId:2, estado:"Finalizado", fechaProgramada:"2026-07-18",
        cierre:{ fecha:"2026-07-20", diagnostico:"Corrección de fuga en racor de línea de líquido, prueba de vacío realizada y ajuste de parámetros.", respuestas:{}, fotos:[], firmaTecnico:null, firmaCliente:null } },
      { id:2, numero:"OS-2026-0002", clienteId:2, sedeId:21, equipoId:211, tecnicoId:1, tipo:"Mantenimiento Preventivo", prioridad:"Media", plantillaId:1, estado:"Programado", fechaProgramada:"2026-07-28", cierre:null }
    ],
    bodegas:[ { id:1, nombre:"Bodega Principal", tipo:"fija" } ],
    inventario:[],
    kardex:[],
    pedidosTienda:[],
    nomina:[], gastos:[], controlOperativo:[],
    recargoMateriales:1.3, porcentajePagoTercero:0.45, metaMensualUtilidad:5000000,
    logs:[],
    config:{
      nombre:"Prevenglobal", subtitulo:"Mantenimiento y Reparación de Equipos de Refrigeración",
      logo:null, direccion:"", mision:"", vision:"",
      tiendaLogo:null, tiendaBanner:[], tiendaGaleria:[], tiendaTelefono:"", tiendaWhatsapp:"",
      tiendaColor:"#0088ff", tiendaImgEstilo:"cover", tiendaTamanoTarjeta:230,
      tiendaSecciones:{ equipo:[], servicios:[], proyectos:[], clientes:[], certificaciones:[] },
      tiendaTestimonios:[],
      colorAcento:"#0088ff", colorFondo:"#15171c", modoClaro:false, adminPassword:null,
      colorSidebar1:"#24272e", colorSidebar2:"#15171c", fontFamily:"'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
      colorTopbar1:"#24272e", colorTopbar2:"#191b20",
      colorPanel1:"#212429", colorPanel2:"#191b20",
      tiposServicio:["Mantenimiento Preventivo","Mantenimiento Correctivo","Instalación","Diagnóstico"],
      prioridades:["Media","Alta","Baja"],
      plantillaWhatsApp:"Hola {nombre_cliente}, adjuntamos el informe de la orden {numero_orden}. Cualquier duda con gusto la resolvemos. ¡Gracias por confiar en nosotros!"
    }
  };
}

function guardarEnLocalStorage(){
  try{
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }catch(err){
    console.warn('[respaldo local] No se pudo guardar en este dispositivo:', err.message);
  }
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
   SINCRONIZACIÓN Y FUSIÓN DE DATOS
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
      if(err.name === 'AbortError') throw new Error('La conexión tardó demasiado tiempo.');
      throw err;
    })
    .finally(()=>clearTimeout(id));
}

async function fusionarConServidorAntesDeGuardar(){
  if(!empresaActual || !sesionServidor) return;
  try{
    const rMeta = await fetchConLimite(API_BASE + '/api/state/meta', { headers: headersAutenticados() }, 4);
    if(rMeta.ok){
      const { actualizadoEn } = await rMeta.json();
      if(ultimaVersionConocida !== null && actualizadoEn === ultimaVersionConocida) return;
      ultimaVersionConocida = actualizadoEn;
    }
    const r = await fetchConLimite(API_BASE + '/api/state', { headers: headersAutenticados() }, 8);
    if(r.ok){
      const remoto = await r.json();
      fusionarAdicionesDesdeServidor(remoto);
    }
  }catch(e){ }
}

async function enviarEstadoAlServidor(){
  await fusionarConServidorAntesDeGuardar();
  const resp = await fetchConLimite(API_BASE + '/api/state', {
    method: 'PUT',
    headers: headersAutenticados({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(db)
  }, 70);
  if(!resp.ok){
    let detalle = '';
    try{ const cuerpo = await resp.json(); if(cuerpo && cuerpo.error) detalle = cuerpo.error; }catch(e){}
    throw new Error(`Error al guardar en el servidor: ${detalle || resp.status}`);
  }
  try{
    const cuerpo = await resp.json();
    if(cuerpo && cuerpo.actualizadoEn) ultimaVersionConocida = cuerpo.actualizadoEn;
  }catch(e){}
  syncEstado = 'ok';
  actualizarBadgeConexion();
}

function marcarErrorSync(err){
  syncEstado = 'error';
  actualizarBadgeConexion();
  mostrarToast('⚠️ No se pudo sincronizar con el servidor: ' + err.message, 'error');
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

let ultimaVersionConocida = null;
function cargarEstadoDesdeBackend(){
  if(!empresaActual || !sesionServidor) return;
  fetch(API_BASE + '/api/state', { headers: headersAutenticados() }).then(r=>{
    if(r.status===401){ forzarNuevoLogin(); throw new Error('sesión expirada'); }
    if(!r.ok) throw new Error('sin datos en el servidor');
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
    anotarVersionConocidaActual();
    iniciarRefrescoSilencioso();
  }).catch(()=>{ });
}

async function anotarVersionConocidaActual(){
  try{
    const r = await fetchConLimite(API_BASE + '/api/state/meta', { headers: headersAutenticados() }, 6);
    if(r.ok){ const d = await r.json(); ultimaVersionConocida = d.actualizadoEn; }
  }catch(e){}
}

let intervaloRefrescoSilencioso = null;
async function revisarSiHayCambiosNuevos(){
  if(!empresaActual || !sesionServidor || syncEstado === 'pendiente') return;
  try{
    const r = await fetchConLimite(API_BASE + '/api/state/meta', { headers: headersAutenticados() }, 6);
    if(!r.ok) return;
    const { actualizadoEn } = await r.json();
    if(ultimaVersionConocida === null){ ultimaVersionConocida = actualizadoEn; return; }
    if(actualizadoEn !== ultimaVersionConocida){
      ultimaVersionConocida = actualizadoEn;
      refrescarSilenciosamenteDesdeServidor();
    }
  }catch(e){}
}

function refrescarSilenciosamenteDesdeServidor(){
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
}

function iniciarRefrescoSilencioso(){
  clearInterval(intervaloRefrescoSilencioso);
  intervaloRefrescoSilencioso = setInterval(revisarSiHayCambiosNuevos, 6000);
}

function forzarNuevoLogin(){
  localStorage.removeItem(TOKEN_KEY);
  sesionServidor = null;
  mostrarLogin();
}

let db = dbCargar();
asegurarEliminados();

/* =========================================================
   RBAC, SESIÓN Y FLUJO DE LOGIN RESISTENTE
========================================================= */
const SESION_KEY = 'prevenglobal_sesion_v1';
let sesionActual = JSON.parse(localStorage.getItem(SESION_KEY) || 'null');

function esAdmin(){ return sesionActual && sesionActual.rol==='admin'; }

function nombreUsuarioActual(){
  if(!sesionActual) return '—';
  if(sesionActual.rol==='admin') return 'Administrador';
  const t = buscarTecnico(sesionActual.tecnicoId);
  return t ? t.nombre : 'Técnico';
}

function registrarLog(accion, entidad, detalle){
  db.logs = db.logs || [];
  db.logs.push({ id:Date.now()+Math.random(), usuario:nombreUsuarioActual(), rol:sesionActual?sesionActual.rol:'—', accion, entidad, detalle, timestamp:new Date().toISOString() });
  dbGuardar();
}

function cerrarSesion(){
  const token = sesionServidor && sesionServidor.token;
  const finalizarLocal = ()=>{
    localStorage.removeItem(SESION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sesionActual = null;
    sesionServidor = null;
    location.reload();
  };
  if(token){
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
  const slugInput = document.getElementById('loginEmpresaSlug');
  if(slugInput) slugInput.value = slug;

  fetch(API_BASE + '/api/empresas/' + encodeURIComponent(slug))
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(info => {
      empresaActual = slug;
      localStorage.setItem(EMPRESA_KEY, slug);
      mostrarPasoCredenciales(info);
    })
    .catch(() => {
      // Si el backend tarda o responde con error, se inicializa el paso de credenciales con datos locales
      mostrarPasoCredenciales({
        nombre: db.config.nombre || 'Prevenglobal',
        logo: db.config.logo,
        tecnicos: (db.tecnicos || []).map(t => ({ id: t.id, nombre: t.nombre }))
      });
    });
}

function aplicarAparienciaLogin(info){
  if(!info) return;
  document.documentElement.style.setProperty('--login-color-1', info.loginColor1 || '#7c3aed');
  document.documentElement.style.setProperty('--login-color-2', info.loginColor2 || '#4c1d95');
  const izq = document.getElementById('loginColumnaIzquierda');
  if(izq){
    if(info.loginImagenFondo){ izq.style.backgroundImage = `url('${info.loginImagenFondo}')`; izq.classList.add('tiene-imagen'); }
    else { izq.style.backgroundImage = 'none'; izq.classList.remove('tiene-imagen'); }
  }
  const tIzq = document.getElementById('loginTituloIzquierdaTxt');
  if(tIzq) tIzq.innerText = info.loginTituloIzquierda || 'Domina el sistema';
  const sIzq = document.getElementById('loginSubtituloIzquierdaTxt');
  if(sIzq) sIzq.innerText = info.loginSubtituloIzquierda || 'Controla clientes, equipos, órdenes de servicio e inventario desde un solo lugar.';
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
  
  aplicarAparienciaLogin(info);

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
    if(!tecnicoId){ mostrarToast('Selecciona un técnico registrado.'); return; }
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
  
  aplicarRBACaUI();
  if(typeof mostrarSeccion === 'function') mostrarSeccion('agenda');
  if(typeof manejarParametroQR === 'function') manejarParametroQR();
  cargarEstadoDesdeBackend();
  registrarLog('Inicio de sesión', 'Sesión', nombreUsuarioActual());
}

const CATALOGO_PERMISOS = [
  { grupo:'Operativo', clave:'ordenes_crear', etiqueta:'Crear órdenes de servicio' },
  { grupo:'Operativo', clave:'ordenes_editar', etiqueta:'Editar orden completa' },
  { grupo:'Operativo', clave:'ordenes_reprogramar', etiqueta:'Reprogramar fecha/hora' },
  { grupo:'Operativo', clave:'ordenes_editar_finalizadas', etiqueta:'Editar órdenes finalizadas' },
  { grupo:'Operativo', clave:'ordenes_eliminar', etiqueta:'Eliminar órdenes' },
  { grupo:'Operativo', clave:'equipos_gestionar', etiqueta:'Crear y editar equipos' },
  { grupo:'Operativo', clave:'equipos_eliminar', etiqueta:'Eliminar equipos' },
  { grupo:'Operativo', clave:'inventario_ver', etiqueta:'Acceder a Inventario' },
  { grupo:'Operativo', clave:'enviar_whatsapp', etiqueta:'Enviar informes por WhatsApp' },
  { grupo:'Configuración', clave:'config_clientes', etiqueta:'Gestionar Clientes y Sedes' },
  { grupo:'Configuración', clave:'config_plantillas', etiqueta:'Diseñar Plantillas' },
  { grupo:'Configuración', clave:'config_personal', etiqueta:'Gestionar Personal' },
  { grupo:'Configuración', clave:'config_general', etiqueta:'Empresa y Perfil' },
  { grupo:'Configuración', clave:'config_apariencia', etiqueta:'Apariencia' },
  { grupo:'Configuración', clave:'config_etiquetas', etiqueta:'Etiquetas' },
  { grupo:'Configuración', clave:'config_whatsapp', etiqueta:'Plantilla de WhatsApp' },
  { grupo:'Configuración', clave:'config_backup', etiqueta:'Base de Datos y Respaldo' },
  { grupo:'Configuración', clave:'config_auditoria', etiqueta:'Ver Auditoría' },
  { grupo:'Negocio', clave:'kpi_ver', etiqueta:'Ver Indicadores (KPI)' },
  { grupo:'Negocio', clave:'contabilidad_ver', etiqueta:'Acceder a Contabilidad' },
  { grupo:'Negocio', clave:'nomina_editar', etiqueta:'Editar liquidaciones de nómina' },
  { grupo:'Negocio', clave:'nomina_eliminar', etiqueta:'Eliminar liquidaciones de nómina' },
  { grupo:'Negocio', clave:'reportes_exportar', etiqueta:'Exportar Reporte Excel' }
];

function tienePermiso(clave){
  if(esAdmin()) return true;
  if(!sesionActual || !sesionActual.tecnicoId) return false;
  const t = buscarTecnico(sesionActual.tecnicoId);
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
  if(syncEstado==='ok'){
    badge.innerHTML = '<span style="color:#22c55e;">● En línea</span>';
  } else if(syncEstado==='pendiente'){
    badge.innerHTML = '<span style="color:#f59e0b;">● Guardando...</span>';
  } else {
    badge.innerHTML = '<span style="color:#ef4444;">● Sin sincronizar</span>';
  }
}

// Inicializador automático al cargar el documento
window.addEventListener('DOMContentLoaded', () => {
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
