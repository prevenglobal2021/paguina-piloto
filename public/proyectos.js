/* =========================================================
   PROYECTOS — trabajos de varios días/semanas/meses, con
   trazabilidad de avance por cortes (diarios, semanales o
   quincenales, a elección de cada proyecto), separados de las
   Órdenes de Servicio (pensadas para una sola visita).

   El % de avance se calcula de 2 formas, según lo que se
   defina en cada proyecto:
   - Si tiene HITOS definidos: se suma el peso de los que están
     marcados como completados (se normaliza sobre 100).
   - Si NO tiene hitos: se usa el % escrito a mano en el último
     corte de avance registrado.
========================================================= */

function buscarProyecto(id){ return (db.proyectos||[]).find(p=>p.id===id); }

function calcularAvanceProyecto(p){
  if(p.hitos && p.hitos.length){
    const pesoTotal = p.hitos.reduce((a,h)=>a+(h.peso||0), 0) || 1;
    const pesoHecho = p.hitos.filter(h=>h.completado).reduce((a,h)=>a+(h.peso||0), 0);
    return Math.round((pesoHecho / pesoTotal) * 100);
  }
  const cortes = (p.cortes||[]).slice().sort((a,b)=> new Date(a.fecha) - new Date(b.fecha));
  return cortes.length ? (cortes[cortes.length-1].porcentaje || 0) : 0;
}

// Compara el avance real contra lo que "debería" llevar el proyecto según
// el tiempo ya transcurrido de su cronograma — para saber de un vistazo
// si va adelantado o atrasado.
function calcularAvanceEsperado(p){
  if(!p.fechaInicioEstimada || !p.fechaFinEstimada) return null;
  const inicio = new Date(p.fechaInicioEstimada+'T00:00:00');
  const fin = new Date(p.fechaFinEstimada+'T00:00:00');
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const totalDias = Math.max(1, Math.round((fin-inicio)/86400000));
  const diasTranscurridos = Math.min(totalDias, Math.max(0, Math.round((hoy-inicio)/86400000)));
  return Math.round((diasTranscurridos/totalDias)*100);
}

function badgeEstadoProyecto(estado){
  const colores = {
    'Planificado': '#64748b', 'En ejecución': '#0088ff', 'Pausado': '#f59e0b',
    'Finalizado': 'var(--green-success)', 'Cancelado': 'var(--red-alert)'
  };
  const c = colores[estado] || '#64748b';
  return `<span style="background:${c}22;color:${c};font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;">${estado}</span>`;
}

function renderizarProyectos(){
  const cont = document.getElementById('listaProyectos');
  if(!cont) return;
  const buscador = (document.getElementById('buscarProyecto').value||'').toLowerCase().trim();
  const proyectos = (db.proyectos||[]).filter(p=>{
    if(!buscador) return true;
    const cliente = buscarCliente(p.clienteId);
    return (p.nombre||'').toLowerCase().includes(buscador) || (cliente && cliente.nombre.toLowerCase().includes(buscador));
  }).sort((a,b)=> new Date(b.creadoEn||0) - new Date(a.creadoEn||0));

  if(!proyectos.length){ cont.innerHTML = '<p class="empty-state">No hay proyectos registrados todavía.</p>'; return; }

  cont.innerHTML = proyectos.map(p=>{
    const cliente = buscarCliente(p.clienteId);
    const avance = calcularAvanceProyecto(p);
    const esperado = calcularAvanceEsperado(p);
    let colorBarra = 'var(--blue-accent)';
    if(esperado!=null){
      if(avance < esperado - 10) colorBarra = 'var(--red-alert)';
      else if(avance >= esperado) colorBarra = 'var(--green-success)';
    }
    return `<div class="panel" style="cursor:pointer;margin-bottom:0;" onclick="abrirDetalleProyecto(${p.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <strong style="font-size:14px;">${p.nombre}</strong>
        ${badgeEstadoProyecto(p.estado)}
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:4px 0 10px;">${cliente ? cliente.nombre : 'Sin cliente asignado'}</p>
      <div style="background:var(--card-border);border-radius:20px;height:8px;overflow:hidden;">
        <div style="width:${avance}%;background:${colorBarra};height:100%;transition:width .3s ease;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:5px;">
        <span>${avance}% avanzado</span>
        <span>${(p.tecnicosAsignados||[]).length} técnico(s)</span>
      </div>
    </div>`;
  }).join('');
}

