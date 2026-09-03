// ===== utilidades-navegacion.js — Firmas Táctiles, Modales, Subida y Exportación =====
/* =========================================================
   COMPONENTE DE FIRMA TÁCTIL, IMPORTACIÓN Y EXPORTACIÓN
========================================================= */
let lienzoFirma = null;
let ctxFirma = null;
let dibujandoFirma = false;
let tipoFirmaActual = null; // 'tecnico' | 'cliente'

function abrirLienzoFirma(tipo){
  tipoFirmaActual = tipo;
  asegurarModalFirmaEnDOM();
  
  const lbl = document.getElementById('lblTituloModalFirma');
  if(lbl){
    lbl.innerText = tipo === 'tecnico' ? '✍️ Firma del Técnico Responsable' : '✍️ Firma de Aceptación del Cliente';
  }

  abrirModal('modalLienzoFirma');
  setTimeout(inicializarCanvasFirma, 60);
}

function inicializarCanvasFirma(){
  lienzoFirma = document.getElementById('canvasFirmaTactil');
  if(!lienzoFirma) return;
  
  ctxFirma = lienzoFirma.getContext('2d');
  
  const rect = lienzoFirma.getBoundingClientRect();
  lienzoFirma.width = rect.width * 2;
  lienzoFirma.height = rect.height * 2;
  ctxFirma.scale(2, 2);
  
  ctxFirma.strokeStyle = '#0f172a';
  ctxFirma.lineWidth = 2.8;
  ctxFirma.lineCap = 'round';
  ctxFirma.lineJoin = 'round';

  limpiarLienzoFirma();

  lienzoFirma.onmousedown = empezarTrazoFirma;
  lienzoFirma.onmousemove = trazarFirma;
  window.onmouseup = terminarTrazoFirma;

  lienzoFirma.ontouchstart = (e)=>{
    e.preventDefault();
    const t = e.touches[0];
    empezarTrazoFirma(obtenerCoordsTouch(t));
  };
  lienzoFirma.ontouchmove = (e)=>{
    e.preventDefault();
    const t = e.touches[0];
    trazarFirma(obtenerCoordsTouch(t));
  };
  lienzoFirma.ontouchend = terminarTrazoFirma;
}

function obtenerCoordsTouch(touch){
  const rect = lienzoFirma.getBoundingClientRect();
  return {
    clientX: touch.clientX,
    clientY: touch.clientY,
    offsetX: touch.clientX - rect.left,
    offsetY: touch.clientY - rect.top
  };
}

function empezarTrazoFirma(e){
  dibujandoFirma = true;
  ctxFirma.beginPath();
  ctxFirma.moveTo(e.offsetX, e.offsetY);
}

function trazarFirma(e){
  if(!dibujandoFirma) return;
  ctxFirma.lineTo(e.offsetX, e.offsetY);
  ctxFirma.stroke();
}

function terminarTrazoFirma(){
  dibujandoFirma = false;
}

function limpiarLienzoFirma(){
  if(!ctxFirma || !lienzoFirma) return;
  ctxFirma.clearRect(0, 0, lienzoFirma.width, lienzoFirma.height);
}

/* --- EXPORTAR ARCHIVO DE FIRMA (PNG TRANSPARENTE) --- */
function exportarArchivoFirma(){
  if(!lienzoFirma){
    mostrarToast('No hay ninguna firma activa para exportar.');
    return;
  }

  const dataUrl = lienzoFirma.toDataURL('image/png');
  const ahora = new Date().toISOString().slice(0, 10);
  const nombreSugerido = `firma-${tipoFirmaActual || 'registro'}-${ahora}.png`;

  const enlaceDescarga = document.createElement('a');
  enlaceDescarga.href = dataUrl;
  enlaceDescarga.download = nombreSugerido;
  document.body.appendChild(enlaceDescarga);
  enlaceDescarga.click();
  enlaceDescarga.remove();

  mostrarToast(`✅ Archivo de firma "${nombreSugerido}" exportado.`, 'exito');
}

