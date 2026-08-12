// ===== utilidades-navegacion.js — extraído de prevenglobal__25_.html (líneas 1957-2126) =====
/* =========================================================
   UTILIDADES DE CONSULTA
========================================================= */
function buscarCliente(id){ return db.clientes.find(c=>c.id===id); }
function equiposSinSedeDe(c){ if(!c.equiposSinSede) c.equiposSinSede = []; return c.equiposSinSede; }
function buscarSede(clienteId,sedeId){ const c=buscarCliente(clienteId); return c ? c.sedes.find(s=>s.id===sedeId) : null; }
function buscarEquipo(clienteId,sedeId,equipoId){
  const c = buscarCliente(clienteId);
  if(!c) return null;
  if(!sedeId){ return equiposSinSedeDe(c).find(e=>e.id===equipoId) || null; }
  const s=buscarSede(clienteId,sedeId); return s ? s.equipos.find(e=>e.id===equipoId) : null;
}
function ubicarEquipoPorId(equipoId){
  for(const c of db.clientes){
    for(const s of c.sedes) for(const e of s.equipos)
      if(e.id===equipoId) return {cliente:c, sede:s, equipo:e};
    for(const e of equiposSinSedeDe(c))
      if(e.id===equipoId) return {cliente:c, sede:null, equipo:e};
  }
  return null;
}
function buscarPlantilla(id){ return db.plantillas.find(p=>p.id===id); }
function buscarTecnico(id){ return db.tecnicos.find(t=>t.id===id); }
function badgeEstado(estado){
  const map={ "Programado":"badge-programado", "En Ejecución":"badge-ejecucion", "Finalizado":"badge-finalizado" };
  return `<span class="badge-estado ${map[estado]||'badge-programado'}">${estado}</span>`;
}

/* =========================================================
   NAVEGACIÓN / INICIO
   Con la pantalla de acceso reactivada: solo se entra a la app
   si hay una empresa + sesión de servidor válidas guardadas;
   si no, se muestra el login (empezando por el paso de empresa).
========================================================= */
window.onload = function(){
  // Enlace público de tienda (?tienda=codigo-empresa): no toca el login ni el resto
  // de la app — es una vista completamente aparte, de solo catálogo, sin sesión.
  const slugTiendaPublica = new URLSearchParams(location.search).get('tienda');
  if(slugTiendaPublica){
    ocultarSkeletonBoot();
    iniciarTiendaPublica(slugTiendaPublica.toLowerCase().trim());
    return;
  }
  setTimeout(ocultarSkeletonBoot, 2500); // red de seguridad, por si ningún otro punto lo oculta
  aplicarConfiguracionVisual();
  actualizarBadgeConexion();
  window.addEventListener('online', actualizarBadgeConexion);
  window.addEventListener('offline', actualizarBadgeConexion);
  document.querySelector('.sidebar-menu').addEventListener('click', e=>{
    if(e.target.closest('a') && window.innerWidth <= 640) cerrarMenuMovil();
  });

  const sinServidor = ['file:','content:',''].includes(location.protocol) || !location.protocol.startsWith('http'); // archivo abierto directamente (PC o Android), sin backend real
  const loginDesactivado = db.config.loginRequerido === false; // interruptor en Configuración

  if(sinServidor || loginDesactivado){
    if(!sesionActual){ sesionActual = { rol:'admin', tecnicoId:null }; localStorage.setItem(SESION_KEY, JSON.stringify(sesionActual)); }
    aplicarRBACaUI(); mostrarSeccion('agenda'); manejarParametroQR();
    if(!sinServidor) cargarEstadoDesdeBackend(); // si hay servidor pero el login está desactivado, igual sincroniza
    return;
  }

  if(empresaActual && sesionServidor && sesionActual){
    aplicarRBACaUI(); mostrarSeccion('agenda'); manejarParametroQR();
    cargarEstadoDesdeBackend();
  } else {
    mostrarLogin();
  }
};
function actualizarBadgeConexion(){
  const el = document.getElementById('badgeConexion');
  if(!el) return;
  if(!navigator.onLine){
    el.innerHTML = '🔴 Sin conexión — guardando localmente'; el.style.color = 'var(--orange-warning)';
  } else if(syncEstado === 'error'){
    el.innerHTML = '⚠️ No se guardó en el servidor — toca para reintentar'; el.style.color = 'var(--orange-warning)';
    el.style.cursor = 'pointer';
    el.onclick = () => sincronizarConBackend();
  } else if(syncEstado === 'pendiente'){
    el.innerHTML = '🟡 Guardando...'; el.style.color = 'var(--orange-warning)';
    el.style.cursor = 'default'; el.onclick = null;
  } else {
    el.innerHTML = '🟢 En línea'; el.style.color = 'var(--green-success)';
    el.style.cursor = 'default'; el.onclick = null;
  }
}

/* Menú lateral deslizante en teléfonos (capa aditiva, no cambia el comportamiento en pantallas grandes) */
function toggleMenuMovil(){ document.querySelector('.left-sidebar').classList.toggle('abierto'); }
function cerrarMenuMovil(){ document.querySelector('.left-sidebar').classList.remove('abierto'); }

