/* =========================================================
   ASISTENCIA Y TURNOS
   Marcación de ingreso/salida con foto en vivo + marca de agua
   (cámara, GPS, hora del sistema) estampada directamente en la
   imagen, cálculo de horas ordinarias/extra, ausencias, y
   regularización manual por el administrador. Persiste en
   db.asistencias, igual que el resto de la plataforma.
========================================================= */
let streamCamaraMarcacion = null;
let camaraActualMarcacion = 'user'; // 'user' (frontal) | 'environment' (posterior)
let tipoMarcacionActual = null;     // 'ingreso' | 'salida'
let gpsMarcacionActual = null;      // {lat, lng, precision}
let fotoMarcacionCapturada = null;  // dataURL ya con la marca de agua estampada

function tecnicoActualAsistencia(){
  if(sesionActual && sesionActual.tecnicoId) return buscarTecnico(sesionActual.tecnicoId);
  return null;
}
function calcularHorasJornada(horaIngresoISO, horaSalidaISO){
  const ms = new Date(horaSalidaISO) - new Date(horaIngresoISO);
  const horasTotales = Math.max(0, ms / 1000 / 3600);
  const ordinarias = Math.min(8, horasTotales);
  const extra = Math.max(0, horasTotales - 8);
  return { ordinarias: Math.round(ordinarias*100)/100, extra: Math.round(extra*100)/100 };
}

