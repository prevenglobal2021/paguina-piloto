// ===== equipos-trazabilidad.js — extraído de prevenglobal__25_.html (líneas 2920-3056) =====
/* =========================================================
   EQUIPOS (VISTA GLOBAL)
========================================================= */
function renderizarEquiposGlobal(filtro){
  const cont = document.getElementById('vistaEquiposGlobal');
  cont.innerHTML = '';
  filtro = (filtro||'').toLowerCase();
  const tarjetaEquipo = (e, c, s) => {
    const numServicios = db.ordenes.filter(o=>o.equipoId===e.id).length;
    return `<div class="orden-card" style="border-left-color:#0ea5e9;">
      <div class="orden-card-top">
        <span class="orden-card-badge" style="background:#e0f2fe;color:#075985;">${numServicios} servicio${numServicios===1?'':'s'}</span>
        <span class="orden-card-numero">${e.serie||'Sin serie'}</span>
      </div>
      <h5 class="orden-card-cliente"><i class="fas fa-snowflake" style="color:#0ea5e9;"></i> ${e.nombre}</h5>
      <div class="orden-card-datos">
        <span><i class="fas fa-industry"></i> ${e.marca||'—'} ${e.modelo||''}</span>
        <span><i class="fas fa-user"></i> ${c.nombre}</span>
        <span><i class="fas fa-building"></i> ${s?s.nombre:'Sin sede'}</span>
        <span><i class="fas fa-flask"></i> ${e.refrigerante||'—'}</span>
      </div>
      <div class="orden-card-acciones">
        <button class="btn-orden-accion btn-orden-principal" onclick="irATrazabilidadEquipo(${e.id})"><i class="fas fa-clock-rotate-left"></i> Historial</button>
        <button class="btn-orden-accion btn-orden-secundaria solo-admin" data-permiso="equipos_gestionar" onclick="abrirModalEquipo(${e.id})"><i class="fas fa-pen"></i> Editar</button>
        <button class="btn-orden-accion btn-orden-secundaria" onclick="verEtiquetaQR(${e.id})"><i class="fas fa-qrcode"></i> QR</button>
        <button class="btn-orden-accion btn-orden-peligro solo-admin" data-permiso="equipos_eliminar" onclick="eliminarEquipoGlobal(${e.id})"><i class="fas fa-trash"></i> Eliminar</button>
      </div>
    </div>`;
  };
  db.clientes.forEach(c=>{
    c.sedes.forEach(s=>s.equipos.forEach(e=>{
      const texto = `${e.nombre} ${e.serie||''} ${c.nombre} ${e.marca||''} ${e.modelo||''}`.toLowerCase();
      if(filtro && !texto.includes(filtro)) return;
      cont.innerHTML += tarjetaEquipo(e, c, s);
    }));
    equiposSinSedeDe(c).forEach(e=>{
      const texto = `${e.nombre} ${e.serie||''} ${c.nombre} ${e.marca||''} ${e.modelo||''}`.toLowerCase();
      if(filtro && !texto.includes(filtro)) return;
      cont.innerHTML += tarjetaEquipo(e, c, null);
    });
  });
  if(cont.innerHTML==='') cont.innerHTML = '<div class="empty-state">No se encontraron equipos.</div>';
  aplicarRBACaUI();
}

async function eliminarEquipoGlobal(equipoId){
  const info = ubicarEquipoPorId(equipoId);
  if(!info) return;
  const numServicios = db.ordenes.filter(o=>o.equipoId===equipoId).length;
  const mensaje = numServicios > 0
    ? `Este equipo tiene ${numServicios} orden(es) de servicio registrada(s). Si lo eliminas, esas órdenes quedarán sin la ficha del equipo (perderán el nombre, marca, modelo, etc. en su historial). ¿Eliminar de todas formas?`
    : '¿Eliminar este equipo?';
  if(!confirm(mensaje)) return;

  const respaldoSede = info.sede ? info.sede.equipos.slice() : null;
  const respaldoSinSede = !info.sede ? equiposSinSedeDe(info.cliente).slice() : null;
  if(info.sede){
    info.sede.equipos = info.sede.equipos.filter(e=>e.id!==equipoId);
  } else {
    info.cliente.equiposSinSede = equiposSinSedeDe(info.cliente).filter(e=>e.id!==equipoId);
  }
  try{
    await dbGuardarInmediato();
  }catch(err){
    if(info.sede) info.sede.equipos = respaldoSede;
    else info.cliente.equiposSinSede = respaldoSinSede;
    mostrarToast('⚠️ No se pudo eliminar el equipo: ' + err.message, 'error');
    return;
  }
  registrarLog('Eliminar', 'Equipo', info.equipo.nombre);
  mostrarToast(`✅ Equipo "${info.equipo.nombre}" eliminado.`, 'exito');
  renderizarEquiposGlobal('');
  actualizarKPIs();
}

