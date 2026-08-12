// ===== config-plantillas-tecnicos.js — extraído de prevenglobal__25_.html (líneas 3600-3781) =====
/* =========================================================
   CONFIGURACIÓN: PLANTILLAS DE FORMULARIOS
========================================================= */
function guardarPlantillaConfig(){
  const id = document.getElementById('cfgPlantId').value;
  const nombre = document.getElementById('cfgPlantNombre').value;
  if(!nombre){ mostrarToast('Escribe el nombre de la plantilla'); return; }
  if(id){ const p = buscarPlantilla(parseInt(id)); p.nombre = nombre; }
  else db.plantillas.push({ id:Date.now(), nombre, campos:[] });
  dbGuardar();
  document.getElementById('cfgPlantId').value=''; document.getElementById('cfgPlantNombre').value='';
  renderizarPlantillasConfig();
}
function renderizarPlantillasConfig(){
  const tbody = document.getElementById('tablaConfigPlantillasBody');
  tbody.innerHTML = '';
  db.plantillas.forEach(p=>{
    tbody.innerHTML += `<tr><td>${p.nombre}</td><td>${p.campos.length}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="editarPlantillaConfig(${p.id})">✏️ Editar</button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarPlantillaConfig(${p.id})">X</button></td></tr>`;
  });
}
function eliminarPlantillaConfig(id){
  if(!confirm('¿Eliminar esta plantilla?')) return;
  db.plantillas = db.plantillas.filter(p=>p.id!==id);
  dbGuardar(); renderizarPlantillasConfig();
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
}
const NOMBRES_TIPO_CAMPO = { number:'Numérico', text:'Texto corto', textarea:'Observación larga', checkbox:'Verificación (Sí/No)', checklist:'Lista de chequeo', foto:'Foto específica' };
function guardarCampoConfig(){
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
  if(idRaw){
    const campo = p.campos.find(c=>c.id===parseInt(idRaw));
    if(campo){
      campo.label = label; campo.tipo = tipo;
      if(tipo==='checklist') campo.items = items; else delete campo.items;
    }
  } else {
    const nuevoCampo = { id:Date.now(), label, tipo };
    if(tipo==='checklist') nuevoCampo.items = items;
    p.campos.push(nuevoCampo);
  }
  dbGuardar();
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
  document.getElementById('btnGuardarCampo').innerText = 'Guardar Cambios';
  document.getElementById('btnCancelarEdicionCampo').style.display = 'inline-block';
}
function cancelarEdicionCampo(){
  document.getElementById('cfgCampoId').value = '';
  document.getElementById('cfgCampoLabel').value = '';
  document.getElementById('cfgCampoItems').value = '';
  document.getElementById('cfgCampoTipo').value = 'number';
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
    tbody.innerHTML += `<tr><td>${campo.label}</td><td>${descTipo}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="editarCampoConfig(${campo.id})">✏️ Editar</button>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarCampoConfig(${campo.id})">X</button></td></tr>`;
  });
}
function eliminarCampoConfig(id){
  const p = buscarPlantilla(plantillaActivaId);
  p.campos = p.campos.filter(c=>c.id!==id);
  dbGuardar(); cancelarEdicionCampo(); renderizarCamposConfig(); renderizarPlantillasConfig();
}

/* =========================================================
   CONFIGURACIÓN: TÉCNICOS
========================================================= */
function guardarTecnicoConfig(){
  const id = document.getElementById('cfgTecId').value;
  const nombre = document.getElementById('cfgTecNombre').value.trim();
  const telefono = document.getElementById('cfgTecTelefono').value.trim();
  const usuario = document.getElementById('cfgTecUsuario').value.trim();
  const password = document.getElementById('cfgTecPassword').value;
  if(!nombre){ mostrarToast('Escribe el nombre del técnico'); return; }
  if(!usuario){ mostrarToast('Define un usuario (correo) para el técnico.'); return; }
  if(!id && !password){ mostrarToast('Define una contraseña para el técnico nuevo.'); return; }
  const duplicado = db.tecnicos.find(t=>t.usuario && t.usuario.toLowerCase()===usuario.toLowerCase() && String(t.id)!==id);
  if(duplicado){ mostrarToast('Ya existe otro técnico con ese usuario.'); return; }
  if(id){
    const t = buscarTecnico(parseInt(id));
    t.nombre = nombre; t.telefono = telefono; t.usuario = usuario;
    if(password) t.password = password;
    registrarLog('Editar', 'Técnico', nombre);
  } else {
    db.tecnicos.push({ id:Date.now(), nombre, telefono, usuario, password, activo:true });
    registrarLog('Crear', 'Técnico', nombre);
  }
  dbGuardar();
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
  document.getElementById('btnGuardarTecnico').innerText = 'Guardar Cambios';
  document.getElementById('btnCancelarEdicionTecnico').style.display = 'inline-block';
}
function cancelarEdicionTecnico(){
  document.getElementById('cfgTecId').value = '';
  document.getElementById('cfgTecNombre').value=''; document.getElementById('cfgTecTelefono').value='';
  document.getElementById('cfgTecUsuario').value=''; document.getElementById('cfgTecPassword').value='';
  document.getElementById('cfgTecPassword').placeholder = 'Contraseña';
  document.getElementById('btnGuardarTecnico').innerText = '+ Añadir Técnico';
  document.getElementById('btnCancelarEdicionTecnico').style.display = 'none';
}
function renderizarTecnicosConfig(){
  const tbody = document.getElementById('tablaConfigTecnicosBody');
  tbody.innerHTML = '';
  db.tecnicos.forEach(t=>{
    const activo = t.activo !== false;
    tbody.innerHTML += `<tr style="${activo?'':'opacity:.55;'}"><td>${t.nombre} ${activo?'<span style="color:var(--exito-verde,#22c55e);font-size:10px;font-weight:700;">● ACTIVO</span>':'<span style="color:var(--text-muted);font-size:10px;font-weight:700;">● INACTIVO</span>'}</td><td>${t.telefono||''}</td><td>${t.usuario||'—'}</td>
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

