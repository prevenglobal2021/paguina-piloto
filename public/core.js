// ===== core.js — extraído de prevenglobal__25_.html (líneas 1601-1956) =====
/* =========================================================
   CAPA DE DATOS (equivalente a db.js) — hoy: localStorage.

   NOTA SOBRE ARQUITECTURA DE ALMACENAMIENTO (punto 3 del alcance):
   Este archivo es un PROTOTIPO 100% de navegador (front-end puro):
   guarda todo en localStorage y no tiene servidor ni base de datos
   real. La estructura jerárquica de carpetas y el modelo relacional
   descritos abajo son el diseño objetivo para la implementación en
   producción (backend + storage en la nube), y no pueden crearse
   dentro de este prototipo porque requieren un servidor:

   Storage de archivos (backend):
     /Clientes/[ID_Nombre_Cliente]/Sedes/[Nombre_Sede]/Equipos/[QR_ID_Equipo]/
     /Clientes/[ID_Nombre_Cliente]/Ordenes_Servicio/[Año_Mes]/[No_Orden.pdf]
     /Inventario/Bodegas/[ID_Bodega]/Items/[Codigo_Item]/

   Base de datos relacional (backend):
     Cliente (1) -> Sedes/Sucursales (N) -> Equipos (N)
     Auditoría automatizada (logs) por fecha, hora y usuario en cada
     cambio — en este prototipo ya se registra en db.logs.

   Este prototipo ya refleja ese modelo en su estructura de datos en
   memoria (clientes -> sedes -> equipos, bodegas -> ítems, y un QR
   único por equipo/ítem para trazabilidad), de modo que migrar a un
   backend real (p. ej. Node/Express + Postgres + S3 o almacenamiento
   en la nube siguiendo las rutas de arriba) sea un mapeo directo.
========================================================= */
const DB_KEY = 'prevenglobal_db_v2';

function dbCargar(){
  const raw = localStorage.getItem(DB_KEY);
  if(raw) return JSON.parse(raw);
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
        cierre:{ fecha:"2026-07-20", diagnostico:"Corrección de fuga en racor de línea de líquido, prueba de vacío realizada y ajuste de parámetros en controlador LS-200-04.", respuestas:{}, fotos:[], firmaTecnico:null, firmaCliente:null } },
      { id:2, numero:"OS-2026-0002", clienteId:2, sedeId:21, equipoId:211, tecnicoId:1, tipo:"Mantenimiento Preventivo", prioridad:"Media", plantillaId:1, estado:"Programado", fechaProgramada:"2026-07-28", cierre:null }
    ],
    bodegas:[
      { id:1, nombre:"Bodega Principal", tipo:"fija" }
    ],
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
function dbGuardar(){
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  sincronizarConBackend();
}
function dbGuardarInmediato(){
  // Para acciones explícitas de "Guardar" (el usuario espera que quede guardado YA,
  // sin esperar la demora de 400ms que usa el guardado automático de fondo).
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  if(!empresaActual || !sesionServidor) return;
  clearTimeout(sincronizacionPendiente);
  syncEstado = 'pendiente';
  actualizarBadgeConexion();
  enviarEstadoAlServidor().catch(marcarErrorSync);
}

/* ---------------------------------------------------------
   PLATAFORMA MULTIEMPRESA — sincronización con el backend real.
   Cada empresa (tenant) tiene su propio espacio de datos en el
   servidor, identificado por un "código de empresa" (slug). El
   inicio de sesión (técnico o administrador) se valida siempre
   en el servidor —incluida la contraseña maestra—, nunca en el
   navegador. localStorage sigue siendo la copia local/offline.
--------------------------------------------------------- */
const API_BASE = '';
const EMPRESA_KEY = 'prevenglobal_empresa_v1';
const TOKEN_KEY = 'prevenglobal_token_v1';
let empresaActual = localStorage.getItem(EMPRESA_KEY) || '';
let sesionServidor = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); // {token, rol, tecnicoId, nombreEmpresa}

function headersAutenticados(extra){
  const h = Object.assign({ 'X-Empresa': empresaActual }, extra || {});
  if(sesionServidor && sesionServidor.token) h['Authorization'] = 'Bearer ' + sesionServidor.token;
  return h;
}
let sincronizacionPendiente = null;
let syncEstado = 'ok'; // 'ok' | 'pendiente' | 'error' — refleja si el servidor realmente confirmó el último guardado
let syncReintentoTimer = null;