/* =========================================================
   HISTORIAL Y TRAZABILIDAD
========================================================= */
function inicializarTrazabilidad(){
  const selCliente = document.getElementById('trazaFiltroCliente');
  selCliente.innerHTML = '<option value="">Todos los clientes</option>' + db.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');
  selCliente.value = '';
  filtrarEquiposTrazabilidad();
}
function filtrarEquiposTrazabilidad(){
  const clienteId = parseInt(document.getElementById('trazaFiltroCliente').value) || null;
  const selSede = document.getElementById('trazaFiltroSede');
  if(clienteId){
    const c = buscarCliente(clienteId);
    selSede.innerHTML = '<option value="">Todas las sedes</option>' + (c ? c.sedes.map(s=>`<option value="${s.id}">${s.nombre}</option>`).join('') : '');
    selSede.disabled = false;
  } else {
    selSede.innerHTML = '<option value="">Todas las sedes</option>';
    selSede.value = '';
    selSede.disabled = true;
  }
  const sedeId = parseInt(selSede.value) || null;

  const sel = document.getElementById('selectorEquipoTrazabilidad');
  let opciones = '<option value="">Selecciona un equipo...</option>';
  db.clientes.forEach(c=>{
    if(clienteId && c.id!==clienteId) return;
    c.sedes.forEach(s=>{
      if(sedeId && s.id!==sedeId) return;
      s.equipos.forEach(e=>{ opciones += `<option value="${e.id}">${e.nombre} — ${c.nombre} (${s.nombre})</option>`; });
    });
    if(!sedeId){
      equiposSinSedeDe(c).forEach(e=>{ opciones += `<option value="${e.id}">${e.nombre} — ${c.nombre} (Sin sede)</option>`; });
    }
  });
  sel.innerHTML = opciones;
  document.getElementById('fichaEquipoTrazabilidad').innerHTML = '';
  document.getElementById('timelineTrazabilidad').innerHTML = '';
}
function irATrazabilidadEquipo(equipoId){
  // Salta directo a la trazabilidad de un equipo específico (desde "Equipos", QR, etc.),
  // limpiando los filtros de cliente/sede para asegurar que el equipo esté en la lista.
  mostrarSeccion('trazabilidad');
  setTimeout(()=>{
    document.getElementById('trazaFiltroCliente').value = '';
    filtrarEquiposTrazabilidad();
    document.getElementById('selectorEquipoTrazabilidad').value = equipoId;
    renderizarTrazabilidad(equipoId);
  }, 80);
}
function renderizarTrazabilidad(equipoIdStr){
  const equipoId = parseInt(equipoIdStr);
  const ficha = document.getElementById('fichaEquipoTrazabilidad');
  const timeline = document.getElementById('timelineTrazabilidad');
  if(!equipoId){ ficha.innerHTML=''; timeline.innerHTML=''; return; }
  const info = ubicarEquipoPorId(equipoId);
  if(!info) return;
  ficha.innerHTML = `<div class="panel" style="margin:0;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:flex-start;">
      <div>
        <strong>${info.equipo.nombre}</strong> — ${info.cliente.nombre} · ${info.sede ? info.sede.nombre : 'Sin sede'}<br>
        <small style="color:var(--text-muted);">
          Código: ${info.equipo.serie||info.equipo.qrId||'—'} · Marca/Modelo: ${info.equipo.marca||'—'} ${info.equipo.modelo||''} · Capacidad: ${info.equipo.capacidad||'—'} · Voltaje: ${info.equipo.voltaje||'—'} · Refrigerante: ${info.equipo.refrigerante||'—'}
        </small>
        ${info.equipo.fichaTecnica ? `<p style="font-size:12px;margin-top:6px;">${info.equipo.fichaTecnica}</p>` : ''}
      </div>
      <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verEtiquetaQR(${info.equipo.id})"><i class="fas fa-qrcode m-r-10"></i>Ver / Imprimir QR</button>
    </div>
    ${(info.equipo.fotos&&info.equipo.fotos.length)?`<div class="fotos-grid" style="margin-top:8px;">${info.equipo.fotos.map(f=>`<img src="${srcDeFoto(f)}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--card-border);">`).join('')}</div>`:''}
  </div>`;
  const ordenesEquipo = db.ordenes.filter(o=>o.equipoId===equipoId).sort((a,b)=> (a.fechaProgramada||'').localeCompare(b.fechaProgramada||''));
  if(ordenesEquipo.length===0){ timeline.innerHTML = '<div class="empty-state">Este equipo aún no tiene órdenes de servicio registradas.</div>'; return; }
  const finalizadas = ordenesEquipo.filter(o=>o.estado==='Finalizado').length;
  let html = `<h5 style="font-size:13px;">Línea de tiempo de servicios · ${ordenesEquipo.length} intervención(es) registrada(s), ${finalizadas} finalizada(s)</h5><div class="timeline">`;
  ordenesEquipo.forEach(o=>{
    const tecnico = buscarTecnico(o.tecnicoId);
    const plantillaUsada = buscarPlantilla(o.plantillaId);
    const fotosHtml = (o.cierre && o.cierre.fotos && o.cierre.fotos.length) ? `<div class="timeline-fotos">${normalizarFotosEvidencia(o.cierre.fotos).map(f=>`<img src="${f.src}">`).join('')}</div>` : '';
    html += `<div class="timeline-item">
      <div class="timeline-date">${o.fechaProgramada||'Sin fecha'} · ${badgeEstado(o.estado)}</div>
      <div class="timeline-title">${o.numero} — ${o.tipo}</div>
      <div class="timeline-body">Técnico: ${tecnico?tecnico.nombre:'—'}${plantillaUsada?` · Formulario: ${plantillaUsada.nombre}`:''}<br>
      ${o.cierre ? `Diagnóstico: ${o.cierre.diagnostico||'—'}` : 'Aún sin cierre registrado.'}</div>
      ${fotosHtml}
      ${o.cierre ? `<button class="btn-custom btn-secondary-custom btn-sm-custom" style="margin-top:8px;" onclick="verPDF(${o.id})"><i class="fas fa-print m-r-10"></i>Ver / Imprimir Informe</button>` : ''}
    </div>`;
  });
  html += '</div>';
  timeline.innerHTML = html;
}

