// ===== config-plantillas-tecnicos.js — extraído de prevenglobal__25_.html (líneas 3600-3781) =====
/* =========================================================
   CONFIGURACIÓN: PLANTILLAS DE FORMULARIOS
========================================================= */
async function guardarPlantillaConfig(){
  const id = document.getElementById('cfgPlantId').value;
  const nombre = document.getElementById('cfgPlantNombre').value;
  if(!nombre){ mostrarToast('Escribe el nombre de la plantilla'); return; }
  let respaldo = null, esNueva = false;
  if(id){ const p = buscarPlantilla(parseInt(id)); respaldo = p.nombre; p.nombre = nombre; }
  else { esNueva = true; db.plantillas.push({ id:Date.now(), nombre, campos:[] }); }
  try{
    await dbGuardarInmediato();
  }catch(err){
    if(id && respaldo!==null){ buscarPlantilla(parseInt(id)).nombre = respaldo; }
    else if(esNueva){ db.plantillas.pop(); }
    mostrarToast('⚠️ No se pudo guardar la plantilla: ' + err.message, 'error');
    return;
  }
  mostrarToast('✅ Plantilla guardada.', 'exito');
  document.getElementById('cfgPlantId').value=''; document.getElementById('cfgPlantNombre').value='';
  renderizarPlantillasConfig();
}
function renderizarPlantillasConfig(){
  const tbody = document.getElementById('tablaConfigPlantillasBody');
  tbody.innerHTML = '';
  db.plantillas.forEach(p=>{
    tbody.innerHTML += `<tr><td>${p.nombre}</td><td>${p.campos.length}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="visualizarPlantilla(${p.id})"><i class="fas fa-eye"></i> Visualizar formulario</button>
      <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="editarPlantillaConfig(${p.id})">✏️ Editar</button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarPlantillaConfig(${p.id})">X</button></td></tr>`;
  });
}
function visualizarPlantilla(id){
  const p = buscarPlantilla(id);
  if(!p) return;
  const camposSimples = p.campos.filter(c=>c.tipo!=='checklist' && c.tipo!=='foto');
  const camposChecklist = p.campos.filter(c=>c.tipo==='checklist');
  const camposFoto = p.campos.filter(c=>c.tipo==='foto');

  const filasSimples = camposSimples.map(c=>{
    const tipoEtiqueta = NOMBRES_TIPO_CAMPO[c.tipo] || c.tipo;
    return `<tr><td style="width:45%;">${c.label} <span style="color:#94a3b8;font-size:10px;">(${tipoEtiqueta})</span></td><td style="color:#94a3b8;">_____________________</td></tr>`;
  }).join('');
  const boxSimples = filasSimples ? `<div class="pdf-box"><h4>Actividades realizadas y datos técnicos a completar</h4>
    <table class="pdf-tabla-datos" cellpadding="4">${filasSimples}</table></div>` : '';

  const boxesChecklist = camposChecklist.map(c=>{
    const itemsHtml = (c.items||[]).map(it=>`<div style="font-size:12px;">☐ ${it.texto}</div>`).join('')
      || '<p style="font-size:11px;color:#94a3b8;">(sin ítems configurados todavía)</p>';
    return `<div class="pdf-box"><h4>${c.label}</h4>${itemsHtml}</div>`;
  }).join('');

  const boxesFoto = camposFoto.map(c=>`
    <div class="pdf-box"><h4>${c.label}</h4>
      <p style="font-size:11px;color:#94a3b8;margin:0;">(Aquí se mostrarán las fotos que el técnico tome para este campo${c.bloqueImagenes ? `, agrupadas en bloques de ${c.bloqueImagenes}` : ''})</p>
    </div>`).join('');

  document.getElementById('vpContenidoFormulario').innerHTML = `
    <div class="pdf-header">
      <div><h2 style="color:#0088ff;margin:0;">${db.config.nombre}</h2><small>${db.config.subtitulo||''}</small></div>
      <div style="text-align:right;"><strong>Vista previa de formulario</strong><br><small>Plantilla: ${p.nombre}</small></div>
    </div>
    <div style="background:#f1f5f9;padding:15px;border-radius:6px;margin-bottom:20px;">
      <small style="color:#64748b;font-weight:bold;">ASÍ SE VERÁ EL INFORME IMPRESO</small>
      <p style="margin:4px 0 0 0;font-size:12px;color:#475569;">Las líneas en blanco son lo que el técnico completa al cerrar una orden real con esta plantilla.</p>
    </div>
    ${boxSimples}
    ${boxesChecklist}
    ${boxesFoto}
    ${(!boxSimples && !boxesChecklist && !boxesFoto) ? '<p class="empty-state">Esta plantilla todavía no tiene campos configurados.</p>' : ''}
  `;
  abrirModal('modalVistaPreviaFormulario');
}
async function eliminarPlantillaConfig(id){
  if(!confirm('¿Eliminar esta plantilla?')) return;
  const respaldo = db.plantillas.slice();
  db.plantillas = db.plantillas.filter(p=>p.id!==id);
  registrarEliminacion('plantillas', id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.plantillas = respaldo;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  mostrarToast('Plantilla eliminada.', 'exito');
  renderizarPlantillasConfig();
  document.getElementById('cfgSeccionCampos').style.display='none';
}
function seleccionarPlantillaConfig(id){
  plantillaActivaId = id;
  const p = buscarPlantilla(id);
  document.getElementById('cfgSeccionCampos').style.display='block';
  document.getElementById('cfgTituloCampos').innerText = `Campos de: ${p.nombre}`;
  cancelarEdicionCampo();
  renderizarCamposConfig();
}
function editarPlantillaConfig(id){
  const p = buscarPlantilla(id);
  if(!p) return;
  document.getElementById('cfgPlantId').value = p.id;
  document.getElementById('cfgPlantNombre').value = p.nombre;
  seleccionarPlantillaConfig(id);
}
function toggleCampoItemsInput(){
  const tipo = document.getElementById('cfgCampoTipo').value;
  document.getElementById('wrapperCampoItems').style.display = (tipo==='checklist') ? 'block' : 'none';
  document.getElementById('wrapperCampoBloqueImagenes').style.display = (tipo==='foto') ? 'block' : 'none';
}
const NOMBRES_TIPO_CAMPO = { number:'Numérico', text:'Texto corto', textarea:'Observación larga', checkbox:'Verificación (Sí/No)', checklist:'Lista de chequeo', foto:'Foto específica' };
async function guardarCampoConfig(){
  const idRaw = document.getElementById('cfgCampoId').value;
  const label = document.getElementById('cfgCampoLabel').value;
  const tipo = document.getElementById('cfgCampoTipo').value;
  if(!label){ mostrarToast('Escribe la etiqueta del campo'); return; }
  let items;
  if(tipo==='checklist'){
    const raw = document.getElementById('cfgCampoItems').value;
    items = raw.split(',').map(t=>t.trim()).filter(Boolean).map((texto,idx)=>({ id:`${Date.now()}_${idx}`, texto }));
    if(items.length===0){ mostrarToast('Escribe al menos un ítem para la lista de chequeo (separados por coma)'); return; }
  }
  const p = buscarPlantilla(plantillaActivaId);
  const bloqueImagenesRaw = document.getElementById('cfgCampoBloqueImagenes').value;
  const bloqueImagenes = (tipo==='foto' && bloqueImagenesRaw) ? parseInt(bloqueImagenesRaw) : null;
  const respaldoCampos = JSON.parse(JSON.stringify(p.campos));
  if(idRaw){
    const campo = p.campos.find(c=>c.id===parseInt(idRaw));
    if(campo){
      campo.label = label; campo.tipo = tipo;
      if(tipo==='checklist') campo.items = items; else delete campo.items;
      if(tipo==='foto') campo.bloqueImagenes = bloqueImagenes; else delete campo.bloqueImagenes;
    }
  } else {
    const nuevoCampo = { id:Date.now(), label, tipo };
    if(tipo==='checklist') nuevoCampo.items = items;
    if(tipo==='foto') nuevoCampo.bloqueImagenes = bloqueImagenes;
    p.campos.push(nuevoCampo);
  }
  try{
    await dbGuardarInmediato();
  }catch(err){
    p.campos = respaldoCampos;
    mostrarToast('⚠️ No se pudo guardar el campo: ' + err.message, 'error');
    return;
  }
  mostrarToast('✅ Campo guardado.', 'exito');
  cancelarEdicionCampo();
  renderizarCamposConfig(); renderizarPlantillasConfig();
}
function editarCampoConfig(campoId){
  const p = buscarPlantilla(plantillaActivaId);
  const campo = p.campos.find(c=>c.id===campoId);
  if(!campo) return;
  document.getElementById('cfgCampoId').value = campo.id;
  document.getElementById('cfgCampoLabel').value = campo.label;
  document.getElementById('cfgCampoTipo').value = campo.tipo;
  toggleCampoItemsInput();
  document.getElementById('cfgCampoItems').value = (campo.items||[]).map(it=>it.texto).join(', ');
  document.getElementById('cfgCampoBloqueImagenes').value = campo.bloqueImagenes || '';
  document.getElementById('btnGuardarCampo').innerText = 'Guardar Cambios';
  document.getElementById('btnCancelarEdicionCampo').style.display = 'inline-block';
}
function cancelarEdicionCampo(){
  document.getElementById('cfgCampoId').value = '';
  document.getElementById('cfgCampoLabel').value = '';
  document.getElementById('cfgCampoItems').value = '';
  document.getElementById('cfgCampoTipo').value = 'number';
  document.getElementById('cfgCampoBloqueImagenes').value = '';
  toggleCampoItemsInput();
  document.getElementById('btnGuardarCampo').innerText = '+ Agregar Campo';
  document.getElementById('btnCancelarEdicionCampo').style.display = 'none';
}
function renderizarCamposConfig(){
  const tbody = document.getElementById('tablaConfigCamposBody');
  tbody.innerHTML = '';
  const p = buscarPlantilla(plantillaActivaId);
  p.campos.forEach(campo=>{
    let descTipo = NOMBRES_TIPO_CAMPO[campo.tipo] || campo.tipo;
    if(campo.tipo==='checklist') descTipo += ` (${(campo.items||[]).length} ítems)`;
    if(campo.tipo==='foto') descTipo += campo.bloqueImagenes ? ` (bloques de ${campo.bloqueImagenes})` : ' (sin agrupar)';
    tbody.innerHTML += `<tr><td>${campo.label}</td><td>${descTipo}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="editarCampoConfig(${campo.id})">✏️ Editar</button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarCampoConfig(${campo.id})">X</button></td></tr>`;
  });
}
async function eliminarCampoConfig(id){
  const p = buscarPlantilla(plantillaActivaId);
  const respaldoCampos = p.campos.slice();
  p.campos = p.campos.filter(c=>c.id!==id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    p.campos = respaldoCampos;
    mostrarToast('⚠️ No se pudo eliminar el campo: ' + err.message, 'error');
    return;
  }
  cancelarEdicionCampo(); renderizarCamposConfig(); renderizarPlantillasConfig();
}

/* =========================================================
   CONFIGURACIÓN: PERSONAL (rol + permisos)
========================================================= */
function onCambiarRolPersonal(){
  // Solo una ayuda de conveniencia: al elegir "Administrativo" sugiere Acceso
  // total marcado (se puede desmarcar igual para dejarlo parcial); elegir
  // "Técnico" lo deja sin marcar por defecto. Nunca es obligatorio.
  const rol = document.getElementById('cfgTecRol').value;
  document.getElementById('cfgTecAccesoTotal').checked = (rol === 'administrativo');
  renderizarChecklistPermisosPersonal();
}
function renderizarChecklistPermisosPersonal(permisosActuales){
  const accesoTotal = document.getElementById('cfgTecAccesoTotal').checked;
  document.getElementById('wrapperPermisosPersonal').style.display = accesoTotal ? 'none' : 'block';
  if(accesoTotal) return;
  const marcados = permisosActuales || {};
  const grupos = {};
  CATALOGO_PERMISOS.forEach(p=>{ (grupos[p.grupo] = grupos[p.grupo] || []).push(p); });
  let html = '';
  Object.keys(grupos).forEach(nombreGrupo=>{
    html += `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:8px 0 4px;text-transform:uppercase;">${nombreGrupo}</div>`;
    html += grupos[nombreGrupo].map(p=>`
      <label style="display:flex;align-items:center;gap:8px;font-weight:normal;margin:0 0 6px 0;font-size:13px;">
        <input type="checkbox" class="chk-permiso-personal" value="${p.clave}" style="width:auto;" ${marcados[p.clave]?'checked':''}>
        ${p.etiqueta}
      </label>`).join('');
  });
  document.getElementById('checklistPermisosPersonal').innerHTML = html;
}
function leerPermisosMarcadosPersonal(){
  const permisos = {};
  document.querySelectorAll('.chk-permiso-personal').forEach(chk=>{ permisos[chk.value] = chk.checked; });
  return permisos;
}
async function guardarTecnicoConfig(){
  const id = document.getElementById('cfgTecId').value;
  const nombre = document.getElementById('cfgTecNombre').value.trim();
  const telefono = document.getElementById('cfgTecTelefono').value.trim();
  const usuario = document.getElementById('cfgTecUsuario').value.trim();
  const password = document.getElementById('cfgTecPassword').value;
  const rol = document.getElementById('cfgTecRol').value;
  const accesoTotal = document.getElementById('cfgTecAccesoTotal').checked;
  const permisos = accesoTotal ? {} : leerPermisosMarcadosPersonal();
  if(!nombre){ mostrarToast('Escribe el nombre de la persona'); return; }
  if(!usuario){ mostrarToast('Define un usuario (correo) para esta persona.'); return; }
  if(!id && !password){ mostrarToast('Define una contraseña para la persona nueva.'); return; }
  const duplicado = db.tecnicos.find(t=>t.usuario && t.usuario.toLowerCase()===usuario.toLowerCase() && String(t.id)!==id);
  if(duplicado){ mostrarToast('Ya existe otra persona con ese usuario.'); return; }
  // Antes esto guardaba en segundo plano sin esperar confirmación real del
  // servidor (mismo tipo de problema ya corregido en Nómina) — si algo
  // fallaba, la edición se perdía en silencio y parecía que "no editaba".
  let respaldo = null;
  let esNuevo = false;
  if(id){
    const t = buscarTecnico(parseInt(id));
    respaldo = Object.assign({}, t);
    t.nombre = nombre; t.telefono = telefono; t.usuario = usuario; t.rol = rol; t.accesoTotal = accesoTotal; t.permisos = permisos;
    if(password) t.password = password;
  } else {
    esNuevo = true;
    db.tecnicos.push({ id:Date.now(), nombre, telefono, usuario, password, activo:true, rol, accesoTotal, permisos });
  }
  try{
    await dbGuardarInmediato();
  }catch(err){
    if(id && respaldo){ Object.assign(buscarTecnico(parseInt(id)), respaldo); }
    else if(esNuevo){ db.tecnicos.pop(); }
    mostrarToast('⚠️ No se pudo guardar: ' + err.message, 'error');
    return;
  }
  registrarLog(id ? 'Editar' : 'Crear', 'Personal', nombre);
  mostrarToast(id ? `✅ ${nombre} actualizado correctamente.` : `✅ ${nombre} agregado a Personal.`, 'exito');
  cancelarEdicionTecnico();
  renderizarTecnicosConfig();
}
function editarTecnicoConfig(id){
  const t = buscarTecnico(id);
  if(!t) return;
  document.getElementById('cfgTecId').value = t.id;
  document.getElementById('cfgTecNombre').value = t.nombre;
  document.getElementById('cfgTecTelefono').value = t.telefono||'';
  document.getElementById('cfgTecUsuario').value = t.usuario||'';
  document.getElementById('cfgTecPassword').value = '';
  document.getElementById('cfgTecPassword').placeholder = 'Dejar en blanco para no cambiarla';
  document.getElementById('cfgTecRol').value = t.rol || 'tecnico';
  document.getElementById('cfgTecAccesoTotal').checked = !!t.accesoTotal;
  renderizarChecklistPermisosPersonal(t.permisos);
  document.getElementById('btnGuardarTecnico').innerText = 'Guardar Cambios';
  document.getElementById('btnCancelarEdicionTecnico').style.display = 'inline-block';
}
function cancelarEdicionTecnico(){
  document.getElementById('cfgTecId').value = '';
  document.getElementById('cfgTecNombre').value=''; document.getElementById('cfgTecTelefono').value='';
  document.getElementById('cfgTecUsuario').value=''; document.getElementById('cfgTecPassword').value='';
  document.getElementById('cfgTecPassword').placeholder = 'Contraseña';
  document.getElementById('cfgTecRol').value = 'tecnico';
  document.getElementById('cfgTecAccesoTotal').checked = false;
  renderizarChecklistPermisosPersonal();
  document.getElementById('btnGuardarTecnico').innerText = '+ Añadir Personal';
  document.getElementById('btnCancelarEdicionTecnico').style.display = 'none';
}
function renderizarTecnicosConfig(){
  const tbody = document.getElementById('tablaConfigTecnicosBody');
  tbody.innerHTML = '';
  db.tecnicos.forEach(t=>{
    const activo = t.activo !== false;
    const etiquetaRol = t.rol==='administrativo' ? 'Administrativo' : 'Técnico';
    const resumenAcceso = t.accesoTotal ? '<span style="color:#22c55e;">Acceso total</span>' : `${Object.values(t.permisos||{}).filter(Boolean).length} permiso(s)`;
    tbody.innerHTML += `<tr style="${activo?'':'opacity:.55;'}"><td>${t.nombre} ${activo?'<span style="color:var(--exito-verde,#22c55e);font-size:10px;font-weight:700;">● ACTIVO</span>':'<span style="color:var(--text-muted);font-size:10px;font-weight:700;">● INACTIVO</span>'}</td>
      <td>${etiquetaRol}<br><small style="color:var(--text-muted);">${resumenAcceso}</small></td>
      <td>${t.telefono||''}</td><td>${t.usuario||'—'}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="cambiarPasswordTecnico(${t.id})">Cambiar</button></td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="editarTecnicoConfig(${t.id})">Editar</button>
      <button class="btn-custom ${activo?'btn-secondary-custom':''} btn-sm-custom" onclick="toggleActivoTecnico(${t.id})">${activo?'⏸️ Desactivar':'▶️ Activar'}</button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarTecnicoConfig(${t.id})">X</button></td></tr>`;
  });
}
function toggleActivoTecnico(id){
  const t = buscarTecnico(id);
  if(!t) return;
  t.activo = t.activo === false ? true : false;
  dbGuardarInmediato();
  registrarLog(t.activo ? 'Activar' : 'Desactivar', 'Técnico', t.nombre);
  renderizarTecnicosConfig();
}