function mostrarSeccion(nombre){
  ocultarSkeletonBoot();
  document.querySelectorAll('.seccion').forEach(el=>el.style.display='none');
  document.getElementById('seccion-'+nombre).style.display='block';
  document.querySelectorAll('.sidebar-menu a[data-sec]').forEach(a=>a.classList.remove('active'));
  const link = document.querySelector(`.sidebar-menu a[data-sec="${nombre}"]`);
  if(link) link.classList.add('active');
  if(nombre==='agenda') renderizarAgenda();
  if(nombre==='equipos') renderizarEquiposGlobal('');
  if(nombre==='trazabilidad') inicializarTrazabilidad();
  if(nombre==='inventario') renderizarInventario();
  if(nombre==='tienda') renderizarTienda();
  else {
    const btnWa = document.getElementById('tiendaBotonWhatsapp');
    if(btnWa) btnWa.style.display = 'none';
    if(intervaloBannerTienda){ clearInterval(intervaloBannerTienda); intervaloBannerTienda = null; }
  }
  if(nombre==='kpi') renderizarKPIs();
  if(nombre==='contabilidad') renderizarContabilidad();
  actualizarKPIs();
  aplicarRBACaUI();
  cerrarMenuMovil();
}

function aplicarConfiguracionVisual(){
  document.getElementById('lblNombreEmpresa').innerText = db.config.nombre;
  document.getElementById('brandTitleSidebar').innerText = db.config.nombre;
  document.getElementById('lblSubtituloEmpresa').innerText = db.config.subtitulo;
  aplicarAparienciaTienda();
  document.documentElement.style.setProperty('--blue-accent', db.config.colorAcento);
  document.documentElement.style.setProperty('--bg-dark', db.config.modoClaro ? '#f4f6f9' : db.config.colorFondo);
  document.documentElement.style.setProperty('--sidebar-bg-1', db.config.colorSidebar1 || '#24272e');
  document.documentElement.style.setProperty('--sidebar-bg-2', db.config.colorSidebar2 || '#15171c');
  document.documentElement.style.setProperty('--topbar-bg-1', db.config.colorTopbar1 || '#24272e');
  document.documentElement.style.setProperty('--topbar-bg-2', db.config.colorTopbar2 || '#191b20');
  document.documentElement.style.setProperty('--panel-bg-1', db.config.colorPanel1 || '#212429');
  document.documentElement.style.setProperty('--panel-bg-2', db.config.colorPanel2 || '#191b20');
  document.documentElement.style.setProperty('--font-family', db.config.fontFamily || "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif");
  document.body.classList.toggle('modo-claro', !!db.config.modoClaro);
  if(db.config.colorTexto) document.documentElement.style.setProperty('--text-main', db.config.colorTexto);
  else document.documentElement.style.removeProperty('--text-main');
  if(db.config.formBorderColor) document.documentElement.style.setProperty('--form-border-color', db.config.formBorderColor);
  else document.documentElement.style.removeProperty('--form-border-color');
  document.documentElement.style.setProperty('--form-radius', (db.config.formRadius!==undefined ? db.config.formRadius : 6) + 'px');
  document.body.classList.remove('letra-pequena','letra-grande');
  if(db.config.tamanoLetra==='sm') document.body.classList.add('letra-pequena');
  if(db.config.tamanoLetra==='lg') document.body.classList.add('letra-grande');
  const logoImg = document.getElementById('sidebarLogo');
  const iconoDefault = document.getElementById('sidebarIconoDefault');
  if(db.config.logo){ logoImg.src = db.config.logo; logoImg.style.display='block'; iconoDefault.style.display='none'; }
  else { logoImg.style.display='none'; iconoDefault.style.display='inline'; }
  const topbarLogo = document.getElementById('topbarLogo');
  if(topbarLogo){ if(db.config.logo){ topbarLogo.src = db.config.logo; topbarLogo.style.display='block'; } else { topbarLogo.style.display='none'; } }
}

function actualizarKPIs(){
  document.getElementById('kpiProgramados').innerText = db.ordenes.filter(o=>o.estado==='Programado').length;
  document.getElementById('kpiEjecucion').innerText = db.ordenes.filter(o=>o.estado==='En Ejecución').length;
  document.getElementById('kpiFinalizados').innerText = db.ordenes.filter(o=>o.estado==='Finalizado').length;
  let totalEquipos=0; db.clientes.forEach(c=>{ c.sedes.forEach(s=>totalEquipos+=s.equipos.length); totalEquipos+=equiposSinSedeDe(c).length; });
  document.getElementById('kpiEquipos').innerText = totalEquipos;
}

/* Notificaciones tipo "toast" — reemplazan las ventanas mostrarToast() del navegador.
   mostrarToast(mensaje, tipo) donde tipo es 'info' (por defecto), 'exito' o 'error'. */
function mostrarToast(mensaje, tipo){
  tipo = tipo || (/no se pud|error|falta|inválid|obligatorio|escribe|selecciona|debes|ya existe/i.test(mensaje) ? 'error' : /listo|guardad|creado|actualizad|registrad|exitos|correct|copiado/i.test(mensaje) ? 'exito' : 'info');
  const cont = document.getElementById('toastContainer');
  if(!cont){ console.log(mensaje); return; }
  const icono = tipo==='exito' ? '✅' : tipo==='error' ? '⚠️' : 'ℹ️';
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = `<span class="toast-icono">${icono}</span><span class="toast-texto">${mensaje}</span><span class="toast-cerrar" onclick="this.parentElement.remove()">✖</span>`;
  cont.appendChild(el);
  setTimeout(()=>{
    el.classList.add('saliendo');
    setTimeout(()=>el.remove(), 250);
  }, 4200);
}