/* =========================================================
   ESCANEO DE QR EN VIVO — abre la cámara del celular dentro de la app,
   lee el código QR de la etiqueta del equipo, y muestra de inmediato su
   ficha, su orden programada (si tiene), o la opción de crear una nueva.

   Corrección de fondo: antes no había ningún candado contra detecciones
   superpuestas — si la cámara tardaba un poco en leer un fotograma, el
   siguiente intento (cada 400ms) arrancaba igual encima del anterior, lo
   que podía producir varias lecturas casi simultáneas y comportamiento
   errático ("pasa muy rápido y no muestra nada"). Ahora solo hay UNA
   lectura a la vez, siempre se ve un texto de estado dentro de la
   ventana (nunca queda en silencio), y se agregó una alternativa manual
   — escribir el código o buscar por nombre/serie — que funciona sin
   depender de la cámara, como respaldo garantizado.
========================================================= */
let escanerQRStream = null;
let escanerQRIntervalo = null;
let escanerQRDetector = null;
let escanerQRLeyendo = false; // candado: nunca dos lecturas de fotograma a la vez
let escanerQRInicioMs = 0;

function escanerQREstado(texto){
  const el = document.getElementById('escanerQREstado');
  if(el){ el.innerText = texto; el.style.display = texto ? 'block' : 'none'; }
}

async function abrirEscanerQR(){
  document.getElementById('escanerQRResultado').style.display = 'none';
  document.getElementById('escanerQRResultado').innerHTML = '';
  document.getElementById('escanerQRVistaCamara').style.display = 'block';
  document.getElementById('escanerQRVideo').style.display = 'none';
  document.getElementById('escanerQRSinSoporte').style.display = 'none';
  document.getElementById('escanerQRManualCodigo').value = '';
  escanerQREstado('Activando cámara...');
  abrirModal('modalEscanerQR');
  escanerQRLeyendo = false;

  if(!('BarcodeDetector' in window)){
    escanerQREstado('');
    document.getElementById('escanerQRSinSoporte').style.display = 'block';
    return;
  }
  try{
    escanerQRDetector = new BarcodeDetector({ formats: ['qr_code'] });
  }catch(err){
    console.error('No se pudo crear BarcodeDetector:', err);
    escanerQREstado('');
    document.getElementById('escanerQRSinSoporte').style.display = 'block';
    return;
  }
  try{
    escanerQRStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  }catch(err){
    escanerQREstado('');
    mostrarToast('No se pudo acceder a la cámara: ' + err.message + ' — puedes usar la búsqueda manual de abajo.', 'error');
    return;
  }
  const video = document.getElementById('escanerQRVideo');
  video.style.display = 'block';
  video.srcObject = escanerQRStream;
  escanerQRInicioMs = Date.now();
  escanerQREstado('Buscando un código QR...');
  iniciarLecturaQR(video);
}

