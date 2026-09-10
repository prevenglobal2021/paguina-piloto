// ===== buscador-agenda.js — extraído de prevenglobal__25_.html (líneas 2127-2523) =====
/* =========================================================
   BUSCADOR GLOBAL — encuentra clientes, equipos, órdenes,
   técnicos, productos y secciones de la app, todo en un solo
   cuadro, tolerante a acentos/errores menores de tipeo, sin
   depender de internet ni de un modelo de IA.
========================================================= */
let resultadosBusquedaActuales = [];
let indiceResultadoActivoBusqueda = -1;

document.addEventListener('keydown', e=>{
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){
    e.preventDefault();
    abrirBuscadorGlobal();
  }
  if(e.key==='Escape') cerrarBuscadorGlobal();
});

function normalizarTexto(str){
  return (str||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
/* =========================================================
   CENTRO DE NOTIFICACIONES — revisa órdenes vencidas/próximas y
   facturas pendientes desde hace tiempo, y las muestra en un panel
   desplegable accesible desde la campana de la barra superior.
========================================================= */
function generarNotificaciones(){
  const notifs = [];
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const hoyStr = hoy.toISOString().slice(0,10);
  const limiteProximas = new Date(hoy.getTime() + 2*24*60*60*1000).toISOString().slice(0,10);

  (db.ordenes||[]).forEach(o=>{
    if(o.estado==='Finalizado' || !o.fechaProgramada) return;
    if(o.fechaProgramada < hoyStr){
      notifs.push({ prioridad:0, icono:'fa-triangle-exclamation', color:'var(--red-alert)', texto:`Orden ${o.numero} está vencida — estaba programada para ${o.fechaProgramada}`, accion:`cerrarPanelNotificaciones();verDetalleOrden(${o.id})` });
    } else if(o.fechaProgramada <= limiteProximas){
      const cuando = o.fechaProgramada===hoyStr ? 'hoy' : `el ${o.fechaProgramada}`;
      notifs.push({ prioridad:1, icono:'fa-clock', color:'var(--orange-warning)', texto:`Orden ${o.numero} programada para ${cuando}`, accion:`cerrarPanelNotificaciones();verDetalleOrden(${o.id})` });
    }
  });

  const hace30Dias = new Date(hoy.getTime() - 30*24*60*60*1000).toISOString().slice(0,10);
  (db.facturas||[]).forEach(f=>{
    if(f.estadoPago==='pagado' || f.estadoPago==='cancelada') return;
    if(f.fecha && f.fecha < hace30Dias){
      notifs.push({ prioridad:1, icono:'fa-file-invoice-dollar', color:'var(--orange-warning)', texto:`Factura ${f.numero} sigue pendiente de pago hace más de 30 días`, accion:`cerrarPanelNotificaciones();abrirModalFactura(${f.id})` });
    }
  });

  return notifs.sort((a,b)=>a.prioridad-b.prioridad);
}
function actualizarBadgeNotificaciones(){
  const notifs = generarNotificaciones();
  const punto = document.getElementById('puntoNotificaciones');
  if(punto) punto.style.display = notifs.length ? 'block' : 'none';
}
function toggleCentroNotificaciones(){
  const panel = document.getElementById('panelNotificaciones');
  if(!panel) return;
  if(panel.classList.contains('abierto')){ panel.classList.remove('abierto'); return; }
  const notifs = generarNotificaciones();
  panel.innerHTML = notifs.length
    ? notifs.map(n=>`<div class="autocomplete-item" onclick="${n.accion}"><i class="fas ${n.icono}" style="color:${n.color};width:20px;text-align:center;"></i><span style="flex:1;">${n.texto}</span></div>`).join('')
    : '<div class="autocomplete-item" style="cursor:default;color:#94a3b8;">Sin avisos pendientes — todo al día.</div>';
  panel.classList.add('abierto');
}
function cerrarPanelNotificaciones(){
  const panel = document.getElementById('panelNotificaciones');
  if(panel) panel.classList.remove('abierto');
}
document.addEventListener('click', (e)=>{
  const panel = document.getElementById('panelNotificaciones');
  const btn = document.getElementById('btnNotificaciones');
  if(panel && panel.classList.contains('abierto') && !panel.contains(e.target) && e.target!==btn && !btn.contains(e.target)){
    panel.classList.remove('abierto');
  }
});

function abrirBuscadorGlobal(){
  const overlay = document.getElementById('overlayBuscadorGlobal');
  overlay.style.display = 'flex';
  const input = document.getElementById('inputBuscadorGlobal');
  input.value = '';
  ejecutarBusquedaGlobal();
  setTimeout(()=>input.focus(), 50);
}
function cerrarBuscadorGlobal(){
  document.getElementById('overlayBuscadorGlobal').style.display = 'none';
}
function construirIndiceBusqueda(){
  const indice = [];
  // Secciones / accesos directos de la app
  const secciones = [
    { slug:'agenda', nombre:'Agenda / Órdenes', icono:'fa-calendar-alt' },
    { slug:'equipos', nombre:'Equipos', icono:'fa-snowflake' },
    { slug:'trazabilidad', nombre:'Historial y Trazabilidad', icono:'fa-stream' },
    { slug:'inventario', nombre:'Inventario', icono:'fa-boxes' },
    { slug:'tienda', nombre:'Tienda Virtual', icono:'fa-store' },
    { slug:'kpi', nombre:'Indicadores (KPI)', icono:'fa-chart-line' },
    { slug:'contabilidad', nombre:'Negocio / Contabilidad', icono:'fa-wallet' },
  ];
  secciones.forEach(s=>indice.push({ tipo:'Sección', icono:s.icono, titulo:s.nombre, subtitulo:'Ir a esta sección', accion:()=>mostrarSeccion(s.slug) }));

  // Clientes
  (db.clientes||[]).forEach(c=>{
    indice.push({ tipo:'Cliente', icono:'fa-user-tie', titulo:c.nombre, subtitulo:c.telefono || c.numeroDocumento || 'Cliente',
      accion:()=>{ abrirModalConfig('clientes'); setTimeout(()=>editarClienteConfig(c.id), 150); } });
  });

  // Equipos (con sede y sin sede)
  (db.clientes||[]).forEach(c=>{
    c.sedes.forEach(s=>s.equipos.forEach(e=>{
      indice.push({ tipo:'Equipo', icono:'fa-snowflake', titulo:`${e.nombre}${e.serie?' ('+e.serie+')':''}`, subtitulo:`${c.nombre} — ${s.nombre}`,
        accion:()=>irATrazabilidadEquipo(e.id) });
    }));
    equiposSinSedeDe(c).forEach(e=>{
      indice.push({ tipo:'Equipo', icono:'fa-snowflake', titulo:`${e.nombre}${e.serie?' ('+e.serie+')':''}`, subtitulo:`${c.nombre} — Sin sede`,
        accion:()=>irATrazabilidadEquipo(e.id) });
    });
  });

  // Órdenes de servicio
  (db.ordenes||[]).forEach(o=>{
    indice.push({ tipo:'Orden', icono:'fa-clipboard-list', titulo:o.numero, subtitulo:`${nombreClienteOrden(o)} · ${o.estado}`,
      accion:()=>{ mostrarSeccion('agenda'); setTimeout(()=>verDetalleOrden(o.id), 150); } });
  });

  // Técnicos
  (db.tecnicos||[]).forEach(t=>{
    indice.push({ tipo:'Técnico', icono:'fa-user-hard-hat', titulo:t.nombre, subtitulo:t.activo===false?'Inactivo':'Activo',
      accion:()=>abrirModalConfig('tecnicos') });
  });

  // Productos de inventario / tienda
  (db.inventario||[]).forEach(it=>{
    indice.push({ tipo:'Producto', icono:'fa-box-open', titulo:it.nombre, subtitulo:it.categoria || 'Inventario',
      accion:()=>mostrarSeccion('inventario') });
  });

  // Pestañas de Configuración
  const tabsConfig = [
    ['clientes','Clientes y Sedes'], ['plantillas','Plantillas de Formularios'], ['tecnicos','Técnicos'],
    ['etiquetas','Etiquetas (tipos y prioridades)'], ['general','Empresa y Perfil'], ['apariencia','Apariencia'],
    ['tiendaConfig','Tienda Virtual (config.)'], ['whatsapp','Mensaje de WhatsApp'], ['database','Base de Datos y Backup'], ['auditoria','Auditoría']
  ];
  tabsConfig.forEach(([slug,nombre])=>indice.push({ tipo:'Configuración', icono:'fa-cog', titulo:nombre, subtitulo:'Ir a Configuración', accion:()=>abrirModalConfig(slug) }));

  return indice;
}
function ejecutarBusquedaGlobal(){
  const query = normalizarTexto(document.getElementById('inputBuscadorGlobal').value.trim());
  const cont = document.getElementById('resultadosBuscadorGlobal');
  indiceResultadoActivoBusqueda = -1;
  if(!query){
    cont.innerHTML = '<p class="empty-state">Escribe para buscar clientes, equipos, órdenes, productos, técnicos o secciones...</p>';
    resultadosBusquedaActuales = [];
    return;
  }
  const palabras = query.split(/\s+/).filter(Boolean);
  const indice = construirIndiceBusqueda();
  const coincidencias = indice.filter(item=>{
    const texto = normalizarTexto(item.titulo + ' ' + item.subtitulo + ' ' + item.tipo);
    return palabras.every(p=>texto.includes(p));
  }).slice(0, 40);

  resultadosBusquedaActuales = coincidencias;
  if(!coincidencias.length){
    cont.innerHTML = '<p class="empty-state">Sin resultados para tu búsqueda.</p>';
    return;
  }
  let categoriaAnterior = null;
  let html = '';
  coincidencias.forEach((item, idx)=>{
    if(item.tipo !== categoriaAnterior){
      html += `<div class="resultado-busqueda-categoria">${item.tipo}</div>`;
      categoriaAnterior = item.tipo;
    }
    html += `<div class="resultado-busqueda-item" data-idx="${idx}" onclick="navegarAResultadoBusqueda(${idx})">
      <div class="rb-icono"><i class="fas ${item.icono}"></i></div>
      <div class="rb-texto"><div class="rb-titulo">${item.titulo}</div><div class="rb-subtitulo">${item.subtitulo}</div></div>
    </div>`;
  });
  cont.innerHTML = html;
}
function navegarAResultadoBusqueda(idx){
  const item = resultadosBusquedaActuales[idx];
  if(!item) return;
  cerrarBuscadorGlobal();
  item.accion();
}
function manejarTecladoBuscador(event){
  if(!resultadosBusquedaActuales.length) return;
  if(event.key==='ArrowDown'){
    event.preventDefault();
    indiceResultadoActivoBusqueda = Math.min(indiceResultadoActivoBusqueda+1, resultadosBusquedaActuales.length-1);
    resaltarResultadoActivo();
  } else if(event.key==='ArrowUp'){
    event.preventDefault();
    indiceResultadoActivoBusqueda = Math.max(indiceResultadoActivoBusqueda-1, 0);
    resaltarResultadoActivo();
  } else if(event.key==='Enter'){
    event.preventDefault();
    const idx = indiceResultadoActivoBusqueda >= 0 ? indiceResultadoActivoBusqueda : 0;
    navegarAResultadoBusqueda(idx);
  }
}
function resaltarResultadoActivo(){
  document.querySelectorAll('.resultado-busqueda-item').forEach(el=>el.classList.remove('activo'));
  const activo = document.querySelector(`.resultado-busqueda-item[data-idx="${indiceResultadoActivoBusqueda}"]`);
  if(activo){ activo.classList.add('activo'); activo.scrollIntoView({ block:'nearest' }); }
}

function ocultarSkeletonBoot(){
  const el = document.getElementById('skeletonBoot');
  if(el && el.style.display !== 'none') el.style.display = 'none';
}
function abrirModal(id){
  const el = document.getElementById(id);
  el.classList.remove('cerrando');
  el.style.display='flex';
}
function cerrarModal(id){
  const el = document.getElementById(id);
  if(!el || el.style.display==='none') return;
  el.classList.add('cerrando');
  const box = el.querySelector('.modal-box');
  if(box) box.classList.add('cerrando');
  setTimeout(()=>{
    el.style.display='none';
    el.classList.remove('cerrando');
    if(box) box.classList.remove('cerrando');
  }, 160);
}

/* =========================================================
   AGENDA: VISTA LISTA / CALENDARIO
========================================================= */
function cambiarVistaAgenda(vista){
  document.getElementById('btnVistaLista').classList.toggle('active', vista==='lista');
  document.getElementById('btnVistaCalendario').classList.toggle('active', vista==='calendario');
  document.getElementById('vistaListaOrdenes').style.display = vista==='lista' ? 'grid' : 'none';
  document.getElementById('vistaCalendarioOrdenes').style.display = vista==='calendario' ? 'block' : 'none';
  if(vista==='calendario') renderizarCalendario();
}

function ordenesVisiblesParaSesion(){
  if(esAdmin() || !sesionActual) return db.ordenes;
  const t = sesionActual.tecnicoId ? buscarTecnico(sesionActual.tecnicoId) : null;
  if(t && t.accesoTotal) return db.ordenes; // personal con Acceso total ve la agenda completa, para poder coordinar
  return db.ordenes.filter(o=>o.tecnicoId===sesionActual.tecnicoId);
}
function renderizarAgenda(){
  const cont = document.getElementById('vistaListaOrdenes');
  cont.innerHTML = '';
  const ordenesVisibles = ordenesVisiblesParaSesion();
  if(ordenesVisibles.length===0){ cont.innerHTML = '<div class="empty-state">Aún no hay órdenes de servicio para mostrar.</div>'; return; }
  ordenesVisibles.slice().reverse().forEach(o=>{
    const sede = buscarSede(o.clienteId, o.sedeId);
    const equipo = buscarEquipo(o.clienteId, o.sedeId, o.equipoId);
    const claseEstado = o.estado==='Finalizado' ? 'finalizado' : (o.estado==='En Ejecución' ? 'ejecucion' : 'programado');
    // Semaforización: verde = cerrada, amarillo = en proceso, rojo = fuera de
    // horario (ya pasó la fecha/hora programada y todavía no se finalizó) —
    // el rojo tiene prioridad sobre los demás, porque es lo más urgente de ver.
    // Una sola etiqueta (no dos), que cambia de texto y color según el caso.
    const ahora = new Date();
    const fechaHoraProgramada = o.fechaProgramada ? new Date(`${o.fechaProgramada}T${o.horaProgramada||'23:59'}`) : null;
    const fueraDeHorario = o.estado!=='Finalizado' && fechaHoraProgramada && fechaHoraProgramada < ahora;
    const colorBorde = o.estado==='Finalizado' ? '#22c55e' : (fueraDeHorario ? '#ef4444' : (o.estado==='En Ejecución' ? '#eab308' : '#f59e0b'));
    const textoBadge = fueraDeHorario ? 'Fuera de horario' : o.estado;
    const estiloBadge = o.estado==='Finalizado' ? 'background:#dcfce7;color:#166534;'
      : fueraDeHorario ? 'background:#fee2e2;color:#b91c1c;'
      : o.estado==='En Ejecución' ? 'background:#fef9c3;color:#854d0e;'
      : 'background:#fef3c7;color:#92400e;';
    const iconoBadge = o.estado==='Finalizado' ? 'fa-circle-check' : fueraDeHorario ? 'fa-triangle-exclamation' : (o.estado==='En Ejecución' ? 'fa-hourglass-half' : 'fa-clock');
    const lineaSedeEquipo = o.esClienteNuevo
      ? `<span><i class="fas fa-map-marker-alt"></i> ${o.clienteNuevoDireccion || '—'}</span>`
      : `<span><i class="fas fa-building"></i> ${sede?sede.nombre:'—'}</span><span><i class="fas fa-snowflake"></i> ${equipo?equipo.nombre:'—'}</span>`;
    cont.innerHTML += `
      <div class="orden-card" style="border-left-color:${colorBorde};">
        <div class="orden-card-top">
          <span class="orden-card-badge" style="${estiloBadge}"><i class="fas ${iconoBadge}"></i> ${textoBadge}</span>
          <span class="orden-card-numero">${o.numero}</span>
        </div>
        <h5 class="orden-card-cliente">${nombreClienteOrden(o)}${etiquetaClienteNuevoHtml(o)}</h5>
        <div class="orden-card-datos">
          ${lineaSedeEquipo}
          <span><i class="fas fa-wrench"></i> ${o.tipo}</span>
          <span><i class="fas fa-flag"></i> ${o.prioridad}</span>
          <span><i class="fas fa-calendar-day"></i> ${o.fechaProgramada||'Sin definir'}${o.horaProgramada?` · ${o.horaProgramada}`:''}</span>
          ${(o.recurrencia && o.recurrencia.activa) ? `<span style="cursor:pointer;color:var(--blue-accent);" onclick="abrirGestionRecurrencia(${o.id})" title="Gestionar recurrencia"><i class="fas fa-repeat"></i> ${ETIQUETA_FRECUENCIA_RECURRENCIA[o.recurrencia.frecuencia]}</span>` : ''}
          ${o.esGeneradaPorRecurrencia ? `<span style="color:var(--text-muted);"><i class="fas fa-repeat"></i> Generada por recurrencia</span>` : ''}
        </div>
        <div class="orden-card-acciones">
          <button class="btn-orden-accion btn-orden-principal" onclick="verDetalleOrden(${o.id})"><i class="fas fa-clipboard-check"></i> ${o.estado!=='Finalizado' ? 'Ver / Cerrar Orden' : 'Ver Orden'}</button>
          <button class="btn-orden-accion btn-orden-secundaria solo-admin" data-permiso="ordenes_reprogramar" onclick="abrirReprogramar(${o.id})"><i class="fas fa-calendar-alt"></i> Reprogramar</button>
          ${o.estado==='Finalizado' ? `<button class="btn-orden-accion btn-orden-secundaria solo-admin" data-permiso="ordenes_editar_finalizadas" onclick="editarOrdenFinalizada(${o.id})"><i class="fas fa-unlock"></i> Editar</button>` : ''}
          <button class="btn-orden-accion btn-orden-peligro solo-admin" data-permiso="ordenes_eliminar" onclick="eliminarOrden(${o.id})"><i class="fas fa-trash"></i> Eliminar</button>
        </div>
      </div>`;
  });
  aplicarRBACaUI();
}

async function eliminarOrden(id){
  if(!confirm('¿Eliminar esta orden de servicio?')) return;
  const o = db.ordenes.find(x=>x.id===id);
  const respaldo = db.ordenes.slice();
  db.ordenes = db.ordenes.filter(o=>o.id!==id);
  registrarEliminacion('ordenes', id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.ordenes = respaldo;
    mostrarToast('⚠️ No se pudo eliminar la orden: ' + err.message, 'error');
    return;
  }
  if(o) registrarLog('Eliminar', 'OrdenServicio', o.numero);
  mostrarToast('Orden eliminada.', 'exito');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
}

/* --- Reprogramación --- */
function abrirReprogramar(ordenId){
  ordenReprogramarId = ordenId;
  const o = db.ordenes.find(x=>x.id===ordenId);
  document.getElementById('lblOrdenReprogramar').innerText = `${o.numero} — fecha actual: ${o.fechaProgramada||'sin definir'}${o.horaProgramada?' '+o.horaProgramada:''}`;
  document.getElementById('reprogFecha').value = o.fechaProgramada || '';
  document.getElementById('reprogHora').value = o.horaProgramada || '';
  document.getElementById('reprogEstado').value = o.estado;
  abrirModal('modalReprogramar');
}
async function guardarReprogramacion(){
  const o = db.ordenes.find(x=>x.id===ordenReprogramarId);
  if(!o) return;
  const respaldo = { fechaProgramada:o.fechaProgramada, horaProgramada:o.horaProgramada, estado:o.estado };
  o.fechaProgramada = document.getElementById('reprogFecha').value || null;
  o.horaProgramada = document.getElementById('reprogHora').value || null;
  o.estado = document.getElementById('reprogEstado').value;
  try{
    await dbGuardarInmediato();
  }catch(err){
    Object.assign(o, respaldo);
    mostrarToast('⚠️ No se pudo reprogramar: ' + err.message, 'error');
    return;
  }
  registrarLog('Reprogramar', 'OrdenServicio', `${o.numero} -> ${o.fechaProgramada||'sin fecha'} (${o.estado})`);
  mostrarToast('✅ Orden reprogramada.', 'exito');
  cerrarModal('modalReprogramar');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
}

/* --- Calendario --- */
function cambiarMesCalendario(delta){
  mesCalendarioActual.setMonth(mesCalendarioActual.getMonth()+delta);
  renderizarCalendario();
}
function renderizarCalendario(){
  const dow = document.getElementById('gridDiasSemana');
  const nombresDow = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  dow.innerHTML = nombresDow.map(d=>`<div class="calendar-dow">${d}</div>`).join('');

  const anio = mesCalendarioActual.getFullYear();
  const mes = mesCalendarioActual.getMonth();
  const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('lblMesCalendario').innerText = `${nombresMes[mes]} ${anio}`;

  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes+1, 0);
  const diasEnMes = ultimoDia.getDate();
  const diaSemanaInicio = primerDia.getDay();

  const grid = document.getElementById('gridCalendario');
  grid.innerHTML = '';

  for(let i=0;i<diaSemanaInicio;i++){ grid.innerHTML += `<div class="calendar-day otro-mes"></div>`; }

  const ordenesVisibles = ordenesVisiblesParaSesion();
  const hoyStr = new Date().toISOString().slice(0,10);
  for(let dia=1; dia<=diasEnMes; dia++){
    const fechaStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const ordenesDia = ordenesVisibles.filter(o=>o.fechaProgramada===fechaStr);
    let chips = ordenesDia.map(o=>{
      const ahora = new Date();
      const fechaHoraProgramada = o.fechaProgramada ? new Date(`${o.fechaProgramada}T${o.horaProgramada||'23:59'}`) : null;
      const fueraDeHorario = o.estado!=='Finalizado' && fechaHoraProgramada && fechaHoraProgramada < ahora;
      const claseEstado = o.estado==='Finalizado' ? 'finalizado' : (fueraDeHorario ? 'fuera-horario' : (o.estado==='En Ejecución' ? 'ejecucion' : ''));
      const arrastrable = esAdmin() ? `draggable="true" ondragstart="dragOrdenStart(event,${o.id})"` : '';
      return `<span class="calendar-chip ${claseEstado}" ${arrastrable} title="${o.numero} - ${nombreClienteOrden(o)}${o.esClienteNuevo?' (Cliente nuevo)':''}${o.horaProgramada?' - '+o.horaProgramada:''}" onclick="verDetalleOrden(${o.id})">${o.horaProgramada?o.horaProgramada+' ':''}${o.numero}</span>`;
    }).join('');
    const soltable = esAdmin() ? `ondragover="event.preventDefault()" ondrop="dropOrdenEnDia(event,'${fechaStr}')"` : '';
    const claseHoy = fechaStr===hoyStr ? ' es-hoy' : '';
    const nombreDiaMovil = `<span class="dia-nombre-movil">${nombresDow[new Date(anio,mes,dia).getDay()]} </span>`;
    grid.innerHTML += `<div class="calendar-day${claseHoy}" ${soltable}><div class="num-dia">${nombreDiaMovil}${dia}${fechaStr===hoyStr?' <span class=\"etiqueta-hoy\">HOY</span>':''}</div>${chips}</div>`;
  }
}
let ordenArrastradaId = null;
function dragOrdenStart(event, ordenId){ ordenArrastradaId = ordenId; event.dataTransfer.effectAllowed = 'move'; }
async function dropOrdenEnDia(event, fechaStr){
  event.preventDefault();
  if(!ordenArrastradaId) return;
  const o = db.ordenes.find(x=>x.id===ordenArrastradaId);
  if(!o) return;
  if(o.tecnicoId){
    const conflicto = db.ordenes.find(x=>x.id!==o.id && x.tecnicoId===o.tecnicoId && x.fechaProgramada===fechaStr);
    if(conflicto && !confirm(`El técnico ya tiene la orden ${conflicto.numero} programada ese día. ¿Reprogramar de todos modos?`)) { ordenArrastradaId=null; return; }
  }
  const fechaAnterior = o.fechaProgramada;
  o.fechaProgramada = fechaStr;
  try{
    await dbGuardarInmediato();
  }catch(err){
    o.fechaProgramada = fechaAnterior;
    mostrarToast('⚠️ No se pudo reprogramar: ' + err.message, 'error');
    ordenArrastradaId = null;
    renderizarCalendario();
    return;
  }
  registrarLog('Reprogramar (drag & drop)', 'OrdenServicio', `${o.numero} movida a ${fechaStr}`);
  ordenArrastradaId = null;
  renderizarCalendario(); renderizarAgenda();
}

function abrirModalNuevaOrden(equipoIdPreset){
  document.getElementById('ordClienteBuscador').value = '';
  document.getElementById('ordCliente').value = '';
  document.getElementById('ordClienteNuevo').checked = false;
  document.getElementById('ordClienteNuevoNombre').value = '';
  document.getElementById('ordClienteNuevoDireccion').value = '';
  document.getElementById('ordNotas').value = '';
  cerrarListaClientesOrden();
  const selTec = document.getElementById('ordTecnico');
  selTec.innerHTML = db.tecnicos.filter(t=>t.activo!==false).map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('') || '<option value="">Sin técnicos activos</option>';
  document.getElementById('ordTipo').innerHTML = db.config.tiposServicio.map(t=>`<option>${t}</option>`).join('');
  document.getElementById('ordPrioridad').innerHTML = db.config.prioridades.map(p=>`<option>${p}</option>`).join('');
  document.getElementById('ordSinEquipo').checked = false;
  document.getElementById('ordRecurrente').checked = false;
  document.getElementById('wrapperOrdenRecurrente').style.display = 'none';
  toggleOrdenClienteNuevo();
  // Si viene de un escaneo de QR: preselecciona el cliente dueño de ese
  // equipo, y marca su casilla en la lista una vez esté poblada.
  if(equipoIdPreset){
    const info = ubicarEquipoPorId(equipoIdPreset);
    if(info){
      document.getElementById('ordClienteBuscador').value = info.cliente.nombre;
      document.getElementById('ordCliente').value = info.cliente.id;
    }
  }
  poblarEquiposOrden();
  if(equipoIdPreset){
    const chk = document.querySelector(`#listaEquiposOrden .chk-equipo-orden[data-equipo="${equipoIdPreset}"]`);
    if(chk) chk.checked = true;
  }
  abrirModal('modalNuevaOrden');
}
function toggleOrdenClienteNuevo(){
  const esNuevo = document.getElementById('ordClienteNuevo').checked;
  document.getElementById('wrapperClienteNuevo').style.display = esNuevo ? 'block' : 'none';
  document.getElementById('wrapperClienteExistente').style.display = esNuevo ? 'none' : 'block';
  document.getElementById('lblOrdSinEquipo').style.display = esNuevo ? 'none' : 'flex';
  if(esNuevo){
    document.getElementById('ordCliente').value = '';
    document.getElementById('ordClienteBuscador').value = '';
    document.getElementById('ordSinEquipo').checked = true;
  } else {
    document.getElementById('ordSinEquipo').checked = false;
  }
  toggleOrdenSinEquipo();
}
// Busca clientes por su propio nombre, o por el nombre/marca/modelo/serie de
// cualquiera de sus equipos — así, si te acuerdas del equipo pero no del
// cliente, igual lo encuentras. Sin escribir nada, muestra todos (como el
// selector de antes).
function resaltarCoincidencia(texto, busqueda){
  if(!busqueda) return texto;
  const idx = texto.toLowerCase().indexOf(busqueda.toLowerCase());
  if(idx===-1) return texto;
  return texto.slice(0,idx) + '<mark>' + texto.slice(idx,idx+busqueda.length) + '</mark>' + texto.slice(idx+busqueda.length);
}
function filtrarClientesOrden(){
  const texto = document.getElementById('ordClienteBuscador').value.trim().toLowerCase();
  const cont = document.getElementById('ordClienteResultados');
  const resultados = [];
  db.clientes.forEach(c=>{
    if(!texto || c.nombre.toLowerCase().includes(texto)){
      resultados.push({ cliente:c, motivo:null });
      return;
    }
    const todosLosEquipos = [];
    c.sedes.forEach(s=>s.equipos.forEach(e=>todosLosEquipos.push(e)));
    equiposSinSedeDe(c).forEach(e=>todosLosEquipos.push(e));
    const equipoCoincide = todosLosEquipos.find(e=>
      `${e.nombre||''} ${e.marca||''} ${e.modelo||''} ${e.serie||''}`.toLowerCase().includes(texto)
    );
    if(equipoCoincide) resultados.push({ cliente:c, motivo:equipoCoincide.nombre });
  });
  if(!resultados.length){
    cont.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:#94a3b8;">Sin resultados para esa búsqueda</div>';
  } else {
    cont.innerHTML = resultados.slice(0,30).map(r=>`
      <div class="autocomplete-item" onmousedown="seleccionarClienteOrden(${r.cliente.id})">
        <span class="autocomplete-item-avatar">${(r.cliente.nombre||'?').trim().charAt(0).toUpperCase()}</span>
        <span style="flex:1;min-width:0;">
          ${resaltarCoincidencia(r.cliente.nombre, texto)}
          ${r.motivo ? `<small>Coincide por el equipo: ${resaltarCoincidencia(r.motivo, texto)}</small>` : ''}
        </span>
      </div>`).join('');
  }
  cont.classList.add('abierto');
}
function seleccionarClienteOrden(clienteId){
  const c = buscarCliente(clienteId);
  if(!c) return;
  document.getElementById('ordClienteBuscador').value = c.nombre;
  document.getElementById('ordCliente').value = clienteId;
  cerrarListaClientesOrden();
  poblarEquiposOrden();
}
function cerrarListaClientesOrden(){
  document.getElementById('ordClienteResultados').classList.remove('abierto');
}
function toggleOrdenSinEquipo(){
  const sinEquipo = document.getElementById('ordSinEquipo').checked;
  document.getElementById('wrapperEquiposOrden').style.display = sinEquipo ? 'none' : 'block';
  document.getElementById('wrapperPlantillaGeneral').style.display = sinEquipo ? 'block' : 'none';
  document.getElementById('lblOrdRecurrente').style.display = sinEquipo ? 'none' : 'flex';
  if(sinEquipo){
    document.getElementById('ordRecurrente').checked = false;
    document.getElementById('wrapperOrdenRecurrente').style.display = 'none';
    const sel = document.getElementById('ordPlantillaGeneral');
    sel.innerHTML = '<option value="">Sin plantilla</option>' + db.plantillas.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
  }
}
function toggleOrdenRecurrente(){
  document.getElementById('wrapperOrdenRecurrente').style.display = document.getElementById('ordRecurrente').checked ? 'block' : 'none';
}
function poblarEquiposOrden(){
  // Filtro dinámico: los Equipos dependen exclusivamente del Cliente seleccionado.
  // Incluye los equipos de todas las sedes del cliente y los que no tienen sede asignada.
  // Cada equipo se puede marcar de forma independiente y llevar su propia plantilla
  // y su propio tipo de mantenimiento (Preventivo/Correctivo/etc.).
  const clienteId = parseInt(document.getElementById('ordCliente').value);
  const c = clienteId ? buscarCliente(clienteId) : null;
  const cont = document.getElementById('listaEquiposOrden');
  const opcionesPlantilla = db.plantillas.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('') || '<option value="">Sin plantillas</option>';
  const opcionesTipo = db.config.tiposServicio.map(t=>`<option value="${t}">${t}</option>`).join('');
  if(!c){
    cont.innerHTML = '<p class="empty-state" style="margin:0;">Selecciona primero un Cliente</p>';
    return;
  }
  let opciones = [];
  c.sedes.forEach(s=>s.equipos.forEach(e=>opciones.push({ id:e.id, sedeId:s.id, texto:`${e.nombre}${e.serie?' ('+e.serie+')':''} — ${s.nombre}` })));
  equiposSinSedeDe(c).forEach(e=>opciones.push({ id:e.id, sedeId:null, texto:`${e.nombre}${e.serie?' ('+e.serie+')':''} — Sin sede` }));
  if(!opciones.length){
    cont.innerHTML = '<p class="empty-state" style="margin:0;">Este cliente no tiene equipos registrados</p>';
    return;
  }
  cont.innerHTML = opciones.map(o=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--card-border);flex-wrap:wrap;">
      <input type="checkbox" class="chk-equipo-orden" data-equipo="${o.id}" data-sede="${o.sedeId!==null?o.sedeId:''}" style="width:auto;margin:0;">
      <span style="flex:1;min-width:140px;font-size:13px;">${o.texto}</span>
      <select class="sel-tipo-equipo" data-equipo="${o.id}" style="width:170px;flex-shrink:0;margin:0;" title="Tipo de mantenimiento para este equipo">${opcionesTipo}</select>
      <select class="sel-plantilla-equipo" data-equipo="${o.id}" style="width:190px;flex-shrink:0;margin:0;" title="Plantilla de formulario para este equipo">${opcionesPlantilla}</select>
    </div>`).join('');
}
// =========================================================================
// MANTENIMIENTO RECURRENTE — genera automáticamente las próximas órdenes
// de un equipo (o de un mismo grupo de equipos, si la orden tenía varios)
// según la frecuencia elegida, hasta la fecha límite escogida.
// =========================================================================
function calcularFechaLimiteRecurrencia(rango, fechaBaseStr){
  const base = new Date(fechaBaseStr + 'T00:00:00');
  if(rango === 'resto-anio'){
    return new Date(base.getFullYear(), 11, 31);
  }
  const limite = new Date(base);
  limite.setFullYear(limite.getFullYear() + 2);
  return limite;
}
const MESES_POR_FRECUENCIA_RECURRENCIA = { mensual:1, bimensual:2, trimestral:3, cuatrimestral:4, semestral:6 };
const ETIQUETA_FRECUENCIA_RECURRENCIA = { semanal:'Semanal', mensual:'Mensual', bimensual:'Bimensual', trimestral:'Trimestral', cuatrimestral:'Cada 4 meses', semestral:'Cada 6 meses' };
// Genera las órdenes futuras y las agrega a db.ordenes (sin guardar aún —
// eso lo hace quien llama, en el mismo guardado que la orden origen, para
// que todo quede atómico: o se guarda completo, o no se guarda nada).
function generarSerieRecurrente(ordenBase, frecuencia, rango){
  const serieId = 'serie-' + ordenBase.id;
  const fechaLimite = calcularFechaLimiteRecurrencia(rango, ordenBase.fechaProgramada);
  let fechaSiguiente = new Date(ordenBase.fechaProgramada + 'T00:00:00');
  const nuevas = [];
  let contador = 0;
  while(contador < 104){ // límite defensivo — nunca deberían hacer falta tantas
    if(frecuencia === 'semanal') fechaSiguiente = new Date(fechaSiguiente.getFullYear(), fechaSiguiente.getMonth(), fechaSiguiente.getDate()+7);
    else fechaSiguiente = new Date(fechaSiguiente.getFullYear(), fechaSiguiente.getMonth()+MESES_POR_FRECUENCIA_RECURRENCIA[frecuencia], fechaSiguiente.getDate());
    if(fechaSiguiente > fechaLimite) break;
    contador++;
    const generada = JSON.parse(JSON.stringify(ordenBase));
    generada.id = ordenBase.id + contador; // consecutivo a partir del id base — único y estable
    generada.numero = `OS-2026-${String(db.ordenes.length + nuevas.length + 1).padStart(4,'0')}`;
    generada.fechaProgramada = fechaSiguiente.toISOString().slice(0,10);
    generada.estado = 'Programado';
    generada.cierre = null;
    generada.serieId = serieId;
    generada.esGeneradaPorRecurrencia = true;
    delete generada.recurrencia; // solo la orden ORIGEN guarda la configuración de la serie
    nuevas.push(generada);
  }
  ordenBase.recurrencia = { activa:true, frecuencia, rango, serieId };
  ordenBase.serieId = serieId;
  db.ordenes.push(...nuevas);
  return nuevas.length;
}
// Cancela una serie: borra las órdenes futuras aún no finalizadas; las que
// ya se hayan ejecutado/finalizado quedan intactas, como historial real.
async function cancelarRecurrencia(ordenId){
  const origen = db.ordenes.find(o=>o.id===ordenId);
  if(!origen || !origen.recurrencia) return;
  if(!confirm('¿Cancelar la recurrencia? Se eliminarán las órdenes futuras de esta serie que aún no se hayan finalizado. Las que ya se ejecutaron quedan intactas.')) return;
  const serieId = origen.recurrencia.serieId;
  const respaldo = db.ordenes.slice();
  db.ordenes = db.ordenes.filter(o => !(o.serieId===serieId && o.id!==ordenId && o.estado!=='Finalizado'));
  origen.recurrencia.activa = false;
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.ordenes = respaldo;
    origen.recurrencia.activa = true;
    mostrarToast('⚠️ No se pudo cancelar: ' + err.message, 'error');
    return;
  }
  registrarLog('Cancelar', 'RecurrenciaOrden', origen.numero);
  mostrarToast('✅ Recurrencia cancelada. Las órdenes futuras pendientes fueron eliminadas.', 'exito');
  cerrarModal('modalGestionRecurrencia');
  renderizarAgenda(); renderizarCalendario();
}
// Modifica una serie ya creada: cancela las pendientes actuales y genera
// una nueva serie con la frecuencia/rango elegidos de nuevo.
async function guardarCambiosRecurrencia(ordenId){
  const origen = db.ordenes.find(o=>o.id===ordenId);
  if(!origen) return;
  const frecuencia = document.getElementById('gestRecurrenciaFrecuencia').value;
  const rango = document.getElementById('gestRecurrenciaRango').value;
  const respaldo = db.ordenes.slice();
  const serieId = origen.recurrencia ? origen.recurrencia.serieId : null;
  if(serieId){
    db.ordenes = db.ordenes.filter(o => !(o.serieId===serieId && o.id!==ordenId && o.estado!=='Finalizado'));
  }
  const generadas = generarSerieRecurrente(origen, frecuencia, rango);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.ordenes = respaldo;
    mostrarToast('⚠️ No se pudo actualizar la recurrencia: ' + err.message, 'error');
    return;
  }
  registrarLog('Editar', 'RecurrenciaOrden', `${origen.numero} (${frecuencia}, ${generadas} órdenes generadas)`);
  mostrarToast(`✅ Recurrencia actualizada: se generaron ${generadas} órdenes nuevas.`, 'exito');
  cerrarModal('modalGestionRecurrencia');
  renderizarAgenda(); renderizarCalendario();
}
function abrirGestionRecurrencia(ordenId){
  const o = db.ordenes.find(x=>x.id===ordenId);
  if(!o || !o.recurrencia) return;
  document.getElementById('gestRecurrenciaOrdenId').value = ordenId;
  document.getElementById('gestRecurrenciaFrecuencia').value = o.recurrencia.frecuencia;
  document.getElementById('gestRecurrenciaRango').value = o.recurrencia.rango;
  const serieId = o.recurrencia.serieId;
  const enLaSerie = db.ordenes.filter(x=>x.serieId===serieId);
  const finalizadas = enLaSerie.filter(x=>x.estado==='Finalizado').length;
  const pendientes = enLaSerie.filter(x=>x.estado!=='Finalizado').length;
  document.getElementById('gestRecurrenciaResumen').innerText = `${enLaSerie.length} órdenes en esta serie — ${finalizadas} ya finalizadas, ${pendientes} pendientes.`;
  abrirModal('modalGestionRecurrencia');
}

async function guardarNuevaOrden(){
  const esClienteNuevo = document.getElementById('ordClienteNuevo').checked;
  const clienteId = esClienteNuevo ? null : parseInt(document.getElementById('ordCliente').value);
  const clienteNuevoNombre = esClienteNuevo ? document.getElementById('ordClienteNuevoNombre').value.trim() : null;
  const clienteNuevoDireccion = esClienteNuevo ? document.getElementById('ordClienteNuevoDireccion').value.trim() : null;
  if(esClienteNuevo){
    if(!clienteNuevoNombre){ mostrarToast('Escribe el nombre del cliente nuevo.'); return; }
  } else if(!clienteId){
    mostrarToast('Selecciona el Cliente.'); return;
  }
  const tecnicoId = parseInt(document.getElementById('ordTecnico').value);
  const tipo = document.getElementById('ordTipo').value;
  const prioridad = document.getElementById('ordPrioridad').value;
  const fechaProgramada = document.getElementById('ordFecha').value || null;
  const horaProgramada = document.getElementById('ordHora').value || null;
  const sinEquipo = document.getElementById('ordSinEquipo').checked;
  const notas = document.getElementById('ordNotas').value.trim() || null;

  if(sinEquipo){
    const plantillaId = document.getElementById('ordPlantillaGeneral').value ? parseInt(document.getElementById('ordPlantillaGeneral').value) : null;
    const consecutivo = db.ordenes.length + 1;
    const nueva = {
      id: Date.now(), numero: `OS-2026-${String(consecutivo).padStart(4,'0')}`,
      clienteId, sedeId: null, equipoId: null, tecnicoId: tecnicoId||null,
      esClienteNuevo, clienteNuevoNombre, clienteNuevoDireccion,
      tipo, prioridad, plantillaId, notas,
      estado: 'Programado', fechaProgramada, horaProgramada, cierre: null
    };
    db.ordenes.push(nueva);
    registrarLog('Crear', 'OrdenServicio', esClienteNuevo ? `${nueva.numero} (cliente nuevo: ${clienteNuevoNombre})` : `${nueva.numero} (servicio general, sin equipo)`);
    try{
      await dbGuardarInmediato();
    }catch(err){
      db.ordenes.pop();
      mostrarToast('⚠️ No se pudo crear la orden: ' + err.message, 'error');
      return;
    }
    cerrarModal('modalNuevaOrden');
    renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
    mostrarToast(esClienteNuevo ? `Orden ${nueva.numero} creada para el cliente nuevo "${clienteNuevoNombre}".` : `Orden ${nueva.numero} creada como servicio general, sin equipo asociado.`);
    return;
  }

  const filasSeleccionadas = Array.from(document.querySelectorAll('#listaEquiposOrden .chk-equipo-orden:checked'));
  if(filasSeleccionadas.length===0){ mostrarToast('Selecciona al menos un equipo, o marca la opción de servicio general sin equipo.'); return; }

  const datosEquipos = filasSeleccionadas.map(chk=>{
    const equipoId = parseInt(chk.dataset.equipo);
    // La sede viene directamente de la fila (ya filtrada por este Cliente al construir
    // la lista), en vez de volver a buscarla de forma global por ID — así se evita que
    // una orden se salte en silencio si algún otro equipo del sistema comparte el mismo ID.
    const sedeId = chk.dataset.sede ? parseInt(chk.dataset.sede) : null;
    const selPlant = document.querySelector(`#listaEquiposOrden .sel-plantilla-equipo[data-equipo="${equipoId}"]`);
    const plantillaId = selPlant && selPlant.value ? parseInt(selPlant.value) : null;
    const selTipo = document.querySelector(`#listaEquiposOrden .sel-tipo-equipo[data-equipo="${equipoId}"]`);
    const tipoEquipo = selTipo && selTipo.value ? selTipo.value : tipo;
    return { equipoId, sedeId, plantillaId, tipo: tipoEquipo };
  });

  const consecutivo = db.ordenes.length + 1;
  let nueva;
  if(datosEquipos.length === 1){
    // Un solo equipo: exactamente el mismo comportamiento de siempre.
    const d = datosEquipos[0];
    nueva = {
      id: Date.now(), numero: `OS-2026-${String(consecutivo).padStart(4,'0')}`,
      clienteId, sedeId: d.sedeId, equipoId: d.equipoId, tecnicoId: tecnicoId||null,
      tipo: d.tipo, prioridad, plantillaId: d.plantillaId, notas,
      estado: 'Programado', fechaProgramada, horaProgramada, cierre: null
    };
  } else {
    // Varios equipos marcados: UNA sola orden, donde cada equipo queda como
    // un bloque independiente (su propio tipo/plantilla desde la creación, y
    // más adelante sus propias fotos/informe/actividades al cerrar la orden)
    // — antes esto creaba una orden separada por cada equipo marcado.
    nueva = {
      id: Date.now(), numero: `OS-2026-${String(consecutivo).padStart(4,'0')}`,
      clienteId, sedeId: datosEquipos[0].sedeId, equipoId: null,
      equiposIds: datosEquipos.map(d=>d.equipoId), equiposDatos: datosEquipos,
      tecnicoId: tecnicoId||null,
      tipo, prioridad, plantillaId: null, notas,
      estado: 'Programado', fechaProgramada, horaProgramada, cierre: null
    };
  }
  db.ordenes.push(nueva);
  const esRecurrente = document.getElementById('ordRecurrente').checked;
  let generadasRecurrencia = 0;
  if(esRecurrente && nueva.fechaProgramada){
    const frecuencia = document.getElementById('ordRecurrenteFrecuencia').value;
    const rango = document.getElementById('ordRecurrenteRango').value;
    generadasRecurrencia = generarSerieRecurrente(nueva, frecuencia, rango);
  }
  registrarLog('Crear', 'OrdenServicio', datosEquipos.length>1 ? `${nueva.numero} (${datosEquipos.length} equipos)` : nueva.numero);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.ordenes = db.ordenes.filter(o => o.id!==nueva.id && o.serieId!==nueva.serieId);
    mostrarToast('⚠️ No se pudo crear la orden: ' + err.message, 'error');
    return;
  }
  cerrarModal('modalNuevaOrden');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
  let mensaje = datosEquipos.length>1 ? `✅ Orden ${nueva.numero} creada con ${datosEquipos.length} equipos.` : `✅ Orden ${nueva.numero} creada.`;
  if(esRecurrente && !nueva.fechaProgramada) mensaje += ' (La recurrencia necesita una fecha programada — no se generó ninguna serie.)';
  else if(generadasRecurrencia>0) mensaje += ` Se programaron ${generadasRecurrencia} órdenes más de forma recurrente.`;
  mostrarToast(mensaje, 'exito');
}