// -----------------------------------------------------------------
// FUSIÓN ADITIVA — evita que un dispositivo con datos desactualizados
// (ej. el PC con la pestaña abierta desde antes) borre por accidente
// algo que se guardó desde otro dispositivo (ej. un técnico agregado
// desde el celular). Solo AGREGA lo que falta, por id; nunca modifica
// ni elimina nada que ya esté localmente.
// -----------------------------------------------------------------
const CLAVES_FUSIONABLES = ['clientes','tecnicos','plantillas','ordenes','bodegas','inventario','kardex','pedidosTienda'];
function fusionarPorId(localArr, remotoArr){
  if(!Array.isArray(localArr) || !Array.isArray(remotoArr)) return localArr || remotoArr || [];
  const idsLocal = new Set(localArr.map(x=>x && x.id));
  const faltantes = remotoArr.filter(x=>x && !idsLocal.has(x.id));
  return faltantes.length ? localArr.concat(faltantes) : localArr;
}
function fusionarAdicionesDesdeServidor(remoto){
  if(!remoto) return false;
  let huboCambios = false;
  CLAVES_FUSIONABLES.forEach(clave=>{
    if(Array.isArray(remoto[clave])){
      const antes = (db[clave]||[]).length;
      db[clave] = fusionarPorId(db[clave]||[], remoto[clave]);
      if(db[clave].length !== antes) huboCambios = true;
    }
  });
  return huboCambios;
}
// Antes de subir cualquier cambio local, primero se trae lo último del servidor
// y se fusiona — así el guardado del PC nunca sobreescribe algo agregado, por
// ejemplo, desde el celular unos segundos antes.
async function fusionarConServidorAntesDeGuardar(){
  if(!empresaActual || !sesionServidor) return;
  try{
    const r = await fetch(API_BASE + '/api/state', { headers: headersAutenticados() });
    if(r.ok){
      const remoto = await r.json();
      fusionarAdicionesDesdeServidor(remoto);
    }
  }catch(e){ /* sin conexión: seguimos con la copia local, ya sin fusionar */ }
}

async function enviarEstadoAlServidor(){
  await fusionarConServidorAntesDeGuardar();
  const resp = await fetch(API_BASE + '/api/state', {
    method: 'PUT',
    headers: headersAutenticados({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(db)
  });
  if(!resp.ok){
    // Antes esto no se verificaba: un 413 (payload muy grande, típico con fotos sin
    // comprimir de celular) o un 500 pasaban como "enviado" sin serlo, en silencio.
    let detalle = '';
    if(resp.status === 413) detalle = 'La información es demasiado pesada (posiblemente una foto sin comprimir).';
    else if(resp.status === 401) detalle = 'Tu sesión expiró, vuelve a iniciar sesión.';
    throw new Error(`El servidor rechazó el guardado (código ${resp.status}). ${detalle}`);
  }
  syncEstado = 'ok';
  actualizarBadgeConexion();
}

function marcarErrorSync(err){
  syncEstado = 'error';
  actualizarBadgeConexion();
  mostrarToast('⚠️ No se pudo guardar en el servidor: ' + err.message + ' Tus datos siguen aquí en el dispositivo, pero NO se han subido a la plataforma.', 'error');
  clearTimeout(syncReintentoTimer);
  syncReintentoTimer = setTimeout(()=>{ if(syncEstado==='error') sincronizarConBackend(); }, 15000);
}

function sincronizarConBackend(){
  if(!empresaActual || !sesionServidor) return; // sin sesión activa: no hay a dónde sincronizar todavía
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
    if(!r.ok) throw new Error('sin datos en el servidor todavía');
    return r.json();
  }).then(estadoServidor=>{
    if(!estadoServidor || !estadoServidor.config) return;
    db = estadoServidor;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    aplicarConfiguracionVisual();
    renderizarAgenda(); renderizarCalendario(); renderizarEquiposGlobal(''); actualizarKPIs();
    iniciarRefrescoSilencioso();
  }).catch(()=>{ /* sin conexión: seguimos trabajando con la copia local (modo offline) */ });
}
let intervaloRefrescoSilencioso = null;
function refrescarSilenciosamenteDesdeServidor(){
  if(!empresaActual || !sesionServidor) return;
  if(syncEstado === 'pendiente') return; // no interferir mientras hay un guardado en curso
  fetch(API_BASE + '/api/state', { headers: headersAutenticados() }).then(r=>{
    if(!r.ok) throw new Error('sin respuesta');
    return r.json();
  }).then(remoto=>{
    const huboCambios = fusionarAdicionesDesdeServidor(remoto);
    if(huboCambios){
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      renderizarAgenda(); renderizarCalendario(); renderizarEquiposGlobal(''); actualizarKPIs();
      mostrarToast('📥 Se actualizó información nueva desde otro dispositivo.');
    }
  }).catch(()=>{ /* sin conexión: se reintenta en el próximo ciclo */ });
}
function iniciarRefrescoSilencioso(){
  clearInterval(intervaloRefrescoSilencioso);
  intervaloRefrescoSilencioso = setInterval(refrescarSilenciosamenteDesdeServidor, 20000);
}
function forzarNuevoLogin(){
  localStorage.removeItem(TOKEN_KEY);
  sesionServidor = null;
  mostrarLogin();
}