function iniciarLecturaQR(video){
  if(escanerQRIntervalo) clearInterval(escanerQRIntervalo);
  escanerQRIntervalo = setInterval(async ()=>{
    if(escanerQRLeyendo) return; // ya hay una lectura en curso — nunca superponer
    if(video.readyState < 2 || !video.videoWidth) return; // el video todavía no tiene un fotograma real
    escanerQRLeyendo = true;
    try{
      const codigos = await escanerQRDetector.detect(video);
      if(codigos.length > 0){
        procesarCodigoEscaneado(codigos[0].rawValue, video);
        return; // procesarCodigoEscaneado deja el candado como corresponda
      }
    }catch(err){
      console.error('Error leyendo un fotograma del QR:', err);
    }
    escanerQRLeyendo = false;
    if(Date.now() - escanerQRInicioMs > 10000){
      escanerQREstado('Sigue intentando... acerca la cámara y asegúrate de que la etiqueta esté bien iluminada, o usa la búsqueda manual de abajo.');
    }
  }, 350);
}

// Pausa solo la LECTURA (para procesar un resultado) sin apagar la cámara —
// así se puede reanudar al instante si el código no era válido, sin tener
// que volver a pedir permiso de cámara ni sufrir el parpadeo de reabrirla.
function pausarLecturaQR(){
  if(escanerQRIntervalo){ clearInterval(escanerQRIntervalo); escanerQRIntervalo = null; }
  escanerQRLeyendo = false;
}
function detenerCamaraQR(){
  pausarLecturaQR();
  if(escanerQRStream){ escanerQRStream.getTracks().forEach(t=>t.stop()); escanerQRStream = null; }
}
function cerrarEscanerQR(){
  detenerCamaraQR();
  cerrarModal('modalEscanerQR');
}

function procesarCodigoEscaneado(texto, video){
  pausarLecturaQR();
  const { equipoId, itemId } = interpretarCodigoQR(texto);
  if(equipoId){
    mostrarResultadoEscaneoQR(equipoId);
  } else if(itemId){
    detenerCamaraQR();
    cerrarModal('modalEscanerQR');
    mostrarSeccion('inventario');
    setTimeout(()=>{ verFichaQR(itemId); }, 80);
  } else {
    // Código leído, pero no es de Prevenglobal — se avisa claro DENTRO de
    // la ventana (no solo un toast que se pueda pasar por alto), y se
    // reanuda la lectura sobre la MISMA cámara (que nunca se apagó).
    escanerQREstado('Ese código no corresponde a un equipo registrado — intenta con otra etiqueta, o usa la búsqueda manual de abajo.');
    escanerQRInicioMs = Date.now();
    if(video) iniciarLecturaQR(video);
  }
}
// Interpreta el texto leído del QR (o escrito a mano): puede ser la URL
// completa que genera la etiqueta, o solo el número del equipo.
function interpretarCodigoQR(texto){
  texto = (texto||'').trim();
  let equipoId = null, itemId = null;
  try{
    const url = new URL(texto);
    const eq = url.searchParams.get('equipo');
    const it = url.searchParams.get('item');
    if(eq) equipoId = parseInt(eq);
    if(it) itemId = parseInt(it);
  }catch(err){
    const m = texto.match(/equipo=(\d+)/);
    if(m) equipoId = parseInt(m[1]);
    else if(/^\d+$/.test(texto)) equipoId = parseInt(texto); // solo escribieron el número
  }
  return { equipoId, itemId };
}

// Respaldo manual: escribir el código o buscar por nombre/serie, sin
// depender de la cámara — funciona siempre, en cualquier dispositivo.
function buscarEquipoManualQR(){
  const texto = document.getElementById('escanerQRManualCodigo').value.trim();
  if(!texto){ mostrarToast('Escribe el código, nombre o serie del equipo.'); return; }
  const { equipoId } = interpretarCodigoQR(texto);
  if(equipoId){ mostrarResultadoEscaneoQR(equipoId); return; }
  // No es un número/código — buscar por nombre, marca, modelo o serie entre todos los equipos.
  const textoLower = texto.toLowerCase();
  const coincidencias = [];
  db.clientes.forEach(c=>{
    const todos = [];
    c.sedes.forEach(s=>s.equipos.forEach(e=>todos.push(e)));
    equiposSinSedeDe(c).forEach(e=>todos.push(e));
    todos.forEach(e=>{
      if(`${e.nombre||''} ${e.marca||''} ${e.modelo||''} ${e.serie||''}`.toLowerCase().includes(textoLower)){
        coincidencias.push(e.id);
      }
    });
  });
  if(coincidencias.length === 0){
    mostrarToast('No se encontró ningún equipo que coincida con "' + texto + '".', 'error');
    return;
  }
  mostrarResultadoEscaneoQR(coincidencias[0]);
}

