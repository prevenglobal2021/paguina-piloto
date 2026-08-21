// ===== config-clientes-equipos.js — extraído de prevenglobal__25_.html (líneas 3152-3599) =====
/* =========================================================
   CONFIGURACIÓN: CLIENTES / SEDES / EQUIPOS
========================================================= */
function abrirModalConfig(tab){ abrirModal('modalConfigCentro'); cambiarTabConfig(tab, null); }
function cambiarTabConfig(tab, evt){
  document.querySelectorAll('.config-tab-content').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.config-tab-btn').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  const btn = evt && evt.target ? evt.target : document.querySelector(`.config-tab-btn[data-tab="${tab}"]`);
  if(btn) btn.classList.add('active');
  if(tab==='clientes') renderizarClientesConfig();
  if(tab==='plantillas') renderizarPlantillasConfig();
  if(tab==='tecnicos'){ renderizarTecnicosConfig(); renderizarChecklistPermisosPersonal(); }
  if(tab==='tiendaConfig') cargarTabTiendaConfig();
  if(tab==='general'){
    document.getElementById('cfgEmpresaNombre').value = db.config.nombre;
    document.getElementById('cfgEmpresaSub').value = db.config.subtitulo;
    document.getElementById('cfgEmpresaDireccion').value = db.config.direccion||'';
    document.getElementById('cfgEmpresaMision').value = db.config.mision||'';
    document.getElementById('cfgEmpresaVision').value = db.config.vision||'';
    document.getElementById('cfgAdminUsuario').value = db.config.adminUsuario||'';
    document.getElementById('cfgLoginRequerido').checked = db.config.loginRequerido !== false;
    document.getElementById('cfgNombreRepresentante').value = db.config.nombreRepresentante||'';
    logoTempBase64 = db.config.logo;
    const prev = document.getElementById('previewLogoConfig');
    const placeholder = document.getElementById('previewLogoConfigPlaceholder');
    if(db.config.logo){ prev.src = db.config.logo; prev.style.display='inline-block'; placeholder.style.display='none'; } else { prev.style.display='none'; placeholder.style.display='block'; }
    firmaTempBase64 = db.config.firmaRepresentante;
    const prevFirma = document.getElementById('imgFirmaConfig');
    const placeholderFirma = document.getElementById('previewFirmaConfigPlaceholder');
    if(db.config.firmaRepresentante){ prevFirma.src = db.config.firmaRepresentante; prevFirma.style.display='inline-block'; placeholderFirma.style.display='none'; } else { prevFirma.style.display='none'; placeholderFirma.style.display='block'; }
  }
  if(tab==='apariencia'){
    document.getElementById('cfgTamanoLetra').value = db.config.tamanoLetra || 'md';
    document.getElementById('cfgColorTexto').value = db.config.colorTexto || '#1e293b';
    document.getElementById('cfgFormRadius').value = db.config.formRadius!==undefined ? db.config.formRadius : '6';
    document.getElementById('cfgFormBorderColor').value = db.config.formBorderColor || '#cbd5e1';
    document.getElementById('cfgFormTamanoBotones').value = db.config.formTamanoBotones || 'md';
    document.getElementById('cfgTipoLetra').value = db.config.fontFamily || "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif";
    renderizarTemasClaros();
    document.getElementById('cfgLoginColor1').value = db.config.loginColor1 || '#7c3aed';
    document.getElementById('cfgLoginColor2').value = db.config.loginColor2 || '#4c1d95';
    loginImagenTempBase64 = db.config.loginImagenFondo || null;
    document.getElementById('cfgLoginTituloIzquierda').value = db.config.loginTituloIzquierda || 'Domina el sistema';
    document.getElementById('cfgLoginSubtituloIzquierda').value = db.config.loginSubtituloIzquierda || 'Controla clientes, equipos, órdenes de servicio e inventario desde un solo lugar.';
    document.getElementById('cfgLoginBienvenidaTitulo').value = db.config.loginBienvenidaTitulo || '¡Bienvenido!';
    document.getElementById('cfgLoginBienvenidaSubtitulo').value = db.config.loginBienvenidaSubtitulo || 'Por favor inicia sesión';
    actualizarPreviewLoginMini();
  }
  if(tab==='etiquetas') renderizarEtiquetas();
  if(tab==='whatsapp') document.getElementById('cfgPlantillaWhatsApp').value = db.config.plantillaWhatsApp;
  if(tab==='auditoria') renderizarAuditoria();
}
function guardarPlantillaWhatsApp(){
  db.config.plantillaWhatsApp = document.getElementById('cfgPlantillaWhatsApp').value;
  dbGuardar();
  mostrarToast('Plantilla de WhatsApp actualizada.');
}
function renderizarAuditoria(){
  const tbody = document.getElementById('tablaAuditoria');
  tbody.innerHTML = db.logs.slice().reverse().map(l=>`
    <tr><td>${new Date(l.timestamp).toLocaleString('es-CO')}</td><td>${l.usuario}</td><td>${l.accion}</td><td>${l.entidad}</td><td>${l.detalle||''}</td></tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">Sin actividad registrada todavía.</td></tr>';
}
function enviarPorWhatsApp(ordenId){
  const o = db.ordenes.find(x=>x.id===ordenId);
  if(o.esClienteNuevo){ mostrarToast('Esta orden es de un cliente nuevo (no registrado), sin teléfono guardado — usa "Ver Documento" para descargar el informe y enviarlo tú mismo.'); return; }
  const cliente = buscarCliente(o.clienteId);
  if(!cliente || !cliente.telefono){ mostrarToast('Este cliente no tiene teléfono registrado.'); return; }
  const telefonoLimpio = cliente.telefono.replace(/[^0-9]/g,'');
  let mensaje = db.config.plantillaWhatsApp
    .replace(/{nombre_cliente}/g, cliente.nombre)
    .replace(/{numero_orden}/g, o.numero);
  const enlaceWhatsApp = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;

  const puedeCompartirArchivosNativo = !!(navigator.share && navigator.canShare);
  let ventanaWhatsApp = null;
  if(!puedeCompartirArchivosNativo){
    ventanaWhatsApp = window.open(enlaceWhatsApp, '_blank');
    if(!ventanaWhatsApp){
      mostrarToast('⚠️ El navegador bloqueó la ventana de WhatsApp. Busca el ícono de "ventana emergente bloqueada" en la barra de direcciones, permítela para este sitio, e intenta de nuevo.', 'error');
      return;
    }
  }

  verPDF(ordenId);
  const nombreArchivo = `Informe_${o.numero}_${cliente.nombre}`.replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf';
  const elemento = document.getElementById('pdfContenido');
  const opciones = { margin:10, filename:nombreArchivo, image:{type:'jpeg',quality:0.95}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'letter',orientation:'portrait'}, pagebreak:{ mode:['css','legacy'] } };

  if(typeof html2pdf === 'undefined'){
    if(puedeCompartirArchivosNativo) window.open(enlaceWhatsApp, '_blank');
    registrarLog('Enviar WhatsApp', 'OrdenServicio', `${o.numero} a ${cliente.nombre} (sin informe adjunto automático — sin conexión)`);
    return;
  }
  html2pdf().set(opciones).from(elemento).outputPdf('blob').then(blob=>{
    cerrarModal('modalPDF');
    const archivoPdf = new File([blob], nombreArchivo, { type:'application/pdf' });

    if(puedeCompartirArchivosNativo && navigator.canShare({ files:[archivoPdf] })){
      navigator.share({ files:[archivoPdf], title:`Informe ${o.numero}`, text: mensaje }).then(()=>{
        registrarLog('Enviar WhatsApp', 'OrdenServicio', `${o.numero} a ${cliente.nombre} (informe compartido directo desde el celular)`);
      }).catch(()=>{ });
      return;
    }

    const url = URL.createObjectURL(blob);
    const enlaceDescarga = document.createElement('a');
    enlaceDescarga.href = url; enlaceDescarga.download = nombreArchivo; enlaceDescarga.click();
    URL.revokeObjectURL(url);
    mostrarToast(`Se descargó el informe "${nombreArchivo}". WhatsApp ya está abierto con el mensaje listo: adjunta ese archivo en el chat (📎 → Documento) antes de enviarlo.`);
    registrarLog('Enviar WhatsApp', 'OrdenServicio', `${o.numero} a ${cliente.nombre} (con informe PDF descargado para adjuntar)`);
  }).catch(()=>{
    if(!ventanaWhatsApp && !puedeCompartirArchivosNativo) window.open(enlaceWhatsApp, '_blank');
    mostrarToast('No se pudo generar el PDF automáticamente. WhatsApp está abierto; genera el informe desde "Ver Documento" y adjúntalo manualmente.');
    registrarLog('Enviar WhatsApp', 'OrdenServicio', `${o.numero} a ${cliente.nombre} (sin informe adjunto automático)`);
  });
}

let imagenesClienteTemp = [];
let imagenesClienteModificado = false;
function usarUbicacionActualCliente(){
  if(!navigator.geolocation){ mostrarToast('Tu navegador no soporta geolocalización.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      document.getElementById('cfgCliLat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('cfgCliLng').value = pos.coords.longitude.toFixed(6);
    },
    err=>{ mostrarToast('No se pudo obtener tu ubicación: '+err.message+'. Revisa que el navegador tenga permiso de ubicación.'); }
  );
}
function manejarImagenClienteUpload(event){
  const files = Array.from(event.target.files);
  if(files.length===0) return;
  imagenesClienteModificado = true;
  files.forEach(file=>{
    comprimirImagen(file).then(dataUrl=>{ imagenesClienteTemp.push({ src:dataUrl, desc:'' }); renderizarImagenesClientePreview(); });
  });
  event.target.value = '';
}
function renderizarImagenesClientePreview(){
  renderizarGaleriaFotos('previewImagenesCliente', imagenesClienteTemp, 'cliente');
}
function abrirEnGoogleMaps(direccion){
  if(!direccion){ mostrarToast('Este registro no tiene una dirección guardada todavía.'); return; }
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
  window.open(url, '_blank');
}
function abrirUbicacionCliente(id){
  const c = buscarCliente(id);
  if(c.lat && c.lng){
    window.open(`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`, '_blank');
  } else {
    abrirEnGoogleMaps(c.direccion);
  }
}
function guardarClienteConfig(){
  const id = document.getElementById('cfgCliId').value;
  const nombre = document.getElementById('cfgCliNombre').value;
  const tipoDoc = document.getElementById('cfgCliTipoDoc').value;
  const numDoc = document.getElementById('cfgCliNumDoc').value.trim();
  const telefono = document.getElementById('cfgCliTelefono').value;
  const direccion = document.getElementById('cfgCliDireccion').value;
  const lat = document.getElementById('cfgCliLat').value.trim();
  const lng = document.getElementById('cfgCliLng').value.trim();
  if(!nombre){ mostrarToast('El nombre del cliente es obligatorio'); return; }
  if(id){
    const c = buscarCliente(parseInt(id));
    c.nombre=nombre; c.tipoDocumento=tipoDoc; c.numeroDocumento=numDoc; c.telefono=telefono; c.direccion=direccion; c.lat=lat||null; c.lng=lng||null;
    if(imagenesClienteModificado) c.imagenesReferencia = imagenesClienteTemp.slice();
    delete c.imagenReferencia;
  } else {
    db.clientes.push({ id:Date.now(), nombre, tipoDocumento:tipoDoc, numeroDocumento:numDoc, telefono, direccion, lat:lat||null, lng:lng||null, imagenesReferencia: imagenesClienteTemp.slice(), sedes:[] });
  }
  dbGuardar();
  registrarLog(id?'Editar':'Crear', 'Cliente', nombre);
  document.getElementById('cfgCliId').value=''; document.getElementById('cfgCliNombre').value=''; document.getElementById('cfgCliTipoDoc').value='NIT'; document.getElementById('cfgCliNumDoc').value=''; document.getElementById('cfgCliTelefono').value=''; document.getElementById('cfgCliDireccion').value='';
  document.getElementById('cfgCliLat').value=''; document.getElementById('cfgCliLng').value='';
  imagenesClienteTemp = []; imagenesClienteModificado = false;
  document.getElementById('previewImagenesCliente').innerHTML = '';
  renderizarClientesConfig();
}
function renderizarClientesConfig(){
  const tbody = document.getElementById('tablaConfigClientesBody');
  const buscadorEl = document.getElementById('cliBuscadorConfig');
  const texto = buscadorEl ? buscadorEl.value.trim().toLowerCase() : '';
  const clientesFiltrados = !texto ? db.clientes : db.clientes.filter(c=>
    (c.nombre||'').toLowerCase().includes(texto)
    || (c.numeroDocumento||'').toLowerCase().includes(texto)
    || (c.telefono||'').toLowerCase().includes(texto)
    || (c.direccion||'').toLowerCase().includes(texto)
  );
  tbody.innerHTML = '';
  if(!clientesFiltrados.length){
    tbody.innerHTML = `<tr><td class="empty-state">${texto ? 'Sin clientes que coincidan con "'+buscadorEl.value+'".' : 'Sin clientes registrados todavía.'}</td></tr>`;
    return;
  }
  clientesFiltrados.forEach(c=>{
    const imagenes = c.imagenesReferencia || (c.imagenReferencia ? [c.imagenReferencia] : []);
    const imgHtml = imagenes.length ? `<div style="display:flex;gap:4px;margin-top:4px;">${imagenes.slice(0,3).map(im=>`<img src="${srcDeFoto(im)}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;">`).join('')}${imagenes.length>3?`<span style="font-size:10px;color:var(--text-muted);align-self:center;">+${imagenes.length-3}</span>`:''}</div>` : '';
    const precisionTxt = (c.lat && c.lng) ? 'Ubicación GPS guardada' : (c.direccion ? 'Solo dirección de texto' : 'Sin dirección registrada');
    const docTxt = c.numeroDocumento ? `${c.tipoDocumento||'NIT'}: ${c.numeroDocumento}` : '';
    const contactosTxt = (c.contactos||[]).length ? `<br><small style="color:var(--text-muted);">👤 ${c.contactos.map(ct=>`${ct.nombre}${ct.cargo?' ('+ct.cargo+')':''}${ct.telefono?' — '+ct.telefono:''}`).join(' · ')}</small>` : '';
    tbody.innerHTML += `<tr><td><strong>${c.nombre}</strong>${docTxt?`<br><small style="color:var(--text-muted);">${docTxt}</small>`:''}<br><small style="color:var(--text-muted);">${c.telefono||''}</small><br><small style="color:var(--text-muted);">${c.direccion||'Sin dirección registrada'} · ${precisionTxt}</small>${contactosTxt}${imgHtml}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="seleccionarClienteConfig(${c.id})"><i class="fas fa-building"></i> Sedes</button>
      <button class="btn-custom btn-sm-custom" onclick="editarClienteConfig(${c.id})"><i class="fas fa-pen"></i> Editar</button>
      <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirUbicacionCliente(${c.id})"><i class="fas fa-map-marker-alt"></i></button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarClienteConfig(${c.id})"><i class="fas fa-trash"></i></button></td></tr>`;
  });
}
function editarClienteConfig(id){
  const c = buscarCliente(id);
  document.getElementById('cfgCliId').value = c.id;
  document.getElementById('cfgCliNombre').value = c.nombre;
  document.getElementById('cfgCliTipoDoc').value = c.tipoDocumento || 'NIT';
  document.getElementById('cfgCliNumDoc').value = c.numeroDocumento || '';
  document.getElementById('cfgCliTelefono').value = c.telefono||'';
  document.getElementById('cfgCliDireccion').value = c.direccion||'';
  document.getElementById('cfgCliLat').value = c.lat||'';
  document.getElementById('cfgCliLng').value = c.lng||'';
  imagenesClienteTemp = (c.imagenesReferencia || (c.imagenReferencia ? [c.imagenReferencia] : [])).slice();
  imagenesClienteModificado = false;
  renderizarImagenesClientePreview();
}
function eliminarClienteConfig(id){
  if(!confirm('¿Eliminar este cliente y todas sus sedes/equipos?')) return;
  const c = buscarCliente(id);
  db.clientes = db.clientes.filter(c=>c.id!==id);
  registrarEliminacion('clientes', id);
  dbGuardar();
  if(c) registrarLog('Eliminar', 'Cliente', c.nombre);
  renderizarClientesConfig();
  document.getElementById('cfgSeccionSedes').style.display='none';
  document.getElementById('cfgSeccionEquipos').style.display='none';
}
function seleccionarClienteConfig(id){
  clienteActivoId = id;
  const c = buscarCliente(id);
  document.getElementById('cfgSeccionSedes').style.display='block';
  document.getElementById('cfgSeccionEquipos').style.display='none';
  document.getElementById('cfgTituloSedes').innerText = `Sedes de: ${c.nombre}`;
  renderizarSedesConfig();
}
function agregarSedeConfig(){
  const nombre = document.getElementById('cfgSedeNombre').value;
  const direccion = document.getElementById('cfgSedeDireccion').value;
  if(!nombre){ mostrarToast('Escribe el nombre de la sede'); return; }
  const c = buscarCliente(clienteActivoId);
  c.sedes.push({ id:Date.now(), nombre, direccion, equipos:[] });
  dbGuardar();
  document.getElementById('cfgSedeNombre').value=''; document.getElementById('cfgSedeDireccion').value='';
  renderizarSedesConfig();
}
function renderizarSedesConfig(){
  const tbody = document.getElementById('tablaConfigSedesBody');
  tbody.innerHTML = '';
  const c = buscarCliente(clienteActivoId);
  c.sedes.forEach(s=>{
    tbody.innerHTML += `<tr><td>${s.nombre}</td><td>${s.direccion||''}</td><td>${s.equipos.length}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="seleccionarSedeConfig(${s.id})">Equipos</button>
      <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirEnGoogleMaps('${(s.direccion||'').replace(/'/g,"\'")}')"><i class="fas fa-map-marker-alt"></i></button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarSedeConfig(${s.id})">X</button></td></tr>`;
  });
}
function eliminarSedeConfig(id){
  if(!confirm('¿Eliminar esta sede y sus equipos?')) return;
  const c = buscarCliente(clienteActivoId);
  c.sedes = c.sedes.filter(s=>s.id!==id);
  dbGuardar(); renderizarSedesConfig();
  document.getElementById('cfgSeccionEquipos').style.display='none';
}
function seleccionarSedeConfig(id){
  sedeActivaId = id;
  const c = buscarCliente(clienteActivoId);
  const s = c.sedes.find(x=>x.id===id);
  document.getElementById('cfgSeccionEquipos').style.display='block';
  document.getElementById('cfgTituloEquipos').innerText = `Equipos de: ${s.nombre}`;
  renderizarEquiposConfig();
}

