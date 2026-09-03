// ===== config-general.js — extraído de prevenglobal__25_.html =====
/* =========================================================
   CONFIGURACIÓN: EMPRESA Y PERFIL (logo, dirección, misión, visión)
========================================================= */
function actualizarPreviewLoginMini(){
  const c1 = document.getElementById('cfgLoginColor1').value || '#7c3aed';
  const c2 = document.getElementById('cfgLoginColor2').value || '#4c1d95';
  const mini = document.getElementById('previewLoginMini');
  mini.style.setProperty('--preview-login-color-1', c1);
  mini.style.setProperty('--preview-login-color-2', c2);
  document.getElementById('previewLoginMiniTitulo').innerText = document.getElementById('cfgLoginTituloIzquierda').value || 'Domina el sistema';
  document.getElementById('previewLoginMiniSubtitulo').innerText = document.getElementById('cfgLoginSubtituloIzquierda').value || 'Controla clientes, equipos, órdenes de servicio e inventario desde un solo lugar.';
  document.getElementById('previewLoginMiniBienvenida').innerText = document.getElementById('cfgLoginBienvenidaTitulo').value || '¡Bienvenido!';
  document.getElementById('previewLoginMiniSubBienvenida').innerText = document.getElementById('cfgLoginBienvenidaSubtitulo').value || 'Por favor inicia sesión';
  document.getElementById('previewLoginMiniIzq').style.backgroundImage = loginImagenTempBase64 ? `url('${loginImagenTempBase64}')` : 'none';
}
let loginImagenTempBase64 = null;
function manejarLoginImagenUpload(event){
  const file = event.target.files[0];
  if(!file) return;
  const estadoEl = document.getElementById('loginImagenEstado');
  const inputEl = document.getElementById('cfgLoginImagenInput');
  const cargandoEl = document.getElementById('loginImagenCargando');
  const btnGuardar = document.getElementById('btnGuardarAparienciaLogin');
  if(file.size > 10*1024*1024){
    estadoEl.innerText = '⚠️ Esa imagen pesa más de 10MB. Elige una más liviana.';
    estadoEl.style.color = 'var(--red-alert)';
    event.target.value = '';
    return;
  }
  estadoEl.innerText = '';
  cargandoEl.style.display = 'flex';
  inputEl.disabled = true;
  if(btnGuardar) btnGuardar.disabled = true;
  const reader = new FileReader();
  reader.onload = e=>{
    fetch(API_BASE + '/api/imagenes/login-fondo', {
      method: 'POST',
      headers: headersAutenticados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ imagenBase64: e.target.result })
    }).then(async r=>{
      const data = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error || 'No se pudo procesar la imagen.');
      return data;
    }).then(data=>{
      loginImagenTempBase64 = data.imagen;
      actualizarPreviewLoginMini();
      estadoEl.innerText = '✅ Imagen lista (recortada a 1080x1920). Falta guardar los cambios.';
      estadoEl.style.color = 'var(--exito-verde,#22c55e)';
    }).catch(err=>{
      estadoEl.innerText = '⚠️ ' + err.message;
      estadoEl.style.color = 'var(--red-alert)';
      inputEl.value = '';
    }).finally(()=>{
      cargandoEl.style.display = 'none';
      inputEl.disabled = false;
      if(btnGuardar) btnGuardar.disabled = false;
    });
  };
  reader.onerror = ()=>{
    estadoEl.innerText = '⚠️ No se pudo leer el archivo desde tu dispositivo. Intenta de nuevo.';
    estadoEl.style.color = 'var(--red-alert)';
    cargandoEl.style.display = 'none';
    inputEl.disabled = false;
    if(btnGuardar) btnGuardar.disabled = false;
    inputEl.value = '';
  };
  reader.readAsDataURL(file);
}
async function guardarAparienciaLogin(){
  db.config.loginColor1 = document.getElementById('cfgLoginColor1').value;
  db.config.loginColor2 = document.getElementById('cfgLoginColor2').value;
  db.config.loginImagenFondo = loginImagenTempBase64;
  db.config.loginTituloIzquierda = document.getElementById('cfgLoginTituloIzquierda').value.trim();
  db.config.loginSubtituloIzquierda = document.getElementById('cfgLoginSubtituloIzquierda').value.trim();
  db.config.loginBienvenidaTitulo = document.getElementById('cfgLoginBienvenidaTitulo').value.trim();
  db.config.loginBienvenidaSubtitulo = document.getElementById('cfgLoginBienvenidaSubtitulo').value.trim();
  try{
    await dbGuardarInmediato();
    registrarLog('Actualizar', 'Apariencia del Login', '—');
    mostrarToast('✅ Pantalla de login guardada.', 'exito');
  }catch(err){
    mostrarToast('⚠️ No se guardó: ' + err.message, 'error');
  }
}
function manejarLogoUpload(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    logoTempBase64 = e.target.result;
    const prev = document.getElementById('previewLogoConfig');
    prev.src = logoTempBase64; prev.style.display='inline-block';
    document.getElementById('previewLogoConfigPlaceholder').style.display='none';
  };
  reader.readAsDataURL(file);
}
function actualizarPreviewFirmaRepresentante(){
  const prev = document.getElementById('imgFirmaConfig');
  const placeholder = document.getElementById('previewFirmaConfigPlaceholder');
  if(firmaTempBase64){ prev.src = firmaTempBase64; prev.style.display='block'; placeholder.style.display='none'; }
}
async function guardarAjustesGenerales(){
  db.config.nombre = document.getElementById('cfgEmpresaNombre').value;
  db.config.subtitulo = document.getElementById('cfgEmpresaSub').value;
  db.config.direccion = document.getElementById('cfgEmpresaDireccion').value;
  db.config.mision = document.getElementById('cfgEmpresaMision').value;
  db.config.vision = document.getElementById('cfgEmpresaVision').value;
  db.config.logo = logoTempBase64;
  db.config.nombreRepresentante = document.getElementById('cfgNombreRepresentante').value.trim();
  db.config.firmaRepresentante = firmaTempBase64;
  try{
    await dbGuardarInmediato();
    aplicarConfiguracionVisual();
    mostrarToast('✅ Perfil de empresa y firma guardados.', 'exito');
  }catch(err){
    mostrarToast('⚠️ No se guardó: ' + err.message, 'error');
  }
}
async function guardarPasswordAdmin(){
  const usuario = document.getElementById('cfgAdminUsuario').value.trim();
  const nueva = document.getElementById('cfgAdminPasswordNueva').value;
  if(!usuario && !nueva) return;
  const respaldo = { adminUsuario: db.config.adminUsuario, adminPassword: db.config.adminPassword };
  if(usuario) db.config.adminUsuario = usuario;
  if(nueva) db.config.adminPassword = nueva;
  try{
    await dbGuardarInmediato();
  }catch(err){
    Object.assign(db.config, respaldo);
    mostrarToast('⚠️ No se pudo guardar: ' + err.message, 'error');
    return;
  }
  document.getElementById('cfgAdminPasswordNueva').value = '';
  registrarLog('Actualizar acceso', 'Administrador', usuario || '—');
  mostrarToast('✅ Acceso de administrador actualizado.', 'exito');
}
async function guardarInterruptorLogin(){
  const anterior = db.config.loginRequerido;
  db.config.loginRequerido = document.getElementById('cfgLoginRequerido').checked;
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.config.loginRequerido = anterior;
    document.getElementById('cfgLoginRequerido').checked = anterior;
    mostrarToast('⚠️ No se pudo guardar: ' + err.message, 'error');
    return;
  }
  registrarLog('Actualizar acceso', 'Pantalla de login', db.config.loginRequerido ? 'Activada' : 'Desactivada');
}