/* --- Modal de marcación: cámara en vivo + GPS + marca de agua --- */
async function abrirModalMarcacion(tipo){
  const tecnico = tecnicoActualAsistencia();
  if(!tecnico){ mostrarToast('No se pudo identificar al técnico de esta sesión.', 'error'); return; }
  db.asistencias = db.asistencias || [];
  const hoy = new Date().toISOString().slice(0,10);
  const registroHoy = db.asistencias.find(a=>a.tecnicoId===tecnico.id && a.fecha===hoy);
  if(tipo==='ingreso' && registroHoy && registroHoy.horaIngreso){ mostrarToast('Ya registraste tu ingreso hoy.'); return; }
  if(tipo==='salida' && (!registroHoy || !registroHoy.horaIngreso)){ mostrarToast('No puedes marcar salida sin haber marcado ingreso hoy.'); return; }
  if(tipo==='salida' && registroHoy.horaSalida){ mostrarToast('Ya registraste tu salida hoy.'); return; }

  tipoMarcacionActual = tipo;
  gpsMarcacionActual = null;
  fotoMarcacionCapturada = null;
  document.getElementById('tituloModalMarcacion').innerText = tipo==='ingreso' ? '📸 Marcar Ingreso' : '📸 Marcar Salida';
  document.getElementById('marcacionPasoCamara').style.display = 'block';
  document.getElementById('marcacionPasoPreview').style.display = 'none';
  document.getElementById('btnCapturarMarcacion').disabled = true;
  document.getElementById('marcacionEstadoGPS').innerHTML = '<i class="fas fa-satellite-dish"></i> Obteniendo ubicación...';
  abrirModal('modalMarcacion');
  await iniciarCamaraMarcacion();
  iniciarGPSMarcacion();
}
async function iniciarCamaraMarcacion(){
  detenerCamaraMarcacion();
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    mostrarToast('Este dispositivo/navegador no permite acceso a la cámara.', 'error');
    return;
  }
  try{
    streamCamaraMarcacion = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camaraActualMarcacion }, audio:false });
    document.getElementById('marcacionVideo').srcObject = streamCamaraMarcacion;
  }catch(err){
    mostrarToast('No se pudo acceder a la cámara. Revisa los permisos del navegador.', 'error');
  }
}
function detenerCamaraMarcacion(){
  if(streamCamaraMarcacion){ streamCamaraMarcacion.getTracks().forEach(t=>t.stop()); streamCamaraMarcacion = null; }
}
function alternarCamaraMarcacion(){
  camaraActualMarcacion = camaraActualMarcacion==='user' ? 'environment' : 'user';
  iniciarCamaraMarcacion();
}
function iniciarGPSMarcacion(){
  if(!navigator.geolocation){
    document.getElementById('marcacionEstadoGPS').innerHTML = '<i class="fas fa-triangle-exclamation" style="color:#dc2626;"></i> Este dispositivo no tiene GPS disponible.';
    gpsMarcacionActual = null;
    actualizarBotonCapturarMarcacion();
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    gpsMarcacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) };
    document.getElementById('marcacionEstadoGPS').innerHTML = `<i class="fas fa-location-crosshairs" style="color:#16a34a;"></i> Ubicación obtenida (±${gpsMarcacionActual.precision} m)`;
    actualizarBotonCapturarMarcacion();
  }, err=>{
    document.getElementById('marcacionEstadoGPS').innerHTML = '<i class="fas fa-triangle-exclamation" style="color:#dc2626;"></i> No se pudo obtener el GPS. Actívalo para poder marcar.';
    gpsMarcacionActual = null;
    actualizarBotonCapturarMarcacion();
  }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
}
function actualizarBotonCapturarMarcacion(){
  document.getElementById('btnCapturarMarcacion').disabled = !gpsMarcacionActual;
}
function capturarFotoMarcacion(){
  if(!gpsMarcacionActual){ mostrarToast('Todavía no se ha obtenido el GPS. Espera un momento e intenta de nuevo.'); return; }
  const video = document.getElementById('marcacionVideo');
  const canvas = document.getElementById('marcacionCanvasOculto');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // --- Estampado de la marca de agua (empresa, tipo, persona, fecha/hora
  // real del sistema, GPS y enlace a Maps) directamente sobre los píxeles,
  // para que quede indeleble en la imagen final. ---
  const tecnico = tecnicoActualAsistencia();
  const nombreTec = tecnico ? tecnico.nombre : '—';
  const cargoTec = tecnico ? (tecnico.cargo||'Técnico') : '—';
  const ahora = new Date();
  const fechaHoraTexto = ahora.toLocaleDateString('es-CO') + ' ' + ahora.toLocaleTimeString('es-CO');
  const enlaceMaps = `https://www.google.com/maps?q=${gpsMarcacionActual.lat},${gpsMarcacionActual.lng}`;
  const lineas = [
    `${(db.config && db.config.nombre) || 'PREVENGLOBAL'} — ${tipoMarcacionActual==='ingreso'?'INGRESO':'SALIDA'}`,
    `${nombreTec} — ${cargoTec}`,
    fechaHoraTexto,
    `GPS: ${gpsMarcacionActual.lat.toFixed(6)}, ${gpsMarcacionActual.lng.toFixed(6)} (±${gpsMarcacionActual.precision} m)`,
    enlaceMaps
  ];
  const alturaFranja = Math.round(canvas.height * 0.24);
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, canvas.height - alturaFranja, canvas.width, alturaFranja);
  ctx.fillStyle = '#ffffff';
  const tamanoFuente = Math.max(11, Math.round(canvas.width / 42));
  ctx.font = `${tamanoFuente}px Arial`;
  let y = canvas.height - alturaFranja + tamanoFuente + 4;
  const espaciado = tamanoFuente + 5;
  lineas.forEach(linea=>{ ctx.fillText(linea, 10, y); y += espaciado; });

  fotoMarcacionCapturada = canvas.toDataURL('image/jpeg', 0.85);
  document.getElementById('marcacionPreviewImg').src = fotoMarcacionCapturada;
  document.getElementById('marcacionPasoCamara').style.display = 'none';
  document.getElementById('marcacionPasoPreview').style.display = 'block';
  detenerCamaraMarcacion();
}
function reintentarFotoMarcacion(){
  fotoMarcacionCapturada = null;
  document.getElementById('marcacionPasoCamara').style.display = 'block';
  document.getElementById('marcacionPasoPreview').style.display = 'none';
  iniciarCamaraMarcacion();
}
function cerrarModalMarcacion(){
  detenerCamaraMarcacion();
  cerrarModal('modalMarcacion');
}
async function confirmarMarcacion(){
  if(!fotoMarcacionCapturada || !gpsMarcacionActual){ mostrarToast('Falta la foto o el GPS.'); return; }
  const tecnico = tecnicoActualAsistencia();
  if(!tecnico){ mostrarToast('No se pudo identificar al técnico de esta sesión.', 'error'); return; }
  db.asistencias = db.asistencias || [];
  const hoy = new Date().toISOString().slice(0,10);
  const horaActual = new Date().toISOString();
  let registro = db.asistencias.find(a=>a.tecnicoId===tecnico.id && a.fecha===hoy);
  let respaldo = null, esNuevo = false;

  if(tipoMarcacionActual === 'ingreso'){
    if(registro && registro.horaIngreso){ mostrarToast('Ya registraste tu ingreso hoy.'); return; }
    if(registro){ respaldo = JSON.parse(JSON.stringify(registro)); }
    else { esNuevo = true; registro = { id: Date.now(), tecnicoId: tecnico.id, fecha: hoy, estado:'Normal' }; db.asistencias.push(registro); }
    registro.horaIngreso = horaActual;
    registro.fotoIngreso = fotoMarcacionCapturada;
    registro.gpsIngreso = gpsMarcacionActual;
  } else {
    if(!registro || !registro.horaIngreso){ mostrarToast('No puedes marcar salida sin haber marcado ingreso hoy.'); return; }
    if(registro.horaSalida){ mostrarToast('Ya registraste tu salida hoy.'); return; }
    respaldo = JSON.parse(JSON.stringify(registro));
    registro.horaSalida = horaActual;
    registro.fotoSalida = fotoMarcacionCapturada;
    registro.gpsSalida = gpsMarcacionActual;
    const { ordinarias, extra } = calcularHorasJornada(registro.horaIngreso, registro.horaSalida);
    registro.horasOrdinarias = ordinarias;
    registro.horasExtra = extra;
  }
  try{
    await dbGuardarInmediato();
  }catch(err){
    if(esNuevo){ db.asistencias.pop(); }
    else if(respaldo){ const idx = db.asistencias.findIndex(x=>x.id===registro.id); db.asistencias[idx] = respaldo; }
    mostrarToast('⚠️ No se pudo guardar: '+err.message, 'error');
    return;
  }
  registrarLog(tipoMarcacionActual==='ingreso' ? 'Marcar Ingreso' : 'Marcar Salida', 'Asistencia', tecnico.nombre);
  mostrarToast(tipoMarcacionActual==='ingreso' ? '✅ Ingreso registrado.' : '✅ Salida registrada.', 'exito');
  cerrarModalMarcacion();
  renderizarAsistencia();
}

