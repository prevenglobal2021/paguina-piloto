// ===== inventario.js — Módulo de Inventario, Bodegas, Kardex y Trazabilidad de Herramientas =====
/* =========================================================
   INVENTARIO, BODEGAS, KARDEX, TRAZABILIDAD Y QR DINÁMICO
========================================================= */
let fotosInventarioTemp = [];
let bodegaEdicionId = null;
let itemMovimientoActualId = null;

function buscarItemInventario(id){ return (db.inventario||[]).find(i=>i.id===id); }
function buscarBodega(id){ return (db.bodegas||[]).find(b=>b.id===id); }

/* ---------------------------------------------------------
   GESTIÓN Y EDICIÓN DE BODEGAS
--------------------------------------------------------- */
function abrirModalBodega(bodegaId){
  bodegaEdicionId = bodegaId || null;
  const inputNombre = document.getElementById('bodNombre');
  const selectTipo = document.getElementById('bodTipo');
  const btnGuardar = document.getElementById('btnGuardarBodega');
  
  if(bodegaId){
    const b = buscarBodega(bodegaId);
    if(!b) return;
    if(inputNombre) inputNombre.value = b.nombre;
    if(selectTipo) selectTipo.value = b.tipo || 'fija';
    if(btnGuardar) btnGuardar.innerText = 'Actualizar Bodega';
  } else {
    if(inputNombre) inputNombre.value = '';
    if(selectTipo) selectTipo.value = 'fija';
    if(btnGuardar) btnGuardar.innerText = 'Crear Bodega';
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
  const itemsEnBodega = (db.inventario||[]).filter(i=>i.bodegaId===id);
  if(itemsEnBodega.length > 0){
    mostrarToast(`⚠️ No se puede eliminar "${b.nombre}" porque tiene ${itemsEnBodega.length} ítem(s) asignado(s). Trasládalos primero.`, 'error');
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
   REGISTRO / EDICIÓN DE ÍTEMS DE INVENTARIO
--------------------------------------------------------- */
function abrirModalItemInventario(itemId){
  fotosInventarioTemp = [];
  document.getElementById('invItemId').value = itemId || '';
  document.getElementById('invBodega').innerHTML = (db.bodegas||[]).map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('') || '<option value="">Crea una bodega primero</option>';
  
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
    fotosInventarioTemp = (it.fotos||[]).slice();
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
    const nuevoId = Date.now();
    db.inventario.push({
      id: nuevoId,
      qrId: 'ITEM-' + nuevoId,
      nombre, categoria, bodegaId,
      stockActual, stockMinimo,
      fotos: fotosInventarioTemp.slice(),
      publicarEnTienda, precio, descripcionTienda
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
  if(!confirm('¿Eliminar este ítem de inventario y su historial?')) return;
  const it = buscarItemInventario(id);
  const respaldo = (db.inventario||[]).slice();
  db.inventario = db.inventario.filter(i=>i.id!==id);
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
   TRAZABILIDAD DE MOVIMIENTOS / HERRAMIENTAS / PRÉSTAMOS
--------------------------------------------------------- */
function abrirModalSalidaInventario(itemId){
  itemMovimientoActualId = itemId;
  const it = buscarItemInventario(itemId);
  if(!it) return;

  // Si no existe el contenedor dinámico en el HTML, lo inyecta limpiamente
  asegurarModalMovimientoEnDOM();

  document.getElementById('movItemTitulo').innerText = `${it.nombre} (Stock actual: ${it.stockActual})`;
  document.getElementById('movCantidad').value = 1;
  document.getElementById('movCantidad').max = it.stockActual;
  document.getElementById('movFechaSalida').value = new Date().toISOString().slice(0, 16);
  document.getElementById('movFechaRetorno').value = '';
  document.getElementById('movNotas').value = '';

  const selTec = document.getElementById('movTecnico');
  selTec.innerHTML = '<option value="">— Seleccionar técnico o responsable —</option>' +
    (db.tecnicos||[]).filter(t=>t.activo!==false).map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');

  onCambiarMotivoMovimiento();
  abrirModal('modalMovimientoInventario');
}

function onCambiarMotivoMovimiento(){
  const motivo = document.getElementById('movMotivo').value;
  const wrapRetorno = document.getElementById('wrapMovFechaRetorno');
  const wrapTecnico = document.getElementById('wrapMovTecnico');
  if(wrapRetorno) wrapRetorno.style.display = (motivo === 'prestamo') ? 'block' : 'none';
  if(wrapTecnico) wrapTecnico.style.display = (motivo === 'baja') ? 'none' : 'block';
}

async function guardarMovimientoInventario(){
  const it = buscarItemInventario(itemMovimientoActualId);
  if(!it) return;

  const tipo = document.getElementById('movTipoOperacion').value; // 'salida' | 'entrada'
  const motivo = document.getElementById('movMotivo').value;
  const cantidad = parseInt(document.getElementById('movCantidad').value) || 0;
  const fechaHora = document.getElementById('movFechaSalida').value || new Date().toISOString();
  const fechaRetorno = document.getElementById('movFechaRetorno').value || null;
  const tecnicoId = parseInt(document.getElementById('movTecnico').value) || null;
  const tecnico = tecnicoId ? (db.tecnicos||[]).find(t=>t.id===tecnicoId) : null;
  const responsableNombre = tecnico ? tecnico.nombre : (document.getElementById('movResponsableManual')?.value || 'Sin asignar');
  const notas = (document.getElementById('movNotas').value || '').trim();

  if(cantidad <= 0){ mostrarToast('La cantidad debe ser mayor a cero.'); return; }
  if(tipo === 'salida' && it.stockActual < cantidad){
    mostrarToast(`Stock insuficiente. Solo hay ${it.stockActual} disponibles.`);
    return;
  }
  if(motivo === 'prestamo' && !tecnicoId){
    mostrarToast('Selecciona el técnico responsable del préstamo.');
    return;
  }

  const stockPrevio = it.stockActual;
  const nuevoStock = tipo === 'salida' ? (stockPrevio - cantidad) : (stockPrevio + cantidad);
  it.stockActual = nuevoStock;

  db.kardex = db.kardex || [];
  const movimiento = {
    id: Date.now(),
    itemId: it.id,
    itemNombre: it.nombre,
    tipo, // 'salida' | 'entrada'
    motivo, // 'prestamo', 'venta', 'orden', 'baja', 'retorno', 'ajuste'
    cantidad,
    stockPrevio,
    nuevoStock,
    fechaHora,
    fechaEstimadaRetorno: (motivo === 'prestamo') ? fechaRetorno : null,
    tecnicoId,
    responsable: responsableNombre,
    estadoPrestamo: (motivo === 'prestamo') ? 'pendiente' : 'completado',
    notas,
    usuarioRegistro: nombreUsuarioActual ? nombreUsuarioActual() : 'Sistema'
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

  registrarLog('Inventario', tipo.toUpperCase(), `${it.nombre}: ${tipo==='salida'?'-':'+'}${cantidad} (${motivo}) por ${responsableNombre}`);
  mostrarToast(`✅ Movimiento registrado. Stock de "${it.nombre}": ${nuevoStock}`, 'exito');
  cerrarModal('modalMovimientoInventario');
  renderizarInventario();
}

async function registrarDevolucionPrestamo(kardexId){
  const mov = (db.kardex||[]).find(k=>k.id===kardexId);
  if(!mov || mov.estadoPrestamo !== 'pendiente') return;

  const it = buscarItemInventario(mov.itemId);
  if(!it){ mostrarToast('El ítem original ya no existe.'); return; }

  if(!confirm(`¿Registrar el retorno de ${mov.cantidad} unidad(es) de "${mov.itemNombre}" devuelta(s) por ${mov.responsable}?`)) return;

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
    notas: `Devolución de préstamo registrado el ${new Date(mov.fechaHora).toLocaleDateString('es-CO')}`,
    usuarioRegistro: nombreUsuarioActual ? nombreUsuarioActual() : 'Sistema'
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

  registrarLog('Inventario', 'RETORNO', `${it.nombre}: devuelto por ${mov.responsable}`);
  mostrarToast(`✅ Retorno registrado. Stock actual: ${it.stockActual}`, 'exito');
  renderizarInventario();
}

/* ---------------------------------------------------------
   QR DINÁMICO E IMPRESIÓN CORPORATIVA (5x5 CM)
--------------------------------------------------------- */
function verFichaQR(itemId){
  const it = buscarItemInventario(itemId);
  if(!it) return;

  if(!it.qrId){
    it.qrId = 'ITEM-' + it.id;
    dbGuardarInmediato().catch(()=>{});
  }

  asegurarModalQRInventarioEnDOM();

  const urlPublica = `${location.origin}${location.pathname}?item=${it.id}`;
  const wrap = document.getElementById('qrInventarioWrap');
  if(wrap){
    wrap.innerHTML = '';
    if(typeof QRCode !== 'undefined'){
      new QRCode(wrap, {
        text: urlPublica,
        width: 260,
        height: 260,
        correctLevel: QRCode.CorrectLevel.H
      });
      if(db.config && db.config.logo){
        setTimeout(()=>{
          const logoExistente = wrap.querySelector('.etiqueta-logo-centro');
          if(logoExistente) logoExistente.remove();
          const logo = document.createElement('img');
          logo.src = db.config.logo;
          logo.className = 'etiqueta-logo-centro';
          wrap.appendChild(logo);
        }, 80);
      }
    } else {
      wrap.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Librería QR no disponible.</p>`;
    }
  }

  const bodega = buscarBodega(it.bodegaId);
  document.getElementById('qrItemNombre').innerText = it.nombre;
  document.getElementById('qrItemCodigo').innerText = it.qrId;
  document.getElementById('qrItemDetalle').innerText = `${it.categoria || 'Sin categoría'} · ${bodega ? bodega.nombre : 'Sin bodega'} · Stock: ${it.stockActual}`;

  abrirModal('modalQRInventario');
}

function imprimirQRInventario(){
  const estilo = document.createElement('style');
  estilo.id = 'estiloImpresionQRItem';
  estilo.innerHTML = '@page{size:5cm 5cm;margin:0;} @media print{body *{visibility:hidden;} #modalQRInventario, #modalQRInventario *{visibility:visible;} #modalQRInventario{position:fixed;top:0;left:0;width:5cm;height:5cm;margin:0;padding:4px;}}';
  document.head.appendChild(estilo);
  window.print();
  setTimeout(()=>{
    const el = document.getElementById('estiloImpresionQRItem');
    if(el) el.remove();
  }, 1000);
}

/* ---------------------------------------------------------
   RENDERIZADO DE VISTAS: TABLA, KARDEX Y ALERTAS
--------------------------------------------------------- */
function renderizarInventario(){
  const tbody = document.getElementById('tablaInventario');
  const buscadorEl = document.getElementById('invBuscador');
  const texto = buscadorEl ? buscadorEl.value.trim().toLowerCase() : '';

  const itemsFiltrados = (db.inventario||[]).filter(it=>{
    const bodega = buscarBodega(it.bodegaId);
    if(!texto) return true;
    return (it.nombre||'').toLowerCase().includes(texto)
      || (it.categoria||'').toLowerCase().includes(texto)
      || (bodega && bodega.nombre.toLowerCase().includes(texto))
      || (it.qrId && it.qrId.toLowerCase().includes(texto));
  });

  if(tbody){
    tbody.innerHTML = itemsFiltrados.map(it=>{
      const bodega = buscarBodega(it.bodegaId);
      const bajoStock = (it.stockActual <= (it.stockMinimo || 0));
      const fotosHtml = (it.fotos||[]).map(f=>`<img src="${srcDeFoto(f)}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;margin-right:4px;">`).join('');
      return `<tr>
        <td><strong>${it.nombre}</strong><br><small style="color:var(--text-muted);">${it.categoria||'General'} · <code>${it.qrId||'—'}</code></small></td>
        <td>
          ${bodega ? bodega.nombre : '—'} 
          <button class="btn-custom btn-secondary-custom btn-sm-custom" style="padding:2px 6px;font-size:10px;margin-left:4px;" onclick="abrirModalBodega(${it.bodegaId})" title="Editar Bodega"><i class="fas fa-pen"></i></button>
        </td>
        <td>
          <span style="font-size:14px;font-weight:700;">${it.stockActual}</span> 
          <span class="${bajoStock?'badge-stock-bajo':'badge-stock-ok'}">${bajoStock?'BAJO':'OK'}</span>
          <br><small style="color:var(--text-muted);">Mín: ${it.stockMinimo||0}</small>
        </td>
        <td>${fotosHtml || '<span style="color:var(--text-muted);font-size:11px;">Sin fotos</span>'}</td>
        <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verFichaQR(${it.id})" title="Ver / Imprimir QR"><i class="fas fa-qrcode"></i></button></td>
        <td>
          <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirModalSalidaInventario(${it.id})" title="Salida o préstamo de herramienta"><i class="fas fa-arrow-right-from-bracket"></i> Movimiento</button>
          <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirModalItemInventario(${it.id})">Editar</button>
          <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarItemInventario(${it.id})">X</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" class="empty-state">${texto ? 'Sin ítems que coincidan con "'+buscadorEl.value+'".' : 'Sin ítems registrados en inventario.'}</td></tr>`;
  }

  const alertasEl = document.getElementById('alertasStockBajo');
  if(alertasEl){
    const bajos = (db.inventario||[]).filter(i=>i.stockActual <= (i.stockMinimo||0));
    alertasEl.innerHTML = bajos.length ? `
      <div class="panel" style="background:rgba(239,68,68,.1);border-color:var(--red-alert,#ef4444);margin-bottom:15px;color:#b91c1c;">
        ⚠️ <strong>${bajos.length}</strong> ítem(s) por debajo del stock mínimo: ${bajos.map(b=>b.nombre).join(', ')}
      </div>` : '';
  }

  renderizarKardex();
}

function renderizarKardex(){
  const cont = document.getElementById('tablaKardex') || document.querySelector('#kardexMovimientos tbody');
  if(!cont) return;

  const lista = (db.kardex||[]).slice().sort((a,b)=> new Date(b.fechaHora||b.id) - new Date(a.fechaHora||a.id));

  cont.innerHTML = lista.map(k=>{
    const esSalida = k.tipo === 'salida';
    const colorTipo = esSalida ? '#dc2626' : '#16a34a';
    const signo = esSalida ? '−' : '+';
    
    let badgeMotivo = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#e2e8f0;color:#334155;text-transform:capitalize;">${k.motivo||'Movimiento'}</span>`;
    let botonRetorno = '';

    if(k.motivo === 'prestamo'){
      if(k.estadoPrestamo === 'pendiente'){
        badgeMotivo = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#fef3c7;color:#92400e;font-weight:700;">HERRAMIENTA PRESTADA</span>`;
        botonRetorno = `<button class="btn-custom btn-secondary-custom btn-sm-custom" style="margin-top:4px;background:#dcfce7;color:#166534;border-color:#86efac;" onclick="registrarDevolucionPrestamo(${k.id})"><i class="fas fa-arrow-rotate-left"></i> Marcar Devuelto</button>`;
      } else {
        badgeMotivo = `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#dcfce7;color:#166534;">DEVUELTO</span>`;
      }
    }

    const fechaFormat = new Date(k.fechaHora).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' });
    const fechaRetornoFormat = k.fechaEstimadaRetorno ? `<br><small style="color:#b45309;">Retorno estipulado: ${new Date(k.fechaEstimadaRetorno).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })}</small>` : '';

    return `<tr>
      <td>${fechaFormat}</td>
      <td><strong>${k.itemNombre}</strong><br>${badgeMotivo}${fechaRetornoFormat}</td>
      <td style="font-weight:700;color:${colorTipo};">${signo}${k.cantidad}</td>
      <td>${k.stockPrevio ?? '—'} → <strong>${k.nuevoStock ?? '—'}</strong></td>
      <td><strong>${k.responsable || '—'}</strong><br><small style="color:var(--text-muted);">${k.notas || 'Sin observaciones'}</small></td>
      <td>${botonRetorno}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-state">Sin movimientos registrados en el kardex todavía.</td></tr>';
}

/* ---------------------------------------------------------
   INYECCIÓN AUTOMÁTICA DE MODALES (Salida/Préstamo y QR)
--------------------------------------------------------- */
function asegurarModalMovimientoEnDOM(){
  if(document.getElementById('modalMovimientoInventario')) return;
  const div = document.createElement('div');
  div.id = 'modalMovimientoInventario';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-card" style="max-width:540px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--card-border);padding-bottom:10px;margin-bottom:15px;">
        <h3 style="margin:0;"><i class="fas fa-boxes-stacked"></i> Salida o Préstamo de Inventario</h3>
        <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="cerrarModal('modalMovimientoInventario')">✕</button>
      </div>
      <p id="movItemTitulo" style="font-weight:700;color:var(--accent-color);margin-bottom:12px;"></p>
      
      <div class="field-row">
        <div>
          <label style="font-size:12px;font-weight:600;">Tipo de Operación</label>
          <select id="movTipoOperacion">
            <option value="salida">Salida / Egreso</option>
            <option value="entrada">Entrada / Reingreso manual</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;">Motivo del Movimiento</label>
          <select id="movMotivo" onchange="onCambiarMotivoMovimiento()">
            <option value="prestamo">Préstamo de herramienta (Técnico)</option>
            <option value="orden">Uso en Orden de Servicio</option>
            <option value="venta">Venta / Despacho a cliente</option>
            <option value="baja">Baja / Deterioro / Desecho</option>
            <option value="traslado">Traslado entre bodegas</option>
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

      <div id="wrapMovTecnico" style="margin-top:10px;">
        <label style="font-size:12px;font-weight:600;">Técnico Responsable</label>
        <select id="movTecnico"></select>
      </div>

      <div id="wrapMovFechaRetorno" style="margin-top:10px;display:none;">
        <label style="font-size:12px;font-weight:600;color:#b45309;">Fecha y Hora Estimada de Retorno</label>
        <input type="datetime-local" id="movFechaRetorno">
      </div>

      <div style="margin-top:10px;">
        <label style="font-size:12px;font-weight:600;">Notas / Destino / Observaciones</label>
        <input type="text" id="movNotas" placeholder="Ej: Se la lleva Pedro para mantenimiento en Sede Centro">
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
        <button type="button" class="btn-custom btn-secondary-custom" onclick="cerrarModal('modalMovimientoInventario')">Cancelar</button>
        <button type="button" class="btn-custom btn-primary-custom" onclick="guardarMovimientoInventario()">Confirmar Movimiento</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}

function asegurarModalQRInventarioEnDOM(){
  if(document.getElementById('modalQRInventario')) return;
  const div = document.createElement('div');
  div.id = 'modalQRInventario';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-card" style="max-width:380px;text-align:center;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--card-border);padding-bottom:8px;margin-bottom:12px;">
        <h4 style="margin:0;"><i class="fas fa-qrcode"></i> Ficha y Etiqueta QR</h4>
        <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="cerrarModal('modalQRInventario')">✕</button>
      </div>
      <div id="qrInventarioWrap" style="display:flex;justify-content:center;align-items:center;margin:15px 0;position:relative;"></div>
      <h4 id="qrItemNombre" style="margin:6px 0 2px 0;"></h4>
      <code id="qrItemCodigo" style="font-size:13px;color:var(--accent-color);"></code>
      <p id="qrItemDetalle" style="font-size:12px;color:var(--text-muted);margin:6px 0 15px;"></p>
      <div style="display:flex;justify-content:center;gap:10px;">
        <button type="button" class="btn-custom btn-secondary-custom" onclick="imprimirQRInventario()"><i class="fas fa-print"></i> Imprimir 5x5 cm</button>
        <button type="button" class="btn-custom btn-primary-custom" onclick="cerrarModal('modalQRInventario')">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}
