// ===== buscador-agenda.js — Búsqueda Global, Agenda y Notificaciones =====
/* =========================================================
   BUSCADOR GLOBAL
========================================================= */
let resultadosBusquedaActuales = [];
let indiceResultadoActivoBusqueda = -1;

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    abrirBuscadorGlobal();
  }
  if (e.key === 'Escape') cerrarBuscadorGlobal();
});

function normalizarTexto(str) {
  return (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function abrirBuscadorGlobal() {
  const overlay = document.getElementById('overlayBuscadorGlobal');
  overlay.style.display = 'flex';
  const input = document.getElementById('inputBuscadorGlobal');
  input.value = '';
  ejecutarBusquedaGlobal();
  setTimeout(() => input.focus(), 50);
}

function cerrarBuscadorGlobal() {
  document.getElementById('overlayBuscadorGlobal').style.display = 'none';
}

function construirIndiceBusqueda() {
  const indice = [];
  const secciones = [
    { slug: 'agenda', nombre: 'Agenda / Órdenes', icono: 'fa-calendar-alt' },
    { slug: 'equipos', nombre: 'Equipos', icono: 'fa-snowflake' },
    { slug: 'trazabilidad', nombre: 'Historial y Trazabilidad', icono: 'fa-stream' },
    { slug: 'inventario', nombre: 'Inventario', icono: 'fa-boxes' },
    { slug: 'tienda', nombre: 'Tienda Virtual', icono: 'fa-store' },
    { slug: 'kpi', nombre: 'Indicadores (KPI)', icono: 'fa-chart-line' },
    { slug: 'contabilidad', nombre: 'Negocio / Contabilidad', icono: 'fa-wallet' },
  ];
  secciones.forEach(s => indice.push({ tipo: 'Sección', icono: s.icono, titulo: s.nombre, subtitulo: 'Ir a esta sección', accion: () => mostrarSeccion(s.slug) }));

  (db.clientes || []).forEach(c => {
    indice.push({
      tipo: 'Cliente', icono: 'fa-user-tie', titulo: c.nombre, subtitulo: c.telefono || c.numeroDocumento || 'Cliente',
      accion: () => { abrirModalConfig('clientes'); setTimeout(() => editarClienteConfig(c.id), 150); }
    });
  });

  (db.clientes || []).forEach(c => {
    (c.sedes || []).forEach(s => (s.equipos || []).forEach(e => {
      indice.push({
        tipo: 'Equipo', icono: 'fa-snowflake', titulo: `${e.nombre}${e.serie ? ' (' + e.serie + ')' : ''}`, subtitulo: `${c.nombre} — ${s.nombre}`,
        accion: () => irATrazabilidadEquipo(e.id)
      });
    }));
    equiposSinSedeDe(c).forEach(e => {
      indice.push({
        tipo: 'Equipo', icono: 'fa-snowflake', titulo: `${e.nombre}${e.serie ? ' (' + e.serie + ')' : ''}`, subtitulo: `${c.nombre} — Sin sede`,
        accion: () => irATrazabilidadEquipo(e.id)
      });
    });
  });

  (db.ordenes || []).forEach(o => {
    indice.push({
      tipo: 'Orden', icono: 'fa-clipboard-list', titulo: o.numero, subtitulo: `${nombreClienteOrden(o)} · ${o.estado}`,
      accion: () => { mostrarSeccion('agenda'); setTimeout(() => verDetalleOrden(o.id), 150); }
    });
  });

  (db.tecnicos || []).forEach(t => {
    indice.push({
      tipo: 'Técnico', icono: 'fa-user-hard-hat', titulo: t.nombre, subtitulo: t.activo === false ? 'Inactivo' : 'Activo',
      accion: () => abrirModalConfig('tecnicos')
    });
  });

  (db.inventario || []).forEach(it => {
    indice.push({
      tipo: 'Producto', icono: 'fa-box-open', titulo: it.nombre, subtitulo: it.categoria || 'Inventario',
      accion: () => mostrarSeccion('inventario')
    });
  });

  const tabsConfig = [
    ['clientes', 'Clientes y Sedes'], ['plantillas', 'Plantillas de Formularios'], ['tecnicos', 'Técnicos'],
    ['etiquetas', 'Etiquetas (tipos y prioridades)'], ['general', 'Empresa y Perfil'], ['apariencia', 'Apariencia'],
    ['tiendaConfig', 'Tienda Virtual (config.)'], ['whatsapp', 'Mensaje de WhatsApp'], ['database', 'Base de Datos y Backup'], ['auditoria', 'Auditoría']
  ];
  tabsConfig.forEach(([slug, nombre]) => indice.push({ tipo: 'Configuración', icono: 'fa-cog', titulo: nombre, subtitulo: 'Ir a Configuración', accion: () => abrirModalConfig(slug) }));

  return indice;
}

function ejecutarBusquedaGlobal() {
  const query = normalizarTexto(document.getElementById('inputBuscadorGlobal').value.trim());
  const cont = document.getElementById('resultadosBuscadorGlobal');
  indiceResultadoActivoBusqueda = -1;
  if (!query) {
    cont.innerHTML = '<p class="empty-state">Escribe para buscar clientes, equipos, órdenes, productos, técnicos o secciones...</p>';
    resultadosBusquedaActuales = [];
    return;
  }
  const palabras = query.split(/\s+/).filter(Boolean);
  const indice = construirIndiceBusqueda();
  const coincidencias = indice.filter(item => {
    const texto = normalizarTexto(item.titulo + ' ' + item.subtitulo + ' ' + item.tipo);
    return palabras.every(p => texto.includes(p));
  }).slice(0, 40);

  resultadosBusquedaActuales = coincidencias;
  if (!coincidencias.length) {
    cont.innerHTML = '<p class="empty-state">Sin resultados para tu búsqueda.</p>';
    return;
  }
  let categoriaAnterior = null;
  let html = '';
  coincidencias.forEach((item, idx) => {
    if (item.tipo !== categoriaAnterior) {
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

function navegarAResultadoBusqueda(idx) {
  const item = resultadosBusquedaActuales[idx];
  if (!item) return;
  cerrarBuscadorGlobal();
  item.accion();
}

function manejarTecladoBuscador(event) {
  if (!resultadosBusquedaActuales.length) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    indiceResultadoActivoBusqueda = Math.min(indiceResultadoActivoBusqueda + 1, resultadosBusquedaActuales.length - 1);
    resaltarResultadoActivo();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    indiceResultadoActivoBusqueda = Math.max(indiceResultadoActivoBusqueda - 1, 0);
    resaltarResultadoActivo();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const idx = indiceResultadoActivoBusqueda >= 0 ? indiceResultadoActivoBusqueda : 0;
    navegarAResultadoBusqueda(idx);
  }
}

function resaltarResultadoActivo() {
  document.querySelectorAll('.resultado-busqueda-item').forEach(el => el.classList.remove('activo'));
  const activo = document.querySelector(`.resultado-busqueda-item[data-idx="${indiceResultadoActivoBusqueda}"]`);
  if (activo) { activo.classList.add('activo'); activo.scrollIntoView({ block: 'nearest' }); }
}

function ocultarSkeletonBoot() {
  const el = document.getElementById('skeletonBoot');
  if (el && el.style.display !== 'none') el.style.display = 'none';
}
function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }

/* =========================================================
   AGENDA: VISTA LISTA / CALENDARIO
========================================================= */
function cambiarVistaAgenda(vista) {
  document.getElementById('btnVistaLista').classList.toggle('active', vista === 'lista');
  document.getElementById('btnVistaCalendario').classList.toggle('active', vista === 'calendario');
  document.getElementById('vistaListaOrdenes').style.display = vista === 'lista' ? 'grid' : 'none';
  document.getElementById('vistaCalendarioOrdenes').style.display = vista === 'calendario' ? 'block' : 'none';
  if (vista === 'calendario') renderizarCalendario();
}

function ordenesVisiblesParaSesion() {
  if (esAdmin() || !sesionActual) return db.ordenes;
  const t = sesionActual.tecnicoId ? buscarTecnico(sesionActual.tecnicoId) : null;
  if (t && t.accesoTotal) return db.ordenes;
  return (db.ordenes || []).filter(o => o.tecnicoId === sesionActual.tecnicoId);
}

function esOrdenParaHoy(fechaStr) {
  if (!fechaStr) return false;
  const hoyStr = new Date().toISOString().slice(0, 10);
  return fechaStr === hoyStr;
}

function renderizarAgenda() {
  const cont = document.getElementById('vistaListaOrdenes');
  cont.innerHTML = '';
  const ordenesVisibles = ordenesVisiblesParaSesion();
  if (ordenesVisibles.length === 0) {
    cont.innerHTML = '<div class="empty-state">Aún no hay órdenes de servicio para mostrar.</div>';
    return;
  }

  ordenesVisibles.slice().reverse().forEach(o => {
    const sede = buscarSede(o.clienteId, o.sedeId);
    const equipo = buscarEquipo(o.clienteId, o.sedeId, o.equipoId);
    const tec = o.tecnicoId ? buscarTecnico(o.tecnicoId) : null;
    const esHoy = esOrdenParaHoy(o.fechaProgramada);

    const claseEstado = o.estado === 'Finalizado' ? 'finalizado' : (o.estado === 'En Ejecución' ? 'ejecucion' : 'programado');
    const colorBorde = o.estado === 'Finalizado' ? '#22c55e' : (o.estado === 'En Ejecución' ? '#8b5cf6' : (esHoy ? '#ef4444' : '#f59e0b'));
    
    const lineaSedeEquipo = o.esClienteNuevo
      ? `<span><i class="fas fa-map-marker-alt"></i> ${o.clienteNuevoDireccion || '—'}</span>`
      : `<span><i class="fas fa-building"></i> ${sede ? sede.nombre : '—'}</span><span><i class="fas fa-snowflake"></i> ${equipo ? equipo.nombre : '—'}</span>`;

    const avisoHoyHtml = (esHoy && o.estado !== 'Finalizado') 
      ? `<span style="font-size:10px;font-weight:700;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:10px;border:1px solid #fca5a5;margin-left:6px;"><i class="fas fa-bell"></i> VISITA HOY</span>` 
      : '';

    cont.innerHTML += `
      <div class="orden-card" style="border-left-color:${colorBorde};">
        <div class="orden-card-top">
          <div>
            <span class="orden-card-badge badge-${claseEstado}">${o.estado}</span>
            ${avisoHoyHtml}
          </div>
          <span class="orden-card-numero">${o.numero}</span>
        </div>
        <h5 class="orden-card-cliente">${nombreClienteOrden(o)}${etiquetaClienteNuevoHtml(o)}</h5>
        <div class="orden-card-datos">
          ${lineaSedeEquipo}
          <span><i class="fas fa-wrench"></i> ${o.tipo}</span>
          <span><i class="fas fa-flag"></i> ${o.prioridad}</span>
          <span><i class="fas fa-user-hard-hat"></i> ${tec ? tec.nombre : 'Sin técnico asignado'}</span>
          <span><i class="fas fa-calendar-day"></i> ${o.fechaProgramada || 'Sin definir'}${o.horaProgramada ? ` · ${o.horaProgramada}` : ''}</span>
        </div>
        <div class="orden-card-acciones">
          ${o.estado !== 'Finalizado' ? `<button class="btn-orden-accion btn-orden-principal" onclick="verDetalleOrden(${o.id})"><i class="fas fa-clipboard-check"></i> Ver / Cerrar Orden</button>` : ''}
          <button class="btn-orden-accion btn-orden-secundaria solo-admin" data-permiso="ordenes_reprogramar" onclick="abrirReprogramar(${o.id})"><i class="fas fa-calendar-alt"></i> Reprogramar</button>
          ${o.cierre ? `<button class="btn-orden-accion btn-orden-secundaria" onclick="verPDF(${o.id})"><i class="fas fa-file-pdf"></i> Documento</button>` : ''}
          ${o.estado === 'Finalizado' ? `<button class="btn-orden-accion btn-orden-secundaria solo-admin" data-permiso="ordenes_editar_finalizadas" onclick="editarOrdenFinalizada(${o.id})"><i class="fas fa-unlock"></i> Editar</button>` : ''}
          <button class="btn-orden-accion btn-orden-peligro solo-admin" data-permiso="ordenes_eliminar" onclick="eliminarOrden(${o.id})"><i class="fas fa-trash"></i> Eliminar</button>
        </div>
      </div>`;
  });
  aplicarRBACaUI();
}

async function eliminarOrden(id) {
  if (!confirm('¿Eliminar esta orden de servicio?')) return;
  const o = (db.ordenes || []).find(x => x.id === id);
  const respaldo = (db.ordenes || []).slice();
  db.ordenes = (db.ordenes || []).filter(x => x.id !== id);
  registrarEliminacion('ordenes', id);
  try {
    await dbGuardarInmediato();
  } catch (err) {
    db.ordenes = respaldo;
    mostrarToast('⚠️ No se pudo eliminar la orden: ' + err.message, 'error');
    return;
  }
  if (o) registrarLog('Eliminar', 'OrdenServicio', o.numero);
  mostrarToast('Orden eliminada.', 'exito');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
}

/* --- Reprogramación --- */
function abrirReprogramar(ordenId) {
  ordenReprogramarId = ordenId;
  const o = (db.ordenes || []).find(x => x.id === ordenId);
  document.getElementById('lblOrdenReprogramar').innerText = `${o.numero} — fecha actual: ${o.fechaProgramada || 'sin definir'}${o.horaProgramada ? ' ' + o.horaProgramada : ''}`;
  document.getElementById('reprogFecha').value = o.fechaProgramada || '';
  document.getElementById('reprogHora').value = o.horaProgramada || '';
  document.getElementById('reprogEstado').value = o.estado;
  abrirModal('modalReprogramar');
}

async function guardarReprogramacion() {
  const o = (db.ordenes || []).find(x => x.id === ordenReprogramarId);
  if (!o) return;
  const respaldo = { fechaProgramada: o.fechaProgramada, horaProgramada: o.horaProgramada, estado: o.estado };
  o.fechaProgramada = document.getElementById('reprogFecha').value || null;
  o.horaProgramada = document.getElementById('reprogHora').value || null;
  o.estado = document.getElementById('reprogEstado').value;
  try {
    await dbGuardarInmediato();
  } catch (err) {
    Object.assign(o, respaldo);
    mostrarToast('⚠️ No se pudo reprogramar: ' + err.message, 'error');
    return;
  }
  registrarLog('Reprogramar', 'OrdenServicio', `${o.numero} -> ${o.fechaProgramada || 'sin fecha'} (${o.estado})`);
  mostrarToast('✅ Orden reprogramada.', 'exito');
  cerrarModal('modalReprogramar');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
}

/* --- Calendario --- */
function cambiarMesCalendario(delta) {
  mesCalendarioActual.setMonth(mesCalendarioActual.getMonth() + delta);
  renderizarCalendario();
}

function renderizarCalendario() {
  const dow = document.getElementById('gridDiasSemana');
  const nombresDow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  dow.innerHTML = nombresDow.map(d => `<div class="calendar-dow">${d}</div>`).join('');

  const anio = mesCalendarioActual.getFullYear();
  const mes = mesCalendarioActual.getMonth();
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  document.getElementById('lblMesCalendario').innerText = `${nombresMes[mes]} ${anio}`;

  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  const diasEnMes = ultimoDia.getDate();
  const diaSemanaInicio = primerDia.getDay();

  const grid = document.getElementById('gridCalendario');
  grid.innerHTML = '';

  for (let i = 0; i < diaSemanaInicio; i++) { grid.innerHTML += `<div class="calendar-day otro-mes"></div>`; }

  const ordenesVisibles = ordenesVisiblesParaSesion();
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const ordenesDia = ordenesVisibles.filter(o => o.fechaProgramada === fechaStr);
    let chips = ordenesDia.map(o => {
      const claseEstado = o.estado === 'Finalizado' ? 'finalizado' : (o.estado === 'En Ejecución' ? 'ejecucion' : '');
      const arrastrable = esAdmin() ? `draggable="true" ondragstart="dragOrdenStart(event,${o.id})"` : '';
      return `<span class="calendar-chip ${claseEstado}" ${arrastrable} title="${o.numero} - ${nombreClienteOrden(o)}${o.esClienteNuevo ? ' (Cliente nuevo)' : ''}${o.horaProgramada ? ' - ' + o.horaProgramada : ''}" onclick="verDetalleOrden(${o.id})">${o.horaProgramada ? o.horaProgramada + ' ' : ''}${o.numero}</span>`;
    }).join('');
    const soltable = esAdmin() ? `ondragover="event.preventDefault()" ondrop="dropOrdenEnDia(event,'${fechaStr}')"` : '';
    grid.innerHTML += `<div class="calendar-day" ${soltable}><div class="num-dia">${dia}</div>${chips}</div>`;
  }
}

let ordenArrastradaId = null;
function dragOrdenStart(event, ordenId) { ordenArrastradaId = ordenId; event.dataTransfer.effectAllowed = 'move'; }

async function dropOrdenEnDia(event, fechaStr) {
  event.preventDefault();
  if (!ordenArrastradaId) return;
  const o = (db.ordenes || []).find(x => x.id === ordenArrastradaId);
  if (!o) return;
  if (o.tecnicoId) {
    const conflicto = (db.ordenes || []).find(x => x.id !== o.id && x.tecnicoId === o.tecnicoId && x.fechaProgramada === fechaStr);
    if (conflicto && !confirm(`El técnico ya tiene la orden ${conflicto.numero} programada ese día. ¿Reprogramar de todos modos?`)) { ordenArrastradaId = null; return; }
  }
  const fechaAnterior = o.fechaProgramada;
  o.fechaProgramada = fechaStr;
  try {
    await dbGuardarInmediato();
  } catch (err) {
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

/* --- Creación de nueva orden --- */
function abrirModalNuevaOrden() {
  document.getElementById('ordClienteBuscador').value = '';
  document.getElementById('ordCliente').value = '';
  document.getElementById('ordClienteNuevo').checked = false;
  document.getElementById('ordClienteNuevoNombre').value = '';
  document.getElementById('ordClienteNuevoDireccion').value = '';
  document.getElementById('ordNotas').value = '';
  cerrarListaClientesOrden();
  const selTec = document.getElementById('ordTecnico');
  selTec.innerHTML = (db.tecnicos || []).filter(t => t.activo !== false).map(t => `<option value="${t.id}">${t.nombre}</option>`).join('') || '<option value="">Sin técnicos activos</option>';
  document.getElementById('ordTipo').innerHTML = db.config.tiposServicio.map(t => `<option>${t}</option>`).join('');
  document.getElementById('ordPrioridad').innerHTML = db.config.prioridades.map(p => `<option>${p}</option>`).join('');
  document.getElementById('ordSinEquipo').checked = false;
  toggleOrdenClienteNuevo();
  poblarEquiposOrden();
  abrirModal('modalNuevaOrden');
}

function toggleOrdenClienteNuevo() {
  const esNuevo = document.getElementById('ordClienteNuevo').checked;
  document.getElementById('wrapperClienteNuevo').style.display = esNuevo ? 'block' : 'none';
  document.getElementById('wrapperClienteExistente').style.display = esNuevo ? 'none' : 'block';
  document.getElementById('lblOrdSinEquipo').style.display = esNuevo ? 'none' : 'flex';
  if (esNuevo) {
    document.getElementById('ordCliente').value = '';
    document.getElementById('ordClienteBuscador').value = '';
    document.getElementById('ordSinEquipo').checked = true;
  } else {
    document.getElementById('ordSinEquipo').checked = false;
  }
  toggleOrdenSinEquipo();
}

function filtrarClientesOrden() {
  const texto = document.getElementById('ordClienteBuscador').value.trim().toLowerCase();
  const cont = document.getElementById('ordClienteResultados');
  const resultados = [];
  (db.clientes || []).forEach(c => {
    if (!texto || c.nombre.toLowerCase().includes(texto)) {
      resultados.push({ cliente: c, motivo: null });
      return;
    }
    const todosLosEquipos = [];
    (c.sedes || []).forEach(s => (s.equipos || []).forEach(e => todosLosEquipos.push(e)));
    equiposSinSedeDe(c).forEach(e => todosLosEquipos.push(e));
    const equipoCoincide = todosLosEquipos.find(e =>
      `${e.nombre || ''} ${e.marca || ''} ${e.modelo || ''} ${e.serie || ''}`.toLowerCase().includes(texto)
    );
    if (equipoCoincide) resultados.push({ cliente: c, motivo: equipoCoincide.nombre });
  });
  if (!resultados.length) {
    cont.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted);">Sin resultados</div>';
  } else {
    cont.innerHTML = resultados.slice(0, 30).map(r => `
      <div class="autocomplete-item" onmousedown="seleccionarClienteOrden(${r.cliente.id})">
        ${r.cliente.nombre}
        ${r.motivo ? `<small>Coincide por el equipo: ${r.motivo}</small>` : ''}
      </div>`).join('');
  }
  cont.style.display = 'block';
}

function seleccionarClienteOrden(clienteId) {
  const c = buscarCliente(clienteId);
  if (!c) return;
  document.getElementById('ordClienteBuscador').value = c.nombre;
  document.getElementById('ordCliente').value = clienteId;
  cerrarListaClientesOrden();
  poblarEquiposOrden();
}

function cerrarListaClientesOrden() {
  document.getElementById('ordClienteResultados').style.display = 'none';
}

function toggleOrdenSinEquipo() {
  const sinEquipo = document.getElementById('ordSinEquipo').checked;
  document.getElementById('wrapperEquiposOrden').style.display = sinEquipo ? 'none' : 'block';
  document.getElementById('wrapperPlantillaGeneral').style.display = sinEquipo ? 'block' : 'none';
  if (sinEquipo) {
    const sel = document.getElementById('ordPlantillaGeneral');
    sel.innerHTML = '<option value="">Sin plantilla</option>' + (db.plantillas || []).map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  }
}

function poblarEquiposOrden() {
  const clienteId = parseInt(document.getElementById('ordCliente').value);
  const c = clienteId ? buscarCliente(clienteId) : null;
  const cont = document.getElementById('listaEquiposOrden');
  const opcionesPlantilla = (db.plantillas || []).map(p => `<option value="${p.id}">${p.nombre}</option>`).join('') || '<option value="">Sin plantillas</option>';
  const opcionesTipo = db.config.tiposServicio.map(t => `<option value="${t}">${t}</option>`).join('');
  if (!c) {
    cont.innerHTML = '<p class="empty-state" style="margin:0;">Selecciona primero un Cliente</p>';
    return;
  }
  let opciones = [];
  (c.sedes || []).forEach(s => (s.equipos || []).forEach(e => opciones.push({ id: e.id, sedeId: s.id, texto: `${e.nombre}${e.serie ? ' (' + e.serie + ')' : ''} — ${s.nombre}` })));
  equiposSinSedeDe(c).forEach(e => opciones.push({ id: e.id, sedeId: null, texto: `${e.nombre}${e.serie ? ' (' + e.serie + ')' : ''} — Sin sede` }));
  if (!opciones.length) {
    cont.innerHTML = '<p class="empty-state" style="margin:0;">Este cliente no tiene equipos registrados</p>';
    return;
  }
  cont.innerHTML = opciones.map(o => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--card-border);flex-wrap:wrap;">
      <input type="checkbox" class="chk-equipo-orden" data-equipo="${o.id}" data-sede="${o.sedeId !== null ? o.sedeId : ''}" style="width:auto;margin:0;">
      <span style="flex:1;min-width:140px;font-size:13px;">${o.texto}</span>
      <select class="sel-tipo-equipo" data-equipo="${o.id}" style="width:170px;flex-shrink:0;margin:0;" title="Tipo de mantenimiento para este equipo">${opcionesTipo}</select>
      <select class="sel-plantilla-equipo" data-equipo="${o.id}" style="width:190px;flex-shrink:0;margin:0;" title="Plantilla de formulario para este equipo">${opcionesPlantilla}</select>
    </div>`).join('');
}

async function guardarNuevaOrden() {
  const esClienteNuevo = document.getElementById('ordClienteNuevo').checked;
  const clienteId = esClienteNuevo ? null : parseInt(document.getElementById('ordCliente').value);
  const clienteNuevoNombre = esClienteNuevo ? document.getElementById('ordClienteNuevoNombre').value.trim() : null;
  const clienteNuevoDireccion = esClienteNuevo ? document.getElementById('ordClienteNuevoDireccion').value.trim() : null;
  if (esClienteNuevo) {
    if (!clienteNuevoNombre) { mostrarToast('Escribe el nombre del cliente nuevo.'); return; }
  } else if (!clienteId) {
    mostrarToast('Selecciona el Cliente.'); return;
  }
  const tecnicoId = parseInt(document.getElementById('ordTecnico').value);
  const tipo = document.getElementById('ordTipo').value;
  const prioridad = document.getElementById('ordPrioridad').value;
  const fechaProgramada = document.getElementById('ordFecha').value || null;
  const horaProgramada = document.getElementById('ordHora').value || null;
  const sinEquipo = document.getElementById('ordSinEquipo').checked;
  const notas = document.getElementById('ordNotas').value.trim() || null;

  db.ordenes = db.ordenes || [];

  if (sinEquipo) {
    const plantillaId = document.getElementById('ordPlantillaGeneral').value ? parseInt(document.getElementById('ordPlantillaGeneral').value) : null;
    const consecutivo = db.ordenes.length + 1;
    const nueva = {
      id: Date.now(), numero: `OS-2026-${String(consecutivo).padStart(4, '0')}`,
      clienteId, sedeId: null, equipoId: null, tecnicoId: tecnicoId || null,
      esClienteNuevo, clienteNuevoNombre, clienteNuevoDireccion,
      tipo, prioridad, plantillaId, notas,
      estado: 'Programado', fechaProgramada, horaProgramada, cierre: null
    };
    db.ordenes.push(nueva);
    registrarLog('Crear', 'OrdenServicio', esClienteNuevo ? `${nueva.numero} (cliente nuevo: ${clienteNuevoNombre})` : `${nueva.numero} (servicio general, sin equipo)`);
    try {
      await dbGuardarInmediato();
    } catch (err) {
      db.ordenes.pop();
      mostrarToast('⚠️ No se pudo crear la orden: ' + err.message, 'error');
      return;
    }
    cerrarModal('modalNuevaOrden');
    renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
    mostrarToast(`Orden ${nueva.numero} creada.`);
    return;
  }

  const filasSeleccionadas = Array.from(document.querySelectorAll('#listaEquiposOrden .chk-equipo-orden:checked'));
  if (filasSeleccionadas.length === 0) { mostrarToast('Selecciona al menos un equipo, o marca la opción de servicio general sin equipo.'); return; }
  let consecutivo = db.ordenes.length;
  const numerosCreados = [];
  const nuevasCreadas = [];
  filasSeleccionadas.forEach(chk => {
    const equipoId = parseInt(chk.dataset.equipo);
    const sedeId = chk.dataset.sede ? parseInt(chk.dataset.sede) : null;
    const selPlant = document.querySelector(`#listaEquiposOrden .sel-plantilla-equipo[data-equipo="${equipoId}"]`);
    const plantillaId = selPlant && selPlant.value ? parseInt(selPlant.value) : null;
    const selTipo = document.querySelector(`#listaEquiposOrden .sel-tipo-equipo[data-equipo="${equipoId}"]`);
    const tipoEquipo = selTipo && selTipo.value ? selTipo.value : tipo;
    consecutivo++;
    const nueva = {
      id: Date.now() + consecutivo, numero: `OS-2026-${String(consecutivo).padStart(4, '0')}`,
      clienteId, sedeId, equipoId, tecnicoId: tecnicoId || null,
      tipo: tipoEquipo, prioridad, plantillaId, notas,
      estado: 'Programado', fechaProgramada, horaProgramada, cierre: null
    };
    db.ordenes.push(nueva);
    nuevasCreadas.push(nueva);
    numerosCreados.push(nueva.numero);
    registrarLog('Crear', 'OrdenServicio', nueva.numero);
  });
  try {
    await dbGuardarInmediato();
  } catch (err) {
    nuevasCreadas.forEach(n => { const i = db.ordenes.indexOf(n); if (i > -1) db.ordenes.splice(i, 1); });
    mostrarToast('⚠️ No se pudieron crear las órdenes: ' + err.message, 'error');
    return;
  }
  cerrarModal('modalNuevaOrden');
  renderizarAgenda(); renderizarCalendario(); actualizarKPIs();
  if (numerosCreados.length > 1) mostrarToast(`Se crearon ${numerosCreados.length} órdenes de servicio: ${numerosCreados.join(', ')}`);
  else mostrarToast(`Orden ${numerosCreados[0]} creada.`);
}
