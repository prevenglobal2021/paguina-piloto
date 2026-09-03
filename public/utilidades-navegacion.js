// ===== utilidades-navegacion.js — Navegación, Modales, Toast y Firma =====
/* =========================================================
   UTILIDADES DE NAVEGACIÓN Y MENÚS
========================================================= */
function mostrarSeccion(slug){
  document.querySelectorAll('.seccion').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
  
  const secEl = document.getElementById('seccion-' + slug);
  if(secEl) secEl.style.display = 'block';

  const linkEl = document.querySelector(`.sidebar-menu a[data-sec="${slug}"]`);
  if(linkEl) linkEl.classList.add('active');

  cerrarMenuMovil();

  if(slug === 'agenda'){
    if(typeof renderizarAgenda === 'function') renderizarAgenda();
    if(typeof renderizarCalendario === 'function') renderizarCalendario();
  } else if(slug === 'equipos' && typeof renderizarEquiposGlobal === 'function'){
    renderizarEquiposGlobal('');
  } else if(slug === 'trazabilidad' && typeof inicializarTrazabilidad === 'function'){
    inicializarTrazabilidad();
  } else if(slug === 'inventario' && typeof renderizarInventario === 'function'){
    renderizarInventario();
  } else if(slug === 'kpi' && typeof renderizarKPIs === 'function'){
    renderizarKPIs();
  } else if(slug === 'contabilidad' && typeof renderizarContabilidad === 'function'){
    renderizarContabilidad();
  } else if(slug === 'tienda' && typeof renderizarTienda === 'function'){
    renderizarTienda();
  }
}

function toggleMenuMovil(){
  const sb = document.querySelector('.left-sidebar');
  if(sb) sb.classList.toggle('abierto');
}

function cerrarMenuMovil(){
  const sb = document.querySelector('.left-sidebar');
  if(sb) sb.classList.remove('abierto');
}

function abrirModal(id){
  const el = document.getElementById(id);
  if(el) el.style.display = 'flex';
}

function cerrarModal(id){
  const el = document.getElementById(id);
  if(el) el.style.display = 'none';
}

function mostrarToast(mensaje, tipo){
  const cont = document.getElementById('toastContainer');
  if(!cont) return;
  const t = document.createElement('div');
  t.className = `toast ${tipo || 'info'}`;
  t.innerHTML = `
    <div class="toast-icono">${tipo === 'error' ? '⚠️' : (tipo === 'exito' ? '✅' : 'ℹ️')}</div>
    <div class="toast-texto">${mensaje}</div>
    <div class="toast-cerrar" onclick="this.parentElement.remove()">✕</div>
  `;
  cont.appendChild(t);
  setTimeout(()=>{
    t.classList.add('saliendo');
    setTimeout(()=>t.remove(), 260);
  }, 4200);
}

function formatoCOP(num){
  return '$' + Math.round(num || 0).toLocaleString('es-CO');
}

function buscarCliente(id){ return (db.clientes || []).find(c => c.id === id); }
function buscarSede(clienteId, sedeId){
  const c = buscarCliente(clienteId);
  return c ? (c.sedes || []).find(s => s.id === sedeId) : null;
}
function buscarEquipo(clienteId, sedeId, equipoId){
  const c = buscarCliente(clienteId);
  if(!c) return null;
  if(sedeId){
    const s = buscarSede(clienteId, sedeId);
    return s ? (s.equipos || []).find(e => e.id === equipoId) : null;
  }
  return equiposSinSedeDe(c).find(e => e.id === equipoId);
}
function buscarTecnico(id){ return (db.tecnicos || []).find(t => t.id === id); }
function buscarPlantilla(id){ return (db.plantillas || []).find(p => p.id === id); }
function equiposSinSedeDe(cliente){ return (cliente && cliente.equiposSinSede) || []; }

function ubicarEquipoPorId(equipoId){
  for(const c of (db.clientes || [])){
    for(const s of (c.sedes || [])){
      const eq = (s.equipos || []).find(e => e.id === equipoId);
      if(eq) return { cliente: c, sede: s, equipo: eq };
    }
    const eqSinSede = (c.equiposSinSede || []).find(e => e.id === equipoId);
    if(eqSinSede) return { cliente: c, sede: null, equipo: eqSinSede };
  }
  return null;
}