/* =========================================================
   REGISTRO / EDICIÓN DE EQUIPO
========================================================= */
let fotosEquipoModalTemp = [];
function abrirModalEquipo(equipoId, clientePreset, sedePreset){
  document.getElementById('eqModalId').value = equipoId || '';
  fotosEquipoModalTemp = [];
  const selCliente = document.getElementById('eqModalCliente');
  selCliente.innerHTML = db.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('') || '<option value="">Registra un cliente primero en Clientes y Sedes</option>';
  if(equipoId){
    const info = ubicarEquipoPorId(equipoId);
    if(!info){ mostrarToast('No se encontró el equipo.'); return; }
    document.getElementById('tituloModalEquipo').innerText = '✏️ Editar Equipo';
    selCliente.value = info.cliente.id;
    poblarSedesModalEquipo();
    document.getElementById('eqModalSede').value = info.sede ? info.sede.id : '';
    document.getElementById('eqModalNombre').value = info.equipo.nombre||'';
    document.getElementById('eqModalSerial').value = info.equipo.serie||'';
    document.getElementById('eqModalMarca').value = info.equipo.marca||'';
    document.getElementById('eqModalModelo').value = info.equipo.modelo||'';
    document.getElementById('eqModalCapacidad').value = info.equipo.capacidad||'';
    document.getElementById('eqModalVoltaje').value = info.equipo.voltaje||'';
    document.getElementById('eqModalRefrigerante').value = info.equipo.refrigerante||'';
    document.getElementById('eqModalFichaTecnica').value = info.equipo.fichaTecnica||'';
    fotosEquipoModalTemp = (info.equipo.fotos||[]).slice();
  } else {
    document.getElementById('tituloModalEquipo').innerText = '🆕 Registrar Equipo';
    ['eqModalNombre','eqModalSerial','eqModalMarca','eqModalModelo','eqModalCapacidad','eqModalVoltaje','eqModalRefrigerante','eqModalFichaTecnica'].forEach(id=>document.getElementById(id).value='');
    if(clientePreset) selCliente.value = clientePreset;
    poblarSedesModalEquipo();
    if(sedePreset) document.getElementById('eqModalSede').value = sedePreset;
  }
  renderizarFotosEquipoModalPreview();
  abrirModal('modalEquipo');
}
function poblarSedesModalEquipo(){
  const c = buscarCliente(parseInt(document.getElementById('eqModalCliente').value));
  const selSede = document.getElementById('eqModalSede');
  const opcionSinSede = '<option value="">— Sin sede (opcional) —</option>';
  selSede.innerHTML = opcionSinSede + (c ? c.sedes.map(s=>`<option value="${s.id}">${s.nombre}</option>`).join('') : '');
}
function manejarFotoEquipoModal(event){
  const files = Array.from(event.target.files);
  files.forEach(file=>{ comprimirImagen(file).then(dataUrl=>{ fotosEquipoModalTemp.push({ src:dataUrl, desc:'' }); renderizarFotosEquipoModalPreview(); }); });
  event.target.value = '';
}
function renderizarFotosEquipoModalPreview(){
  renderizarGaleriaFotos('previewFotosEquipoModal', fotosEquipoModalTemp, 'equipoModal');
}
function guardarEquipoModal(){
  const idRaw = document.getElementById('eqModalId').value;
  const clienteId = parseInt(document.getElementById('eqModalCliente').value);
  const sedeIdRaw = document.getElementById('eqModalSede').value;
  const sedeId = sedeIdRaw ? parseInt(sedeIdRaw) : null;
  const nombre = document.getElementById('eqModalNombre').value;
  if(!clienteId){ mostrarToast('Selecciona el Cliente al que pertenece el equipo.'); return; }
  if(!nombre){ mostrarToast('Escribe el nombre del equipo.'); return; }
  const clienteDestino = buscarCliente(clienteId);
  if(!clienteDestino){ mostrarToast('No se encontró el cliente seleccionado.'); return; }
  let sedeDestino = null;
  if(sedeId){
    sedeDestino = buscarSede(clienteId, sedeId);
    if(!sedeDestino){ mostrarToast('No se encontró la sede seleccionada.'); return; }
  }
  const destinoTexto = sedeDestino ? sedeDestino.nombre : 'Sin sede';
  const datos = {
    nombre,
    serie: document.getElementById('eqModalSerial').value,
    marca: document.getElementById('eqModalMarca').value,
    modelo: document.getElementById('eqModalModelo').value,
    capacidad: document.getElementById('eqModalCapacidad').value,
    voltaje: document.getElementById('eqModalVoltaje').value,
    refrigerante: document.getElementById('eqModalRefrigerante').value,
    fichaTecnica: document.getElementById('eqModalFichaTecnica').value,
    fotos: fotosEquipoModalTemp.slice()
  };
  if(idRaw){
    const equipoId = parseInt(idRaw);
    const infoActual = ubicarEquipoPorId(equipoId);
    if(infoActual){
      const eqExistente = infoActual.equipo;
      const sedeActualId = infoActual.sede ? infoActual.sede.id : null;
      const mismaUbicacion = infoActual.cliente.id===clienteId && sedeActualId===sedeId;
      Object.assign(eqExistente, datos);
      if(!eqExistente.qrId) eqExistente.qrId = 'EQ-'+eqExistente.id;
      if(!mismaUbicacion){
        if(infoActual.sede){ infoActual.sede.equipos = infoActual.sede.equipos.filter(e=>e.id!==equipoId); }
        else { const arr = equiposSinSedeDe(infoActual.cliente); infoActual.cliente.equiposSinSede = arr.filter(e=>e.id!==equipoId); }
        if(sedeDestino) sedeDestino.equipos.push(eqExistente);
        else equiposSinSedeDe(clienteDestino).push(eqExistente);
      }
      registrarLog('Editar', 'Equipo', `${nombre} (${clienteDestino.nombre} · ${destinoTexto})`);
    }
  } else {
    const nuevoId = Date.now();
    const nuevoEquipo = Object.assign({ id:nuevoId, qrId:'EQ-'+nuevoId }, datos);
    if(sedeDestino) sedeDestino.equipos.push(nuevoEquipo);
    else equiposSinSedeDe(clienteDestino).push(nuevoEquipo);
    registrarLog('Crear', 'Equipo', `${nombre} (${clienteDestino.nombre} · ${destinoTexto})`);
  }
  dbGuardar();
  cerrarModal('modalEquipo');
  renderizarEquiposGlobal('');
  if(clienteActivoId){ renderizarSedesConfig(); if(sedeActivaId) renderizarEquiposConfig(); }
  actualizarKPIs();
}
function renderizarEquiposConfig(){
  const tbody = document.getElementById('tablaConfigEquiposBody');
  tbody.innerHTML = '';
  const c = buscarCliente(clienteActivoId);
  const s = c.sedes.find(x=>x.id===sedeActivaId);
  s.equipos.forEach(e=>{
    tbody.innerHTML += `<tr><td>${e.nombre}</td><td>${e.serie||'—'}</td><td>${e.marca||''} ${e.modelo||''}</td><td>${e.refrigerante||''}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirModalEquipo(${e.id})">Editar</button>
      <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verEtiquetaQR(${e.id})"><i class="fas fa-qrcode"></i></button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarEquipoConfig(${e.id})">X</button></td></tr>`;
  });
}
function eliminarEquipoConfig(id){
  const c = buscarCliente(clienteActivoId);
  const s = c.sedes.find(x=>x.id===sedeActivaId);
  const eq = s.equipos.find(e=>e.id===id);
  s.equipos = s.equipos.filter(e=>e.id!==id);
  dbGuardar();
  if(eq) registrarLog('Eliminar', 'Equipo', eq.nombre);
  renderizarEquiposConfig(); renderizarSedesConfig();
}

