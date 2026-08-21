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

function eliminarEquipoGlobal(equipoId){
  const info = ubicarEquipoPorId(equipoId);
  if(!info) return;
  const numServicios = db.ordenes.filter(o=>o.equipoId===equipoId).length;
  const mensaje = numServicios > 0
    ? `Este equipo tiene ${numServicios} orden(es) de servicio registrada(s). Si lo eliminas, esas órdenes quedarán sin la ficha del equipo (perderán el nombre, marca, modelo, etc. en su historial). ¿Eliminar de todas formas?`
    : '¿Eliminar este equipo?';
  if(!confirm(mensaje)) return;

  if(info.sede){
    info.sede.equipos = info.sede.equipos.filter(e=>e.id!==equipoId);
  } else {
    info.cliente.equiposSinSede = equiposSinSedeDe(info.cliente).filter(e=>e.id!==equipoId);
  }
  dbGuardar();
  registrarLog('Eliminar', 'Equipo', info.equipo.nombre);
  mostrarToast(`Equipo "${info.equipo.nombre}" eliminado.`);
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
  ficha.innerHTML = `<div class="panel" style="margin:0;background:rgba(0,0,0,.15);">
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