function nombreClienteOrden(o){
  if(o.esClienteNuevo) return (o.clienteNuevoNombre || 'Cliente Nuevo') + ' (Nuevo)';
  const c = buscarCliente(o.clienteId);
  return c ? c.nombre : 'Cliente Desconocido';
}

function etiquetaClienteNuevoHtml(o){
  if(!o.esClienteNuevo) return '';
  return ` <span style="font-size:10px;font-weight:700;background:#fee2e2;color:#dc2626;padding:2px 7px;border-radius:10px;margin-left:4px;">NUEVO</span>`;
}

function srcDeFoto(f){ return (typeof f === 'string') ? f : (f && f.src ? f.src : ''); }

function aplicarConfiguracionVisual(){
  const cfg = db.config || {};
  const acento = cfg.colorAcento || '#0088ff';
  document.documentElement.style.setProperty('--blue-accent', acento);
  document.documentElement.style.setProperty('--primary-color', acento);
  
  if(cfg.modoClaro) document.body.classList.add('modo-claro');
  else document.body.classList.remove('modo-claro');

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

/* =========================================================
   COMPONENTE DE FIRMA TÁCTIL (PANTALLA COMPLETA)
========================================================= */
let firmaDestinoActual = null;
let canvasFirma = null;
let ctxFirma = null;
let trazandoFirma = false;

function abrirFirmaTactil(destino, firmaExistente){
  firmaDestinoActual = destino;
  const overlay = document.getElementById('firmaTactilOverlay');
  if(!overlay) return;

  const lbl = document.getElementById('firmaTactilTitulo');
  if(lbl){
    lbl.innerText = destino === 'tecnico' ? '✍️ Firma del Técnico' : (destino === 'cliente' ? '✍️ Firma del Cliente' : '✍️ Firma del Representante');
  }

  asegurarBotoneraFirmaExtra();
  overlay.classList.add('activa');
  setTimeout(()=>{ inicializarLienzoFirma(firmaExistente); }, 60);
}

function inicializarLienzoFirma(firmaExistente){
  canvasFirma = document.getElementById('firmaTactilCanvas');
  if(!canvasFirma) return;

  ctxFirma = canvasFirma.getContext('2d');
  const rect = canvasFirma.getBoundingClientRect();
  canvasFirma.width = rect.width * 2;
  canvasFirma.height = rect.height * 2;
  ctxFirma.scale(2, 2);

  ctxFirma.strokeStyle = '#0f172a';
  ctxFirma.lineWidth = 2.8;
  ctxFirma.lineCap = 'round';
  ctxFirma.lineJoin = 'round';

  limpiarFirmaTactil();

  if(firmaExistente){
    const img = new Image();
    img.onload = () => { ctxFirma.drawImage(img, 0, 0, rect.width, rect.height); };
    img.src = firmaExistente;
  }

  canvasFirma.onmousedown = (e) => { trazandoFirma = true; ctxFirma.beginPath(); ctxFirma.moveTo(e.offsetX, e.offsetY); };
  canvasFirma.onmousemove = (e) => { if(trazandoFirma){ ctxFirma.lineTo(e.offsetX, e.offsetY); ctxFirma.stroke(); } };
  window.onmouseup = () => { trazandoFirma = false; };

  canvasFirma.ontouchstart = (e) => {
    e.preventDefault();
    trazandoFirma = true;
    const r = canvasFirma.getBoundingClientRect();
    const t = e.touches[0];
    ctxFirma.beginPath();
    ctxFirma.moveTo(t.clientX - r.left, t.clientY - r.top);
  };
  canvasFirma.ontouchmove = (e) => {
    e.preventDefault();
    if(!trazandoFirma) return;
    const r = canvasFirma.getBoundingClientRect();
    const t = e.touches[0];
    ctxFirma.lineTo(t.clientX - r.left, t.clientY - r.top);
    ctxFirma.stroke();
  };
  canvasFirma.ontouchend = () => { trazandoFirma = false; };
}

function limpiarFirmaTactil(){
  if(!ctxFirma || !canvasFirma) return;
  ctxFirma.clearRect(0, 0, canvasFirma.width, canvasFirma.height);
}

function cerrarFirmaTactil(){
  const overlay = document.getElementById('firmaTactilOverlay');
  if(overlay) overlay.classList.remove('activa');
}

function confirmarFirmaTactil(){
  if(!canvasFirma) return;
  const dataUrl = canvasFirma.toDataURL('image/png');

  if(firmaDestinoActual === 'tecnico'){
    firmaTecnicoTemp = dataUrl;
    const img = document.getElementById('detPreviewFirmaTecnico');
    const ph = document.getElementById('detPreviewFirmaTecnicoPlaceholder');
    if(img){ img.src = dataUrl; img.style.display = 'block'; }
    if(ph) ph.style.display = 'none';
  } else if(firmaDestinoActual === 'cliente'){
    firmaClienteTemp = dataUrl;
    const img = document.getElementById('detPreviewFirmaCliente');
    const ph = document.getElementById('detPreviewFirmaClientePlaceholder');
    if(img){ img.src = dataUrl; img.style.display = 'block'; }
    if(ph) ph.style.display = 'none';
  } else if(firmaDestinoActual === 'representante'){
    firmaTempBase64 = dataUrl;
    const img = document.getElementById('imgFirmaConfig');
    const ph = document.getElementById('previewFirmaConfigPlaceholder');
    if(img){ img.src = dataUrl; img.style.display = 'inline-block'; }
    if(ph) ph.style.display = 'none';
  }

  cerrarFirmaTactil();
  mostrarToast('✅ Firma guardada con éxito.', 'exito');
}

function exportarArchivoFirma(){
  if(!canvasFirma){ mostrarToast('No hay firma para exportar.'); return; }
  const dataUrl = canvasFirma.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `firma-${firmaDestinoActual || 'registro'}-${new Date().toISOString().slice(0,10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  mostrarToast('✅ Firma exportada en PNG.', 'exito');
}

function dispararSubidaFirma(){
  const input = document.getElementById('inputSubirFirmaOculto');
  if(input) input.click();
}

function manejarSubidaFirma(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      limpiarFirmaTactil();
      const rect = canvasFirma.getBoundingClientRect();
      ctxFirma.drawImage(img, 0, 0, rect.width, rect.height);
      mostrarToast('Firma cargada al lienzo.', 'exito');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function asegurarBotoneraFirmaExtra(){
  const botonera = document.querySelector('.firma-tactil-botonera');
  if(!botonera || document.getElementById('btnExportarFirmaDoc')) return;

  const btnSubir = document.createElement('button');
  btnSubir.type = 'button';
  btnSubir.id = 'btnSubirFirmaDoc';
  btnSubir.className = 'firma-tactil-btn';
  btnSubir.style.cssText = 'background:#475569;color:#fff;font-size:13px;padding:10px;';
  btnSubir.innerHTML = '<i class="fas fa-upload"></i> Subir archivo';
  btnSubir.onclick = dispararSubidaFirma;

  const btnExportar = document.createElement('button');
  btnExportar.type = 'button';
  btnExportar.id = 'btnExportarFirmaDoc';
  btnExportar.className = 'firma-tactil-btn';
  btnExportar.style.cssText = 'background:#0284c7;color:#fff;font-size:13px;padding:10px;';
  btnExportar.innerHTML = '<i class="fas fa-download"></i> Exportar PNG';
  btnExportar.onclick = exportarArchivoFirma;

  const inputOculto = document.createElement('input');
  inputOculto.type = 'file';
  inputOculto.id = 'inputSubirFirmaOculto';
  inputOculto.accept = 'image/png, image/jpeg';
  inputOculto.style.display = 'none';
  inputOculto.onchange = manejarSubidaFirma;

  botonera.insertBefore(btnExportar, botonera.lastElementChild);
  botonera.insertBefore(btnSubir, btnExportar);
  document.body.appendChild(inputOculto);
}
