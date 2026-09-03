// ===== utilidades-navegacion.js — Navegación, Firmas Táctiles, Subida y Exportación =====
/* =========================================================
   COMPONENTE DE FIRMA TÁCTIL (PANTALLA COMPLETA)
   Integrado con el HTML nativo: permite dibujar, subir y exportar
========================================================= */
let firmaDestinoActual = null; // 'tecnico' | 'cliente' | 'representante'
let canvasFirma = null;
let ctxFirma = null;
let trazandoFirma = false;

function abrirFirmaTactil(destino, firmaExistente){
  firmaDestinoActual = destino;
  const overlay = document.getElementById('firmaTactilOverlay');
  if(!overlay) return;

  const lbl = document.getElementById('firmaTactilTitulo');
  if(lbl){
    lbl.innerText = destino === 'tecnico' ? '✍️ Firma del Técnico' : (destino === 'cliente' ? '✍️ Firma del Cliente' : '✍️ Firma del Representante Legal');
  }

  asegurarBotoneraFirmaExtra();

  overlay.classList.add('activa');
  setTimeout(()=>{
    inicializarLienzoFirma(firmaExistente);
  }, 50);
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
    const rect = canvasFirma.getBoundingClientRect();
    const t = e.touches[0];
    ctxFirma.beginPath();
    ctxFirma.moveTo(t.clientX - rect.left, t.clientY - rect.top);
  };
  canvasFirma.ontouchmove = (e) => {
    e.preventDefault();
    if(!trazandoFirma) return;
    const rect = canvasFirma.getBoundingClientRect();
    const t = e.touches[0];
    ctxFirma.lineTo(t.clientX - rect.left, t.clientY - rect.top);
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
  mostrarToast('✅ Firma guardada en el formulario.', 'exito');
}

/* --- Exportar archivo de firma (PNG transparente) --- */
function exportarArchivoFirma(){
  if(!canvasFirma){ mostrarToast('No hay firma disponible para exportar.'); return; }
  const dataUrl = canvasFirma.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `firma-${firmaDestinoActual || 'servicio'}-${new Date().toISOString().slice(0,10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  mostrarToast('✅ Archivo de firma descargado en formato PNG.', 'exito');
}

/* --- Subir archivo de firma desde el computador / celular --- */
function dispararSubidaFirma(){
  const input = document.getElementById('inputSubirArchivoFirmaOculto');
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
      mostrarToast('Firma cargada al recuadro correctamente.', 'exito');
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
  inputOculto.id = 'inputSubirArchivoFirmaOculto';
  inputOculto.accept = 'image/png, image/jpeg';
  inputOculto.style.display = 'none';
  inputOculto.onchange = manejarSubidaFirma;

  botonera.insertBefore(btnExportar, botonera.lastElementChild);
  botonera.insertBefore(btnSubir, btnExportar);
  document.body.appendChild(inputOculto);
}
