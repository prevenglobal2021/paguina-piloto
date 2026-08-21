// ===== core.js — extraído de prevenglobal__25_.html (líneas 1601-1956) =====
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
function guardarEnLocalStorage(){
  try{
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }catch(err){
    console.warn('[respaldo local] No se pudo guardar en este dispositivo (probablemente lleno):', err.message);
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

const API_BASE = '';
const EMPRESA_KEY = 'prevenglobal_empresa_v1';
const TOKEN_KEY = 'prevenglobal_token_v1';
let empresaActual = localStorage.getItem(EMPRESA_KEY) || '';
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
      if(err.name === 'AbortError') throw new Error('La conexión tardó demasiado (más de ' + segundos + ' segundos). Revisa tu señal e intenta de nuevo.');
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
    try{ const cuerpo = await resp.json(); if(cuerpo && cuerpo.error) detalle = cuerpo.error; }catch(e){ }
    if(!detalle){
      if(resp.status === 413) detalle = 'La información es demasiado pesada (posiblemente una foto sin comprimir).';
      else if(resp.status === 401) detalle = 'Tu sesión expiró, vuelve a iniciar sesión.';
    }
    throw new Error(`El servidor rechazó el guardado (código ${resp.status}). ${detalle}`);
  }
  try{
    const cuerpo = await resp.json();
    if(cuerpo && cuerpo.actualizadoEn) ultimaVersionConocida = cuerpo.actualizadoEn;
  }catch(e){ }
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
    if(!r.ok) throw new Error('sin datos en el servidor todavía');
    return r.json();
  }).then(estadoServidor=>{
    if(!estadoServidor || !estadoServidor.config) return;
    db = estadoServidor;
    asegurarEliminados();
    guardarEnLocalStorage();
    aplicarConfiguracionVisual();
    renderizarAgenda(); renderizarCalendario(); renderizarEquiposGlobal(''); actualizarKPIs();
    anotarVersionConocidaActual();
    iniciarRefrescoSilencioso();
  }).catch(()=>{ });
}

async function anotarVersionConocidaActual(){
  try{
    const r = await fetchConLimite(API_BASE + '/api/state/meta', { headers: headersAutenticados() }, 6);
    if(r.ok){ const d = await r.json(); ultimaVersionConocida = d.actualizadoEn; }
  }catch(e){ }
}
let intervaloRefrescoSilencioso = null;
async function revisarSiHayCambiosNuevos(){
  if(!empresaActual || !sesionServidor) return;
  if(syncEstado === 'pendiente') return;
  try{
    const r = await fetchConLimite(API_BASE + '/api/state/meta', { headers: headersAutenticados() }, 6);
    if(!r.ok) return;
    const { actualizadoEn } = await r.json();
    if(ultimaVersionConocida === null){ ultimaVersionConocida = actualizadoEn; return; }
    if(actualizadoEn !== ultimaVersionConocida){
      ultimaVersionConocida = actualizadoEn;
      refrescarSilenciosamenteDesdeServidor();
    }
  }catch(e){ }
}
function refrescarSilenciosamenteDesdeServidor(){
  if(!empresaActual || !sesionServidor) return;
  if(syncEstado === 'pendiente') return;
  fetch(API_BASE + '/api/state', { headers: headersAutenticados() }).then(r=>{
    if(!r.ok) throw new Error('sin respuesta');
    return r.json();
  }).then(remoto=>{
    const huboCambios = fusionarAdicionesDesdeServidor(remoto);
    if(huboCambios){
      guardarEnLocalStorage();
      renderizarAgenda(); renderizarCalendario(); renderizarEquiposGlobal(''); actualizarKPIs();
      mostrarToast('📥 Se actualizó información nueva desde otro dispositivo.');
    }
  }).catch(()=>{ });
}
function iniciarRefrescoSilencioso(){
  clearInterval(intervaloRefrescoSilencioso);
  intervaloRefrescoSilencioso = setInterval(revisarSiHayCambiosNuevos, 5000);
  if(!window.__refrescoAlVolverConfigurado){
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) revisarSiHayCambiosNuevos(); });
    window.__refrescoAlVolverConfigurado = true;
  }
}
function forzarNuevoLogin(){
  // Si está en modo escaneo QR público, no forzar login
  var params = new URLSearchParams(location.search);
  if(params.has('equipo') || params.has('tienda')) return;

  localStorage.removeItem(TOKEN_KEY);
  sesionServidor = null;
  mostrarLogin();
}

let db = dbCargar();
asegurarEliminados();
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