/* --------------------- Crear / editar proyecto --------------------- */
let hitosProyectoTemp = [];

function abrirModalProyecto(id){
  document.getElementById('proyectoId').value = id || '';
  document.getElementById('tituloModalProyecto').innerText = id ? '✎ Editar Proyecto' : '➕ Nuevo Proyecto';
  cargarClientesSelectProyecto();
  const p = id ? buscarProyecto(id) : null;

  document.getElementById('proyectoNombre').value = p ? p.nombre : '';
  document.getElementById('proyectoDescripcion').value = p ? (p.descripcion||'') : '';
  document.getElementById('proyectoFechaInicio').value = p ? (p.fechaInicioEstimada||'') : '';
  document.getElementById('proyectoFechaFin').value = p ? (p.fechaFinEstimada||'') : '';
  document.getElementById('proyectoEstado').value = p ? p.estado : 'Planificado';
  document.getElementById('proyectoCliente').value = p ? (p.clienteId||'') : '';
  cargarSedesProyecto();
  if(p) document.getElementById('proyectoSede').value = p.sedeId || '';

  hitosProyectoTemp = p ? JSON.parse(JSON.stringify(p.hitos||[])) : [];
  renderizarHitosProyecto();
  renderizarChecklistTecnicosProyecto(p ? (p.tecnicosAsignados||[]) : []);

  abrirModal('modalProyecto');
}

function cargarClientesSelectProyecto(){
  const sel = document.getElementById('proyectoCliente');
  sel.innerHTML = '<option value="">Selecciona un cliente...</option>' +
    db.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');
}
function cargarSedesProyecto(){
  const clienteId = parseInt(document.getElementById('proyectoCliente').value);
  const sel = document.getElementById('proyectoSede');
  const cliente = buscarCliente(clienteId);
  sel.innerHTML = '<option value="">Sin sede específica</option>' +
    (cliente ? cliente.sedes.map(s=>`<option value="${s.id}">${s.nombre}</option>`).join('') : '');
}

function renderizarChecklistTecnicosProyecto(seleccionados){
  const cont = document.getElementById('checklistTecnicosProyecto');
  if(!db.tecnicos.length){ cont.innerHTML = '<p class="empty-state">No hay personal registrado todavía.</p>'; return; }
  cont.innerHTML = db.tecnicos.filter(t=>t.activo!==false).map(t=>`
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-weight:400;">
      <input type="checkbox" class="chk-tecnico-proyecto" value="${t.id}" style="width:auto;" ${seleccionados.includes(t.id)?'checked':''}>
      ${t.nombre}
    </label>
  `).join('');
}
function leerTecnicosMarcados(selectorClase){
  return Array.from(document.querySelectorAll('.'+selectorClase+':checked')).map(chk=>parseInt(chk.value));
}

