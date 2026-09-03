// ===== inventario.js — Inventario, Bodegas, Kardex, Trazabilidad y QR =====
/* =========================================================
   INVENTARIO, BODEGAS, KARDEX Y TRAZABILIDAD
========================================================= */
let fotosInventarioTemp = [];
let bodegaEdicionId = null;
let itemMovimientoActualId = null;

function buscarItemInventario(id){ return (db.inventario || []).find(i=>i.id===id); }
function buscarBodega(id){ return (db.bodegas || []).find(b=>b.id===id); }

/* ---------------------------------------------------------
   BODEGAS (Crear, Editar, Eliminar)
--------------------------------------------------------- */
function abrirModalBodega(bodegaId){
  bodegaEdicionId = bodegaId || null;
  const inputNombre = document.getElementById('bodNombre');
  const selectTipo = document.getElementById('bodTipo');
  const btnGuardar = document.querySelector('#modalBodega button[onclick="guardarBodega()"]') || document.getElementById('btnGuardarBodega');
  
  if(bodegaId){
    const b = buscarBodega(bodegaId);
    if(!b) return;
    if(inputNombre) inputNombre.value = b.nombre;
    if(selectTipo) selectTipo.value = b.tipo || 'fija';
    if(btnGuardar) btnGuardar.innerText = 'Guardar Cambios';
  } else {
    if(inputNombre) inputNombre.value = '';
    if(selectTipo) selectTipo.value = 'fija';
    if(btnGuardar) btnGuardar.innerText = '+ Guardar Bodega';
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
  mostrarToast(bodegaEdicionId ? `✅ Bodega "${nombre}" actualizada.` : `✅ Bodega "${nombre}" creada.`, 'exito');
  bodegaEdicionId = null;
  cerrarModal('modalBodega');
  renderizarInventario();
}

async function eliminarBodega(id){
  const b = buscarBodega(id);
  if(!b) return;
  const itemsEnBodega = (db.inventario || []).filter(i=>i.bodegaId===id);
  if(itemsEnBodega.length > 0){
    mostrarToast(`⚠️ No se puede eliminar: tiene ${itemsEnBodega.length} ítem(s) asignado(s). Trasládalos primero.`, 'error');
    return;
  }
  if(!confirm(`¿Eliminar la bodega "${b.nombre}"?`)) return;

  const respaldo = db.bodegas.slice();
  db.bodegas = db.bodegas.filter(x=>x.id!==id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.bodegas = respaldo;
    mostrarToast('⚠️ No se pudo eliminar la bodega: ' + err.message, 'error');
    return;
  }
  registrarLog('Eliminar', 'Bodega', b.nombre);
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
   KARDEX Y TRAZABILIDAD AVANZADA (SALIDAS / PRÉSTAMOS)
--------------------------------------------------------- */
function abrirModalSalidaRapida(itemId){
  itemMovimientoActualId = itemId;
  const it = buscarItemInventario(itemId);
  if(!it) return;

  asegurarModalMovimientoEnDOM();

  const tituloEl = document.getElementById('movItemTitulo');
  if(tituloEl) tituloEl.innerText = `${it.nombre} (Disponibles: ${it.stockActual})`;

  document.getElementById('movCantidad').value = 1;
  document.getElementById('movCantidad').max = it.stockActual;
  
  // Asignar fecha y hora actual en formato local
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  document.getElementById('movFechaHora').value = ahora.toISOString().slice(0, 16);

  document.getElementById('movFechaEstimadaRetorno').value = '';
  document.getElementById('movNotas').value = '';
  document.getElementById('movPersonaExterna').value = '';

  const selTec = document.getElementById('movTecnicoSelect');
  selTec.innerHTML = '<option value="">— Ninguno / Persona externa no registrada —</option>' +
    (db.tecnicos || []).filter(t=>t.activo!==false).map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');

  actualizarCamposDinamicosMovimiento();
  abrirModal('modalMovimientoAvanzado');
}

function actualizarCamposDinamicosMovimiento(){
  const motivo = document.getElementById('movMotivo').value;
  const tecnicoVal = document.getElementById('movTecnicoSelect').value;
  
  const wrapRetorno = document.getElementById('wrapMovRetorno');
  const wrapExterna = document.getElementById('wrapMovExterna');

  if(wrapRetorno) wrapRetorno.style.display = (motivo === 'prestamo') ? 'block' : 'none';
  if(wrapExterna) wrapExterna.style.display = (!tecnicoVal) ? 'block' : 'none';
}

async function guardarMovimientoAvanzado(){
  const it = buscarItemInventario(itemMovimientoActualId);
  if(!it) return;

  const tipo = document.getElementById('movTipo').value; // 'salida' | 'entrada'
  const motivo = document.getElementById('movMotivo').value;
  const cantidad = parseInt(document.getElementById('movCantidad').value) || 0;
  const fechaHora = document.getElementById('movFechaHora').value || new Date().toISOString();
  const fechaRetorno = document.getElementById('movFechaEstimadaRetorno').value || null;
  const tecnicoId = parseInt(document.getElementById('movTecnicoSelect').value) || null;
  const notas = (document.getElementById('movNotas').value || '').trim();

  let responsableNombre = '';
  if(tecnicoId){
    const tec = (db.tecnicos || []).find(t=>t.id===tecnicoId);
    responsableNombre = tec ? tec.nombre : 'Técnico';
  } else {
    responsableNombre = (document.getElementById('movPersonaExterna').value || '').trim();
    if(!responsableNombre && tipo === 'salida'){
      mostrarToast('Escribe el nombre de la persona que retira la herramienta o material.');
      return;
    }
    if(!responsableNombre) responsableNombre = 'Externo / General';
  }

  if(cantidad <= 0){ mostrarToast('La cantidad debe ser mayor a cero.'); return; }
  if(tipo === 'salida' && it.stockActual < cantidad){
    mostrarToast(`Stock insuficiente. Solo hay ${it.stockActual} unidades disponibles.`);
    return;
  }

  const stockPrevio = it.stockActual;
  const nuevoStock = (tipo === 'salida') ? (stockPrevio - cantidad) : (stockPrevio + cantidad);
  it.stockActual = nuevoStock;

  db.kardex = db.kardex || [];
  const nuevoKardex = {
    id: Date.now(),
    itemId: it.id,
    itemNombre: it.nombre,
    tipo, // 'salida' | 'entrada'
    motivo, // 'prestamo', 'venta', 'orden', 'baja', 'entrada_manual'
    cantidad,
    stockPrevio,
    nuevoStock,
    fechaHora,
    fechaEstimadaRetorno: (motivo === 'prestamo') ? fechaRetorno : null,
    tecnicoId,
    esExterno: !tecnicoId,
    responsable: responsableNombre,
    estadoPrestamo: (motivo === 'prestamo') ? 'prestado' : 'completado',
    notas,
    usuarioRegistro: (typeof nombreUsuarioActual === 'function') ? nombreUsuarioActual() : 'Administrador'
  };

  db.kardex.push(nuevoKardex);

  try{
    await dbGuardarInmediato();
  }catch(err){
    it.stockActual = stockPrevio;
    db.kardex.pop();
    mostrarToast('⚠️ Error al registrar movimiento: ' + err.message, 'error');
    return;
  }

  registrarLog('Inventario', tipo.toUpperCase(), `${it.nombre}: ${tipo==='salida'?'-':'+'}${cantidad} (${motivo}) a cargo de ${responsableNombre}`);
  mostrarToast(`✅ Movimiento registrado. Stock de "${it.nombre}": ${nuevoStock}`, 'exito');
  cerrarModal('modalMovimientoAvanzado');
  renderizarInventario();
}

async function registrarRetornoHerramienta(kardexId){
  const mov = (db.kardex || []).find(k=>k.id===kardexId);
  if(!mov || mov.estadoPrestamo !== 'prestado') return;

  const it = buscarItemInventario(mov.itemId);
  if(!it){ mostrarToast('El ítem original ya no existe.'); return; }

  if(!confirm(`¿Confirmar la devolución de ${mov.cantidad} unidad(es) de "${mov.itemNombre}" entregada(s) por ${mov.responsable}?`)) return;

  const stockPrevio = it.stockActual;
  it.stockActual += mov.cantidad;
  mov.estadoPrestamo = 'devuelto';
  mov.fechaRetornoReal = new Date().toISOString();

  const retornoKardex = {
    id: Date.now(),
    itemId: it.id,
    itemNombre: it.nombre,
    tipo: 'entrada',
    motivo: 'devolucion',
    referenciaPrestamoId: mov.id,
    cantidad: mov.cantidad,
    stockPrevio,
    nuevoStock: it.stockActual,
    fechaHora: new Date().toISOString(),
    responsable: mov.responsable,
    notas: `Devolución de préstamo registrado el ${new Date(mov.fechaHora).toLocaleDateString('es-CO')}`,
    usuarioRegistro: (typeof nombreUsuarioActual === 'function') ? nombreUsuarioActual() : 'Administrador'
  };

  db.kardex.push(retornoKardex);

  try{
    await dbGuardarInmediato();
  }catch(err){
    it.stockActual = stockPrevio;
    mov.estadoPrestamo = 'prestado';
    delete mov.fechaRetornoReal;
    db.kardex.pop();
    mostrarToast('⚠️ Error al registrar devolución: ' + err.message, 'error');
    return;
  }

  registrarLog('Inventario', 'DEVOLUCION', `${it.nombre}: devuelto por ${mov.responsable}`);
  mostrarToast(`✅ Devolución guardada. Stock actual de "${it.nombre}": ${it.stockActual}`, 'exito');
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
   PANEL DE GESTIÓN DE BODEGAS (INYECCIÓN VISUAL)
--------------------------------------------------------- */
function renderizarPanelBodegas(){
  const tabla = document.getElementById('tablaInventario');
  if(!tabla) return;
  
  let cont = document.getElementById('panelGestionBodegas');
  if(!cont){
    cont = document.createElement('div');
    cont.id = 'panelGestionBodegas';
    cont.style.cssText = 'background:rgba(0,0,0,.03);border:1px solid var(--card-border);border-radius:8px;padding:10px 14px;margin-bottom:15px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    tabla.parentNode.insertBefore(cont, tabla);
  }

  const bodegas = Array.isArray(db.bodegas) ? db.bodegas : [];
  const chips = bodegas.map(b=>{
    const cant = (db.inventario || []).filter(i=>i.bodegaId===b.id).length;
    return `
      <div style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--card-border);padding:4px 10px;border-radius:6px;font-size:13px;">
        <i class="fas fa-warehouse" style="color:var(--text-muted);font-size:11px;"></i>
        <strong>${b.nombre}</strong>
        <span style="font-size:11px;color:var(--text-muted);">(${cant} ítems)</span>
        <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" style="padding:1px 6px;font-size:10px;margin-left:4px;" onclick="abrirModalBodega(${b.id})" title="Editar Bodega"><i class="fas fa-pen"></i></button>
        <button type="button" class="btn-custom btn-danger-custom btn-sm-custom" style="padding:1px 6px;font-size:10px;" onclick="eliminarBodega(${b.id})" title="Eliminar Bodega">✕</button>
      </div>`;
  }).join('');

  cont.innerHTML = `
    <span style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-right:4px;">
      <i class="fas fa-boxes-stacked"></i> Bodegas:
    </span>
    ${chips || '<span style="font-size:12px;color:var(--text-muted);">No hay bodegas creadas.</span>'}
    <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" style="margin-left:auto;" onclick="abrirModalBodega()"><i class="fas fa-plus"></i> Nueva Bodega</button>
  `;
}

/* ---------------------------------------------------------
   RENDERIZADO DE VISTAS (TABLA Y KARDEX)
--------------------------------------------------------- */
function renderizarInventario(){
  renderizarPanelBodegas();

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
      const fotosHtml = (it.fotos||[]).map(f=>`<img src="${srcDeFoto(f)}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;margin-right:3px;">`).join('');
      return `<tr>
        <td><strong>${it.nombre}</strong><br><small style="color:var(--text-muted);">${it.categoria||''}</small></td>
        <td>
          ${bodega ? bodega.nombre : '—'}
          <button class="btn-custom btn-secondary-custom btn-sm-custom" style="padding:1px 5px;font-size:10px;margin-left:5px;" onclick="abrirModalBodega(${it.bodegaId})" title="Editar Bodega"><i class="fas fa-pen"></i></button>
        </td>
        <td>${it.stockActual} <span class="${bajoStock?'badge-stock-bajo':'badge-stock-ok'}">${bajoStock?'BAJO':'OK'}</span><br><small style="color:var(--text-muted);">mín: ${it.stockMinimo}</small></td>
        <td>${fotosHtml||'—'}</td>
        <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verFichaQR(${it.id})"><i class="fas fa-qrcode"></i></button></td>
        <td>
          <button class="btn-custom btn-secondary-custom btn-sm-custom" style="background:#f1f5f9;" onclick="abrirModalSalidaRapida(${it.id})" title="Registrar Salida / Préstamo"><i class="fas fa-arrow-right-from-bracket"></i> Salida</button>
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
  const movimientos = Array.isArray(db.kardex) ? db.kardex : [];
  
  tbody.innerHTML = movimientos.slice().reverse().map(k=>{
    const esSalida = k.tipo === 'salida';
    const colorTipo = esSalida ? '#dc2626' : '#16a34a';
    const signo = esSalida ? '−' : '+';

    let badgeMotivo = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#e2e8f0;color:#334155;text-transform:capitalize;">${k.motivo || 'Movimiento'}</span>`;
    let accionRetorno = '';

    if(k.motivo === 'prestamo'){
      if(k.estadoPrestamo === 'prestado'){
        badgeMotivo = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#fef3c7;color:#92400e;font-weight:700;">PRESTADA</span>`;
        accionRetorno = `<button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" style="background:#dcfce7;color:#166534;border-color:#86efac;margin-top:4px;" onclick="registrarRetornoHerramienta(${k.id})"><i class="fas fa-arrow-rotate-left"></i> Marcar Devuelto</button>`;
      } else {
        badgeMotivo = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#dcfce7;color:#166534;">DEVUELTO</span>`;
      }
    }

    const fechaFormat = new Date(k.fechaHora || k.fecha || k.id).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' });
    const avisoRetorno = k.fechaEstimadaRetorno ? `<br><small style="color:#b45309;">Retorno: ${new Date(k.fechaEstimadaRetorno).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })}</small>` : '';

    return `
      <tr>
        <td>${fechaFormat}</td>
        <td><strong>${k.itemNombre || k.item || '—'}</strong><br>${badgeMotivo}${avisoRetorno}</td>
        <td style="font-weight:700;color:${colorTipo};">${signo}${k.cantidad}</td>
        <td>${k.stockPrevio ?? '—'} → <strong>${k.nuevoStock ?? '—'}</strong></td>
        <td>
          <strong>${k.responsable || k.destino || '—'}</strong>
          ${k.esExterno ? '<span style="font-size:9px;background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:4px;margin-left:4px;">EXTERNO</span>' : ''}
          <br><small style="color:var(--text-muted);">${k.notas || 'Sin notas'}</small>
        </td>
        <td>${k.usuarioRegistro || k.usuario || '—'}</td>
        <td>${accionRetorno}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="7" class="empty-state">Sin movimientos registrados en el kardex.</td></tr>';
}

/* ---------------------------------------------------------
   MODAL DE SALIDA Y TRAZABILIDAD (INYECCIÓN DOM)
--------------------------------------------------------- */
function asegurarModalMovimientoEnDOM(){
  if(document.getElementById('modalMovimientoAvanzado')) return;
  const div = document.createElement('div');
  div.id = 'modalMovimientoAvanzado';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-card" style="max-width:520px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--card-border);padding-bottom:10px;margin-bottom:12px;">
        <h3 style="margin:0;"><i class="fas fa-dolly"></i> Movimiento de Inventario / Préstamo</h3>
        <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="cerrarModal('modalMovimientoAvanzado')">✕</button>
      </div>
      
      <p id="movItemTitulo" style="font-weight:700;color:var(--accent-color);margin-bottom:14px;"></p>
      
      <div class="field-row">
        <div>
          <label style="font-size:12px;font-weight:600;">Tipo de Operación</label>
          <select id="movTipo">
            <option value="salida">Salida / Retiro</option>
            <option value="entrada">Entrada / Reingreso manual</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;">Motivo del Retiro</label>
          <select id="movMotivo" onchange="actualizarCamposDinamicosMovimiento()">
            <option value="prestamo">Préstamo de herramienta</option>
            <option value="orden">Uso en Servicio / Orden</option>
            <option value="venta">Venta / Despacho</option>
            <option value="baja">Baja / Dañado / Desecho</option>
            <option value="entrada_manual">Ajuste de inventario</option>
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
          <input type="datetime-local" id="movFechaHora">
        </div>
      </div>

      <div style="margin-top:10px;">
        <label style="font-size:12px;font-weight:600;">Técnico Registrado</label>
        <select id="movTecnicoSelect" onchange="actualizarCamposDinamicosMovimiento()"></select>
      </div>

      <div id="wrapMovExterna" style="margin-top:10px;display:none;">
        <label style="font-size:12px;font-weight:600;color:#0369a1;">Nombre de persona externa / ajena (No registrada)</label>
        <input type="text" id="movPersonaExterna" placeholder="Nombre completo de quien se lleva la herramienta/material">
      </div>

      <div id="wrapMovRetorno" style="margin-top:10px;display:none;">
        <label style="font-size:12px;font-weight:600;color:#b45309;">Fecha y Hora Estipulada de Retorno</label>
        <input type="datetime-local" id="movFechaEstimadaRetorno">
      </div>

      <div style="margin-top:10px;">
        <label style="font-size:12px;font-weight:600;">Observaciones / Destino</label>
        <input type="text" id="movNotas" placeholder="Ej: Trabajo en Sede Principal de Supermercados del Norte">
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
        <button type="button" class="btn-custom btn-secondary-custom" onclick="cerrarModal('modalMovimientoAvanzado')">Cancelar</button>
        <button type="button" class="btn-custom btn-primary-custom" onclick="guardarMovimientoAvanzado()">Confirmar y Descontar</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}
