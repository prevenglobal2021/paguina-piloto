// ===== inventario.js — Inventario, Bodegas, Kardex, QR y Trazabilidad Avanzada =====
/* =========================================================
   INVENTARIO, BODEGAS, KARDEX Y QR
========================================================= */
let fotosInventarioTemp = [];
let bodegaEdicionId = null;
let itemMovimientoActualId = null;

function buscarItemInventario(id){ return (db.inventario || []).find(i=>i.id===id); }
function buscarBodega(id){ return (db.bodegas || []).find(b=>b.id===id); }

/* ---------------------------------------------------------
   VISOR DE FOTOS EN ALTA RESOLUCIÓN
--------------------------------------------------------- */
function verFotoInventarioGrande(src, nombreItem){
  let modal = document.getElementById('modalVisorFotoGrande');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modalVisorFotoGrande';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,.88);z-index:999999;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;backdrop-filter:blur(5px);cursor:zoom-out;';
    modal.onclick = cerrarVisorFoto;
    modal.innerHTML = `
      <div style="position:relative;max-width:92%;max-height:88%;text-align:center;" onclick="event.stopPropagation();">
        <button type="button" onclick="cerrarVisorFoto()" style="position:absolute;top:-15px;right:-15px;background:#ef4444;color:#ffffff;border:2px solid #ffffff;width:34px;height:34px;border-radius:50%;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.5);line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>
        <img id="imgVisorFotoGrande" src="" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;border:3px solid #ffffff;box-shadow:0 12px 35px rgba(0,0,0,.6);background:#000;">
        <p id="lblVisorFotoGrande" style="color:#ffffff;margin-top:12px;font-size:15px;font-weight:600;letter-spacing:.02em;text-shadow:0 2px 5px rgba(0,0,0,.9);"></p>
      </div>`;
    document.body.appendChild(modal);

    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') cerrarVisorFoto();
    });
  }
  
  const imgEl = document.getElementById('imgVisorFotoGrande');
  const lblEl = document.getElementById('lblVisorFotoGrande');
  if(imgEl) imgEl.src = src;
  if(lblEl) lblEl.innerText = nombreItem || 'Fotografía de producto';
  modal.style.display = 'flex';
}

function cerrarVisorFoto(){
  const modal = document.getElementById('modalVisorFotoGrande');
  if(modal) modal.style.display = 'none';
}

/* ---------------------------------------------------------
   GESTIÓN Y EDICIÓN DE BODEGAS
--------------------------------------------------------- */
function abrirModalBodega(bodegaId){
  bodegaEdicionId = bodegaId || null;
  const inputNombre = document.getElementById('bodNombre');
  const selectTipo = document.getElementById('bodTipo');
  
  if(bodegaId){
    const b = buscarBodega(bodegaId);
    if(!b) return;
    if(inputNombre) inputNombre.value = b.nombre;
    if(selectTipo) selectTipo.value = b.tipo || 'fija';
  } else {
    if(inputNombre) inputNombre.value = '';
    if(selectTipo) selectTipo.value = 'fija';
  }
  abrirModal('modalBodega');
}

async function guardarBodega(){
  const nombre = (document.getElementById('bodNombre').value || '').trim();
  const tipo = document.getElementById('bodTipo').value || 'fija';
  if(!nombre){ mostrarToast('Escribe el nombre de la bodega.'); return; }
  
  db.bodegas = db.bodegas || [];
  let respaldo = null;

  if(bodegaEdicionId){
    const b = buscarBodega(bodegaEdicionId);
    if(!b) return;
    respaldo = Object.assign({}, b);
    b.nombre = nombre;
    b.tipo = tipo;
  } else {
    const b = { id: Date.now(), nombre, tipo };
    db.bodegas.push(b);
  }

  try{
    await dbGuardarInmediato();
  }catch(err){
    if(bodegaEdicionId && respaldo){ Object.assign(buscarBodega(bodegaEdicionId), respaldo); }
    else if(!bodegaEdicionId){ db.bodegas.pop(); }
    mostrarToast('⚠️ No se pudo guardar la bodega: ' + err.message, 'error');
    return;
  }

  registrarLog(bodegaEdicionId ? 'Editar' : 'Crear', 'Bodega', nombre);
  mostrarToast(bodegaEdicionId ? `✅ Bodega actualizada.` : `✅ Bodega creada.`, 'exito');
  bodegaEdicionId = null;
  cerrarModal('modalBodega');
  renderizarInventario();
}

