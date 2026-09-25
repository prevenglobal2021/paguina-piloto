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
      const blob = await generarPDFDesdeElemento('pdfContenido', nombreArchivo);
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
// --------- VALIDACIÓN DE DOCUMENTO Y AUTOCOMPLETADO POR NIT (RUES) ---------
// Mismo algoritmo oficial de la DIAN para el dígito de verificación del
// NIT (Resolución 8121 de 2011) — cálculo matemático estable, no depende
// de ningún servicio externo.
function calcularDVNit(nitSinDV){
  const pesos = [71,67,59,53,47,43,41,37,29,23,19,17,13,7,3];
  const nit15 = nitSinDV.replace(/\D/g,'').padStart(15,'0');
  let suma = 0;
  for(let i=0;i<15;i++) suma += parseInt(nit15[i],10) * pesos[i];
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}
// Acepta tanto "900123456" como "900123456-7" (con el dígito ya incluido).
function validarNIT(numDoc){
  const texto = numDoc.trim();
  const partes = texto.split('-');
  if(partes.length === 2){
    if(!/^\d+$/.test(partes[0]) || !/^\d$/.test(partes[1])) return false;
    return calcularDVNit(partes[0]) === parseInt(partes[1],10);
  }
  // Sin guion: se acepta el número solo (no se puede validar el dígito
  // porque no vino incluido) — se valida solo que sean puros números.
  return /^\d{8,15}$/.test(texto);
}
function validarCedula(numDoc){
  // Se valida el texto TAL COMO SE ESCRIBIÓ (sin quitarle nada primero) —
  // así si alguien escribe una letra por error, se detecta como inválido
  // en vez de simplemente ignorarla.
  return /^\d{6,10}$/.test(numDoc.trim());
}
function limpiarDatosRuesFormulario(){
  ['cfgCliEstadoMatricula','cfgCliCamaraComercio','cfgCliActividadEconomica','cfgCliRepresentanteLegal'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = '';
  });
  mostrarBloqueDatosRues(false);
}
function mostrarBloqueDatosRues(mostrar){
  const bloque = document.getElementById('bloqueDatosRues');
  if(bloque) bloque.style.display = mostrar ? 'block' : 'none';
}
// Se dispara al salir del campo de número de documento (evento blur), solo
// cuando el tipo de documento es NIT — para Cédula nunca se intenta nada
// automático, sigue siendo 100% manual, tal como debe ser (no existe
// ninguna base de datos pública para traer datos personales por cédula).
async function alSalirDeNumDocCliente(){
  const tipoDoc = document.getElementById('cfgCliTipoDoc').value;
  const numDoc = document.getElementById('cfgCliNumDoc').value.trim();
  const avisoFormato = document.getElementById('avisoFormatoDocumento');
  const textoAviso = avisoFormato ? avisoFormato.querySelector('span') : null;
  if(!numDoc){ if(avisoFormato) avisoFormato.style.display='none'; return; }

  if(tipoDoc === 'C.C.'){
    if(avisoFormato && textoAviso){
      const valido = validarCedula(numDoc);
      avisoFormato.style.display = valido ? 'none' : 'flex';
      textoAviso.innerText = 'La cédula debe tener solo números, entre 6 y 10 dígitos.';
    }
    return;
  }
  if(tipoDoc !== 'NIT') { if(avisoFormato) avisoFormato.style.display='none'; return; }

  const valido = validarNIT(numDoc);
  if(avisoFormato && textoAviso){
    avisoFormato.style.display = valido ? 'none' : 'flex';
    textoAviso.innerText = 'Ese NIT no parece válido — revisa el número (puedes escribirlo con o sin el dígito de verificación, ej. 900123456-7).';
  }
  if(!valido) return;

  await consultarRUES(numDoc);
}
async function consultarRUES(numDoc){
  const estado = document.getElementById('estadoConsultaRues');
  if(estado){ estado.style.display = 'flex'; }
  try{
    const nitParaConsultar = numDoc.includes('-') ? numDoc.split('-')[0].replace(/\D/g,'') : numDoc.replace(/\D/g,'');
    const respuesta = await fetchConLimite(API_BASE + `/api/rues/consultar-nit/${nitParaConsultar}`, { headers: headersAutenticados() }, 10);
    const datos = await respuesta.json();
    if(!respuesta.ok) throw new Error(datos.error || 'No se encontró ese NIT.');
    document.getElementById('cfgCliNombre').value = datos.razonSocial || document.getElementById('cfgCliNombre').value;
    document.getElementById('cfgCliEstadoMatricula').value = datos.estadoMatricula || '';
    document.getElementById('cfgCliCamaraComercio').value = datos.camaraComercio || '';
    document.getElementById('cfgCliActividadEconomica').value = datos.actividadEconomica || '';
    document.getElementById('cfgCliRepresentanteLegal').value = datos.representanteLegal || '';
    mostrarBloqueDatosRues(true);
    mostrarToast('✅ Datos autocompletados desde el RUES — revísalos antes de guardar.', 'exito');
  }catch(err){
    // Nunca bloquea el formulario — el usuario sigue llenando todo manual.
    mostrarToast('No se pudo consultar el RUES (' + err.message + ') — puedes seguir llenando el formulario manualmente.');
  }finally{
    if(estado) estado.style.display = 'none';
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
  const datosRues = {
    estadoMatricula: document.getElementById('cfgCliEstadoMatricula').value.trim() || null,
    camaraComercio: document.getElementById('cfgCliCamaraComercio').value.trim() || null,
    actividadEconomica: document.getElementById('cfgCliActividadEconomica').value.trim() || null,
    representanteLegal: document.getElementById('cfgCliRepresentanteLegal').value.trim() || null,
  };
  if(!nombre){ mostrarToast('El nombre del cliente es obligatorio'); return; }
  if(tipoDoc==='NIT' && numDoc && !validarNIT(numDoc)){
    mostrarToast('El NIT no parece válido (el dígito de verificación no coincide). Revísalo antes de guardar.'); return;
  }
  if(tipoDoc==='C.C.' && numDoc && !validarCedula(numDoc)){
    mostrarToast('La cédula debe tener solo números, entre 6 y 10 dígitos.'); return;
  }
  let respaldo = null, esNuevo = false;
  if(id){
    const c = buscarCliente(parseInt(id));
    respaldo = Object.assign({}, c);
    c.nombre=nombre; c.tipoDocumento=tipoDoc; c.numeroDocumento=numDoc; c.telefono=telefono; c.direccion=direccion; c.lat=lat||null; c.lng=lng||null;
    Object.assign(c, datosRues);
    if(imagenesClienteModificado) c.imagenesReferencia = imagenesClienteTemp.slice();
    delete c.imagenReferencia;
  } else {
    esNuevo = true;
    db.clientes.push(Object.assign({ id:Date.now(), nombre, tipoDocumento:tipoDoc, numeroDocumento:numDoc, telefono, direccion, lat:lat||null, lng:lng||null, imagenesReferencia: imagenesClienteTemp.slice(), sedes:[] }, datosRues));
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
  limpiarDatosRuesFormulario();
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
  document.getElementById('cfgCliEstadoMatricula').value = c.estadoMatricula||'';
  document.getElementById('cfgCliCamaraComercio').value = c.camaraComercio||'';
  document.getElementById('cfgCliActividadEconomica').value = c.actividadEconomica||'';
  document.getElementById('cfgCliRepresentanteLegal').value = c.representanteLegal||'';
  mostrarBloqueDatosRues(c.tipoDocumento==='NIT' && !!(c.estadoMatricula||c.camaraComercio||c.actividadEconomica||c.representanteLegal));
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
// Tamaños de etiqueta disponibles — el usuario elige uno en el modal antes
// de imprimir. Cada uno ajusta el tamaño de la hoja física Y el tamaño de
// todo el contenido (QR, textos, logo) para que quede bien proporcionado,
// no solo la hoja recortada.
const TAMANOS_ETIQUETA_QR = {
  '5x5': { ancho:'5cm',  alto:'5cm',  qr:'3.4cm', logo:'0.85cm', fuenteNombre:'7px',   fuenteCodigo:'8px' },
  '4x4': { ancho:'4cm',  alto:'4cm',  qr:'2.7cm', logo:'0.68cm', fuenteNombre:'6px',   fuenteCodigo:'7px' },
  '3x3': { ancho:'3cm',  alto:'3cm',  qr:'2cm',   logo:'0.5cm',  fuenteNombre:'5px',   fuenteCodigo:'5.5px' },
  '6x4': { ancho:'6cm',  alto:'4cm',  qr:'2.6cm', logo:'0.65cm', fuenteNombre:'7px',   fuenteCodigo:'7px' },
};
let tamanoEtiquetaActual = '5x5';
function aplicarTamanoEtiqueta(clave){
  const t = TAMANOS_ETIQUETA_QR[clave] || TAMANOS_ETIQUETA_QR['5x5'];
  tamanoEtiquetaActual = clave;
  const cont = document.getElementById('etiquetaQRPrint');
  cont.style.setProperty('--etq-ancho', t.ancho);
  cont.style.setProperty('--etq-alto', t.alto);
  cont.style.setProperty('--etq-qr', t.qr);
  cont.style.setProperty('--etq-logo', t.logo);
  cont.style.setProperty('--etq-fuente-nombre', t.fuenteNombre);
  cont.style.setProperty('--etq-fuente-codigo', t.fuenteCodigo);
  const selector = document.getElementById('etiquetaQRTamano');
  if(selector) selector.value = clave;
  const textoTamano = document.getElementById('etiquetaQRTamanoTexto');
  if(textoTamano) textoTamano.innerText = `Tamaño de impresión: ${t.ancho.replace('cm','')} x ${t.alto.replace('cm','')} cm`;
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
  aplicarTamanoEtiqueta(tamanoEtiquetaActual); // recuerda el último tamaño elegido durante la sesión
  abrirModal('modalEtiquetaQR');
}
function imprimirEtiquetaQR(){
  const t = TAMANOS_ETIQUETA_QR[tamanoEtiquetaActual] || TAMANOS_ETIQUETA_QR['5x5'];
  const estilo = document.createElement('style');
  estilo.id = 'estiloPaginaEtiqueta';
  estilo.innerHTML = `@page{size:${t.ancho} ${t.alto};margin:0;}`;
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
// En Android/celular, el diálogo de impresión del sistema no respeta el
// tamaño de página personalizado (@page) que pide el navegador — siempre
// muestra el tamaño estándar (Carta), sin importar lo que se le indique
// por CSS. Esto genera la etiqueta como una imagen real, del tamaño
// exacto elegido — funciona igual en cualquier dispositivo, sin depender
// de cómo cada sistema operativo maneje la impresión.
async function descargarEtiquetaComoImagen(){
  if(typeof html2canvas === 'undefined'){ mostrarToast('No se pudo generar la imagen — revisa tu conexión e intenta de nuevo.', 'error'); return; }
  const elemento = document.getElementById('etiquetaQRPrint');
  try{
    const canvas = await html2canvas(elemento, { scale:4, useCORS:true, backgroundColor:'#ffffff' });
    const url = canvas.toDataURL('image/png');
    const codigo = (document.getElementById('etiquetaQRCodigo').innerText || 'QR').replace(/[^a-zA-Z0-9_-]/g,'_');
    const link = document.createElement('a');
    link.href = url;
    link.download = `Etiqueta_${codigo}.png`;
    link.click();
    mostrarToast('📷 Imagen descargada — ya puedes imprimirla desde tu galería o app de fotos.', 'exito');
  }catch(err){
    mostrarToast('No se pudo generar la imagen: ' + err.message, 'error');
  }
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