/* =========================================================
   QR CORPORATIVO DEL EQUIPO (5x5cm / 10x10cm + Redirección Pública)
========================================================= */
let equipoQREdicionActualId = null;
let tamanoEtiquetaActual = '5cm';

function verEtiquetaQR(equipoId, tamano = '5cm'){
  const info = ubicarEquipoPorId(equipoId);
  if(!info) return;
  equipoQREdicionActualId = equipoId;
  tamanoEtiquetaActual = tamano;
  if(!info.equipo.qrId){ info.equipo.qrId = 'EQ-'+equipoId; dbGuardar(); }
  
  cambiarTamanoEtiqueta(tamanoEtiquetaActual);
  abrirModal('modalEtiquetaQR');
}

function cambiarTamanoEtiqueta(tamano){
  tamanoEtiquetaActual = tamano;
  const btn5 = document.getElementById('btnTamanoQR5');
  const btn10 = document.getElementById('btnTamanoQR10');
  if(btn5) btn5.classList.toggle('active', tamano === '5cm');
  if(btn10) btn10.classList.toggle('active', tamano === '10cm');

  const info = ubicarEquipoPorId(equipoQREdicionActualId);
  if(!info) return;

  const urlEquipo = `${location.origin}${location.pathname}?equipo=${equipoQREdicionActualId}`;
  const wrap = document.getElementById('etiquetaQRWrap');
  const container = document.getElementById('etiquetaQRPrint');
  wrap.innerHTML = '';

  const esGrande = tamano === '10cm';
  if(container){
    container.style.width = esGrande ? '10cm' : '5cm';
    container.style.height = esGrande ? '10cm' : '5cm';
    container.className = 'etiqueta-qr-print ' + (esGrande ? 'etiqueta-10cm' : 'etiqueta-5cm');
  }

  const qrPixelSize = esGrande ? 240 : 150;
  new QRCode(wrap, { text: urlEquipo, width: qrPixelSize, height: qrPixelSize, correctLevel: QRCode.CorrectLevel.H });
  
  document.getElementById('etiquetaQRNombre').innerText = info.equipo.nombre;
  document.getElementById('etiquetaQRCodigo').innerText = info.equipo.serie ? `SERIE: ${info.equipo.serie}` : info.equipo.qrId;
  
  const subtituloInfo = document.getElementById('etiquetaQRSubInfo');
  if(subtituloInfo){
    subtituloInfo.innerText = `${info.cliente.nombre}${info.sede ? ' · ' + info.sede.nombre : ''}`;
  }

  if(db.config.logo){
    setTimeout(()=>{
      const existente = wrap.querySelector('.etiqueta-logo-centro');
      if(existente) existente.remove();
      const logoImg = document.createElement('img');
      logoImg.src = db.config.logo;
      logoImg.className = 'etiqueta-logo-centro';
      wrap.appendChild(logoImg);
    }, 80);
  }
}

