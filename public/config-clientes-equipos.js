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
async function guardarPlantillaWhatsApp(){
  const anterior = db.config.plantillaWhatsApp;
  db.config.plantillaWhatsApp = document.getElementById('cfgPlantillaWhatsApp').value;
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.config.plantillaWhatsApp = anterior;
    mostrarToast('⚠️ No se pudo guardar: ' + err.message, 'error');
    return;
  }
  mostrarToast('✅ Plantilla de WhatsApp actualizada.', 'exito');
}
function renderizarAuditoria(){
  const tbody = document.getElementById('tablaAuditoria');
  tbody.innerHTML = db.logs.slice().reverse().map(l=>`
    <tr><td>${new Date(l.timestamp).toLocaleString('es-CO')}</td><td>${l.usuario}</td><td>${l.accion}</td><td>${l.entidad}</td><td>${l.detalle||''}</td></tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">Sin actividad registrada todavía.</td></tr>';
}
// Envoltorio delgado: arma los datos propios de una Orden de Servicio y
// se los entrega al motor único de envío por WhatsApp (compartirDocumentoPorWhatsApp,
// en pdf.js) — ahí vive toda la lógica de compartir/descargar/reintentar,
// igual para Orden, Cotización, Factura y Nómina.
async function enviarPorWhatsApp(ordenId){
  const o = db.ordenes.find(x=>x.id===ordenId);
  if(!o) return;
  if(o.esClienteNuevo){ mostrarToast('Esta orden es de un cliente nuevo (no registrado), sin teléfono guardado — usa "Ver Documento" para descargar el informe y enviarlo tú mismo.'); return; }
  const cliente = buscarCliente(o.clienteId);
  const mensaje = (db.config.plantillaWhatsApp || '')
    .replace(/{nombre_cliente}/g, cliente ? cliente.nombre : '')
    .replace(/{numero_orden}/g, o.numero);
  const nombreArchivo = `Informe_${o.numero}_${cliente ? cliente.nombre : ''}`.replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf';

  await compartirDocumentoPorWhatsApp({
    telefono: cliente ? cliente.telefono : null,
    mensaje,
    nombreArchivo,
    tituloCompartir: `Informe ${o.numero}`,
    tipoLog: 'OrdenServicio',
    detalleLog: `${o.numero} a ${cliente ? cliente.nombre : 'cliente'}`,
    mensajeSinTelefono: 'Este cliente no tiene teléfono registrado.',
    generarBlob: async () => {
      verPDF(ordenId);
      const elemento = document.getElementById('pdfContenido');
      await esperarImagenesCargadas(elemento); // evita fotos en blanco en el PDF por no esperar a que carguen
      const opciones = { margin:10, filename:nombreArchivo, image:{type:'jpeg',quality:0.95}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'letter',orientation:'portrait'}, pagebreak:{ mode:['css','legacy'] } };
      const blob = await conTiempoLimite(
        html2pdf().set(opciones).from(elemento).outputPdf('blob'),
        25000,
        'La generación del informe está tardando demasiado (puede deberse a muchas fotos de alta resolución). Vuelve a intentarlo, o usa "Ver Documento" para generarlo manualmente.'
      );
      cerrarModal('modalPDF');
      return blob;
    }
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
async function guardarClienteConfig(){
  const id = document.getElementById('cfgCliId').value;
  const nombre = document.getElementById('cfgCliNombre').value;
  const tipoDoc = document.getElementById('cfgCliTipoDoc').value;
  const numDoc = document.getElementById('cfgCliNumDoc').value.trim();
  const telefono = document.getElementById('cfgCliTelefono').value;
  const direccion = document.getElementById('cfgCliDireccion').value;
  const lat = document.getElementById('cfgCliLat').value.trim();
  const lng = document.getElementById('cfgCliLng').value.trim();
  if(!nombre){ mostrarToast('El nombre del cliente es obligatorio'); return; }
  let respaldo = null, esNuevo = false;
  if(id){
    const c = buscarCliente(parseInt(id));
    respaldo = Object.assign({}, c);
    c.nombre=nombre; c.tipoDocumento=tipoDoc; c.numeroDocumento=numDoc; c.telefono=telefono; c.direccion=direccion; c.lat=lat||null; c.lng=lng||null;
    if(imagenesClienteModificado) c.imagenesReferencia = imagenesClienteTemp.slice();
    delete c.imagenReferencia;
  } else {
    esNuevo = true;
    db.clientes.push({ id:Date.now(), nombre, tipoDocumento:tipoDoc, numeroDocumento:numDoc, telefono, direccion, lat:lat||null, lng:lng||null, imagenesReferencia: imagenesClienteTemp.slice(), sedes:[] });
  }
  try{
    await dbGuardarInmediato();
  }catch(err){
    if(id && respaldo){ Object.assign(buscarCliente(parseInt(id)), respaldo); }
    else if(esNuevo){ db.clientes.pop(); }
    mostrarToast('⚠️ No se pudo guardar el cliente: ' + err.message, 'error');
    return;
  }
  registrarLog(id?'Editar':'Crear', 'Cliente', nombre);
  mostrarToast(id ? `✅ ${nombre} actualizado correctamente.` : `✅ ${nombre} agregado correctamente.`, 'exito');
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
async function eliminarClienteConfig(id){
  if(!confirm('¿Eliminar este cliente y todas sus sedes/equipos?')) return;
  const c = buscarCliente(id);
  const respaldo = db.clientes.slice();
  db.clientes = db.clientes.filter(c=>c.id!==id);
  registrarEliminacion('clientes', id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.clientes = respaldo;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  if(c) registrarLog('Eliminar', 'Cliente', c.nombre);
  mostrarToast('Cliente eliminado.', 'exito');
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
async function agregarSedeConfig(){
  const nombre = document.getElementById('cfgSedeNombre').value;
  const direccion = document.getElementById('cfgSedeDireccion').value;
  if(!nombre){ mostrarToast('Escribe el nombre de la sede'); return; }
  const c = buscarCliente(clienteActivoId);
  c.sedes.push({ id:Date.now(), nombre, direccion, equipos:[] });
  try{
    await dbGuardarInmediato();
  }catch(err){
    c.sedes.pop();
    mostrarToast('⚠️ No se pudo guardar la sede: ' + err.message, 'error');
    return;
  }
  mostrarToast('✅ Sede agregada.', 'exito');
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
      <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirEnGoogleMaps('${(s.direccion||'').replace(/'/g,"\\'")}')"><i class="fas fa-map-marker-alt"></i></button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarSedeConfig(${s.id})">X</button></td></tr>`;
  });
}
async function eliminarSedeConfig(id){
  if(!confirm('¿Eliminar esta sede y sus equipos?')) return;
  const c = buscarCliente(clienteActivoId);
  const respaldo = c.sedes.slice();
  c.sedes = c.sedes.filter(s=>s.id!==id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    c.sedes = respaldo;
    mostrarToast('⚠️ No se pudo eliminar la sede: ' + err.message, 'error');
    return;
  }
  renderizarSedesConfig();
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

/* =========================================================
   TOMAR FOTO EN VIVO (equipos) — misma cámara del navegador que el
   escáner QR, pero para capturar una foto fija en vez de leer un
   código. Al confirmar, la foto pasa por comprimirImagen() y se agrega
   a fotosEquipoModalTemp EXACTAMENTE igual que una foto subida por
   archivo — mismo formato, mismo almacenamiento, misma vista previa.
========================================================= */
let camaraFotoEquipoStream = null;
let camaraFotoEquipoBlobCapturado = null;

async function abrirCamaraFotoEquipo(){
  const estado = document.getElementById('camaraFotoEquipoEstado');
  if(estado) estado.innerText = 'Encuadra el equipo y toma la foto…';
  volverAVistaEnVivoCamaraEquipo();
  abrirModal('modalCamaraFotoEquipo');
  camaraFotoEquipoStream = null;
  const video = document.getElementById('camaraFotoEquipoVideo');
  try{
    camaraFotoEquipoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = camaraFotoEquipoStream;
    await video.play();
  }catch(err){
    if(estado) estado.innerText = 'No se pudo acceder a la cámara. Revisa los permisos del navegador.';
    mostrarToast('⚠️ No se pudo acceder a la cámara: ' + err.message, 'error');
  }
}

function capturarFotoEquipo(){
  const video = document.getElementById('camaraFotoEquipoVideo');
  const canvas = document.getElementById('camaraFotoEquipoCanvasOculto');
  if(!video || !video.videoWidth){ mostrarToast('La cámara todavía no está lista — espera un segundo e intenta de nuevo.'); return; }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob=>{
    camaraFotoEquipoBlobCapturado = blob;
    const preview = document.getElementById('camaraFotoEquipoPreview');
    preview.src = URL.createObjectURL(blob);
    preview.style.display = 'block';
    video.style.display = 'none';
    document.getElementById('camaraFotoEquipoEstado').innerText = '¿Quedó bien? Puedes usarla o repetir la toma.';
    document.getElementById('btnCapturarFotoEquipo').style.display = 'none';
    document.getElementById('btnRepetirFotoEquipo').style.display = 'block';
    document.getElementById('btnUsarFotoEquipo').style.display = 'block';
  }, 'image/jpeg', 0.92);
}