/* --- SUBIR ARCHIVO DE FIRMA DESDE EL DISPOSITIVO --- */
function dispararSubidaArchivoFirma(){
  const input = document.getElementById('inputSubirArchivoFirma');
  if(input) input.click();
}

function manejarArchivoFirmaSubido(event){
  const file = event.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      limpiarLienzoFirma();
      const rect = lienzoFirma.getBoundingClientRect();
      ctxFirma.drawImage(img, 0, 0, rect.width, rect.height);
      mostrarToast('Firma cargada al lienzo correctamente.', 'exito');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function guardarFirmaLienzo(){
  if(!lienzoFirma) return;
  const dataUrl = lienzoFirma.toDataURL('image/png');

  if(tipoFirmaActual === 'tecnico'){
    firmaTecnicoTemp = dataUrl;
    actualizarPreviewFirmaOrden('tecnico');
  } else if(tipoFirmaActual === 'cliente'){
    firmaClienteTemp = dataUrl;
    actualizarPreviewFirmaOrden('cliente');
  }

  cerrarModal('modalLienzoFirma');
  mostrarToast('Firma guardada correctamente.', 'exito');
}

function actualizarPreviewFirmaOrden(tipo){
  const imgEl = document.getElementById(tipo === 'tecnico' ? 'detPreviewFirmaTecnico' : 'detPreviewFirmaCliente');
  const phEl = document.getElementById(tipo === 'tecnico' ? 'detPreviewFirmaTecnicoPlaceholder' : 'detPreviewFirmaClientePlaceholder');
  const val = (tipo === 'tecnico') ? firmaTecnicoTemp : firmaClienteTemp;

  if(imgEl && phEl){
    if(val){
      imgEl.src = val;
      imgEl.style.display = 'block';
      phEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      phEl.style.display = 'block';
    }
  }
}

/* ---------------------------------------------------------
   INYECCIÓN DEL MODAL CON BOTONES DE SUBIR Y EXPORTAR
--------------------------------------------------------- */
function asegurarModalFirmaEnDOM(){
  if(document.getElementById('modalLienzoFirma')) return;
  const div = document.createElement('div');
  div.id = 'modalLienzoFirma';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.style.zIndex = '999999';
  div.innerHTML = `
    <div class="modal-card" style="max-width:600px;width:94%;padding:18px;border-radius:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--card-border);padding-bottom:10px;margin-bottom:12px;">
        <h4 id="lblTituloModalFirma" style="margin:0;font-size:16px;">✍️ Firma Táctil</h4>
        <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="cerrarModal('modalLienzoFirma')">✕</button>
      </div>

      <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px 0;">Dibuja la firma en el área blanca o carga un archivo existente:</p>

      <div style="background:#ffffff;border:2px dashed #94a3b8;border-radius:10px;overflow:hidden;position:relative;">
        <canvas id="canvasFirmaTactil" style="width:100%;height:220px;display:block;touch-action:none;cursor:crosshair;"></canvas>
      </div>

      <input type="file" id="inputSubirArchivoFirma" accept="image/png, image/jpeg" style="display:none;" onchange="manejarArchivoFirmaSubido(event)">

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:14px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="limpiarLienzoFirma()"><i class="fas fa-eraser"></i> Limpiar</button>
          <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" style="background:#f1f5f9;font-weight:600;" onclick="dispararSubidaArchivoFirma()"><i class="fas fa-upload"></i> Subir Archivo</button>
          <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" style="background:#e0f2fe;color:#0369a1;border-color:#7dd3fc;font-weight:600;" onclick="exportarArchivoFirma()"><i class="fas fa-download"></i> Exportar Archivo</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn-custom btn-secondary-custom" onclick="cerrarModal('modalLienzoFirma')">Cancelar</button>
          <button type="button" class="btn-custom btn-primary-custom" onclick="guardarFirmaLienzo()">Aceptar Firma</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div);
}