/* --- Pantalla de login --- */
function mostrarLogin(){
  // Si la URL contiene ?equipo=... (escaneo de QR público) o ?tienda=..., NUNCA abrir el login
  var params = new URLSearchParams(window.location.search);
  if(params.has('equipo') || params.has('tienda')) {
    var overlay = document.getElementById('loginOverlay');
    if(overlay) overlay.style.display = 'none';
    var sk = document.getElementById('skeletonBoot');
    if(sk) sk.style.display = 'none';
    return;
  }

  ocultarSkeletonBoot();
  document.getElementById('loginOverlay').style.display = 'flex';
  const slug = empresaActual || 'prevenglobal';
  document.getElementById('loginEmpresaSlug').value = slug;
  fetch(API_BASE + '/api/empresas/' + encodeURIComponent(slug)).then(r=>{
    if(!r.ok) throw new Error('sin respuesta');
    return r.json();
  }).then(info=>{
    empresaActual = slug;
    localStorage.setItem(EMPRESA_KEY, slug);
    mostrarPasoCredenciales(info);
  }).catch(()=>{
    mostrarPasoEmpresa();
  });
}
function aplicarAparienciaLogin(info){
  document.documentElement.style.setProperty('--login-color-1', info.loginColor1 || '#7c3aed');
  document.documentElement.style.setProperty('--login-color-2', info.loginColor2 || '#4c1d95');
  const izq = document.getElementById('loginColumnaIzquierda');
  if(izq){
    if(info.loginImagenFondo){ izq.style.backgroundImage = `url('${info.loginImagenFondo}')`; izq.classList.add('tiene-imagen'); }
    else { izq.style.backgroundImage = 'none'; izq.classList.remove('tiene-imagen'); }
  }
  document.getElementById('loginTituloIzquierdaTxt').innerText = info.loginTituloIzquierda || 'Domina el sistema';
  document.getElementById('loginSubtituloIzquierdaTxt').innerText = info.loginSubtituloIzquierda || 'Controla clientes, equipos, órdenes de servicio e inventario desde un solo lugar.';
  document.getElementById('loginBienvenidaTitulo').innerText = info.loginBienvenidaTitulo || '¡Bienvenido!';
  document.getElementById('loginBienvenidaSubtitulo').innerText = info.loginBienvenidaSubtitulo || 'Por favor inicia sesión';
}
function mostrarAyudaContrasena(){
  document.getElementById('resetSolicitudEmail').value = '';
  document.getElementById('resetSolicitudMensaje').style.display = 'none';
  abrirModal('modalSolicitarReset');
}
function enviarSolicitudReset(){
  const email = document.getElementById('resetSolicitudEmail').value.trim();
  const msgEl = document.getElementById('resetSolicitudMensaje');
  if(!email){ msgEl.style.display='block'; msgEl.style.color='var(--red-alert)'; msgEl.innerText='Escribe tu correo.'; return; }
  fetch(API_BASE + '/api/auth/solicitar-reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  }).then(r=>r.json()).then(data=>{
    msgEl.style.display = 'block'; msgEl.style.color = '#15803d';
    msgEl.innerText = data.mensaje || 'Si ese correo está registrado, revisa tu bandeja de entrada.';
  }).catch(()=>{
    msgEl.style.display = 'block'; msgEl.style.color = 'var(--red-alert)';
    msgEl.innerText = 'No se pudo conectar con el servidor. Intenta de nuevo en un momento.';
  });
}
function detectarTokenReset(){
  const params = new URLSearchParams(location.search);
  const token = params.get('resetToken');
  if(!token) return false;
  tokenResetActual = token;
  ocultarSkeletonBoot();
  document.getElementById('resetPasswordOverlay').style.display = 'flex';
  return true;
}
let tokenResetActual = null;
function confirmarNuevaPassword(){
  const nueva = document.getElementById('resetNuevaPassword').value;
  const confirmar = document.getElementById('resetConfirmarPassword').value;
  const msgEl = document.getElementById('resetConfirmarMensaje');
  msgEl.style.display = 'block';
  if(!nueva || nueva.length < 4){ msgEl.style.color='var(--red-alert)'; msgEl.innerText='La contraseña debe tener al menos 4 caracteres.'; return; }
  if(nueva !== confirmar){ msgEl.style.color='var(--red-alert)'; msgEl.innerText='Las dos contraseñas no coinciden.'; return; }
  fetch(API_BASE + '/api/auth/confirmar-reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenResetActual, nuevaPassword: nueva })
  }).then(async r=>{
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña.');
    msgEl.style.color = '#15803d';
    msgEl.innerText = '✅ Contraseña actualizada. Ya puedes iniciar sesión con ella.';
    setTimeout(()=>{ location.href = location.pathname; }, 2200);
  }).catch(err=>{
    msgEl.style.color = 'var(--red-alert)';
    msgEl.innerText = err.message;
  });
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
  }).catch(()=>{ });
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
    if(err.message==='no existe') return;
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
  aplicarAparienciaLogin(info);
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

