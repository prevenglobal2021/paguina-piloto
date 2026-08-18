// ===== ordenes.js — extraído de prevenglobal__25_.html (líneas 2524-2919) =====
/* =========================================================
   CIERRE DE SERVICIO (plantilla + fotos + doble firma)
========================================================= */
function iniciarCierre(ordenId){
  ordenActivaId = ordenId;
  fotosTempCierre = [];
  const o = db.ordenes.find(x=>x.id===ordenId);
  const equipo = buscarEquipo(o.clienteId, o.sedeId, o.equipoId);
  document.getElementById('lblOrdenActivaCierre').innerText = `${o.numero} · ${nombreClienteOrden(o)}${o.esClienteNuevo?' (Cliente nuevo)':''} · ${equipo?equipo.nombre:''}`;
  document.getElementById('cierreDiagnostico').value = '';
  document.getElementById('previewFotosCierre').innerHTML = '';
  renderizarFormularioDinamico(o.plantillaId);
  abrirModal('modalEvidencias');
  setTimeout(()=>{ inicializarCanvasFirma('canvasFirmaTecnico'); inicializarCanvasFirma('canvasFirmaCliente'); }, 50);
}
function renderizarFormularioDinamico(plantillaId){
  const cont = document.getElementById('contenedorCamposDinamicos');
  cont.innerHTML = '';
  fotosCamposTemp = {};
  const plantilla = buscarPlantilla(plantillaId);
  if(!plantilla || plantilla.campos.length===0){ cont.innerHTML = '<p style="font-size:11px;color:var(--text-muted);">Esta orden no tiene plantilla de formulario asignada.</p>'; return; }
  plantilla.campos.forEach(campo=>{
    if(campo.tipo==='checklist'){
      const itemsHtml = (campo.items||[]).map(item=>`
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
          <input type="checkbox" data-campo="${campo.id}" data-item="${item.id}" style="width:auto;margin:0;">
          <span style="font-size:12px;">${item.texto}</span>
        </div>`).join('');
      cont.innerHTML += `<div style="margin-top:10px;border-top:1px dashed var(--card-border);padding-top:8px;"><label>${campo.label}:</label>${itemsHtml}</div>`;
    } else if(campo.tipo==='foto'){
      fotosCamposTemp[campo.id] = [];
      cont.innerHTML += `<div style="margin-top:10px;border-top:1px dashed var(--card-border);padding-top:8px;">
        <label>${campo.label}:</label>
        <input type="file" accept="image/*" multiple onchange="manejarFotoCampo(event, ${campo.id})">
        <div class="fotos-grid" id="previewFotoCampo${campo.id}"></div>
      </div>`;
    } else {
      let inputHtml;
      if(campo.tipo==='textarea') inputHtml = `<textarea rows="2" data-campo="${campo.id}"></textarea>`;
      else if(campo.tipo==='checkbox') inputHtml = `<select data-campo="${campo.id}"><option value="Sí">Sí</option><option value="No">No</option></select>`;
      else inputHtml = `<input type="${campo.tipo}" data-campo="${campo.id}">`;
      cont.innerHTML += `<div style="margin-top:8px;"><label>${campo.label}:</label>${inputHtml}</div>`;
    }
  });
}
function manejarFotoCampo(event, campoId){
  const files = Array.from(event.target.files);
  if(!fotosCamposTemp[campoId]) fotosCamposTemp[campoId] = [];
  files.forEach(file=>{
    comprimirImagen(file).then(dataUrl=>{ fotosCamposTemp[campoId].push(dataUrl); renderizarFotoCampoPreview(campoId); });
  });
  event.target.value = '';
}
function renderizarFotoCampoPreview(campoId){
  const cont = document.getElementById('previewFotoCampo'+campoId);
  if(!cont) return;
  cont.innerHTML = (fotosCamposTemp[campoId]||[]).map((f,idx)=>`
    <div class="foto-thumb"><img src="${f}"><button onclick="eliminarFotoCampoTemp(${campoId},${idx})">✖</button></div>
  `).join('');
}
function eliminarFotoCampoTemp(campoId, idx){
  fotosCamposTemp[campoId].splice(idx,1);
  renderizarFotoCampoPreview(campoId);
}