let db = dbCargar();
if(!db.config.colorAcento) db.config.colorAcento = "#0088ff";
if(!db.config.colorFondo) db.config.colorFondo = "#0b111e";
if(db.config.modoClaro===undefined) db.config.modoClaro = false;
if(!db.config.tiposServicio) db.config.tiposServicio = ["Mantenimiento Preventivo","Mantenimiento Correctivo","Instalación","Diagnóstico"];
if(!db.config.prioridades) db.config.prioridades = ["Media","Alta","Baja"];
if(!db.config.plantillaWhatsApp) db.config.plantillaWhatsApp = "Hola {nombre_cliente}, adjuntamos el informe de la orden {numero_orden}. Cualquier duda con gusto la resolvemos. ¡Gracias por confiar en nosotros!";
if(!db.bodegas) db.bodegas = [{ id:1, nombre:"Bodega Principal", tipo:"fija" }];
if(!db.inventario) db.inventario = [];
if(!db.kardex) db.kardex = [];
if(!db.logs) db.logs = [];

/* =========================================================
   RBAC — sesión, roles y permisos
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
  db.logs.push({ id:Date.now()+Math.random(), usuario:nombreUsuarioActual(), rol:sesionActual?sesionActual.rol:'—', accion, entidad, detalle, timestamp:new Date().toISOString() });
  dbGuardar();
}
function cerrarSesion(){
  localStorage.removeItem(SESION_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sesionActual = null;
  sesionServidor = null;
  location.reload();
}

/* --- Pantalla de login: paso 1 (empresa) / paso 1b (crear empresa) / paso 2 (credenciales) --- */
function mostrarLogin(){
  ocultarSkeletonBoot();
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('loginEmpresaSlug').value = empresaActual;
  mostrarPasoEmpresa();
}
function mostrarPasoEmpresa(){
  document.getElementById('loginPasoEmpresa').style.display = 'block';
  document.getElementById('loginPasoEmpresaNueva').style.display = 'none';
  document.getElementById('loginPasoCredenciales').style.display = 'none';
  document.getElementById('loginEmpresaError').style.display = 'none';
  cargarListaEmpresas();
}
function cargarListaEmpresas(){
  const cont = document.getElementById('loginListaEmpresas');
  if(!cont) return;
  cont.innerHTML = '';
  fetch(API_BASE + '/api/empresas').then(r=>r.ok ? r.json() : []).then(lista=>{
    if(!lista || !lista.length) return;
    cont.innerHTML = '<label style="text-align:left;">Empresas registradas — toca la tuya:</label>' +
      lista.map(e=>`<div class="boton-empresa-registrada" onclick="document.getElementById('loginEmpresaSlug').value='${e.slug}';continuarConEmpresa();">${e.nombre} <small>${e.slug}</small></div>`).join('');
  }).catch(()=>{ /* sin conexión: el campo de texto sigue funcionando igual */ });
}
function mostrarFormularioEmpresaNueva(){
  document.getElementById('loginPasoEmpresa').style.display = 'none';
  document.getElementById('loginPasoEmpresaNueva').style.display = 'block';
  document.getElementById('loginPasoCredenciales').style.display = 'none';
  document.getElementById('nuevaEmpresaSlug').value = document.getElementById('loginEmpresaSlug').value.trim();
}
function continuarConEmpresa(){
  const slug = document.getElementById('loginEmpresaSlug').value.trim().toLowerCase();
  const errEl = document.getElementById('loginEmpresaError');
  errEl.style.display = 'none';
  if(!slug){ errEl.innerText = 'Escribe el código de tu empresa.'; errEl.style.display = 'block'; return; }
  fetch(API_BASE + '/api/empresas/' + encodeURIComponent(slug)).then(r=>{
    if(r.status===404){ errEl.innerText = 'No existe esa empresa. Puedes crearla abajo.'; errEl.style.display = 'block'; throw new Error('no existe'); }
    if(!r.ok) throw new Error('error de red');
    return r.json();
  }).then(info=>{
    empresaActual = slug;
    localStorage.setItem(EMPRESA_KEY, slug);
    mostrarPasoCredenciales(info);
  }).catch(err=>{
    if(err.message==='no existe') return; // ya se mostró el mensaje correspondiente arriba
    errEl.innerText = 'No se pudo conectar con el servidor. Verifica que la app esté corriendo (node server.js) y que la estés abriendo desde su dirección http://, no como archivo local.';
    errEl.style.display = 'block';
  });
}
function mostrarPasoCredenciales(info){
  document.getElementById('loginPasoEmpresa').style.display = 'none';
  document.getElementById('loginPasoEmpresaNueva').style.display = 'none';
  document.getElementById('loginPasoCredenciales').style.display = 'block';
  document.getElementById('loginEmpresaActualLbl').innerText = `Empresa: ${info.nombre || empresaActual}`;
  document.getElementById('loginTituloEmpresa').lastChild.textContent = ' ' + (info.nombre || 'Prevenglobal');
  const logoWrap = document.getElementById('loginLogoWrap');
  const logoImg = document.getElementById('loginLogo');
  const iconoDefault = document.getElementById('loginIconoDefault');
  if(info.logo){ logoImg.src = info.logo; logoWrap.style.display = 'flex'; iconoDefault.style.display = 'none'; }
  else { logoWrap.style.display = 'none'; iconoDefault.style.display = 'inline'; }
  const selTec = document.getElementById('loginTecnicoSelect');
  selTec.innerHTML = (info.tecnicos||[]).map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('') || '<option value="">Sin técnicos registrados</option>';
  document.getElementById('loginTecnicoPassword').value = '';
  document.getElementById('loginAdminUsuario').value = '';
  document.getElementById('loginAdminPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
}
function crearEmpresaNueva(){
  const errEl = document.getElementById('loginEmpresaNuevaError');
  errEl.style.display = 'none';
  const slug = document.getElementById('nuevaEmpresaSlug').value.trim().toLowerCase();
  const nombre = document.getElementById('nuevaEmpresaNombre').value.trim();
  const adminUsuario = document.getElementById('nuevaEmpresaAdminUsuario').value.trim();
  const adminPassword = document.getElementById('nuevaEmpresaAdminPassword').value;
  if(!slug || !nombre || !adminUsuario || !adminPassword){ errEl.innerText = 'Completa todos los campos.'; errEl.style.display = 'block'; return; }
  fetch(API_BASE + '/api/empresas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, nombre, adminUsuario, adminPassword })
  }).then(async r=>{
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'No se pudo crear la empresa.');
    return data;
  }).then(resultado=>{
    empresaActual = slug;
    localStorage.setItem(EMPRESA_KEY, slug);
    completarLogin(resultado);
  }).catch(err=>{ errEl.innerText = err.message; errEl.style.display = 'block'; });
}
function iniciarSesionComo(rol){
  const errorEl = document.getElementById('loginError');
  errorEl.style.display = 'none';
  const payload = { slug: empresaActual, tipo: rol };
  if(rol==='tecnico'){
    const tecnicoId = parseInt(document.getElementById('loginTecnicoSelect').value);
    if(!tecnicoId){ mostrarToast('Registra al menos un técnico en Configuración antes de ingresar como técnico.'); return; }
    payload.tecnicoId = tecnicoId;
    payload.password = document.getElementById('loginTecnicoPassword').value;
  } else {
    payload.usuario = document.getElementById('loginAdminUsuario').value.trim();
    payload.password = document.getElementById('loginAdminPassword').value;
  }
  fetch(API_BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(async r=>{
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'credenciales incorrectas');
    return data;
  }).then(resultado=> completarLogin(resultado))
    .catch(err=>{
      errorEl.innerText = err.message==='Failed to fetch' ? 'No se pudo conectar con el servidor.' : (err.message || 'Usuario o contraseña incorrectos.');
      errorEl.style.display = 'block';
    });
}
function completarLogin(resultado){
  sesionServidor = { token: resultado.token, rol: resultado.rol, tecnicoId: resultado.tecnicoId || null, nombreEmpresa: resultado.nombreEmpresa };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(sesionServidor));
  sesionActual = { rol: resultado.rol, tecnicoId: resultado.tecnicoId || null };
  localStorage.setItem(SESION_KEY, JSON.stringify(sesionActual));
  document.getElementById('loginOverlay').style.display = 'none';
  aplicarRBACaUI();
  mostrarSeccion('agenda');
  manejarParametroQR();
  cargarEstadoDesdeBackend();
  registrarLog('Inicio de sesión', 'Sesión', nombreUsuarioActual());
}
function aplicarRBACaUI(){
  document.getElementById('lblUsuarioActual').innerText = `${nombreUsuarioActual()} (${esAdmin()?'Administrador':'Técnico'})`;
  document.querySelectorAll('.solo-admin').forEach(el=> el.style.display = esAdmin() ? '' : 'none');
}

let ordenActivaId = null, ordenReprogramarId = null;
let clienteActivoId = null, sedeActivaId = null, plantillaActivaId = null;
let mesCalendarioActual = new Date();
let fotosTempCierre = [];
let fotosCamposTemp = {};
let logoTempBase64 = null;