function repetirFotoEquipo(){
  camaraFotoEquipoBlobCapturado = null;
  volverAVistaEnVivoCamaraEquipo();
}

function volverAVistaEnVivoCamaraEquipo(){
  const preview = document.getElementById('camaraFotoEquipoPreview');
  const video = document.getElementById('camaraFotoEquipoVideo');
  if(preview){ preview.style.display = 'none'; if(preview.src) URL.revokeObjectURL(preview.src); preview.removeAttribute('src'); }
  if(video) video.style.display = 'block';
  const estado = document.getElementById('camaraFotoEquipoEstado');
  if(estado) estado.innerText = 'Encuadra el equipo y toma la foto…';
  const btnCapturar = document.getElementById('btnCapturarFotoEquipo');
  const btnRepetir = document.getElementById('btnRepetirFotoEquipo');
  const btnUsar = document.getElementById('btnUsarFotoEquipo');
  if(btnCapturar) btnCapturar.style.display = 'block';
  if(btnRepetir) btnRepetir.style.display = 'none';
  if(btnUsar) btnUsar.style.display = 'none';
}

async function usarFotoCapturadaEquipo(){
  if(!camaraFotoEquipoBlobCapturado){ mostrarToast('No hay ninguna foto capturada todavía.'); return; }
  try{
    // Mismo comprimirImagen() que usan las fotos subidas por archivo —
    // así la foto en vivo queda guardada en el mismo formato exacto.
    const dataUrl = await comprimirImagen(camaraFotoEquipoBlobCapturado);
    fotosEquipoModalTemp.push({ src: dataUrl, desc: '' });
    renderizarFotosEquipoModalPreview();
    mostrarToast('📷 Foto agregada.', 'exito');
    cerrarCamaraFotoEquipo();
  }catch(err){
    mostrarToast('No se pudo procesar la foto capturada. Intenta de nuevo.', 'error');
  }
}