/* --- Compresión automática de imágenes (antes de guardar en la BD) --- */
function comprimirImagen(file, maxDim, calidad){
  maxDim = maxDim || 1280; calidad = calidad || 0.7;
  return new Promise((resolve, reject)=>{
    if(!file){ reject(new Error('Sin archivo')); return; }
    if(file.type && !file.type.startsWith('image/')){
      mostrarToast(`"${file.name||'el archivo'}" no es una imagen compatible. Elige una foto en formato JPG o PNG.`);
      reject(new Error('Archivo no es imagen'));
      return;
    }
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w > maxDim || h > maxDim){
          if(w >= h){ h = Math.round(h*(maxDim/w)); w = maxDim; }
          else { w = Math.round(w*(maxDim/h)); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = ()=>{
        // Algunos formatos (ej. HEIC de iPhone) no se pueden decodificar/comprimir en el
        // navegador. Se sube la imagen original sin comprimir en vez de no subir nada,
        // pero se avisa porque un archivo así de pesado puede hacer fallar el guardado.
        console.warn('No se pudo comprimir la imagen, se sube sin comprimir:', file.name);
        mostrarToast(`"${file.name||'la foto'}" no se pudo comprimir (formato no compatible, ej. HEIC de iPhone) y se subirá pesada. Si el guardado falla, tómala en formato JPG desde la cámara.`, 'info');
        resolve(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.onerror = ()=>{
      mostrarToast(`No se pudo leer el archivo "${file.name||''}". Intenta con otra foto.`);
      reject(new Error('Error de lectura del archivo'));
    };
    reader.readAsDataURL(file);
  });
}

/* --- Fotos de evidencia --- */
function normalizarFotosEvidencia(fotos){
  // Compatibilidad: órdenes guardadas antes de esta función tenían las fotos como texto plano (solo la imagen, sin descripción).
  return (fotos||[]).map(f => (typeof f === 'string') ? { src:f, desc:'' } : { src:f.src, desc:f.desc||'' });
}
function manejarFotosCierre(event){
  const files = Array.from(event.target.files);
  if(files.length===0) return;
  files.forEach(file=>{
    comprimirImagen(file).then(dataUrl=>{ fotosTempCierre.push({ src:dataUrl, desc:'' }); renderizarFotosPreview(); });
  });
  event.target.value = '';
}
function renderizarFotosPreview(){
  const cont = document.getElementById('previewFotosCierre');
  cont.innerHTML = fotosTempCierre.map((f,idx)=>`
    <div class="foto-thumb foto-thumb-con-desc"><img src="${f.src}"><button onclick="eliminarFotoTemp(${idx})">✖</button>
      <input type="text" class="foto-desc-input" placeholder="Descripción (opcional)" value="${(f.desc||'').replace(/"/g,'&quot;')}" oninput="fotosTempCierre[${idx}].desc=this.value">
    </div>
  `).join('');
}
function eliminarFotoTemp(idx){ fotosTempCierre.splice(idx,1); renderizarFotosPreview(); }

/* --- Firmas (técnico + cliente) --- */
let canvasCtxs = {}; let dibujandoCanvas = null;
function activarDibujoCanvas(canvas, ctx, id){
  const pos = e=>{
    const r = canvas.getBoundingClientRect();
    const t = e.touches && e.touches[0];
    const x = t ? t.clientX : e.clientX, y = t ? t.clientY : e.clientY;
    return { x: x - r.left, y: y - r.top };
  };
  const iniciar = e=>{ e.preventDefault(); dibujandoCanvas=id; ctx.beginPath(); const p=pos(e); ctx.moveTo(p.x,p.y); };
  const mover = e=>{ if(dibujandoCanvas!==id) return; e.preventDefault(); const p=pos(e); ctx.lineWidth=2; ctx.strokeStyle="#0088ff"; ctx.lineCap='round'; ctx.lineTo(p.x,p.y); ctx.stroke(); };
  const soltar = ()=>{ dibujandoCanvas=null; };
  canvas.onmousedown = iniciar; canvas.onmousemove = mover; canvas.onmouseup = soltar; canvas.onmouseleave = soltar;
  // Táctil (celular/tablet): antes solo funcionaba con mouse, no respondía al dedo.
  canvas.ontouchstart = iniciar; canvas.ontouchmove = mover; canvas.ontouchend = soltar; canvas.ontouchcancel = soltar;
}
function inicializarCanvasFirma(id){
  const canvas = document.getElementById(id);
  if(!canvas) return;
  canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');
  canvasCtxs[id] = ctx;
  activarDibujoCanvas(canvas, ctx, id);
}
function limpiarFirma(id){ const ctx=canvasCtxs[id]; const canvas=document.getElementById(id); if(ctx&&canvas) ctx.clearRect(0,0,canvas.width,canvas.height); }

function guardarCierre(){
  const o = db.ordenes.find(x=>x.id===ordenActivaId);
  if(!o) return;
  const respuestas = {};
  document.querySelectorAll('#contenedorCamposDinamicos [data-campo]').forEach(el=>{
    if(el.dataset.item){
      if(!respuestas[el.dataset.campo]) respuestas[el.dataset.campo] = {};
      respuestas[el.dataset.campo][el.dataset.item] = el.checked;
    } else {
      respuestas[el.dataset.campo] = el.value;
    }
  });
  const canvasTec = document.getElementById('canvasFirmaTecnico');
  const canvasCli = document.getElementById('canvasFirmaCliente');
  o.cierre = {
    fecha: new Date().toISOString().slice(0,10),
    diagnostico: document.getElementById('cierreDiagnostico').value,
    respuestas,
    fotos: fotosTempCierre.slice(),
    fotosPorCampo: JSON.parse(JSON.stringify(fotosCamposTemp)),
    firmaTecnico: canvasTec ? canvasTec.toDataURL() : null,
    firmaCliente: canvasCli ? canvasCli.toDataURL() : null
  };
  o.estado = 'Finalizado';
  dbGuardar();
  registrarLog('Registrar cierre', 'OrdenServicio', `${o.numero} finalizada por ${nombreUsuarioActual()}`);
  cerrarModal('modalEvidencias');
  mostrarToast('Cierre registrado en la base de datos.');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
}

/* =========================================================
   DETALLE / EDICIÓN DE ORDEN DESDE EL CALENDARIO
   Editable mientras la orden no esté "Finalizada". Al presionar
   "Finalizar Orden" queda bloqueada (solo lectura) para proteger
   la trazabilidad de la Hoja de Vida del equipo.
========================================================= */
let ordenDetalleId = null;
let fotosDetalleTemp = [];
let fotosCamposDetalleTemp = {};

let solicitudEdicionForzada = false; // bandera de un solo uso: la activa editarOrdenFinalizada()
let ordenDetalleEsEdicionForzada = false; // vigente mientras el modal de detalle está abierto en ese modo
function editarOrdenFinalizada(ordenId){
  if(!esAdmin()) return;
  solicitudEdicionForzada = true;
  verDetalleOrden(ordenId);
}
function verDetalleOrden(ordenId){
  ordenDetalleId = ordenId;
  const o = db.ordenes.find(x=>x.id===ordenId);
  if(!o) return;
  ordenDetalleEsEdicionForzada = solicitudEdicionForzada;
  solicitudEdicionForzada = false;
  const finalizada = o.estado === 'Finalizado' && !ordenDetalleEsEdicionForzada;

  document.getElementById('lblNumeroOrdenDetalle').innerText = `📋 ${o.numero} · ${nombreClienteOrden(o)}${finalizada ? ' — Finalizada' : (ordenDetalleEsEdicionForzada ? ' — Editando orden finalizada' : '')}`;

  const selCliente = document.getElementById('detCliente');
  selCliente.innerHTML = db.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');
  document.getElementById('detAvisoClienteNuevo').style.display = o.esClienteNuevo ? 'block' : 'none';
  document.getElementById('detWrapperClienteExistente').style.display = o.esClienteNuevo ? 'none' : 'block';
  document.getElementById('detWrapperEquipoExistente').style.display = o.esClienteNuevo ? 'none' : 'block';
  if(o.esClienteNuevo){
    document.getElementById('detClienteNuevoInfo').innerText = `${o.clienteNuevoNombre||'—'} — ${o.clienteNuevoDireccion||'sin dirección'}`;
  } else {
    selCliente.value = o.clienteId;
    poblarEquiposDetalleOrden(o.equipoId);
  }

  const selTec = document.getElementById('detTecnico');
  selTec.innerHTML = '<option value="">Sin asignar</option>' + db.tecnicos.filter(t=>t.activo!==false || t.id===o.tecnicoId).map(t=>`<option value="${t.id}">${t.nombre}${t.activo===false?' (inactivo)':''}</option>`).join('');
  selTec.value = o.tecnicoId || '';

  document.getElementById('detTipo').innerHTML = db.config.tiposServicio.map(t=>`<option ${t===o.tipo?'selected':''}>${t}</option>`).join('');
  document.getElementById('detPrioridad').innerHTML = db.config.prioridades.map(p=>`<option ${p===o.prioridad?'selected':''}>${p}</option>`).join('');
  document.getElementById('detFecha').value = o.fechaProgramada || '';
  document.getElementById('detHora').value = o.horaProgramada || '';
  document.getElementById('detEstado').value = (o.estado==='Finalizado') ? 'Programado' : o.estado;

  const selPlant = document.getElementById('detPlantilla');
  selPlant.innerHTML = '<option value="">Sin plantilla</option>' + db.plantillas.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
  selPlant.value = o.plantillaId || '';

  document.getElementById('detDiagnostico').value = (o.cierre && o.cierre.diagnostico) || '';
  fotosDetalleTemp = normalizarFotosEvidencia(o.cierre && o.cierre.fotos);
  renderizarFotosDetallePreview();
  renderizarFormularioDinamicoDetalle(o.plantillaId, (o.cierre && o.cierre.respuestas) || {}, (o.cierre && o.cierre.fotosPorCampo) || {});

  const camposEditables = ['detCliente','detEquipo','detTecnico','detTipo','detPrioridad','detFecha','detHora','detEstado','detPlantilla','detDiagnostico','detInputFotos'];
  camposEditables.forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled = finalizada; });
  document.querySelectorAll('#detCamposDinamicos [data-campo]').forEach(el=>el.disabled = finalizada);
  document.querySelectorAll('#detPreviewFotos button, [id^="detPreviewFotoCampo"] button').forEach(b=>b.style.display = finalizada ? 'none' : '');
  document.getElementById('detAccionesEdicion').style.display = finalizada ? 'none' : 'flex';
  document.getElementById('detAccionesSoloLectura').style.display = finalizada ? 'block' : 'none';
  document.getElementById('detAvisoFinalizada').style.display = finalizada ? 'block' : 'none';
  document.getElementById('detAvisoEdicionForzada').style.display = (ordenDetalleEsEdicionForzada && o.estado==='Finalizado') ? 'block' : 'none';

  abrirModal('modalDetalleOrden');
  setTimeout(()=>{
    inicializarCanvasFirmaConPrefill('detCanvasFirmaTecnico', o.cierre && o.cierre.firmaTecnico, finalizada);
    inicializarCanvasFirmaConPrefill('detCanvasFirmaCliente', o.cierre && o.cierre.firmaCliente, finalizada);
  }, 50);
}
function poblarEquiposDetalleOrden(equipoIdPreseleccionado){
  const clienteId = parseInt(document.getElementById('detCliente').value);
  const c = clienteId ? buscarCliente(clienteId) : null;
  const selEq = document.getElementById('detEquipo');
  if(!c){ selEq.innerHTML = '<option value="">Selecciona un Cliente</option>'; return; }
  let opciones = [];
  c.sedes.forEach(s=>s.equipos.forEach(e=>opciones.push({ id:e.id, texto:`${e.nombre}${e.serie?' ('+e.serie+')':''} — ${s.nombre}` })));
  equiposSinSedeDe(c).forEach(e=>opciones.push({ id:e.id, texto:`${e.nombre}${e.serie?' ('+e.serie+')':''} — Sin sede` }));
  selEq.innerHTML = opciones.length ? opciones.map(o=>`<option value="${o.id}">${o.texto}</option>`).join('') : '<option value="">Este cliente no tiene equipos</option>';
  if(equipoIdPreseleccionado) selEq.value = equipoIdPreseleccionado;
}
function renderizarFormularioDinamicoDetalle(plantillaId, respuestasExistentes, fotosPorCampoExistentes){
  const cont = document.getElementById('detCamposDinamicos');
  cont.innerHTML = '';
  fotosCamposDetalleTemp = JSON.parse(JSON.stringify(fotosPorCampoExistentes||{}));
  const plantilla = buscarPlantilla(parseInt(plantillaId));
  if(!plantilla || plantilla.campos.length===0){ cont.innerHTML = '<p style="font-size:11px;color:var(--text-muted);">Esta orden no tiene plantilla de formulario asignada.</p>'; return; }
  plantilla.campos.forEach(campo=>{
    if(campo.tipo==='checklist'){
      const respCampo = respuestasExistentes[campo.id] || {};
      const itemsHtml = (campo.items||[]).map(item=>`
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
          <input type="checkbox" data-campo="${campo.id}" data-item="${item.id}" style="width:auto;margin:0;" ${respCampo[item.id]?'checked':''}>
          <span style="font-size:12px;">${item.texto}</span>
        </div>`).join('');
      cont.innerHTML += `<div style="margin-top:10px;border-top:1px dashed var(--card-border);padding-top:8px;"><label>${campo.label}:</label>${itemsHtml}</div>`;
    } else if(campo.tipo==='foto'){
      if(!fotosCamposDetalleTemp[campo.id]) fotosCamposDetalleTemp[campo.id] = [];
      cont.innerHTML += `<div style="margin-top:10px;border-top:1px dashed var(--card-border);padding-top:8px;">
        <label>${campo.label}:</label>
        <input type="file" accept="image/*" multiple onchange="manejarFotoCampoDetalle(event, ${campo.id})">
        <div class="fotos-grid" id="detPreviewFotoCampo${campo.id}"></div>
      </div>`;
      renderizarFotoCampoDetallePreview(campo.id);
    } else {
      const valorExistente = respuestasExistentes[campo.id] || '';
      let inputHtml;
      if(campo.tipo==='textarea') inputHtml = `<textarea rows="2" data-campo="${campo.id}">${valorExistente}</textarea>`;
      else if(campo.tipo==='checkbox') inputHtml = `<select data-campo="${campo.id}"><option value="Sí" ${valorExistente==='Sí'?'selected':''}>Sí</option><option value="No" ${valorExistente==='No'?'selected':''}>No</option></select>`;
      else inputHtml = `<input type="${campo.tipo}" data-campo="${campo.id}" value="${valorExistente}">`;
      cont.innerHTML += `<div style="margin-top:8px;"><label>${campo.label}:</label>${inputHtml}</div>`;
    }
  });
}
function manejarFotoCampoDetalle(event, campoId){
  const files = Array.from(event.target.files);
  if(!fotosCamposDetalleTemp[campoId]) fotosCamposDetalleTemp[campoId] = [];
  files.forEach(file=>{ comprimirImagen(file).then(dataUrl=>{ fotosCamposDetalleTemp[campoId].push(dataUrl); renderizarFotoCampoDetallePreview(campoId); }); });
  event.target.value='';
}
function renderizarFotoCampoDetallePreview(campoId){
  const cont = document.getElementById('detPreviewFotoCampo'+campoId);
  if(!cont) return;
  cont.innerHTML = (fotosCamposDetalleTemp[campoId]||[]).map((f,idx)=>`
    <div class="foto-thumb"><img src="${f}"><button onclick="eliminarFotoCampoDetalleTemp(${campoId},${idx})">✖</button></div>
  `).join('');
}
function eliminarFotoCampoDetalleTemp(campoId, idx){ fotosCamposDetalleTemp[campoId].splice(idx,1); renderizarFotoCampoDetallePreview(campoId); }
function manejarFotosDetalle(event){
  const files = Array.from(event.target.files);
  files.forEach(file=>{ comprimirImagen(file).then(dataUrl=>{ fotosDetalleTemp.push({ src:dataUrl, desc:'' }); renderizarFotosDetallePreview(); }); });
  event.target.value='';
}
function renderizarFotosDetallePreview(){
  document.getElementById('detPreviewFotos').innerHTML = fotosDetalleTemp.map((f,idx)=>`
    <div class="foto-thumb foto-thumb-con-desc"><img src="${f.src}"><button onclick="eliminarFotoDetalleTemp(${idx})">✖</button>
      <input type="text" class="foto-desc-input" placeholder="Descripción (opcional)" value="${(f.desc||'').replace(/"/g,'&quot;')}" oninput="fotosDetalleTemp[${idx}].desc=this.value">
    </div>
  `).join('');
}
function eliminarFotoDetalleTemp(idx){ fotosDetalleTemp.splice(idx,1); renderizarFotosDetallePreview(); }
function inicializarCanvasFirmaConPrefill(id, firmaExistenteDataUrl, soloLectura){
  const canvas = document.getElementById(id);
  if(!canvas) return;
  canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');
  canvasCtxs[id] = ctx;
  if(firmaExistenteDataUrl){
    const img = new Image();
    img.onload = ()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);
    img.src = firmaExistenteDataUrl;
  }
  if(soloLectura){ canvas.onmousedown=null; canvas.onmousemove=null; canvas.onmouseup=null; canvas.ontouchstart=null; canvas.ontouchmove=null; canvas.ontouchend=null; canvas.style.pointerEvents='none'; return; }
  canvas.style.pointerEvents = 'auto';
  activarDibujoCanvas(canvas, ctx, id);
}
function guardarDetalleOrden(finalizar){
  const o = db.ordenes.find(x=>x.id===ordenDetalleId);
  if(!o) return;
  const esEdicionForzada = o.estado==='Finalizado' && ordenDetalleEsEdicionForzada && esAdmin();
  if(o.estado==='Finalizado' && !esEdicionForzada){ mostrarToast('Esta orden está finalizada y no se puede editar.'); return; }
  let clienteId, equipoId, sedeId;
  if(o.esClienteNuevo){
    // El cliente/equipo de una orden de cliente nuevo no se puede reasignar desde
    // aquí — se conservan tal cual quedaron al crear la orden.
    clienteId = o.clienteId; equipoId = o.equipoId; sedeId = o.sedeId;
  } else {
    clienteId = parseInt(document.getElementById('detCliente').value);
    equipoId = parseInt(document.getElementById('detEquipo').value);
    if(!clienteId || !equipoId){ mostrarToast('Selecciona Cliente y Equipo.'); return; }
    const infoEquipo = ubicarEquipoPorId(equipoId);
    if(!infoEquipo || infoEquipo.cliente.id !== clienteId){ mostrarToast('El equipo seleccionado no corresponde al cliente elegido.'); return; }
    sedeId = infoEquipo.sede ? infoEquipo.sede.id : null;
  }
  const tecnicoIdRaw = document.getElementById('detTecnico').value;
  const plantillaIdRaw = document.getElementById('detPlantilla').value;

  const respuestas = {};
  document.querySelectorAll('#detCamposDinamicos [data-campo]').forEach(el=>{
    if(el.dataset.item){
      if(!respuestas[el.dataset.campo]) respuestas[el.dataset.campo] = {};
      respuestas[el.dataset.campo][el.dataset.item] = el.checked;
    } else {
      respuestas[el.dataset.campo] = el.value;
    }
  });
  const canvasTec = document.getElementById('detCanvasFirmaTecnico');
  const canvasCli = document.getElementById('detCanvasFirmaCliente');

  o.clienteId = clienteId; o.sedeId = sedeId; o.equipoId = equipoId;
  o.tecnicoId = tecnicoIdRaw ? parseInt(tecnicoIdRaw) : null;
  o.tipo = document.getElementById('detTipo').value;
  o.prioridad = document.getElementById('detPrioridad').value;
  o.fechaProgramada = document.getElementById('detFecha').value || null;
  o.horaProgramada = document.getElementById('detHora').value || null;
  o.plantillaId = plantillaIdRaw ? parseInt(plantillaIdRaw) : null;
  o.cierre = {
    fecha: (o.cierre && o.cierre.fecha) || new Date().toISOString().slice(0,10),
    diagnostico: document.getElementById('detDiagnostico').value,
    respuestas,
    fotos: fotosDetalleTemp.slice(),
    fotosPorCampo: JSON.parse(JSON.stringify(fotosCamposDetalleTemp)),
    firmaTecnico: canvasTec ? canvasTec.toDataURL() : (o.cierre?o.cierre.firmaTecnico:null),
    firmaCliente: canvasCli ? canvasCli.toDataURL() : (o.cierre?o.cierre.firmaCliente:null)
  };
  o.estado = (finalizar || esEdicionForzada) ? 'Finalizado' : document.getElementById('detEstado').value;

  dbGuardar();
  registrarLog(esEdicionForzada ? 'Editar orden finalizada' : (finalizar ? 'Finalizar' : 'Editar'), 'OrdenServicio', `${o.numero} (${nombreUsuarioActual()})`);
  cerrarModal('modalDetalleOrden');
  ordenDetalleEsEdicionForzada = false;
  if(finalizar && !esEdicionForzada) mostrarToast('Orden finalizada. Los datos quedaron bloqueados para edición.');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
}
function confirmarFinalizarOrden(){
  if(!confirm('¿Finalizar esta orden? Una vez finalizada no podrás editar el técnico, los datos del formulario, las fotos ni las firmas.')) return;
  guardarDetalleOrden(true);
}