function renderizarHitosProyecto(){
  const cont = document.getElementById('listaHitosProyecto');
  if(!hitosProyectoTemp.length){ cont.innerHTML = ''; return; }
  cont.innerHTML = hitosProyectoTemp.map((h,idx)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-dark);border-radius:6px;margin-bottom:5px;font-size:12px;">
      <span>${h.nombre} <span style="color:var(--text-muted);">(${h.peso}%)</span></span>
      <button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarHitoProyecto(${idx})">✖</button>
    </div>
  `).join('');
}
function agregarHitoProyecto(){
  const nombre = document.getElementById('nuevoHitoNombre').value.trim();
  const peso = parseInt(document.getElementById('nuevoHitoPeso').value);
  if(!nombre){ mostrarToast('Escribe el nombre del hito.'); return; }
  if(!peso || peso<1 || peso>100){ mostrarToast('El peso debe ser un número entre 1 y 100.'); return; }
  hitosProyectoTemp.push({ id:Date.now(), nombre, peso, completado:false });
  document.getElementById('nuevoHitoNombre').value = '';
  document.getElementById('nuevoHitoPeso').value = '';
  renderizarHitosProyecto();
}
function quitarHitoProyecto(idx){ hitosProyectoTemp.splice(idx,1); renderizarHitosProyecto(); }

async function guardarProyecto(){
  const id = document.getElementById('proyectoId').value;
  const nombre = document.getElementById('proyectoNombre').value.trim();
  if(!nombre){ mostrarToast('El nombre del proyecto es obligatorio.'); return; }
  const clienteId = parseInt(document.getElementById('proyectoCliente').value) || null;
  const sedeId = parseInt(document.getElementById('proyectoSede').value) || null;
  const datos = {
    nombre,
    descripcion: document.getElementById('proyectoDescripcion').value.trim(),
    clienteId, sedeId,
    fechaInicioEstimada: document.getElementById('proyectoFechaInicio').value || null,
    fechaFinEstimada: document.getElementById('proyectoFechaFin').value || null,
    estado: document.getElementById('proyectoEstado').value,
    tecnicosAsignados: leerTecnicosMarcados('chk-tecnico-proyecto'),
    hitos: hitosProyectoTemp,
  };
  if(id){
    Object.assign(buscarProyecto(parseInt(id)), datos, { actualizadoEn: new Date().toISOString() });
  } else {
    if(!Array.isArray(db.proyectos)) db.proyectos = [];
    db.proyectos.push(Object.assign({ id:Date.now(), cortes:[], creadoEn:new Date().toISOString() }, datos));
  }
  await dbGuardarInmediato();
  registrarLog(id?'Editar':'Crear', 'Proyecto', nombre);
  mostrarToast(id ? '✅ Proyecto actualizado.' : '✅ Proyecto creado.', 'exito');
  cerrarModal('modalProyecto');
  renderizarProyectos();
}

/* --------------------- Detalle del proyecto --------------------- */
let proyectoDetalleActualId = null;

function abrirDetalleProyecto(id){
  proyectoDetalleActualId = id;
  renderizarDetalleProyecto();
  abrirModal('modalDetalleProyecto');
}

function renderizarDetalleProyecto(){
  const p = buscarProyecto(proyectoDetalleActualId);
  const cont = document.getElementById('contenidoDetalleProyecto');
  if(!p){ cont.innerHTML = '<p class="empty-state">Este proyecto ya no existe.</p>'; return; }

  const cliente = buscarCliente(p.clienteId);
  const avance = calcularAvanceProyecto(p);
  const esperado = calcularAvanceEsperado(p);
  const cortes = (p.cortes||[]).slice().sort((a,b)=> new Date(b.fecha) - new Date(a.fecha));
  const diasUnicos = new Set(cortes.map(c=>c.fecha)).size;
  let totalDias = null;
  if(p.fechaInicioEstimada && p.fechaFinEstimada){
    totalDias = Math.max(1, Math.round((new Date(p.fechaFinEstimada) - new Date(p.fechaInicioEstimada))/86400000));
  }

  const bloqueHitos = p.hitos && p.hitos.length ? `
    <div class="seccion-form-cliente">
      <div class="seccion-form-cliente-titulo"><i class="fas fa-list-check"></i> Hitos / fases</div>
      ${p.hitos.map(h=>`
        <label style="display:flex;align-items:center;gap:8px;padding:5px 0;font-weight:400;font-size:13px;">
          <input type="checkbox" style="width:auto;" ${h.completado?'checked':''} onchange="toggleHitoCompletado(${p.id},${h.id})">
          <span style="${h.completado?'text-decoration:line-through;color:var(--text-muted);':''}">${h.nombre} (${h.peso}%)</span>
        </label>
      `).join('')}
    </div>` : '';

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
      <div>
        <h3 style="margin:0 0 4px;">${p.nombre}</h3>
        <p style="font-size:12px;color:var(--text-muted);margin:0;">${cliente ? cliente.nombre : 'Sin cliente'} ${p.fechaInicioEstimada?(' · '+formatoFechaCorta(p.fechaInicioEstimada)+' → '+formatoFechaCorta(p.fechaFinEstimada)):''}</p>
      </div>
      <div style="display:flex;gap:6px;">
        ${badgeEstadoProyecto(p.estado)}
        <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="cerrarModal('modalDetalleProyecto');abrirModalProyecto(${p.id});">✎ Editar</button>
      </div>
    </div>
    ${p.descripcion ? `<p style="font-size:13px;margin:10px 0;">${p.descripcion}</p>` : ''}

    <div class="kpi-cards-grid" style="grid-auto-rows:80px;margin-top:14px;">
      <div class="kpi-card"><div class="kpi-card-valor">${avance}%</div><div class="kpi-card-label">Avance real</div></div>
      <div class="kpi-card"><div class="kpi-card-valor">${esperado!=null?esperado+'%':'—'}</div><div class="kpi-card-label">Avance esperado (cronograma)</div></div>
      <div class="kpi-card"><div class="kpi-card-valor">${diasUnicos}${totalDias?'/'+totalDias:''}</div><div class="kpi-card-label">Días con corte registrado</div></div>
      <div class="kpi-card"><div class="kpi-card-valor">${cortes.length}</div><div class="kpi-card-label">Cortes de avance</div></div>
    </div>
    ${esperado!=null && avance < esperado - 10 ? `<p style="font-size:12px;color:var(--red-alert);margin-top:8px;"><i class="fas fa-triangle-exclamation"></i> Este proyecto va atrasado respecto a su cronograma.</p>` : ''}

    ${bloqueHitos}

    <div class="seccion-form-cliente">
      <div class="seccion-form-cliente-titulo" style="display:flex;justify-content:space-between;align-items:center;">
        <span><i class="fas fa-timeline"></i> Cortes de avance</span>
        <button class="btn-custom btn-sm-custom" onclick="abrirModalCorteProyecto(${p.id})">+ Nuevo corte</button>
      </div>
      ${cortes.length ? cortes.map(c=>`
        <div style="border-left:3px solid var(--blue-accent);padding:8px 12px;margin-bottom:10px;background:var(--bg-dark);border-radius:0 8px 8px 0;">
          <div style="display:flex;justify-content:space-between;font-size:12px;"><strong>${formatoFechaCorta(c.fecha)}</strong><span>${c.porcentaje}% en ese momento</span></div>
          <p style="font-size:13px;margin:6px 0;">${c.descripcion||''}</p>
          ${c.novedades ? `<p style="font-size:12px;color:var(--orange-warning);margin:4px 0;"><i class="fas fa-triangle-exclamation"></i> ${c.novedades}</p>` : ''}
          ${(c.tecnicosPresentes||[]).length ? `<p style="font-size:11px;color:var(--text-muted);margin:4px 0;">👥 ${c.tecnicosPresentes.map(id=>{const t=buscarTecnico(id);return t?t.nombre:'';}).filter(Boolean).join(', ')}</p>` : ''}
          ${(c.fotos||[]).length ? `<div class="galeria-fotos" style="margin-top:6px;">${c.fotos.map(f=>`<img src="${f.src}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;">`).join('')}</div>` : ''}
        </div>
      `).join('') : '<p class="empty-state">Todavía no hay cortes de avance registrados.</p>'}
    </div>
  `;
}