function imprimirEtiquetaQR(){
  const tam = tamanoEtiquetaActual || '5cm';
  const estilo = document.createElement('style');
  estilo.id = 'estiloPaginaEtiqueta';
  estilo.innerHTML = `@page { size: ${tam} ${tam}; margin: 0; } @media print { html, body { width: ${tam} !important; height: ${tam} !important; max-height: ${tam} !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; } }`;
  document.head.appendChild(estilo);
  
  document.body.classList.add('imprimiendo-etiqueta');
  window.print();
  
  const limpiar = ()=>{
    document.body.classList.remove('imprimiendo-etiqueta');
    const el = document.getElementById('estiloPaginaEtiqueta');
    if(el) el.remove();
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  setTimeout(limpiar, 1500);
}

/* =========================================================
   HOJA DE VIDA PÚBLICA (ESCANEO DE QR SIN LOGIN)
========================================================= */
function manejarParametroQR(){
  const params = new URLSearchParams(location.search);
  const equipoId = params.get('equipo');
  const itemId = params.get('item');
  
  if(equipoId){
    renderizarHojaVidaPublica(parseInt(equipoId));
    return;
  }
  if(itemId){
    if(sesionActual){
      mostrarSeccion('inventario');
      setTimeout(()=>{ verFichaQR(parseInt(itemId)); }, 80);
    }
  }
}

function renderizarHojaVidaPublica(equipoId){
  const info = ubicarEquipoPorId(equipoId);
  const wrapPublico = document.getElementById('hojaVidaPublicaWrapper');
  const mainWrapper = document.getElementById('main-wrapper');
  const skeleton = document.getElementById('skeletonBoot');
  const login = document.getElementById('loginOverlay');
  
  if(skeleton) skeleton.style.display = 'none';
  if(login) login.style.display = 'none';

  if(!info){
    if(mainWrapper) mainWrapper.style.display = 'none';
    if(wrapPublico){
      wrapPublico.style.display = 'block';
      wrapPublico.innerHTML = `
        <div style="max-width:600px;margin:40px auto;background:#fff;padding:30px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.06);text-align:center;font-family:var(--font-sans);">
          <i class="fas fa-exclamation-circle" style="font-size:48px;color:#ef4444;margin-bottom:12px;"></i>
          <h3 style="color:#0f172a;margin:0 0 6px;">Equipo No Encontrado</h3>
          <p style="color:#64748b;font-size:14px;">El código escaneado no corresponde a un equipo activo o registrado en la plataforma.</p>
          <a href="${location.pathname}" class="btn-custom" style="margin-top:16px;text-decoration:none;display:inline-flex;">Ir al Inicio</a>
        </div>`;
    }
    return;
  }

  if(mainWrapper) mainWrapper.style.display = 'none';
  if(wrapPublico){
    wrapPublico.style.display = 'block';
    
    const ordenesEquipo = (db.ordenes||[]).filter(o=>o.equipoId===equipoId).sort((a,b)=> (b.fechaProgramada||'').localeCompare(a.fechaProgramada||''));
    const finalizadas = ordenesEquipo.filter(o=>o.estado==='Finalizado').length;
    
    const fotosEq = (info.equipo.fotos && info.equipo.fotos.length) 
      ? `<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;margin-top:10px;">
          ${info.equipo.fotos.map(f=>`<img src="${srcDeFoto(f)}" style="width:110px;height:110px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;flex-shrink:0;">`).join('')}
         </div>`
      : '';

    let timelineHtml = '';
    if(ordenesEquipo.length === 0){
      timelineHtml = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px;"><i class="fas fa-clipboard-check" style="font-size:28px;display:block;margin-bottom:8px;"></i>Este equipo aún no registra mantenimientos u órdenes finalizadas.</div>';
    } else {
      timelineHtml = '<div class="timeline" style="margin-top:16px;border-left:2px solid #0066ff;padding-left:18px;">';
      ordenesEquipo.forEach(o=>{
        const tecnico = buscarTecnico(o.tecnicoId);
        const fotosCierre = (o.cierre && o.cierre.fotos && o.cierre.fotos.length) 
          ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
              ${normalizarFotosEvidencia(o.cierre.fotos).map(f=>`<img src="${f.src}" style="width:65px;height:65px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;">`).join('')}
             </div>`
          : '';

        let badgeClass = 'background:#fef3c7;color:#92400e;';
        if(o.estado === 'Finalizado') badgeClass = 'background:#dcfce7;color:#166534;';
        if(o.estado === 'En Ejecución') badgeClass = 'background:#ede9fe;color:#5b21b6;';

        timelineHtml += `
          <div class="timeline-item" style="position:relative;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;display:flex;align-items:center;gap:8px;">
              <span><i class="fas fa-calendar-day"></i> ${o.fechaProgramada || (o.cierre?o.cierre.fecha:'Sin fecha')}</span>
              <span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:800;text-transform:uppercase;${badgeClass}">${o.estado}</span>
            </div>
            <div style="font-size:14px;font-weight:800;color:#0f172a;margin:4px 0;">${o.numero} — ${o.tipo}</div>
            <div style="font-size:12.5px;color:#475569;line-height:1.5;">
              <strong>Técnico:</strong> ${tecnico ? tecnico.nombre : 'Personal asignado'}<br>
              ${o.cierre ? `<strong>Diagnóstico técnico:</strong> <div style="margin-top:2px;color:#1e293b;">${o.cierre.diagnostico || 'Servicio completado satisfactoriamente.'}</div>` : 'Intervención en progreso.'}
            </div>
            ${fotosCierre}
          </div>`;
      });
      timelineHtml += '</div>';
    }

    const logoEmpresaHtml = db.config.logo ? `<img src="${db.config.logo}" style="height:48px;max-width:140px;object-fit:contain;">` : `<h2 style="margin:0;font-size:18px;font-weight:800;color:#0066ff;">${db.config.nombre || 'Prevenglobal'}</h2>`;

    wrapPublico.innerHTML = `
      <div style="max-width:760px;margin:0 auto;padding:20px 14px;font-family:var(--font-sans);">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.03);margin-bottom:16px;">
          <div>${logoEmpresaHtml}</div>
          <div style="text-align:right;">
            <span style="font-size:11px;font-weight:800;background:#eff6ff;color:#0066ff;padding:4px 10px;border-radius:20px;display:inline-block;">HOJA DE VIDA DIGITAL</span>
            <small style="display:block;color:#64748b;font-size:11px;margin-top:3px;">Trazabilidad Técnica en Tiempo Real</small>
          </div>
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;box-shadow:0 2px 8px rgba(0,0,0,0.03);margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div>
              <span style="font-size:11px;font-weight:700;color:#0066ff;text-transform:uppercase;letter-spacing:0.5px;">${info.cliente.nombre} ${info.sede ? ' &bull; ' + info.sede.nombre : ''}</span>
              <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:2px 0 4px;">${info.equipo.nombre}</h2>
              <div style="font-size:12px;color:#64748b;">Código / Serie: <strong style="color:#0f172a;">${info.equipo.serie || info.equipo.qrId}</strong></div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:11px;font-weight:700;background:#ecfdf5;color:#10b981;padding:4px 12px;border-radius:20px;display:inline-block;">${finalizadas} Mantenimiento(s)</span>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:16px;background:#f8fafc;padding:14px;border-radius:10px;border:1px solid #e2e8f0;">
            <div><span style="font-size:11px;color:#64748b;display:block;">Marca / Modelo:</span><strong style="font-size:13px;color:#0f172a;">${info.equipo.marca || '—'} ${info.equipo.modelo || ''}</strong></div>
            <div><span style="font-size:11px;color:#64748b;display:block;">Capacidad:</span><strong style="font-size:13px;color:#0f172a;">${info.equipo.capacidad || '—'}</strong></div>
            <div><span style="font-size:11px;color:#64748b;display:block;">Refrigerante:</span><strong style="font-size:13px;color:#0066ff;">${info.equipo.refrigerante || '—'}</strong></div>
            <div><span style="font-size:11px;color:#64748b;display:block;">Voltaje:</span><strong style="font-size:13px;color:#0f172a;">${info.equipo.voltaje || '—'}</strong></div>
          </div>

          ${info.equipo.fichaTecnica ? `<div style="margin-top:14px;font-size:12.5px;color:#334155;background:#ffffff;border:1px dashed #cbd5e1;padding:10px 12px;border-radius:8px;"><strong>Notas técnicas:</strong> ${info.equipo.fichaTecnica}</div>` : ''}
          ${fotosEq}
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0 0 4px;"><i class="fas fa-history" style="color:#0066ff;margin-right:6px;"></i>Historial de Mantenimientos e Intervenciones</h3>
          <p style="font-size:12px;color:#64748b;margin:0 0 16px;">Registro cronológico detallado de actividades ejecutadas sobre este equipo.</p>
          ${timelineHtml}
        </div>

        <div style="text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:11px;">
          Plataforma de Control Técnico &bull; ${db.config.nombre || 'Prevenglobal'}<br>
          <a href="${location.pathname}" style="color:#0066ff;text-decoration:none;font-weight:700;margin-top:6px;display:inline-block;">Ingreso al Panel Administrativo</a>
        </div>
      </div>`;
  }
}
