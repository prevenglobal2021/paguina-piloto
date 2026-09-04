
// ===== config-general.js — Configuración General, Empresa, Logo y Temas Metalizados =====
/* =========================================================
   CONFIGURACIÓN: EMPRESA Y PERFIL
========================================================= */
function actualizarPreviewLoginMini(){
  const c1 = document.getElementById('cfgLoginColor1')?.value || '#0284c7';
  const c2 = document.getElementById('cfgLoginColor2')?.value || '#0f172a';
  const mini = document.getElementById('previewLoginMini');
  if(!mini) return;
  mini.style.setProperty('--preview-login-color-1', c1);
  mini.style.setProperty('--preview-login-color-2', c2);
  const tIzq = document.getElementById('cfgLoginTituloIzquierda');
  const sIzq = document.getElementById('cfgLoginSubtituloIzquierda');
  const bTit = document.getElementById('cfgLoginBienvenidaTitulo');
  const bSub = document.getElementById('cfgLoginBienvenidaSubtitulo');
  if(tIzq) document.getElementById('previewLoginMiniTitulo').innerText = tIzq.value || 'Domina el sistema';
  if(sIzq) document.getElementById('previewLoginMiniSubtitulo').innerText = sIzq.value || 'Controla clientes, equipos, órdenes de servicio e inventario.';
  if(bTit) document.getElementById('previewLoginMiniBienvenida').innerText = bTit.value || '¡Bienvenido!';
  if(bSub) document.getElementById('previewLoginMiniSubBienvenida').innerText = bSub.value || 'Por favor inicia sesión';
  const izq = document.getElementById('previewLoginMiniIzq');
  if(izq) izq.style.backgroundImage = loginImagenTempBase64 ? `url('${loginImagenTempBase64}')` : 'none';
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
    estadoEl.innerText = '⚠️ La imagen supera 10MB. Selecciona una más liviana.';
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
      estadoEl.innerText = '✅ Imagen optimizada lista. Guarda cambios para aplicar.';
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
    estadoEl.innerText = '⚠️ Error al leer archivo.';
    cargandoEl.style.display = 'none';
    inputEl.disabled = false;
    if(btnGuardar) btnGuardar.disabled = false;
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
    registrarLog('Actualizar', 'Apariencia Login', '—');
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
    if(prev) { prev.src = logoTempBase64; prev.style.display='inline-block'; }
    const ph = document.getElementById('previewLogoConfigPlaceholder');
    if(ph) ph.style.display='none';
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
    mostrarToast('✅ Configuración general y logo guardados.', 'exito');
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
    mostrarToast('⚠️ No se pudo guardar clave de admin: ' + err.message, 'error');
    return;
  }
  document.getElementById('cfgAdminPasswordNueva').value = '';
  registrarLog('Actualizar acceso', 'Administrador', usuario || '—');
  mostrarToast('✅ Acceso actualizado.', 'exito');
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
   CATÁLOGO DE TEMAS EMPRESARIALES (6 PALETAS DIVERSAS)