function formatoFechaCorta(f){
  if(!f) return '';
  const d = new Date(f+'T00:00:00');
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}

async function toggleHitoCompletado(proyectoId, hitoId){
  const p = buscarProyecto(proyectoId);
  const h = p.hitos.find(x=>x.id===hitoId);
  h.completado = !h.completado;
  await dbGuardarInmediato();
  renderizarDetalleProyecto();
  renderizarProyectos();
}

/* --------------------- Registrar corte de avance --------------------- */
let fotosCorteProyectoTemp = [];

function abrirModalCorteProyecto(proyectoId){
  const p = buscarProyecto(proyectoId);
  document.getElementById('corteProyectoId').value = proyectoId;
  document.getElementById('corteFecha').value = new Date().toISOString().slice(0,10);
  document.getElementById('cortePorcentaje').value = '';
  document.getElementById('corteDescripcion').value = '';
  document.getElementById('corteNovedades').value = '';
  fotosCorteProyectoTemp = [];
  renderizarFotosCorteProyectoPreview();

  // Si el proyecto tiene hitos, el % se calcula solo (con lo que marques
  // en la pantalla de detalle) — no se pide a mano en el corte.
  document.getElementById('bloqueCortePorcentaje').style.display = (p.hitos && p.hitos.length) ? 'none' : 'block';

  const cont = document.getElementById('checklistTecnicosCorte');
  cont.innerHTML = (p.tecnicosAsignados||[]).map(id=>{
    const t = buscarTecnico(id);
    return t ? `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-weight:400;">
      <input type="checkbox" class="chk-tecnico-corte" value="${t.id}" style="width:auto;" checked> ${t.nombre}
    </label>` : '';
  }).join('') || '<p class="empty-state">Este proyecto no tiene técnicos asignados todavía.</p>';

  abrirModal('modalCorteProyecto');
}