/* --- Render principal: decide qué vista mostrar según el rol --- */
function renderizarAsistencia(){
  db.asistencias = db.asistencias || [];
  const vistaTec = document.getElementById('asistenciaVistaTecnico');
  const vistaAdmin = document.getElementById('asistenciaVistaAdmin');
  if(esAdmin()){
    vistaTec.style.display = 'none';
    vistaAdmin.style.display = 'block';
    poblarFiltroTecnicoAsistencia();
    renderizarTablaAsistenciaAdmin();
  } else {
    vistaTec.style.display = 'block';
    vistaAdmin.style.display = 'none';
    renderizarTablaAsistenciaTecnico();
  }
}
function badgeEstadoAsistencia(registro){
  if(registro.estado==='AjustadoAdmin') return `<span style="font-size:9px;font-weight:700;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:8px;">AJUSTADO POR ADMIN</span>`;
  if(registro.estado==='Ausente') return `<span style="font-size:9px;font-weight:700;background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:8px;">AUSENTE</span>`;
  if(!registro.horaSalida) return `<span style="font-size:9px;font-weight:700;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:8px;">EN TURNO</span>`;
  return `<span style="font-size:9px;font-weight:700;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:8px;">COMPLETO</span>`;
}
function enlaceHoraConMaps(horaISO, gps){
  if(!horaISO) return '—';
  const hora = new Date(horaISO).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
  if(!gps) return hora;
  return `<a href="https://www.google.com/maps?q=${gps.lat},${gps.lng}" target="_blank" rel="noopener" title="Ver ubicación en Google Maps">${hora} <i class="fas fa-map-location-dot" style="color:#2563eb;"></i></a>`;
}
function renderizarTablaAsistenciaTecnico(){
  const tecnico = tecnicoActualAsistencia();
  const tbody = document.getElementById('tablaAsistenciaTecnico');
  if(!tecnico){ tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No se pudo identificar tu usuario.</td></tr>'; return; }
  const registros = db.asistencias.filter(a=>a.tecnicoId===tecnico.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  tbody.innerHTML = registros.map(r=>`
    <tr>
      <td>${r.fecha}</td>
      <td>${r.fotoIngreso ? `<a onclick="verFotoAsistencia('${r.id}','ingreso')" style="cursor:pointer;">${enlaceHoraConMaps(r.horaIngreso, r.gpsIngreso)}</a>` : enlaceHoraConMaps(r.horaIngreso, r.gpsIngreso)}</td>
      <td>${r.fotoSalida ? `<a onclick="verFotoAsistencia('${r.id}','salida')" style="cursor:pointer;">${enlaceHoraConMaps(r.horaSalida, r.gpsSalida)}</a>` : enlaceHoraConMaps(r.horaSalida, r.gpsSalida)}</td>
      <td>${r.horasOrdinarias ?? '—'}</td>
      <td>${r.horasExtra || '—'}</td>
      <td>${badgeEstadoAsistencia(r)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty-state">Todavía no tienes registros de asistencia.</td></tr>';
}
function poblarFiltroTecnicoAsistencia(){
  const sel = document.getElementById('asistFiltroTecnico');
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + db.tecnicos.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');
  sel.value = actual;
}
// Calcula los días hábiles (lunes a sábado) sin registro de ingreso dentro
// del rango, para reflejarlos como ausencias — no se guardan como tal en la
// base de datos, se calculan al momento de mostrar la tabla.
function calcularAusencias(tecnicoId, desde, hasta){
  if(!desde || !hasta) return [];
  const registrados = new Set(db.asistencias.filter(a=>a.tecnicoId===tecnicoId).map(a=>a.fecha));
  const ausencias = [];
  let cursor = new Date(desde+'T00:00:00');
  const fin = new Date(hasta+'T00:00:00');
  const hoy = new Date().toISOString().slice(0,10);
  while(cursor <= fin){
    const iso = cursor.toISOString().slice(0,10);
    const diaSemana = cursor.getDay(); // 0=domingo
    if(diaSemana!==0 && !registrados.has(iso) && iso < hoy){
      ausencias.push(iso);
    }
    cursor.setDate(cursor.getDate()+1);
  }
  return ausencias;
}
function renderizarTablaAsistenciaAdmin(){
  const tbody = document.getElementById('tablaAsistenciaAdmin');
  const filtroTecnico = parseInt(document.getElementById('asistFiltroTecnico').value) || null;
  const desde = document.getElementById('asistFiltroDesde').value;
  const hasta = document.getElementById('asistFiltroHasta').value;
  let registros = db.asistencias.slice();
  if(filtroTecnico) registros = registros.filter(a=>a.tecnicoId===filtroTecnico);
  if(desde) registros = registros.filter(a=>a.fecha>=desde);
  if(hasta) registros = registros.filter(a=>a.fecha<=hasta);
  registros.sort((a,b)=>b.fecha.localeCompare(a.fecha));

  let filasAusencias = '';
  if(filtroTecnico && desde && hasta){
    const ausencias = calcularAusencias(filtroTecnico, desde, hasta);
    const tec = buscarTecnico(filtroTecnico);
    filasAusencias = ausencias.map(fecha=>`
      <tr style="opacity:.75;">
        <td>${fecha}</td><td>${tec?tec.nombre:'—'}</td><td>${tec?(tec.cargo||'Técnico'):'—'}</td>
        <td>—</td><td>—</td><td>—</td><td>—</td>
        <td><span style="font-size:9px;font-weight:700;background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:8px;">AUSENTE</span></td><td></td>
      </tr>`).join('');
  }

  const filasRegistros = registros.map(r=>{
    const tec = buscarTecnico(r.tecnicoId);
    return `<tr>
      <td>${r.fecha}</td><td>${tec?tec.nombre:'—'}</td><td>${tec?(tec.cargo||'Técnico'):'—'}</td>
      <td>${r.fotoIngreso ? `<a onclick="verFotoAsistencia('${r.id}','ingreso')" style="cursor:pointer;">${enlaceHoraConMaps(r.horaIngreso, r.gpsIngreso)}</a>` : enlaceHoraConMaps(r.horaIngreso, r.gpsIngreso)}</td>
      <td>${r.fotoSalida ? `<a onclick="verFotoAsistencia('${r.id}','salida')" style="cursor:pointer;">${enlaceHoraConMaps(r.horaSalida, r.gpsSalida)}</a>` : enlaceHoraConMaps(r.horaSalida, r.gpsSalida)}</td>
      <td>${r.horasOrdinarias ?? '—'}</td><td>${r.horasExtra || '—'}</td>
      <td>${badgeEstadoAsistencia(r)}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="abrirModalRegularizarTurno(${r.id})" title="Editar"><i class="fas fa-pen"></i></button></td>
    </tr>`;
  }).join('');

  tbody.innerHTML = (filasRegistros + filasAusencias) || '<tr><td colspan="9" class="empty-state">Sin registros para este filtro.</td></tr>';
}
function verFotoAsistencia(registroId, tipo){
  const r = db.asistencias.find(a=>String(a.id)===String(registroId));
  if(!r) return;
  const foto = tipo==='ingreso' ? r.fotoIngreso : r.fotoSalida;
  if(!foto) return;
  document.getElementById('fotoAsistenciaAmpliada').src = foto;
  abrirModal('modalFotoAsistencia');
}

/* --- Regularización manual (Administrador) --- */
function toggleDiaJustificadoReg(){
  const justificado = document.getElementById('regDiaJustificado').checked;
  document.getElementById('wrapperRegHoras').style.display = justificado ? 'none' : 'flex';
}
function recalcularHorasReg(){
  const horaEntrada = document.getElementById('regHoraEntrada').value;
  const horaSalida = document.getElementById('regHoraSalida').value;
  const fecha = document.getElementById('regFecha').value;
  if(!fecha || !horaEntrada || !horaSalida){ mostrarToast('Completa fecha, hora de entrada y hora de salida primero.'); return; }
  const { ordinarias, extra } = calcularHorasJornada(`${fecha}T${horaEntrada}:00`, `${fecha}T${horaSalida}:00`);
  document.getElementById('regHorasOrdinarias').value = ordinarias;
  document.getElementById('regHorasExtra').value = extra;
}
function abrirModalRegularizarTurno(asistenciaId){
  document.getElementById('regAsistId').value = asistenciaId || '';
  document.getElementById('regTecnico').innerHTML = db.tecnicos.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');
  document.getElementById('regFecha').value = new Date().toISOString().slice(0,10);
  document.getElementById('regDiaJustificado').checked = false;
  document.getElementById('regHoraEntrada').value = '';
  document.getElementById('regHoraSalida').value = '';
  document.getElementById('regHorasOrdinarias').value = '';
  document.getElementById('regHorasExtra').value = '';
  document.getElementById('regMotivo').value = '';
  toggleDiaJustificadoReg();
  if(asistenciaId){
    const r = db.asistencias.find(a=>a.id===asistenciaId);
    if(r){
      document.getElementById('regTecnico').value = r.tecnicoId;
      document.getElementById('regFecha').value = r.fecha;
      if(r.horaIngreso) document.getElementById('regHoraEntrada').value = new Date(r.horaIngreso).toTimeString().slice(0,5);
      if(r.horaSalida) document.getElementById('regHoraSalida').value = new Date(r.horaSalida).toTimeString().slice(0,5);
      document.getElementById('regHorasOrdinarias').value = r.horasOrdinarias || '';
      document.getElementById('regHorasExtra').value = r.horasExtra || '';
      document.getElementById('regDiaJustificado').checked = !r.horaIngreso && !r.horaSalida;
      toggleDiaJustificadoReg();
      document.getElementById('regMotivo').value = r.motivoAjuste || '';
    }
  }
  abrirModal('modalRegularizarTurno');
}
async function guardarRegularizacionTurno(){
  const idRaw = document.getElementById('regAsistId').value;
  const tecnicoId = parseInt(document.getElementById('regTecnico').value);
  const fecha = document.getElementById('regFecha').value;
  const justificado = document.getElementById('regDiaJustificado').checked;
  const motivo = document.getElementById('regMotivo').value.trim();
  if(!tecnicoId){ mostrarToast('Selecciona un técnico.'); return; }
  if(!fecha){ mostrarToast('Selecciona la fecha de la jornada.'); return; }
  if(!motivo){ mostrarToast('El motivo del ajuste es obligatorio.'); return; }
  const horaEntrada = document.getElementById('regHoraEntrada').value;
  const horaSalida = document.getElementById('regHoraSalida').value;
  const horasOrdinarias = parseFloat(document.getElementById('regHorasOrdinarias').value) || 0;
  const horasExtra = parseFloat(document.getElementById('regHorasExtra').value) || 0;

  db.asistencias = db.asistencias || [];
  let respaldo = null, esNuevo = false, registro;
  if(idRaw){
    registro = db.asistencias.find(a=>a.id===parseInt(idRaw));
    if(!registro){ mostrarToast('No se encontró el registro.'); return; }
    respaldo = JSON.parse(JSON.stringify(registro));
  } else {
    esNuevo = true;
    registro = { id: Date.now() };
    db.asistencias.push(registro);
  }
  registro.tecnicoId = tecnicoId;
  registro.fecha = fecha;
  registro.estado = 'AjustadoAdmin';
  registro.motivoAjuste = motivo;
  registro.ajustadoPor = nombreUsuarioActual();
  if(justificado){
    registro.horaIngreso = null; registro.horaSalida = null;
    registro.horasOrdinarias = horasOrdinarias; registro.horasExtra = horasExtra;
  } else {
    registro.horaIngreso = horaEntrada ? `${fecha}T${horaEntrada}:00` : null;
    registro.horaSalida = horaSalida ? `${fecha}T${horaSalida}:00` : null;
    registro.horasOrdinarias = horasOrdinarias; registro.horasExtra = horasExtra;
  }
  try{
    await dbGuardarInmediato();
  }catch(err){
    if(esNuevo) db.asistencias.pop();
    else if(respaldo){ const idx = db.asistencias.findIndex(x=>x.id===registro.id); db.asistencias[idx] = respaldo; }
    mostrarToast('⚠️ No se pudo guardar: '+err.message, 'error');
    return;
  }
  registrarLog(idRaw?'Editar':'Crear', 'Asistencia (ajuste manual)', (buscarTecnico(tecnicoId)?.nombre||'')+' — '+fecha);
  mostrarToast('✅ Ajuste guardado correctamente.', 'exito');
  cerrarModal('modalRegularizarTurno');
  renderizarAsistencia();
}

/* --- Integración con Nómina: suma días y horas de un técnico en un rango --- */
function precargarAsistenciaEnNomina(tecnicoId, desde, hasta){
  db.asistencias = db.asistencias || [];
  const registros = db.asistencias.filter(a=>a.tecnicoId===tecnicoId && a.fecha>=desde && a.fecha<=hasta);
  const diasLaborados = registros.filter(r=>r.horaIngreso || r.estado==='AjustadoAdmin').length;
  const horasOrdinarias = registros.reduce((s,r)=>s+(r.horasOrdinarias||0), 0);
  const horasExtra = registros.reduce((s,r)=>s+(r.horasExtra||0), 0);
  return { diasLaborados, horasOrdinarias: Math.round(horasOrdinarias*100)/100, horasExtra: Math.round(horasExtra*100)/100 };
}
