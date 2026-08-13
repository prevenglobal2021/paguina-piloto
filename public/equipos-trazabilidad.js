// ===== equipos-trazabilidad.js — extraído de prevenglobal__25_.html (líneas 2920-3056) =====
/* =========================================================
   EQUIPOS (VISTA GLOBAL)
========================================================= */
function renderizarEquiposGlobal(filtro){
  const tbody = document.getElementById('tablaEquiposGlobal');
  tbody.innerHTML = '';
  filtro = (filtro||'').toLowerCase();
  db.clientes.forEach(c=>{
    c.sedes.forEach(s=>s.equipos.forEach(e=>{
    const texto = `${e.nombre} ${e.serie||''} ${c.nombre} ${e.marca||''} ${e.modelo||''}`.toLowerCase();
    if(filtro && !texto.includes(filtro)) return;
    const numServicios = db.ordenes.filter(o=>o.equipoId===e.id).length;
    tbody.innerHTML += `<tr>
      <td><strong>${e.nombre}</strong><br><small style="color:var(--text-muted);">${e.marca||''} ${e.modelo||''}</small></td>
      <td>${c.nombre}<br><small style="color:var(--text-muted);">${s.nombre}</small></td>
      <td>${e.serie||'—'}</td>
      <td>${e.refrigerante||'—'}</td>
      <td>${numServicios}</td>
      <td>
        <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="irATrazabilidadEquipo(${e.id})">Historial</button>
        <button class="btn-custom btn-secondary-custom btn-sm-custom solo-admin" onclick="abrirModalEquipo(${e.id})">Editar</button>
        <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verEtiquetaQR(${e.id})"><i class="fas fa-qrcode"></i></button>
        <button class="btn-custom btn-danger-custom btn-sm-custom solo-admin" onclick="eliminarEquipoGlobal(${e.id})">Eliminar</button>
      </td>
    </tr>`;
    }));
    equiposSinSedeDe(c).forEach(e=>{
      const texto = `${e.nombre} ${e.serie||''} ${c.nombre} ${e.marca||''} ${e.modelo||''}`.toLowerCase();
      if(filtro && !texto.includes(filtro)) return;
      const numServicios = db.ordenes.filter(o=>o.equipoId===e.id).length;
      tbody.innerHTML += `<tr>
        <td><strong>${e.nombre}</strong><br><small style="color:var(--text-muted);">${e.marca||''} ${e.modelo||''}</small></td>
        <td>${c.nombre}<br><small style="color:var(--text-muted);">Sin sede</small></td>
        <td>${e.serie||'—'}</td>
        <td>${e.refrigerante||'—'}</td>
        <td>${numServicios}</td>
        <td>
          <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="irATrazabilidadEquipo(${e.id})">Historial</button>
          <button class="btn-custom btn-secondary-custom btn-sm-custom solo-admin" onclick="abrirModalEquipo(${e.id})">Editar</button>
          <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verEtiquetaQR(${e.id})"><i class="fas fa-qrcode"></i></button>
          <button class="btn-custom btn-danger-custom btn-sm-custom solo-admin" onclick="eliminarEquipoGlobal(${e.id})">Eliminar</button>
        </td>
      </tr>`;
    });
  });
  if(tbody.innerHTML==='') tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No se encontraron equipos.</td></tr>';
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
    ${(info.equipo.fotos&&info.equipo.fotos.length)?`<div class="fotos-grid" style="margin-top:8px;">${info.equipo.fotos.map(f=>`<img src="${f}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--card-border);">`).join('')}</div>`:''}
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