function cerrarCamaraFotoEquipo(){
  if(camaraFotoEquipoStream){ camaraFotoEquipoStream.getTracks().forEach(t=>t.stop()); camaraFotoEquipoStream = null; }
  camaraFotoEquipoBlobCapturado = null;
  volverAVistaEnVivoCamaraEquipo();
  cerrarModal('modalCamaraFotoEquipo');
}

function renderizarFotosEquipoModalPreview(){
  renderizarGaleriaFotos('previewFotosEquipoModal', fotosEquipoModalTemp, 'equipoModal');
}
async function guardarEquipoModal(){
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
  const respaldoClientes = JSON.parse(JSON.stringify(db.clientes));
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
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.clientes = respaldoClientes;
    mostrarToast('⚠️ No se pudo guardar el equipo: ' + err.message, 'error');
    return;
  }
  mostrarToast(idRaw ? `✅ ${nombre} actualizado correctamente.` : `✅ ${nombre} registrado correctamente.`, 'exito');
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
async function eliminarEquipoConfig(id){
  const c = buscarCliente(clienteActivoId);
  const s = c.sedes.find(x=>x.id===sedeActivaId);
  const eq = s.equipos.find(e=>e.id===id);
  const respaldo = s.equipos.slice();
  s.equipos = s.equipos.filter(e=>e.id!==id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    s.equipos = respaldo;
    mostrarToast('⚠️ No se pudo eliminar el equipo: ' + err.message, 'error');
    return;
  }
  if(eq) registrarLog('Eliminar', 'Equipo', eq.nombre);
  mostrarToast('Equipo eliminado.', 'exito');
  renderizarEquiposConfig(); renderizarSedesConfig();
}
function verEtiquetaQR(equipoId){
  const info = ubicarEquipoPorId(equipoId);
  if(!info) return;
  if(!info.equipo.qrId){ info.equipo.qrId = 'EQ-'+equipoId; dbGuardarInmediato().catch(()=>{ }); }
  const urlEquipo = `${location.origin}${location.pathname}?equipo=${equipoId}`;
  const wrap = document.getElementById('etiquetaQRWrap');
  wrap.innerHTML = '';
  new QRCode(wrap, { text: urlEquipo, width:300, height:300, correctLevel: QRCode.CorrectLevel.H });
  document.getElementById('etiquetaQRNombre').innerText = info.equipo.nombre;
  document.getElementById('etiquetaQRCodigo').innerText = info.equipo.serie || info.equipo.qrId;
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
  abrirModal('modalEtiquetaQR');
}
function imprimirEtiquetaQR(){
  const estilo = document.createElement('style');
  estilo.id = 'estiloPaginaEtiqueta';
  estilo.innerHTML = '@page{size:5cm 5cm;margin:0;}';
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
function manejarParametroQR(){
  const params = new URLSearchParams(location.search);
  const equipoId = params.get('equipo');
  const itemId = params.get('item');
  if(equipoId){
    irATrazabilidadEquipo(equipoId);
    return;
  }
  if(itemId){
    mostrarSeccion('inventario');
    setTimeout(()=>{ verFichaQR(parseInt(itemId)); }, 80);
  }
}