/* =========================================================
   CONFIGURACIÓN: APARIENCIA (PALETAS EMPRESARIALES METALIZADAS)
========================================================= */
const TEMAS_CLAROS = [
  { 
    nombre: 'Titanio & Azul Industrial', 
    acento: '#0284c7', 
    fondo: '#f1f5f9', 
    texto: '#0f172a', 
    sidebar1: '#ffffff', 
    sidebar2: '#e2e8f0', 
    topbar1: '#ffffff', 
    topbar2: '#f8fafc', 
    panel1: '#ffffff', 
    panel2: '#f8fafc' 
  },
  { 
    nombre: 'Platino Satinado (Prevenglobal)', 
    acento: '#0284c7', 
    fondo: '#eef2f6', 
    texto: '#1e293b', 
    sidebar1: '#f8fafc', 
    sidebar2: '#e2e8f0', 
    topbar1: '#ffffff', 
    topbar2: '#f1f5f9', 
    panel1: '#ffffff', 
    panel2: '#f8fafc' 
  },
  { 
    nombre: 'Acero Frío & Esmeralda HVAC', 
    acento: '#059669', 
    fondo: '#f0fdf4', 
    texto: '#064e3b', 
    sidebar1: '#ffffff', 
    sidebar2: '#dcfce7', 
    topbar1: '#ffffff', 
    topbar2: '#f0fdf4', 
    panel1: '#ffffff', 
    panel2: '#f8fafc' 
  },
  { 
    nombre: 'Grafito Claro & Ámbar Operativo', 
    acento: '#d97706', 
    fondo: '#f4f4f5', 
    texto: '#18181b', 
    sidebar1: '#ffffff', 
    sidebar2: '#e4e4e7', 
    topbar1: '#ffffff', 
    topbar2: '#fafafa', 
    panel1: '#ffffff', 
    panel2: '#f8fafc' 
  }
];