function manejarFotoCorteProyecto(event){
  const files = Array.from(event.target.files);
  if(!files.length) return;
  files.forEach(file=>{
    comprimirImagen(file).then(dataUrl=>{ fotosCorteProyectoTemp.push({ src:dataUrl, desc:'' }); renderizarFotosCorteProyectoPreview(); });
  });
  event.target.value = '';
}
function renderizarFotosCorteProyectoPreview(){
  renderizarGaleriaFotos('previewFotosCorteProyecto', fotosCorteProyectoTemp, 'proyectoCorte');
}

async function guardarCorteProyecto(){
  const proyectoId = parseInt(document.getElementById('corteProyectoId').value);
  const p = buscarProyecto(proyectoId);
  if(!p) return;
  const fecha = document.getElementById('corteFecha').value;
  if(!fecha){ mostrarToast('Selecciona la fecha del corte.'); return; }
  const descripcion = document.getElementById('corteDescripcion').value.trim();
  if(!descripcion){ mostrarToast('Describe qué se avanzó en este corte.'); return; }

  let porcentaje;
  if(p.hitos && p.hitos.length){
    porcentaje = calcularAvanceProyecto(p); // se toma el que ya dan los hitos marcados
  } else {
    porcentaje = parseInt(document.getElementById('cortePorcentaje').value);
    if(isNaN(porcentaje) || porcentaje<0 || porcentaje>100){ mostrarToast('Escribe un % de avance válido (0 a 100).'); return; }
  }

  if(!Array.isArray(p.cortes)) p.cortes = [];
  p.cortes.push({
    id: Date.now(),
    fecha, porcentaje,
    descripcion,
    novedades: document.getElementById('corteNovedades').value.trim(),
    tecnicosPresentes: leerTecnicosMarcados('chk-tecnico-corte'),
    fotos: fotosCorteProyectoTemp.slice(),
    reportadoPor: (typeof sesionServidor!=='undefined' && sesionServidor) ? sesionServidor.rol : 'admin',
  });

  await dbGuardarInmediato();
  registrarLog('Registrar corte de avance', 'Proyecto', p.nombre);
  mostrarToast('✅ Corte de avance guardado.', 'exito');
  cerrarModal('modalCorteProyecto');
  renderizarDetalleProyecto();
  renderizarProyectos();
}