========================================================= */
const TEMAS_CLAROS = [
  { 
    nombre: 'Azul Metalizado Claro (Acero & Platino)', 
    esOscuro: false,
    acento: '#0284c7', 
    fondo: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #f1f5f9 100%)', 
    colorFondoSolido: '#e2e8f0',
    texto: '#0f172a', 
    textoMuted: '#475569',
    sidebar1: 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%)', 
    sidebar2: '#cbd5e1', 
    topbar1: 'linear-gradient(90deg, #ffffff 0%, #e2e8f0 100%)', 
    topbar2: '#cbd5e1', 
    panel1: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', 
    panel2: '#ffffff',
    borde: '#94a3b8'
  },
  { 
    nombre: 'Titanio Cobalto (Azul Metalizado Oscuro)', 
    esOscuro: true,
    acento: '#38bdf8', 
    fondo: 'linear-gradient(135deg, #0b1329 0%, #111c38 50%, #1e293b 100%)', 
    colorFondoSolido: '#0b1329',
    texto: '#f8fafc', 
    textoMuted: '#94a3b8',
    sidebar1: 'linear-gradient(180deg, #0f172a 0%, #0b1329 100%)', 
    sidebar2: '#1e293b', 
    topbar1: 'linear-gradient(90deg, #111c38 0%, #0f172a 100%)', 
    topbar2: '#1e293b', 
    panel1: 'linear-gradient(180deg, #16203c 0%, #0f172a 100%)', 
    panel2: '#16203c',
    borde: '#334155'
  },
  { 
    nombre: 'Platino Satinado Puro (Prevenglobal Clean)', 
    esOscuro: false,
    acento: '#2563eb', 
    fondo: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
    colorFondoSolido: '#f1f5f9',
    texto: '#0f172a', 
    textoMuted: '#64748b',
    sidebar1: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', 
    sidebar2: '#e2e8f0', 
    topbar1: '#ffffff', 
    topbar2: '#f1f5f9', 
    panel1: '#ffffff', 
    panel2: '#ffffff',
    borde: '#cbd5e1'
  },
  { 
    nombre: 'Acero Esmeralda HVAC (Ingeniería)', 
    esOscuro: false,
    acento: '#059669', 
    fondo: 'linear-gradient(135deg, #e6f4ea 0%, #dcfce7 50%, #f0fdf4 100%)', 
    colorFondoSolido: '#e6f4ea',
    texto: '#064e3b', 
    textoMuted: '#047857',
    sidebar1: 'linear-gradient(180deg, #ffffff 0%, #dcfce7 100%)', 
    sidebar2: '#bbf7d0', 
    topbar1: 'linear-gradient(90deg, #ffffff 0%, #f0fdf4 100%)', 
    topbar2: '#dcfce7', 
    panel1: '#ffffff', 
    panel2: '#ffffff',
    borde: '#86efac'
  },
  { 
    nombre: 'Grafito & Cobre Industrial', 
    esOscuro: true,
    acento: '#f59e0b', 
    fondo: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)', 
    colorFondoSolido: '#18181b',
    texto: '#fafafa', 
    textoMuted: '#a1a1aa',
    sidebar1: 'linear-gradient(180deg, #27272a 0%, #18181b 100%)', 
    sidebar2: '#3f3f46', 
    topbar1: 'linear-gradient(90deg, #27272a 0%, #18181b 100%)', 
    topbar2: '#3f3f46', 
    panel1: 'linear-gradient(180deg, #27272a 0%, #1f1f23 100%)', 
    panel2: '#27272a',
    borde: '#52525b'
  },
  { 
    nombre: 'Azul Marino Ejecutivo Profundo', 
    esOscuro: true,
    acento: '#60a5fa', 
    fondo: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)', 
    colorFondoSolido: '#020617',
    texto: '#f8fafc', 
    textoMuted: '#94a3b8',
    sidebar1: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)', 
    sidebar2: '#1e293b', 
    topbar1: 'linear-gradient(90deg, #0f172a 0%, #020617 100%)', 
    topbar2: '#1e293b', 
    panel1: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)', 
    panel2: '#0f172a',
    borde: '#1e293b'
  }
];

let temaClaroSeleccionadoIdx = 0;
function renderizarTemasClaros(){
  const cont = document.getElementById('temasClarosGrid');
  if(!cont) return;
  const idxActual = TEMAS_CLAROS.findIndex(t => t.acento === db.config.colorAcento && t.colorFondoSolido === db.config.colorFondo);
  temaClaroSeleccionadoIdx = idxActual >= 0 ? idxActual : 0;
  cont.innerHTML = TEMAS_CLAROS.map((t, idx) => `
    <div class="tema-claro-opcion ${idx === temaClaroSeleccionadoIdx ? 'seleccionado' : ''}" data-idx="${idx}" onclick="seleccionarTemaClaro(${idx})" style="cursor:pointer;border:2px solid ${idx===temaClaroSeleccionadoIdx?t.acento:'#cbd5e1'};border-radius:8px;padding:8px;margin-bottom:8px;background:${t.colorFondoSolido};">
      <div class="tema-claro-preview" style="background:${t.fondo};height:45px;border-radius:6px;display:flex;align-items:center;border:1px solid ${t.borde};overflow:hidden;">
        <div style="background:${t.sidebar1};width:32%;height:100%;border-right:1px solid ${t.borde};"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:${t.acento};margin-left:12px;box-shadow:0 0 6px ${t.acento};"></div>
      </div>
      <span style="color:${t.texto};font-weight:700;font-size:12.5px;margin-top:6px;display:block;">${t.nombre}</span>
    </div>`).join('');
}

function seleccionarTemaClaro(idx){
  temaClaroSeleccionadoIdx = idx;
  document.querySelectorAll('.tema-claro-opcion').forEach(el => el.classList.toggle('seleccionado', parseInt(el.dataset.idx) === idx));
}