function mostrarResultadoEscaneoQR(equipoId){
  detenerCamaraQR();
  escanerQREstado('');
  const info = ubicarEquipoPorId(equipoId);
  document.getElementById('escanerQRVistaCamara').style.display = 'none';
  const cont = document.getElementById('escanerQRResultado');
  cont.style.display = 'block';

  if(!info){
    cont.innerHTML = `
      <div class="panel" style="margin:0;background:rgba(220,38,38,.08);border:1px solid #fca5a5;color:var(--text-main);text-align:center;">
        <i class="fas fa-triangle-exclamation" style="font-size:24px;color:var(--red-alert);"></i>
        <p style="margin:8px 0 0 0;font-weight:600;">Equipo no encontrado</p>
        <p style="font-size:12px;color:var(--text-muted);margin:4px 0 0 0;">Ese código no corresponde a ningún equipo registrado en la plataforma.</p>
      </div>
      <button class="btn-custom btn-secondary-custom" style="width:100%;margin-top:8px;" onclick="reintentarEscaneoQR()"><i class="fas fa-rotate"></i> Intentar de Nuevo</button>
    `;
    return;
  }

  // Busca una orden pendiente (programada o en ejecución) para este equipo —
  // ya sea de un solo equipo, o de una orden con varios equipos donde este
  // esté incluido — y toma la más próxima en fecha.
  const ordenesDelEquipo = db.ordenes.filter(o =>
    (o.equipoId === equipoId || (o.equiposIds||[]).includes(equipoId)) && o.estado !== 'Finalizado'
  ).sort((a,b) => (a.fechaProgramada||'9999').localeCompare(b.fechaProgramada||'9999'));
  const proximaOrden = ordenesDelEquipo[0] || null;

  cont.innerHTML = `
    <div class="panel" style="margin:0;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;">
      <strong>${info.equipo.nombre}</strong><br>
      <small style="color:var(--text-muted);">${info.cliente.nombre} · ${info.sede?info.sede.nombre:'Sin sede'}</small><br>
      <small style="color:var(--text-muted);">Código: ${info.equipo.serie||info.equipo.qrId||'—'} · ${info.equipo.marca||''} ${info.equipo.modelo||''}</small>
    </div>
    ${proximaOrden ? `
      <div style="margin-top:12px;padding:10px;background:rgba(37,99,235,.08);border-radius:8px;">
        <strong style="font-size:13px;"><i class="fas fa-calendar-check"></i> Tiene una orden programada</strong><br>
        <span style="font-size:12px;">${proximaOrden.numero} — ${proximaOrden.fechaProgramada||'Sin fecha'}${proximaOrden.horaProgramada?' · '+proximaOrden.horaProgramada:''}</span>
        <button class="btn-custom" style="width:100%;margin-top:8px;" onclick="cerrarModal('modalEscanerQR');verDetalleOrden(${proximaOrden.id})"><i class="fas fa-clipboard-check"></i> Abrir y Llenar esta Orden</button>
      </div>
    ` : `
      <div style="margin-top:12px;padding:10px;background:rgba(0,0,0,.15);border-radius:8px;">
        <strong style="font-size:13px;">Este equipo no tiene ninguna orden programada.</strong>
        <button class="btn-custom" style="width:100%;margin-top:8px;" onclick="cerrarModal('modalEscanerQR');abrirModalNuevaOrden(${equipoId})"><i class="fas fa-plus"></i> Crear Nueva Orden para este Equipo</button>
      </div>
    `}
    <button class="btn-custom btn-secondary-custom" style="width:100%;margin-top:8px;" onclick="cerrarModal('modalEscanerQR');irATrazabilidadEquipo(${equipoId})"><i class="fas fa-history"></i> Ver Historial Completo</button>
  `;
}
// Vuelve a la vista de cámara tras un "Equipo no encontrado", sin cerrar
// el modal ni tener que volver a pedir permiso de cámara.
function reintentarEscaneoQR(){
  document.getElementById('escanerQRResultado').style.display = 'none';
  document.getElementById('escanerQRVistaCamara').style.display = 'block';
  document.getElementById('escanerQRManualCodigo').value = '';
  abrirEscanerQR();
}

