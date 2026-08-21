// ===== ordenes.js — extraído de prevenglobal__25_.html (líneas 2524-2919) =====
/* =========================================================
   CIERRE DE SERVICIO — unificado dentro del flujo de "Ver / Cerrar Orden"
   (ver verDetalleOrden / guardarDetalleOrden más abajo). Antes existía un
   flujo aparte ("Registrar Cierre") que pedía casi los mismos datos que
   éste — se quitó para no duplicar el formulario ni la información.
========================================================= */
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
/* Las firmas (técnico + cliente) ahora usan el componente único de "Firma
   táctil" en pantalla completa — ver utilidades-navegacion.js. */



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

  document.getElementById('detDiagnostico').innerHTML = (o.cierre && o.cierre.diagnostico) || '';
  fotosDetalleTemp = normalizarFotosEvidencia(o.cierre && o.cierre.fotos);
  renderizarFotosDetallePreview();
  renderizarFormularioDinamicoDetalle(o.plantillaId, (o.cierre && o.cierre.respuestas) || {}, (o.cierre && o.cierre.fotosPorCampo) || {});

  // Los datos de la orden (cliente, equipo, técnico asignado, tipo, plantilla, etc.)
  // solo los puede cambiar quien tenga permiso de "Editar orden completa" — pero
  // cerrar la orden (llenar el formulario, fotos, firmas y finalizar) sigue
  // disponible para cualquier técnico con la orden asignada, sin ese permiso,
  // igual que ya funcionaba con el botón "Registrar Cierre" que se unificó aquí.
  const puedeEditarMetadata = !finalizada && (esAdmin() || tienePermiso('ordenes_editar'));
  const camposMetadata = ['detCliente','detEquipo','detTecnico','detTipo','detPrioridad','detFecha','detHora','detEstado','detPlantilla'];
  camposMetadata.forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled = !puedeEditarMetadata; });
  const camposEditables = ['detInputFotos'];
  camposEditables.forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled = finalizada; });
  const editorDiagnostico = document.getElementById('detDiagnostico');
  if(editorDiagnostico){ editorDiagnostico.contentEditable = finalizada ? 'false' : 'true'; }
  const barraFormatoDiagnostico = editorDiagnostico ? editorDiagnostico.previousElementSibling : null;
  if(barraFormatoDiagnostico) barraFormatoDiagnostico.style.display = finalizada ? 'none' : 'flex';
  document.querySelectorAll('#detCamposDinamicos [data-campo]').forEach(el=>{
    if(el.hasAttribute('contenteditable')){
      el.contentEditable = finalizada ? 'false' : 'true';
      const barra = el.previousElementSibling;
      if(barra && barra.classList.contains('editor-rico-toolbar')) barra.style.display = finalizada ? 'none' : 'flex';
    } else {
      el.disabled = finalizada;
    }
  });
  document.querySelectorAll('#detPreviewFotos button, [id^="detPreviewFotoCampo"] button').forEach(b=>b.style.display = finalizada ? 'none' : '');
  document.getElementById('detAccionesEdicion').style.display = finalizada ? 'none' : 'flex';
  document.getElementById('detAccionesSoloLectura').style.display = finalizada ? 'block' : 'none';
  document.getElementById('detAvisoFinalizada').style.display = finalizada ? 'block' : 'none';
  document.getElementById('detAvisoEdicionForzada').style.display = (ordenDetalleEsEdicionForzada && o.estado==='Finalizado') ? 'block' : 'none';

  // Carga la firma ya guardada (si existe) en la vista previa, y prepara el
  // botón "Firmar" para reabrir el lienzo táctil en pantalla completa. En
  // modo solo lectura (orden finalizada), el botón de firmar se oculta.
  firmaTecnicoTemp = (o.cierre && o.cierre.firmaTecnico) || null;
  firmaClienteTemp = (o.cierre && o.cierre.firmaCliente) || null;
  actualizarPreviewFirmaOrden('tecnico');
  actualizarPreviewFirmaOrden('cliente');
  document.getElementById('detBtnFirmarTecnico').style.display = finalizada ? 'none' : 'inline-flex';
  document.getElementById('detBtnFirmarCliente').style.display = finalizada ? 'none' : 'inline-flex';
  if(!firmaTecnicoTemp){ document.getElementById('detPreviewFirmaTecnico').style.display='none'; document.getElementById('detPreviewFirmaTecnicoPlaceholder').style.display='block'; }
  if(!firmaClienteTemp){ document.getElementById('detPreviewFirmaCliente').style.display='none'; document.getElementById('detPreviewFirmaClientePlaceholder').style.display='block'; }

  abrirModal('modalDetalleOrden');
}
function poblarEquiposDetalleOrden(equipoIdPreseleccionado){
  const clienteId = parseInt(document.getElementById('detCliente').value);
  const c = clienteId ? buscarCliente(clienteId) : null;
  const selEq = document.getElementById('detEquipo');
  if(!c){ selEq.innerHTML = '<option value="">Selecciona un Cliente</option>'; return; }
  let opciones = [];
  c.sedes.forEach(s=>s.equipos.forEach(e=>opciones.push({ id:e.id, texto:`${e.nombre}${e.serie?' ('+e.serie+')':''} — ${s.nombre}` })));
  equiposSinSedeDe(c).forEach(e=>opciones.push({ id:e.id, texto:`${e.nombre}${e.serie?' ('+e.serie+')':''} — Sin sede` }));
  // Siempre se ofrece la opción de "sin equipo" — hay clientes sin equipos
  // registrados todavía, u órdenes de servicio general que no van ligadas
  // a un equipo puntual, y antes no había forma de guardar esos casos.
  selEq.innerHTML = '<option value="">Sin equipo (servicio general)</option>' + opciones.map(o=>`<option value="${o.id}">${o.texto}</option>`).join('');
  selEq.value = equipoIdPreseleccionado || '';
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
        <div class="galeria-fotos" id="detPreviewFotoCampo${campo.id}"></div>
      </div>`;
      renderizarFotoCampoDetallePreview(campo.id);
    } else {
      const valorExistente = respuestasExistentes[campo.id] || '';
      let inputHtml;
      if(campo.tipo==='textarea') inputHtml = generarEditorRico('detCampo'+campo.id, valorExistente, false, campo.id);
      else if(campo.tipo==='checkbox') inputHtml = `<select data-campo="${campo.id}"><option value="Sí" ${valorExistente==='Sí'?'selected':''}>Sí</option><option value="No" ${valorExistente==='No'?'selected':''}>No</option></select>`;
      else inputHtml = `<input type="${campo.tipo}" data-campo="${campo.id}" value="${valorExistente}">`;
      cont.innerHTML += `<div style="margin-top:8px;"><label>${campo.label}:</label>${inputHtml}</div>`;
    }
  });
}
function manejarFotoCampoDetalle(event, campoId){
  const files = Array.from(event.target.files);
  if(!fotosCamposDetalleTemp[campoId]) fotosCamposDetalleTemp[campoId] = [];
  files.forEach(file=>{ comprimirImagen(file, 1000, 0.62).then(dataUrl=>{ fotosCamposDetalleTemp[campoId].push({ src:dataUrl, desc:'' }); renderizarFotoCampoDetallePreview(campoId); }); });
  event.target.value='';
}
function renderizarFotoCampoDetallePreview(campoId){
  // El tamaño de bloque es el que se definió al diseñar la plantilla para
  // este campo puntual (Configuración → Plantillas de Formularios) — se
  // busca aquí para que se respete sin importar desde dónde se llame esta
  // función (al abrir la orden, al subir una foto nueva, al quitar una, etc.).
  const o = db.ordenes.find(x=>x.id===ordenDetalleId);
  const plantilla = o ? buscarPlantilla(o.plantillaId) : null;
  const campo = plantilla ? plantilla.campos.find(c=>c.id===campoId) : null;
  renderizarGaleriaFotos('detPreviewFotoCampo'+campoId, fotosCamposDetalleTemp[campoId], 'ordenCampo', campoId, campo ? campo.bloqueImagenes : null);
}
function manejarFotosDetalle(event){
  const files = Array.from(event.target.files);
  files.forEach(file=>{ comprimirImagen(file, 1000, 0.62).then(dataUrl=>{ fotosDetalleTemp.push({ src:dataUrl, desc:'' }); renderizarFotosDetallePreview(); }); });
  event.target.value='';
}
function renderizarFotosDetallePreview(){
  renderizarGaleriaFotos('detPreviewFotos', fotosDetalleTemp, 'ordenGeneral');
}
async function guardarDetalleOrden(finalizar){
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
    if(!clienteId){ mostrarToast('Selecciona el Cliente.'); return; }
    const equipoRaw = document.getElementById('detEquipo').value;
    // El equipo es OPCIONAL — hay clientes sin equipos registrados, u órdenes
    // de servicio general que no van ligadas a un equipo puntual. Antes esto
    // bloqueaba el guardado por completo; ahora solo se valida si sí se eligió uno.
    if(equipoRaw){
      equipoId = parseInt(equipoRaw);
      const infoEquipo = ubicarEquipoPorId(equipoId);
      if(!infoEquipo || infoEquipo.cliente.id !== clienteId){ mostrarToast('El equipo seleccionado no corresponde al cliente elegido.'); return; }
      sedeId = infoEquipo.sede ? infoEquipo.sede.id : null;
    } else {
      equipoId = null; sedeId = null;
    }
  }
  const tecnicoIdRaw = document.getElementById('detTecnico').value;
  const plantillaIdRaw = document.getElementById('detPlantilla').value;

  const respuestas = {};
  document.querySelectorAll('#detCamposDinamicos [data-campo]').forEach(el=>{
    if(el.dataset.item){
      if(!respuestas[el.dataset.campo]) respuestas[el.dataset.campo] = {};
      respuestas[el.dataset.campo][el.dataset.item] = el.checked;
    } else if(el.hasAttribute('contenteditable')){
      respuestas[el.dataset.campo] = el.innerHTML;
    } else {
      respuestas[el.dataset.campo] = el.value;
    }
  });
  // Respaldo del estado anterior de la orden, por si el guardado en el servidor
  // falla — así se puede restaurar sin perder lo que ya tenía guardado antes,
  // en vez de dejar la orden a medias con datos que nunca llegaron a guardarse.
  const respaldoOrden = JSON.parse(JSON.stringify(o));

  o.clienteId = clienteId; o.sedeId = sedeId; o.equipoId = equipoId;
  o.tecnicoId = tecnicoIdRaw ? parseInt(tecnicoIdRaw) : null;
  o.tipo = document.getElementById('detTipo').value;
  o.prioridad = document.getElementById('detPrioridad').value;
  o.fechaProgramada = document.getElementById('detFecha').value || null;
  o.horaProgramada = document.getElementById('detHora').value || null;
  o.plantillaId = plantillaIdRaw ? parseInt(plantillaIdRaw) : null;
  o.cierre = {
    fecha: (o.cierre && o.cierre.fecha) || new Date().toISOString().slice(0,10),
    diagnostico: document.getElementById('detDiagnostico').innerHTML,
    respuestas,
    fotos: fotosDetalleTemp.slice(),
    fotosPorCampo: JSON.parse(JSON.stringify(fotosCamposDetalleTemp)),
    firmaTecnico: firmaTecnicoTemp || null,
    firmaCliente: firmaClienteTemp || null
  };
  o.estado = (finalizar || esEdicionForzada) ? 'Finalizado' : document.getElementById('detEstado').value;

  // Mientras se confirma el guardado real, se bloquean los botones — así el
  // técnico no cierra el formulario pensando que ya terminó, ni le da doble clic.
  const botones = document.querySelectorAll('#detAccionesEdicion button');
  botones.forEach(b=>b.disabled = true);
  mostrarToast('Guardando informe... esto puede tardar unos segundos si hay fotos.');
  try{
    await dbGuardarInmediato();
  }catch(err){
    // El guardado real falló: se revierte la orden a como estaba antes en memoria,
    // PERO el formulario se queda abierto con todo lo escrito intacto (nada se
    // borra), para que el técnico pueda intentar guardar de nuevo sin perder su
    // trabajo — en vez de cerrar el formulario dando la falsa impresión de éxito.
    Object.assign(o, respaldoOrden);
    botones.forEach(b=>b.disabled = false);
    mostrarToast('⚠️ No se pudo guardar el informe: ' + err.message + ' — tu información sigue aquí, vuelve a intentar "Guardar Cambios" cuando tengas conexión.', 'error');
    return;
  }
  botones.forEach(b=>b.disabled = false);
  registrarLog(esEdicionForzada ? 'Editar orden finalizada' : (finalizar ? 'Finalizar' : 'Editar'), 'OrdenServicio', `${o.numero} (${nombreUsuarioActual()})`);
  cerrarModal('modalDetalleOrden');
  ordenDetalleEsEdicionForzada = false;
  mostrarToast((finalizar && !esEdicionForzada) ? '✅ Informe guardado y orden finalizada correctamente.' : '✅ Avance guardado — puedes cerrar y continuar cuando quieras.', 'exito');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
}
function confirmarFinalizarOrden(){
  if(!confirm('¿Finalizar esta orden? Una vez finalizada no podrás editar el técnico, los datos del formulario, las fotos ni las firmas.')) return;
  guardarDetalleOrden(true);
}