/* =========================================================
   INYECCIÓN VISUAL TOTAL + LOGO CORPORATIVO DESTACADO (10x10 CM)
========================================================= */
function aplicarConfiguracionVisual(){
  const cfg = db.config || {};
  const tema = TEMAS_CLAROS.find(t => t.acento === cfg.colorAcento && t.colorFondoSolido === cfg.colorFondo) || TEMAS_CLAROS[0];
  const root = document.documentElement;

  root.style.setProperty('--accent-color', cfg.colorAcento || tema.acento);
  root.style.setProperty('--bg-body', tema.colorFondoSolido);
  root.style.setProperty('--text-main', tema.texto);
  root.style.setProperty('--text-color', tema.texto);
  root.style.setProperty('--text-muted', tema.textoMuted);
  root.style.setProperty('--card-bg', tema.panel2);
  root.style.setProperty('--panel-bg', tema.panel2);
  root.style.setProperty('--card-border', tema.borde);

  // Asegurar y actualizar dinámicamente el logo corporativo en la barra superior izquierda
  const sidebarHeader = document.querySelector('aside > div:first-child') || document.querySelector('.sidebar-header');
  if(sidebarHeader){
    let logoImg = sidebarHeader.querySelector('img.logo-sidebar-destacado');
    if(!logoImg){
      logoImg = sidebarHeader.querySelector('img') || document.createElement('img');
      logoImg.classList.add('logo-sidebar-destacado');
      sidebarHeader.prepend(logoImg);
    }
    if(cfg.logo){
      logoImg.src = cfg.logo;
      logoImg.style.display = 'block';
    } else {
      logoImg.style.display = 'none';
    }
  }

  let estiloTema = document.getElementById('estiloTemaMetalizadoDinamico');
  if(!estiloTema){
    estiloTema = document.createElement('style');
    estiloTema.id = 'estiloTemaMetalizadoDinamico';
    document.head.appendChild(estiloTema);
  }

  estiloTema.innerHTML = `
    body, html {
      background: ${tema.fondo} !important;
      color: ${tema.texto} !important;
      min-height: 100vh !important;
    }
    aside, .sidebar {
      background: ${tema.sidebar1} !important;
      border-right: 1px solid ${tema.borde} !important;
      color: ${tema.texto} !important;
      width: 260px !important;
    }
    
    /* LOGO DESTACADO EN LA ESQUINA SUPERIOR IZQUIERDA */
    aside > div:first-child, .sidebar-header {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 16px 12px !important;
      border-bottom: 1px solid ${tema.borde} !important;
      text-align: center !important;
    }
    aside img.logo-sidebar-destacado, aside > div:first-child img {
      width: 110px !important;
      height: 110px !important;
      min-width: 110px !important;
      min-height: 110px !important;
      object-fit: contain !important;
      border-radius: 12px !important;
      padding: 6px !important;
      background: ${tema.esOscuro ? '#0f172a' : '#ffffff'} !important;
      border: 2px solid ${tema.borde} !important;
      box-shadow: 0 6px 18px rgba(0,0,0, ${tema.esOscuro ? '0.5' : '0.12'}) !important;
      margin-bottom: 10px !important;
    }
    aside > div:first-child span {
      font-size: 15px !important;
      font-weight: 700 !important;
      letter-spacing: .02em !important;
      color: ${tema.texto} !important;
    }

    aside ul li a, .sidebar a {
      color: ${tema.texto} !important;
    }
    aside ul li a:hover, aside ul li a.active {
      background: ${tema.acento}25 !important;
      color: ${tema.acento} !important;
    }
    header, .topbar {
      background: ${tema.topbar1} !important;
      border-bottom: 1px solid ${tema.borde} !important;
      color: ${tema.texto} !important;
    }
    header h2, header p, header span {
      color: ${tema.texto} !important;
    }
    .panel, .orden-card, .kpi-card, .card, .dashboard-container {
      background: ${tema.panel1} !important;
      border: 1px solid ${tema.borde} !important;
      color: ${tema.texto} !important;
      box-shadow: 0 4px 14px rgba(0,0,0, ${tema.esOscuro ? '0.40' : '0.06'}) !important;
    }
    .orden-card-top span, .orden-card-cliente, .orden-card-datos span {
      color: ${tema.texto} !important;
    }
    table {
      color: ${tema.texto} !important;
    }
    table thead th {
      background: ${tema.sidebar2} !important;
      color: ${tema.texto} !important;
      border-bottom: 2px solid ${tema.borde} !important;
    }
    table tbody td {
      border-bottom: 1px solid ${tema.borde} !important;
      color: ${tema.texto} !important;
    }
    table tbody tr:hover {
      background: ${tema.acento}15 !important;
    }
    input, select, textarea {
      background-color: ${tema.esOscuro ? '#090d16' : '#ffffff'} !important;
      color: ${tema.texto} !important;
      border: 1px solid ${tema.borde} !important;
    }
    .modal-card {
      background: ${tema.panel2} !important;
      color: ${tema.texto} !important;
      border: 1px solid ${tema.borde} !important;
    }
  `;
}