let temaClaroSeleccionadoIdx = 0;
function renderizarTemasClaros(){
  const cont = document.getElementById('temasClarosGrid');
  if(!cont) return;
  const idxActual = TEMAS_CLAROS.findIndex(t=>t.acento===db.config.colorAcento && t.fondo===db.config.colorFondo);
  temaClaroSeleccionadoIdx = idxActual >= 0 ? idxActual : 0;
  cont.innerHTML = TEMAS_CLAROS.map((t,idx)=>`
    <div class="tema-claro-opcion ${idx===temaClaroSeleccionadoIdx?'seleccionado':''}" data-idx="${idx}" onclick="seleccionarTemaClaro(${idx})">
      <div class="tema-claro-preview" style="background:${t.fondo};">
        <div style="background:${t.sidebar1};width:35%;height:100%;border-right:1px solid rgba(0,0,0,.08);"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:${t.acento};margin-left:10px;"></div>
      </div>
      <span>${t.nombre}</span>
    </div>`).join('');
}
function seleccionarTemaClaro(idx){
  temaClaroSeleccionadoIdx = idx;
  document.querySelectorAll('.tema-claro-opcion').forEach(el=>el.classList.toggle('seleccionado', parseInt(el.dataset.idx)===idx));
}
async function guardarApariencia(){
  const tema = TEMAS_CLAROS[temaClaroSeleccionadoIdx] || TEMAS_CLAROS[0];
  db.config.colorAcento = tema.acento;
  db.config.colorFondo = tema.fondo;
  db.config.modoClaro = true;
  db.config.colorTexto = tema.texto;
  db.config.colorSidebar1 = tema.sidebar1;
  db.config.colorSidebar2 = tema.sidebar2;
  db.config.colorTopbar1 = tema.topbar1;
  db.config.colorTopbar2 = tema.topbar2;
  db.config.colorPanel1 = tema.panel1;
  db.config.colorPanel2 = tema.panel2;
  db.config.tamanoLetra = document.getElementById('cfgTamanoLetra').value;
  db.config.formRadius = document.getElementById('cfgFormRadius').value;
  db.config.formBorderColor = document.getElementById('cfgFormBorderColor').value;
  db.config.fontFamily = document.getElementById('cfgTipoLetra').value;
  db.config.formTamanoBotones = document.getElementById('cfgFormTamanoBotones').value;
  try{
    await dbGuardarInmediato();
    aplicarConfiguracionVisual();
    mostrarToast('✅ Apariencia guardada correctamente.', 'exito');
    cerrarModal('modalConfigCentro');
  }catch(err){
    mostrarToast('⚠️ No se guardó: ' + err.message, 'error');
  }
}
async function restablecerColorTexto(){
  db.config.colorTexto = null;
  const tema = TEMAS_CLAROS[temaClaroSeleccionadoIdx] || TEMAS_CLAROS[0];
  document.getElementById('cfgColorTexto').value = tema.texto;
  try{ await dbGuardarInmediato(); }catch(err){ mostrarToast('⚠️ No se pudo restablecer: ' + err.message, 'error'); return; }
  aplicarConfiguracionVisual();
}
async function restablecerBordeFormulario(){
  db.config.formBorderColor = null;
  document.getElementById('cfgFormBorderColor').value = '#cbd5e1';
  try{ await dbGuardarInmediato(); }catch(err){ mostrarToast('⚠️ No se pudo restablecer: ' + err.message, 'error'); return; }
  aplicarConfiguracionVisual();
}