async function eliminarBodega(id){
  const b = buscarBodega(id);
  if(!b) return;
  const itemsEnBodega = (db.inventario || []).filter(i=>i.bodegaId===id);
  if(itemsEnBodega.length > 0){
    mostrarToast(`⚠️ No se puede eliminar: tiene ${itemsEnBodega.length} ítem(s) asignado(s).`, 'error');
    return;
  }
  if(!confirm(`¿Eliminar la bodega "${b.nombre}"?`)) return;

  const respaldo = db.bodegas.slice();
  db.bodegas = db.bodegas.filter(x=>x.id!==id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.bodegas = respaldo;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  mostrarToast('Bodega eliminada.', 'exito');
  renderizarInventario();
}

/* ---------------------------------------------------------
   ÍTEMS DE INVENTARIO
--------------------------------------------------------- */
function abrirModalItemInventario(itemId){
  fotosInventarioTemp = [];
  document.getElementById('invItemId').value = itemId || '';
  document.getElementById('invBodega').innerHTML = (db.bodegas || []).map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('') || '<option value="">Crea una bodega primero</option>';
  
  if(itemId){
    const it = buscarItemInventario(itemId);
    if(!it) return;
    document.getElementById('invNombre').value = it.nombre || '';
    document.getElementById('invCategoria').value = it.categoria || '';
    document.getElementById('invBodega').value = it.bodegaId;
    document.getElementById('invStockActual').value = it.stockActual ?? 0;
    document.getElementById('invStockMinimo').value = it.stockMinimo ?? 0;
    document.getElementById('invPublicarTienda').checked = !!it.publicarEnTienda;
    document.getElementById('invPrecio').value = it.precio || '';
    document.getElementById('invDescripcionTienda').value = it.descripcionTienda || '';
    fotosInventarioTemp = (it.fotos || []).slice();
  } else {
    document.getElementById('invNombre').value = '';
    document.getElementById('invCategoria').value = '';
    document.getElementById('invStockActual').value = 0;
    document.getElementById('invStockMinimo').value = 0;
    document.getElementById('invPublicarTienda').checked = false;
    document.getElementById('invPrecio').value = '';
    document.getElementById('invDescripcionTienda').value = '';
  }
  renderizarFotosInventarioPreview();
  abrirModal('modalItemInventario');
}

function manejarFotoInventario(event){
  const files = Array.from(event.target.files);
  if(fotosInventarioTemp.length >= 2){ mostrarToast('Máximo 2 fotos de referencia por ítem.'); event.target.value=''; return; }
  const disponibles = 2 - fotosInventarioTemp.length;
  files.slice(0, disponibles).forEach(file=>{
    comprimirImagen(file).then(dataUrl=>{ fotosInventarioTemp.push({ src:dataUrl, desc:'' }); renderizarFotosInventarioPreview(); });
  });
  if(files.length > disponibles) mostrarToast('Solo se agregaron las primeras fotos permitidas (límite: 2 por ítem).');
  event.target.value='';
}

function renderizarFotosInventarioPreview(){
  renderizarGaleriaFotos('previewFotosInventario', fotosInventarioTemp, 'inventario');
}

async function guardarItemInventario(){
  const id = document.getElementById('invItemId').value;
  const nombre = (document.getElementById('invNombre').value || '').trim();
  const categoria = (document.getElementById('invCategoria').value || '').trim();
  const bodegaId = parseInt(document.getElementById('invBodega').value);
  const stockActual = parseInt(document.getElementById('invStockActual').value) || 0;
  const stockMinimo = parseInt(document.getElementById('invStockMinimo').value) || 0;
  const publicarEnTienda = document.getElementById('invPublicarTienda').checked;
  const precio = parseFloat(document.getElementById('invPrecio').value) || 0;
  const descripcionTienda = (document.getElementById('invDescripcionTienda').value || '').trim();

  if(!nombre){ mostrarToast('Escribe el nombre del ítem.'); return; }
  if(!bodegaId){ mostrarToast('Selecciona o crea una bodega primero.'); return; }

  db.inventario = db.inventario || [];
  let respaldo = null, esNuevo = false;

  if(id){
    const it = buscarItemInventario(parseInt(id));
    if(!it) return;
    respaldo = Object.assign({}, it);
    Object.assign(it, { nombre, categoria, bodegaId, stockActual, stockMinimo, fotos: fotosInventarioTemp.slice(), publicarEnTienda, precio, descripcionTienda });
  } else {
    esNuevo = true;
    db.inventario.push({ 
      id: Date.now(), 
      nombre, 
      categoria, 
      bodegaId, 
      stockActual, 
      stockMinimo, 
      fotos: fotosInventarioTemp.slice(), 
      qrId: 'ITEM-' + Date.now(), 
      publicarEnTienda, 
      precio, 
      descripcionTienda 
    });
  }

  try{
    await dbGuardarInmediato();
  }catch(err){
    if(id && respaldo){ Object.assign(buscarItemInventario(parseInt(id)), respaldo); }
    else if(esNuevo){ db.inventario.pop(); }
    mostrarToast('⚠️ No se pudo guardar el ítem: ' + err.message, 'error');
    return;
  }

  registrarLog(id ? 'Editar' : 'Crear', 'Inventario', nombre);
  mostrarToast(id ? `✅ ${nombre} actualizado.` : `✅ ${nombre} agregado al inventario.`, 'exito');
  cerrarModal('modalItemInventario');
  renderizarInventario();
}

async function eliminarItemInventario(id){
  if(!confirm('¿Eliminar este ítem de inventario?')) return;
  const it = buscarItemInventario(id);
  const respaldo = (db.inventario || []).slice();
  db.inventario = (db.inventario || []).filter(i=>i.id!==id);
  registrarEliminacion('inventario', id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.inventario = respaldo;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  if(it) registrarLog('Eliminar', 'Inventario', it.nombre);
  mostrarToast('Ítem eliminado.', 'exito');
  renderizarInventario();
}

/* ---------------------------------------------------------
   QR DINÁMICO E IMPRESIÓN (5x5 CM)
--------------------------------------------------------- */
function verFichaQR(itemId){
  const it = buscarItemInventario(itemId);
  if(!it) return;
  if(!it.qrId){ it.qrId = 'ITEM-' + it.id; }

  const wrap = document.getElementById('etiquetaQRWrap');
  if(!wrap) return;
  wrap.innerHTML = '';
  
  const urlItem = `${location.origin}${location.pathname}?item=${it.id}`;
  if(typeof QRCode !== 'undefined'){
    new QRCode(wrap, { text: urlItem, width: 300, height: 300, correctLevel: QRCode.CorrectLevel.H });
  }

  const lblNombre = document.getElementById('etiquetaQRNombre');
  const lblCodigo = document.getElementById('etiquetaQRCodigo');
  if(lblNombre) lblNombre.innerText = it.nombre;
  if(lblCodigo) lblCodigo.innerText = it.qrId;

  if(db.config && db.config.logo){
    setTimeout(()=>{
      const existente = wrap.querySelector('.etiqueta-logo-centro');
      if(existente) existente.remove();
      const logoImg = document.createElement('img');
      logoImg.src = db.config.logo;
      logoImg.className = 'etiqueta-logo-centro';
      wrap.appendChild(logoImg);
    }, 80);
  }
  abrirModal('modalEtiquetaQR');
}

/* ---------------------------------------------------------
   TRAZABILIDAD DE MOVIMIENTOS: PRÉSTAMOS (TÉCNICO / NO REGISTRADO)
--------------------------------------------------------- */
function abrirModalSalidaInventario(itemId){
  itemMovimientoActualId = itemId;
  const it = buscarItemInventario(itemId);
  if(!it) return;

  asegurarModalMovimientoEnDOM();

  document.getElementById('movItemTitulo').innerText = `${it.nombre} (Stock disponible: ${it.stockActual})`;
  document.getElementById('movCantidad').value = 1;
  document.getElementById('movCantidad').max = it.stockActual;
  document.getElementById('movFechaSalida').value = new Date().toISOString().slice(0, 16);
  document.getElementById('movFechaRetorno').value = '';
  document.getElementById('movNotas').value = '';
  document.getElementById('movPersonaNombre').value = '';
  document.getElementById('movPersonaDocumento').value = '';

  const selTec = document.getElementById('movTecnico');
  selTec.innerHTML = '<option value="">— Seleccionar técnico registrado —</option>' +
    (db.tecnicos||[]).filter(t=>t.activo!==false).map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');

  onCambiarTipoResponsable();
  onCambiarMotivoMovimiento();
  abrirModal('modalMovimientoInventario');
}

function onCambiarTipoResponsable(){
  const tipoResp = document.getElementById('movTipoResponsable').value;
  const wrapTec = document.getElementById('wrapMovTecnicoRegistrado');
  const wrapManual = document.getElementById('wrapMovPersonaNoRegistrada');
  if(wrapTec) wrapTec.style.display = (tipoResp === 'tecnico') ? 'block' : 'none';
  if(wrapManual) wrapManual.style.display = (tipoResp === 'manual') ? 'block' : 'none';
}

function onCambiarMotivoMovimiento(){
  const motivo = document.getElementById('movMotivo').value;
  const wrapRetorno = document.getElementById('wrapMovFechaRetorno');
  const wrapDestinatario = document.getElementById('wrapDestinatarioGeneral');
  
  if(wrapRetorno) wrapRetorno.style.display = (motivo === 'prestamo') ? 'block' : 'none';
  if(wrapDestinatario) wrapDestinatario.style.display = (motivo === 'baja') ? 'none' : 'block';
}

async function guardarMovimientoInventario(){
  const it = buscarItemInventario(itemMovimientoActualId);
  if(!it) return;

  const tipo = document.getElementById('movTipoOperacion').value;
  const motivo = document.getElementById('movMotivo').value;
  const cantidad = parseInt(document.getElementById('movCantidad').value) || 0;
  const fechaHora = document.getElementById('movFechaSalida').value || new Date().toISOString();
  const fechaRetorno = document.getElementById('movFechaRetorno').value || null;
  const notas = (document.getElementById('movNotas').value || '').trim();
  const tipoResp = document.getElementById('movTipoResponsable').value;

  if(cantidad <= 0){ mostrarToast('La cantidad debe ser mayor a cero.'); return; }
  if(tipo === 'salida' && it.stockActual < cantidad){
    mostrarToast(`Stock insuficiente. Solo hay ${it.stockActual} disponibles.`);
    return;
  }

  let tecnicoId = null;
  let responsableNombre = 'Sin asignar';
  let responsableDetalle = '';

  if(motivo !== 'baja'){
    if(tipoResp === 'tecnico'){
      tecnicoId = parseInt(document.getElementById('movTecnico').value) || null;
      if(!tecnicoId){ mostrarToast('Selecciona el técnico responsable.'); return; }
      const t = (db.tecnicos||[]).find(x=>x.id===tecnicoId);
      responsableNombre = t ? t.nombre : 'Técnico';
      responsableDetalle = 'Técnico de nómina';
    } else {
      const nombreManual = (document.getElementById('movPersonaNombre').value || '').trim();
      const docManual = (document.getElementById('movPersonaDocumento').value || '').trim();
      if(!nombreManual){ mostrarToast('Escribe el nombre de la persona que retira.'); return; }
      responsableNombre = nombreManual;
      responsableDetalle = docManual ? `No registrado (Doc/Tel: ${docManual})` : 'Persona no registrada';
    }
  } else {
    responsableNombre = 'Baja de inventario';
  }

  const stockPrevio = it.stockActual;
  const nuevoStock = tipo === 'salida' ? (stockPrevio - cantidad) : (stockPrevio + cantidad);
  it.stockActual = nuevoStock;

  db.kardex = db.kardex || [];
  const movimiento = {
    id: Date.now(),
    itemId: it.id,
    itemNombre: it.nombre,
    tipo,
    motivo,
    cantidad,
    stockPrevio,
    nuevoStock,
    fechaHora,
    fechaEstimadaRetorno: (motivo === 'prestamo') ? fechaRetorno : null,
    tecnicoId,
    esNoRegistrado: (tipoResp === 'manual'),
    responsable: responsableNombre,
    responsableDetalle,
    estadoPrestamo: (motivo === 'prestamo') ? 'pendiente' : 'completado',
    notas,
    usuarioRegistro: typeof nombreUsuarioActual === 'function' ? nombreUsuarioActual() : 'Administrador'
  };

  db.kardex.push(movimiento);

  try{
    await dbGuardarInmediato();
  }catch(err){
    it.stockActual = stockPrevio;
    db.kardex.pop();
    mostrarToast('⚠️ No se pudo registrar el movimiento: ' + err.message, 'error');
    return;
  }

  registrarLog('Inventario', tipo.toUpperCase(), `${it.nombre}: ${tipo==='salida'?'-':'+'}${cantidad} (${motivo}) a ${responsableNombre}`);
  mostrarToast(`✅ Movimiento registrado. Stock actual de "${it.nombre}": ${nuevoStock}`, 'exito');
  cerrarModal('modalMovimientoInventario');
  renderizarInventario();
}

async function registrarDevolucionPrestamo(kardexId){
  const mov = (db.kardex||[]).find(k=>k.id===kardexId);
  if(!mov || mov.estadoPrestamo !== 'pendiente') return;

  const it = buscarItemInventario(mov.itemId);
  if(!it){ mostrarToast('El producto original ya no existe.'); return; }

  if(!confirm(`¿Registrar el reingreso de ${mov.cantidad} unidad(es) de "${mov.itemNombre}" devuelta(s) por ${mov.responsable}?`)) return;

  const stockPrevio = it.stockActual;
  it.stockActual += mov.cantidad;
  mov.estadoPrestamo = 'devuelto';
  mov.fechaDevolucionReal = new Date().toISOString();

  const retornoKardex = {
    id: Date.now(),
    itemId: it.id,
    itemNombre: it.nombre,
    tipo: 'entrada',
    motivo: 'retorno_prestamo',
    referenciaPrestamoId: mov.id,
    cantidad: mov.cantidad,
    stockPrevio,
    nuevoStock: it.stockActual,
    fechaHora: new Date().toISOString(),
    responsable: mov.responsable,
    responsableDetalle: mov.responsableDetalle,
    notas: `Devolución de herramienta prestada el ${new Date(mov.fechaHora).toLocaleDateString('es-CO')}`,
    usuarioRegistro: typeof nombreUsuarioActual === 'function' ? nombreUsuarioActual() : 'Administrador'
  };
  db.kardex.push(retornoKardex);

  try{
    await dbGuardarInmediato();
  }catch(err){
    it.stockActual = stockPrevio;
    mov.estadoPrestamo = 'pendiente';
    delete mov.fechaDevolucionReal;
    db.kardex.pop();
    mostrarToast('⚠️ No se pudo registrar el retorno: ' + err.message, 'error');
    return;
  }

  registrarLog('Inventario', 'RETORNO', `${it.nombre}: Devuelto por ${mov.responsable}`);
  mostrarToast(`✅ Herramienta devuelta y sumada a bodega. Stock: ${it.stockActual}`, 'exito');
  renderizarInventario();
}

/* ---------------------------------------------------------
   INYECCIÓN AUTÓNOMA DEL MODAL DE MOVIMIENTOS
--------------------------------------------------------- */
function asegurarModalMovimientoEnDOM(){
  if(document.getElementById('modalMovimientoInventario')) return;
  const div = document.createElement('div');
  div.id = 'modalMovimientoInventario';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-card" style="max-width:560px;width:95%;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--card-border);padding-bottom:10px;margin-bottom:15px;">
        <h3 style="margin:0;"><i class="fas fa-boxes-stacked"></i> Salida o Préstamo de Herramientas</h3>
        <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="cerrarModal('modalMovimientoInventario')">✕</button>
      </div>
      <p id="movItemTitulo" style="font-weight:700;color:var(--accent-color);margin-bottom:12px;"></p>
      
      <div class="field-row">
        <div>
          <label style="font-size:12px;font-weight:600;">Tipo de Operación</label>
          <select id="movTipoOperacion">
            <option value="salida">Salida / Retiro de Bodega</option>
            <option value="entrada">Entrada / Reingreso Manual</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;">Motivo del Movimiento</label>
          <select id="movMotivo" onchange="onCambiarMotivoMovimiento()">
            <option value="prestamo">Préstamo de Herramienta / Equipo</option>
            <option value="orden">Uso en Servicio u Orden</option>
            <option value="venta">Venta / Despacho a Cliente</option>
            <option value="baja">Baja / Desecho / Daño definitivo</option>
            <option value="traslado">Traslado a otra Bodega</option>
          </select>
        </div>
      </div>

      <div class="field-row" style="margin-top:10px;">
        <div>
          <label style="font-size:12px;font-weight:600;">Cantidad</label>
          <input type="number" id="movCantidad" min="1" value="1">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;">Fecha y Hora de Salida</label>
          <input type="datetime-local" id="movFechaSalida">
        </div>
      </div>

      <div id="wrapDestinatarioGeneral" style="margin-top:10px;">
        <label style="font-size:12px;font-weight:600;">¿A quién se le entrega?</label>
        <select id="movTipoResponsable" onchange="onCambiarTipoResponsable()">
          <option value="tecnico">Técnico Registrado en Plataforma</option>
          <option value="manual">Tercero / Persona No Registrada</option>
        </select>

        <div id="wrapMovTecnicoRegistrado" style="margin-top:8px;">
          <select id="movTecnico"></select>
        </div>

        <div id="wrapMovPersonaNoRegistrada" style="margin-top:8px;display:none;background:rgba(0,0,0,.04);padding:10px;border-radius:6px;border:1px dashed var(--card-border);">
          <div class="field-row">
            <div>
              <label style="font-size:11px;">Nombre y Apellido de quien retira</label>
              <input type="text" id="movPersonaNombre" placeholder="Ej: Juan Pérez">
            </div>
            <div>
              <label style="font-size:11px;">Cédula / Teléfono de Contacto</label>
              <input type="text" id="movPersonaDocumento" placeholder="Ej: 3001234567">
            </div>
          </div>
        </div>
      </div>

      <div id="wrapMovFechaRetorno" style="margin-top:10px;display:none;">
        <label style="font-size:12px;font-weight:600;color:#b45309;">Fecha y Hora Estipulada de Retorno</label>
        <input type="datetime-local" id="movFechaRetorno">
      </div>

      <div style="margin-top:10px;">
        <label style="font-size:12px;font-weight:600;">Observaciones / Motivo detallado</label>
        <input type="text" id="movNotas" placeholder="Ej: Se presta para instalación en sede norte">
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
        <button type="button" class="btn-custom btn-secondary-custom" onclick="cerrarModal('modalMovimientoInventario')">Cancelar</button>
        <button type="button" class="btn-custom btn-primary-custom" onclick="guardarMovimientoInventario()">Confirmar Salida</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}

/* ---------------------------------------------------------
   RENDERIZADO DE TABLAS
--------------------------------------------------------- */
function renderizarInventario(){
  const tbody = document.getElementById('tablaInventario');
  const buscadorEl = document.getElementById('invBuscador');
  const texto = buscadorEl ? buscadorEl.value.trim().toLowerCase() : '';
  
  const items = Array.isArray(db.inventario) ? db.inventario : [];
  
  const itemsFiltrados = !texto ? items : items.filter(it=>{
    const bodega = buscarBodega(it.bodegaId);
    return (it.nombre||'').toLowerCase().includes(texto)
      || (it.categoria||'').toLowerCase().includes(texto)
      || (bodega && bodega.nombre.toLowerCase().includes(texto));
  });

  if(tbody){
    tbody.innerHTML = itemsFiltrados.map(it=>{
      const bodega = buscarBodega(it.bodegaId);
      const bajoStock = it.stockActual <= it.stockMinimo;
      
      const fotosHtml = (it.fotos||[]).map(f=>{
        const src = srcDeFoto(f);
        return `<img src="${src}" onclick="verFotoInventarioGrande('${src}', '${(it.nombre||'').replace(/'/g, "\\'")}')" style="width:34px;height:34px;object-fit:cover;border-radius:4px;margin-right:4px;cursor:zoom-in;border:1px solid #cbd5e1;" title="Clic para ampliar foto">`;
      }).join('');

      return `<tr>
        <td><strong>${it.nombre}</strong><br><small style="color:var(--text-muted);">${it.categoria||''}</small></td>
        <td>
          ${bodega ? bodega.nombre : '—'}
          <button class="btn-custom btn-secondary-custom btn-sm-custom" style="padding:1px 5px;font-size:10px;margin-left:5px;" onclick="abrirModalBodega(${it.bodegaId})" title="Editar nombre de bodega"><i class="fas fa-pen"></i></button>
        </td>
        <td>${it.stockActual} <span class="${bajoStock?'badge-stock-bajo':'badge-stock-ok'}">${bajoStock?'BAJO':'OK'}</span><br><small style="color:var(--text-muted);">mín: ${it.stockMinimo}</small></td>
        <td>${fotosHtml||'—'}</td>
        <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verFichaQR(${it.id})"><i class="fas fa-qrcode"></i></button></td>
        <td>
          <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirModalSalidaInventario(${it.id})" title="Registrar préstamo o salida"><i class="fas fa-arrow-right-from-bracket"></i> Salida</button>
          <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirModalItemInventario(${it.id})">Editar</button>
          <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarItemInventario(${it.id})">X</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" class="empty-state">${texto ? 'Sin ítems que coincidan con "'+buscadorEl.value+'".' : 'Sin ítems registrados. Crea uno con "+ Ítem".'}</td></tr>`;
  }

  const alertas = document.getElementById('alertasStockBajo');
  if(alertas){
    const bajos = items.filter(i=>i.stockActual<=i.stockMinimo);
    alertas.innerHTML = bajos.length ? `
      <div class="panel" style="background:rgba(239,68,68,.1);border-color:var(--red-alert);margin-bottom:15px;">
        ⚠️ <strong>${bajos.length}</strong> ítem(s) por debajo del stock mínimo: ${bajos.map(b=>b.nombre).join(', ')}
      </div>` : '';
  }

  renderizarKardex();
}

function renderizarKardex(){
  const tbody = document.querySelector('#kardexMovimientos tbody') || document.getElementById('tablaKardex');
  if(!tbody) return;
  const movimientos = (Array.isArray(db.kardex) ? db.kardex : []).slice().sort((a,b)=> new Date(b.fechaHora||b.id) - new Date(a.fechaHora||a.id));

  tbody.innerHTML = movimientos.map(k=>{
    const esSalida = k.tipo === 'salida';
    const colorTipo = esSalida ? '#dc2626' : '#16a34a';
    const signo = esSalida ? '−' : '+';

    let badgeEstado = '';
    let botonDevolver = '';

    if(k.motivo === 'prestamo'){
      if(k.estadoPrestamo === 'pendiente'){
        badgeEstado = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#fef3c7;color:#92400e;font-weight:700;">PRESTADA</span>`;
        botonDevolver = `<button class="btn-custom btn-secondary-custom btn-sm-custom" style="margin-top:4px;background:#dcfce7;color:#166534;border-color:#86efac;padding:2px 8px;font-size:11px;" onclick="registrarDevolucionPrestamo(${k.id})"><i class="fas fa-arrow-rotate-left"></i> Marcar Devuelto</button>`;
      } else {
        badgeEstado = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#dcfce7;color:#166534;">DEVUELTA</span>`;
      }
    }

    const fechaSalidaFormat = new Date(k.fechaHora || k.fecha || k.id).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' });
    const fechaRetornoFormat = k.fechaEstimadaRetorno ? `<br><small style="color:#b45309;font-weight:600;">Retorno estimado: ${new Date(k.fechaEstimadaRetorno).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })}</small>` : '';
    const detallePersona = k.responsableDetalle ? `<br><small style="color:var(--text-muted);">${k.responsableDetalle}</small>` : '';

    return `<tr>
      <td>${fechaSalidaFormat}</td>
      <td><strong>${k.itemNombre || k.item || '—'}</strong><br>${badgeEstado}${fechaRetornoFormat}</td>
      <td style="font-weight:700;color:${colorTipo};">${signo}${k.cantidad}</td>
      <td>${k.stockPrevio ?? '—'} → <strong>${k.nuevoStock ?? '—'}</strong></td>
      <td><strong>${k.responsable || '—'}</strong>${detallePersona}<br><small style="color:var(--text-muted);">${k.notas || 'Sin observaciones'}</small></td>
      <td>${botonDevolver || '<small style="color:var(--text-muted);">Completado</small>'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-state">Sin movimientos registrados en el kardex.</td></tr>';
}