async function guardarApariencia(){
  const tema = TEMAS_CLAROS[temaClaroSeleccionadoIdx] || TEMAS_CLAROS[0];
  db.config.colorAcento = tema.acento;
  db.config.colorFondo = tema.colorFondoSolido;
  db.config.colorTexto = tema.texto;
  db.config.colorSidebar1 = tema.sidebar2;
  db.config.colorTopbar1 = tema.topbar2;
  db.config.colorPanel1 = tema.panel2;
  db.config.formBorderColor = tema.borde;

  try{
    await dbGuardarInmediato();
    aplicarConfiguracionVisual();
    mostrarToast(`✅ Tema ${tema.nombre} aplicado.`, 'exito');
    cerrarModal('modalConfigCentro');
  }catch(err){
    mostrarToast('⚠️ No se guardó: ' + err.message, 'error');
  }
}

async function restablecerColorTexto(){
  const tema = TEMAS_CLAROS[temaClaroSeleccionadoIdx] || TEMAS_CLAROS[0];
  db.config.colorTexto = tema.texto;
  try{ await dbGuardarInmediato(); }catch(err){ return; }
  aplicarConfiguracionVisual();
}

async function restablecerBordeFormulario(){
  const tema = TEMAS_CLAROS[temaClaroSeleccionadoIdx] || TEMAS_CLAROS[0];
  db.config.formBorderColor = tema.borde;
  try{ await dbGuardarInmediato(); }catch(err){ return; }
  aplicarConfiguracionVisual();
}

/* =========================================================
   CONFIGURACIÓN: ETIQUETAS
========================================================= */
function renderizarEtiquetas(){
  const tbodyTipo = document.getElementById('tablaEtiquetasTipo');
  if(tbodyTipo){
    tbodyTipo.innerHTML = (db.config.tiposServicio||[]).map((t,idx)=>`
      <tr><td>${t}</td><td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarEtiqueta('tiposServicio',${idx})">X</button></td></tr>
    `).join('') || '<tr><td colspan="2" class="empty-state">Sin etiquetas</td></tr>';
  }
  const tbodyPrioridad = document.getElementById('tablaEtiquetasPrioridad');
  if(tbodyPrioridad){
    tbodyPrioridad.innerHTML = (db.config.prioridades||[]).map((p,idx)=>`
      <tr><td>${p}</td><td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarEtiqueta('prioridades',${idx})">X</button></td></tr>
    `).join('') || '<tr><td colspan="2" class="empty-state">Sin etiquetas</td></tr>';
  }
}

async function agregarEtiqueta(lista, inputId){
  const valor = document.getElementById(inputId).value.trim();
  if(!valor){ mostrarToast('Escribe una etiqueta.'); return; }
  db.config[lista] = db.config[lista] || [];
  if(db.config[lista].includes(valor)){ mostrarToast('Esa etiqueta ya existe.'); return; }
  db.config[lista].push(valor);
  try{ await dbGuardarInmediato(); }catch(err){ db.config[lista].pop(); return; }
  document.getElementById(inputId).value = '';
  renderizarEtiquetas();
}

async function eliminarEtiqueta(lista, idx){
  if((db.config[lista]||[]).length <= 1){ mostrarToast('Debe quedar al menos una etiqueta.'); return; }
  if(!confirm('¿Eliminar esta etiqueta?')) return;
  db.config[lista].splice(idx,1);
  try{ await dbGuardarInmediato(); }catch(err){ return; }
  renderizarEtiquetas();
}

/* =========================================================
   BACKUP Y RESTABLECIMIENTO
========================================================= */
function exportarBaseDatosJSON(){
  const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Prevenglobal_Backup_${new Date().toISOString().slice(0,10)}.json`;
  link.click();
}

function restablecerFabrica(){
  if(confirm('¿Restablecer toda la base de datos a los valores iniciales? Se perderán los cambios locales.')){
    localStorage.removeItem(DB_KEY);
    location.reload();
  }
}