/* =========================================================
   CONFIGURACIÓN: ETIQUETAS (Tipos de Servicio / Prioridades)
========================================================= */
function renderizarEtiquetas(){
  const tbodyTipo = document.getElementById('tablaEtiquetasTipo');
  tbodyTipo.innerHTML = db.config.tiposServicio.map((t,idx)=>`
    <tr><td>${t}</td><td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarEtiqueta('tiposServicio',${idx})">X</button></td></tr>
  `).join('') || '<tr><td colspan="2" class="empty-state">Sin etiquetas</td></tr>';

  const tbodyPrioridad = document.getElementById('tablaEtiquetasPrioridad');
  tbodyPrioridad.innerHTML = db.config.prioridades.map((p,idx)=>`
    <tr><td>${p}</td><td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarEtiqueta('prioridades',${idx})">X</button></td></tr>
  `).join('') || '<tr><td colspan="2" class="empty-state">Sin etiquetas</td></tr>';
}
async function agregarEtiqueta(lista, inputId){
  const valor = document.getElementById(inputId).value.trim();
  if(!valor){ mostrarToast('Escribe una etiqueta.'); return; }
  if(db.config[lista].includes(valor)){ mostrarToast('Esa etiqueta ya existe.'); return; }
  db.config[lista].push(valor);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.config[lista].pop();
    mostrarToast('⚠️ No se pudo guardar: ' + err.message, 'error');
    return;
  }
  document.getElementById(inputId).value = '';
  renderizarEtiquetas();
}
async function eliminarEtiqueta(lista, idx){
  if(db.config[lista].length<=1){ mostrarToast('Debe quedar al menos una etiqueta en la lista.'); return; }
  if(!confirm('¿Eliminar esta etiqueta?')) return;
  const respaldo = db.config[lista].slice();
  db.config[lista].splice(idx,1);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.config[lista] = respaldo;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  renderizarEtiquetas();
}

/* =========================================================
   BACKUP / RESET / EXPORT
========================================================= */
function exportarBaseDatosJSON(){
  const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Prevenglobal_Backup_${new Date().toISOString().slice(0,10)}.json`;
  link.click();
}
function importarClientesEquipos(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!data.clientesNuevos || !Array.isArray(data.clientesNuevos)){
        mostrarToast('Formato no esperado.');
        return;
      }
      const nombresExistentes = new Set(db.clientes.map(c=>c.nombre.trim().toLowerCase()));
      let agregados = 0, omitidosDuplicados = 0, equiposAgregados = 0;
      const respaldo = db.clientes.slice();
      data.clientesNuevos.forEach(cNuevo=>{
        const clave = (cNuevo.nombre||'').trim().toLowerCase();
        if(!clave || nombresExistentes.has(clave)){ omitidosDuplicados++; return; }
        const clienteFinal = Object.assign({}, cNuevo, { id: Date.now() + agregados });
        (clienteFinal.equiposSinSede || []).forEach((eq, i)=>{
          eq.id = Date.now() + 1000000 + agregados*100 + i;
          eq.qrId = 'EQ-' + eq.id;
          equiposAgregados++;
        });
        db.clientes.push(clienteFinal);
        nombresExistentes.add(clave);
        agregados++;
      });
      try{
        await dbGuardarInmediato();
      }catch(err){
        db.clientes = respaldo;
        mostrarToast('⚠️ No se pudo guardar la importación: ' + err.message, 'error');
        return;
      }
      registrarLog('Importar', 'Clientes/Equipos', `${agregados} clientes, ${equiposAgregados} equipos`);
      mostrarToast(`✅ Importación completa: ${agregados} clientes agregados.`, 'exito');
      renderizarClientesConfig();
    }catch(err){ mostrarToast('Error al leer el archivo: ' + err.message); }
  };
  reader.readAsText(file);
}
function importarBaseDatosJSON(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(data.clientes && data.plantillas && data.ordenes){
        const respaldo = db;
        db = data;
        try{
          await dbGuardarInmediato();
        }catch(err){
          db = respaldo;
          mostrarToast('⚠️ No se pudo guardar la base de datos importada: ' + err.message, 'error');
          return;
        }
        mostrarToast('✅ Base de datos importada con éxito.', 'exito');
        location.reload();
      } else { mostrarToast('El archivo no tiene el formato esperado.'); }
    }catch(err){ mostrarToast('Error al leer el archivo JSON.'); }
  };
  reader.readAsText(file);
}
function restablecerFabrica(){
  if(confirm('¿Restablecer toda la base de datos a los valores iniciales? Se perderán los cambios locales.')){
    localStorage.removeItem(DB_KEY);
    location.reload();
  }
}