const CATALOGO_PERMISOS = [
  { grupo:'Operativo', clave:'ordenes_crear', etiqueta:'Crear órdenes de servicio' },
  { grupo:'Operativo', clave:'ordenes_editar', etiqueta:'Editar orden completa (técnico, tipo, plantilla)' },
  { grupo:'Operativo', clave:'ordenes_reprogramar', etiqueta:'Reprogramar fecha/hora de una orden' },
  { grupo:'Operativo', clave:'ordenes_editar_finalizadas', etiqueta:'Editar órdenes ya finalizadas' },
  { grupo:'Operativo', clave:'ordenes_eliminar', etiqueta:'Eliminar órdenes' },
  { grupo:'Operativo', clave:'equipos_gestionar', etiqueta:'Crear y editar equipos' },
  { grupo:'Operativo', clave:'equipos_eliminar', etiqueta:'Eliminar equipos' },
  { grupo:'Operativo', clave:'inventario_ver', etiqueta:'Acceder a Inventario (verificación de stock)' },
  { grupo:'Operativo', clave:'enviar_whatsapp', etiqueta:'Enviar informes/comprobantes por WhatsApp' },
  { grupo:'Configuración', clave:'config_clientes', etiqueta:'Gestionar Clientes y Sedes' },
  { grupo:'Configuración', clave:'config_plantillas', etiqueta:'Diseñar Plantillas de Formularios' },
  { grupo:'Configuración', clave:'config_personal', etiqueta:'Gestionar Personal y sus permisos ⚠️' },
  { grupo:'Configuración', clave:'config_general', etiqueta:'Empresa y Perfil' },
  { grupo:'Configuración', clave:'config_apariencia', etiqueta:'Apariencia' },
  { grupo:'Configuración', clave:'config_etiquetas', etiqueta:'Etiquetas (tipos de servicio/prioridad)' },
  { grupo:'Configuración', clave:'config_whatsapp', etiqueta:'Plantilla de mensaje de WhatsApp' },
  { grupo:'Configuración', clave:'config_backup', etiqueta:'Base de Datos y Respaldo' },
  { grupo:'Configuración', clave:'config_auditoria', etiqueta:'Ver Auditoría' },
  { grupo:'Negocio', clave:'kpi_ver', etiqueta:'Ver Indicadores (KPI)' },
  { grupo:'Negocio', clave:'contabilidad_ver', etiqueta:'Acceder a Negocio / Contabilidad' },
  { grupo:'Negocio', clave:'nomina_editar', etiqueta:'Editar liquidaciones de nómina' },
  { grupo:'Negocio', clave:'nomina_eliminar', etiqueta:'Eliminar liquidaciones de nómina' },
  { grupo:'Negocio', clave:'reportes_exportar', etiqueta:'Exportar Reporte Excel' },
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
  document.getElementById('lblUsuarioActual').innerText = `${nombreUsuarioActual()} (${esAdmin()?'Administrador':'Personal'})`;
  document.querySelectorAll('.solo-admin').forEach(el=>{
    const permiso = el.getAttribute('data-permiso');
    el.style.display = (esAdmin() || (permiso && tienePermiso(permiso))) ? '' : 'none';
  });
}

let ordenReprogramarId = null;
let clienteActivoId = null, sedeActivaId = null, plantillaActivaId = null;
let mesCalendarioActual = new Date();
let logoTempBase64 = null;
let firmaTempBase64 = null;

let rangoSeleccionDiagnostico = null;

function guardarSeleccionDiagnostico() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const editor = document.getElementById('detDiagnostico');
    const range = sel.getRangeAt(0);
    if (editor && editor.contains(range.commonAncestorContainer)) {
      rangoSeleccionDiagnostico = range.cloneRange();
    }
  }
}

function restaurarSeleccionDiagnostico() {
  const editor = document.getElementById('detDiagnostico');
  if (!editor) return;
  editor.focus();
  if (rangoSeleccionDiagnostico) {
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(rangoSeleccionDiagnostico);
    }
  }
}

function aplicarFormatoDiagnostico(comando, valor) {
  restaurarSeleccionDiagnostico();
  if (comando === 'hiliteColor') {
    if (!document.execCommand('hiliteColor', false, valor)) {
      document.execCommand('backColor', false, valor);
    }
  } else {
    document.execCommand(comando, false, valor || null);
  }
  guardarSeleccionDiagnostico();
}
