// ===== inventario.js — extraído de prevenglobal__25_.html (líneas 4235-4354) =====
/* =========================================================
   INVENTARIO, BODEGAS, KARDEX Y QR
========================================================= */
let fotosInventarioTemp = [];
function buscarItemInventario(id){ return db.inventario.find(i=>i.id===id); }
function buscarBodega(id){ return db.bodegas.find(b=>b.id===id); }

function abrirModalBodega(){
  document.getElementById('bodNombre').value='';
  abrirModal('modalBodega');
}
async function guardarBodega(){
  const nombre = document.getElementById('bodNombre').value.trim();
  const tipo = document.getElementById('bodTipo').value;
  if(!nombre){ mostrarToast('Escribe el nombre de la bodega.'); return; }
  const b = { id:Date.now(), nombre, tipo };
  db.bodegas.push(b);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.bodegas.pop();
    mostrarToast('⚠️ No se pudo guardar la bodega: ' + err.message, 'error');
    return;
  }
  registrarLog('Crear', 'Bodega', nombre);
  mostrarToast('✅ Bodega creada.', 'exito');
  cerrarModal('modalBodega');
  renderizarInventario();
}

function abrirModalItemInventario(itemId){
  fotosInventarioTemp = [];
  document.getElementById('invItemId').value = itemId || '';
  document.getElementById('invBodega').innerHTML = db.bodegas.map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('') || '<option value="">Crea una bodega primero</option>';
  if(itemId){
    const it = buscarItemInventario(itemId);
    document.getElementById('invNombre').value = it.nombre;
    document.getElementById('invCategoria').value = it.categoria||'';
    document.getElementById('invBodega').value = it.bodegaId;
    document.getElementById('invStockActual').value = it.stockActual;
    document.getElementById('invStockMinimo').value = it.stockMinimo;
    document.getElementById('invPublicarTienda').checked = !!it.publicarEnTienda;
    document.getElementById('invPrecio').value = it.precio || '';
    document.getElementById('invDescripcionTienda').value = it.descripcionTienda || '';
    fotosInventarioTemp = (it.fotos||[]).slice();
  } else {
    document.getElementById('invNombre').value=''; document.getElementById('invCategoria').value='';
    document.getElementById('invStockActual').value=0; document.getElementById('invStockMinimo').value=0;
    document.getElementById('invPublicarTienda').checked = false;
    document.getElementById('invPrecio').value=''; document.getElementById('invDescripcionTienda').value='';
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
  const nombre = document.getElementById('invNombre').value.trim();
  const categoria = document.getElementById('invCategoria').value.trim();
  const bodegaId = parseInt(document.getElementById('invBodega').value);
  const stockActual = parseInt(document.getElementById('invStockActual').value)||0;
  const stockMinimo = parseInt(document.getElementById('invStockMinimo').value)||0;
  const publicarEnTienda = document.getElementById('invPublicarTienda').checked;
  const precio = parseFloat(document.getElementById('invPrecio').value) || 0;
  const descripcionTienda = document.getElementById('invDescripcionTienda').value.trim();
  if(!nombre){ mostrarToast('Escribe el nombre del ítem.'); return; }
  if(!bodegaId){ mostrarToast('Selecciona o crea una bodega primero.'); return; }
  let respaldo = null, esNuevo = false;
  if(id){
    const it = buscarItemInventario(parseInt(id));
    respaldo = Object.assign({}, it);
    Object.assign(it, { nombre, categoria, bodegaId, stockActual, stockMinimo, fotos: fotosInventarioTemp.slice(), publicarEnTienda, precio, descripcionTienda });
  } else {
    esNuevo = true;
    db.inventario.push({ id:Date.now(), nombre, categoria, bodegaId, stockActual, stockMinimo, fotos: fotosInventarioTemp.slice(), qrId: 'ITEM-'+Date.now(), publicarEnTienda, precio, descripcionTienda });
  }
  try{
    await dbGuardarInmediato();
  }catch(err){
    if(id && respaldo){ Object.assign(buscarItemInventario(parseInt(id)), respaldo); }
    else if(esNuevo){ db.inventario.pop(); }
    mostrarToast('⚠️ No se pudo guardar el ítem: ' + err.message, 'error');
    return;
  }
  registrarLog(id?'Editar':'Crear', 'Inventario', nombre);
  mostrarToast(id ? `✅ ${nombre} actualizado.` : `✅ ${nombre} agregado al inventario.`, 'exito');
  cerrarModal('modalItemInventario');
  renderizarInventario();
}
async function eliminarItemInventario(id){
  if(!confirm('¿Eliminar este ítem de inventario?')) return;
  const it = buscarItemInventario(id);
  const respaldo = db.inventario.slice();
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
function renderizarInventario(){
  const tbody = document.getElementById('tablaInventario');
  const buscadorEl = document.getElementById('invBuscador');
  const texto = buscadorEl ? buscadorEl.value.trim().toLowerCase() : '';
  const itemsFiltrados = !texto ? db.inventario : db.inventario.filter(it=>{
    const bodega = buscarBodega(it.bodegaId);
    return (it.nombre||'').toLowerCase().includes(texto)
      || (it.categoria||'').toLowerCase().includes(texto)
      || (bodega && bodega.nombre.toLowerCase().includes(texto));
  });
  tbody.innerHTML = itemsFiltrados.map(it=>{
    const bodega = buscarBodega(it.bodegaId);
    const bajoStock = it.stockActual <= it.stockMinimo;
    const fotosHtml = (it.fotos||[]).map(f=>`<img src="${srcDeFoto(f)}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;margin-right:3px;">`).join('');
    return `<tr>
      <td><strong>${it.nombre}</strong><br><small style="color:var(--text-muted);">${it.categoria||''}</small></td>
      <td>${bodega?bodega.nombre:'—'}</td>
      <td>${it.stockActual} <span class="${bajoStock?'badge-stock-bajo':'badge-stock-ok'}">${bajoStock?'BAJO':'OK'}</span><br><small style="color:var(--text-muted);">mín: ${it.stockMinimo}</small></td>
      <td>${fotosHtml||'—'}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verFichaQR(${it.id})"><i class="fas fa-qrcode"></i></button></td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirModalItemInventario(${it.id})">Editar</button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarItemInventario(${it.id})">X</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="empty-state">${texto ? 'Sin ítems que coincidan con "'+buscadorEl.value+'".' : 'Sin ítems registrados. Crea uno con "+ Ítem".'}</td></tr>`;

  const bajos = db.inventario.filter(i=>i.stockActual<=i.stockMinimo);
  document.getElementById('alertasStockBajo').innerHTML = bajos.length ? `
    <div class="panel" style="background:rgba(239,68,68,.1);border-color:var(--red-alert);margin-bottom:15px;">
      ⚠️ <strong>${bajos.length}</strong> ítem(s) por debajo del stock mínimo: ${bajos.map(b=>b.nombre).join(', ')}
    </div>` : '';

  renderizarKardex();
}

