// ===== inventario.js — Módulo de Inventario, Bodegas, Kardex, QR y Visor de Fotos =====
/* =========================================================
   INVENTARIO, BODEGAS, KARDEX Y QR
========================================================= */
let fotosInventarioTemp = [];
let bodegaEdicionId = null;

function buscarItemInventario(id){ return (db.inventario || []).find(i=>i.id===id); }
function buscarBodega(id){ return (db.bodegas || []).find(b=>b.id===id); }

/* ---------------------------------------------------------
   VISOR DE FOTOS EN ALTA RESOLUCIÓN (MODAL AUTÓNOMO)
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
   RENDERIZADO DE TABLAS CON CLICK EN FOTO GRANDE
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
  
  tbody.innerHTML = movimientos.slice().reverse().map(k=>`
    <tr>
      <td>${new Date(k.fechaHora || k.fecha || k.id).toLocaleString('es-CO')}</td>
      <td><strong>${k.itemNombre || k.item || '—'}</strong></td>
      <td><span style="font-weight:700;color:${k.tipo==='salida'?'#dc2626':'#16a34a'};">${k.tipo ? k.tipo.toUpperCase() : 'MOV'}</span></td>
      <td>${k.cantidad}</td>
      <td>${k.origen || '—'}</td>
      <td>${k.destino || k.responsable || '—'}</td>
      <td>${k.usuario || k.usuarioRegistro || '—'}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="empty-state">Sin movimientos registrados en el kardex.</td></tr>';
}
