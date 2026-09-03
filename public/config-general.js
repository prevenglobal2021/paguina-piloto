// ===== config-general.js — Configuración General, Empresa y Temas Metalizados Persistentes =====
/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

function renderizarConfigGeneral(){
  const cfg = db.config || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  
  setVal('cfgEmpresaNombre', cfg.nombre);
  setVal('cfgEmpresaSub', cfg.subtitulo);
  setVal('cfgEmpresaDireccion', cfg.direccion);
  setVal('cfgEmpresaMision', cfg.mision);
  setVal('cfgEmpresaVision', cfg.vision);
  setVal('cfgAdminUsuario', cfg.adminUsuario);
  setVal('cfgNombreRepresentante', cfg.nombreRepresentante);
  
  const chkLogin = document.getElementById('cfgLoginRequerido');
  if(chkLogin) chkLogin.checked = cfg.loginRequerido !== false;

  const imgLogo = document.getElementById('previewLogoConfig');
  const phLogo = document.getElementById('previewLogoConfigPlaceholder');
  if(imgLogo && phLogo){
    if(cfg.logo){ imgLogo.src = cfg.logo; imgLogo.style.display = 'inline-block'; phLogo.style.display = 'none'; }
    else { imgLogo.style.display = 'none'; phLogo.style.display = 'block'; }
  }

  const imgFirma = document.getElementById('imgFirmaConfig');
  const phFirma = document.getElementById('previewFirmaConfigPlaceholder');
  if(imgFirma && phFirma){
    if(cfg.firmaRepresentante){ imgFirma.src = cfg.firmaRepresentante; imgFirma.style.display = 'inline-block'; phFirma.style.display = 'none'; }
    else { imgFirma.style.display = 'none'; phFirma.style.display = 'block'; }
  }
}

async function guardarAjustesGenerales(){
  const getVal = id => (document.getElementById(id)?.value || '').trim();
  const nombre = getVal('cfgEmpresaNombre');
  if(!nombre){ mostrarToast('El nombre de la empresa es obligatorio.'); return; }

  db.config.nombre = nombre;
  db.config.subtitulo = getVal('cfgEmpresaSub');
  db.config.direccion = getVal('cfgEmpresaDireccion');
  db.config.mision = getVal('cfgEmpresaMision');
  db.config.vision = getVal('cfgEmpresaVision');
  db.config.nombreRepresentante = getVal('cfgNombreRepresentante');
  if(typeof logoTempBase64 !== 'undefined' && logoTempBase64 !== null) db.config.logo = logoTempBase64;
  if(typeof firmaTempBase64 !== 'undefined' && firmaTempBase64 !== null) db.config.firmaRepresentante = firmaTempBase64;

  try{
    await dbGuardarInmediato();
    mostrarToast('✅ Perfil y datos de la empresa guardados.', 'exito');
    aplicarConfiguracionVisual();
  }catch(err){
    mostrarToast('⚠️ Error al guardar: ' + err.message, 'error');
  }
}

function manejarLogoUpload(event){
  const file = event.target.files[0];
  if(!file) return;
  comprimirImagen(file, 600, 0.85).then(dataUrl=>{
    logoTempBase64 = dataUrl;
    const imgLogo = document.getElementById('previewLogoConfig');
    const phLogo = document.getElementById('previewLogoConfigPlaceholder');
    if(imgLogo){ imgLogo.src = dataUrl; imgLogo.style.display = 'inline-block'; }
    if(phLogo){ phLogo.style.display = 'none'; }
    mostrarToast('Logo listo. Recuerda guardar cambios.', 'info');
  });
}

/* =========================================================
   CATÁLOGO EXTENDIDO DE TEMAS METALIZADOS CLAROS MARCADOS
========================================================= */
const TEMAS_CLAROS_METALIZADOS = [
  {
    nombre: 'Titanio Plateado',
    clave: 'titanio',
    acento: '#0284c7',
    fondo: '#f1f5f9',
    sidebar1: '#e2e8f0', sidebar2: '#cbd5e1',
    topbar1: '#f8fafc', topbar2: '#e2e8f0',
    panel1: '#ffffff', panel2: '#f8fafc',
    borde: '#94a3b8', texto: '#0f172a'
  },
  {
    nombre: 'Acero Platino',
    clave: 'platino',
    acento: '#2563eb',
    fondo: '#e2e8f0',
    sidebar1: '#cbd5e1', sidebar2: '#94a3b8',
    topbar1: '#f1f5f9', topbar2: '#cbd5e1',
    panel1: '#ffffff', panel2: '#f1f5f9',
    borde: '#64748b', texto: '#0f172a'
  },
  {
    nombre: 'Aluminio Azul Eléctrico',
    clave: 'aluminio',
    acento: '#0055ff',
    fondo: '#e0f2fe',
    sidebar1: '#bae6fd', sidebar2: '#7dd3fc',
    topbar1: '#f0f9ff', topbar2: '#bae6fd',
    panel1: '#ffffff', panel2: '#f0f9ff',
    borde: '#0284c7', texto: '#082f49'
  },
  {
    nombre: 'Níquel Ámbar Marcado',
    clave: 'niquel',
    acento: '#d97706',
    fondo: '#fef3c7',
    sidebar1: '#fde68a', sidebar2: '#fcd34d',
    topbar1: '#fffbeb', topbar2: '#fde68a',
    panel1: '#ffffff', panel2: '#fffbeb',
    borde: '#b45309', texto: '#451a03'
  },
  {
    nombre: 'Cromo Blanco Puro',
    clave: 'cromo',
    acento: '#0ea5e9',
    fondo: '#ffffff',
    sidebar1: '#f8fafc', sidebar2: '#e2e8f0',
    topbar1: '#ffffff', topbar2: '#f1f5f9',
    panel1: '#ffffff', panel2: '#ffffff',
    borde: '#cbd5e1', texto: '#0f172a'
  },
  {
    nombre: 'Zinc Glacial Esmeralda',
    clave: 'zinc',
    acento: '#059669',
    fondo: '#ecfdf5',
    sidebar1: '#a7f3d0', sidebar2: '#6ee7b7',
    topbar1: '#f0fdf4', topbar2: '#a7f3d0',
    panel1: '#ffffff', panel2: '#f0fdf4',
    borde: '#047857', texto: '#064e3b'
  },
  {
    nombre: 'Cobre Bronce Industrial',
    clave: 'cobre',
    acento: '#ea580c',
    fondo: '#ffedd5',
    sidebar1: '#fed7aa', sidebar2: '#fdba74',
    topbar1: '#fff7ed', topbar2: '#fed7aa',
    panel1: '#ffffff', panel2: '#fff7ed',
    borde: '#c2410c', texto: '#431407'
  },
  {
    nombre: 'Platino Amatista Marcado',
    clave: 'amatista',
    acento: '#7c3aed',
    fondo: '#f3e8ff',
    sidebar1: '#e9d5ff', sidebar2: '#d8b4fe',
    topbar1: '#faf5ff', topbar2: '#e9d5ff',
    panel1: '#ffffff', panel2: '#faf5ff',
    borde: '#6d28d9', texto: '#3b0764'
  },
  {
    nombre: 'Rojo Carmesí Metalizado',
    clave: 'carmesi',
    acento: '#dc2626',
    fondo: '#fee2e2',
    sidebar1: '#fecaca', sidebar2: '#fca5a5',
    topbar1: '#fef2f2', topbar2: '#fecaca',
    panel1: '#ffffff', panel2: '#fef2f2',
    borde: '#b91c1c', texto: '#450a0a'
  },
  {
    nombre: 'Acero Grafito Suave',
    clave: 'grafito',
    acento: '#475569',
    fondo: '#f8fafc',
    sidebar1: '#e2e8f0', sidebar2: '#94a3b8',
    topbar1: '#f1f5f9', topbar2: '#cbd5e1',
    panel1: '#ffffff', panel2: '#f8fafc',
    borde: '#475569', texto: '#0f172a'
  }
];

function renderizarTemasClaros(){
  const cont = document.getElementById('temasClarosGrid');
  if(!cont) return;

  const cfg = db.config || {};
  const temaActual = cfg.temaMetalizado || 'titanio';

  cont.innerHTML = TEMAS_CLAROS_METALIZADOS.map(t => {
    const seleccionado = (temaActual === t.clave) ? 'seleccionado' : '';
    return `
      <div class="tema-claro-opcion ${seleccionado}" onclick="aplicarTemaMetalizado('${t.clave}')" style="cursor:pointer;">
        <div class="tema-claro-preview" style="background:linear-gradient(135deg, ${t.sidebar1}, ${t.sidebar2});box-shadow:inset 0 0 10px rgba(255,255,255,.6);">
          <div style="width:32%;height:100%;background:linear-gradient(180deg, ${t.sidebar1}, ${t.sidebar2});border-right:1px solid ${t.borde};"></div>
          <div style="flex:1;height:100%;display:flex;flex-direction:column;">
            <div style="height:35%;background:linear-gradient(90deg, ${t.topbar1}, ${t.topbar2});border-bottom:1px solid ${t.borde};"></div>
            <div style="flex:1;background:${t.fondo};padding:3px;display:flex;align-items:center;justify-content:center;">
              <div style="width:80%;height:70%;background:${t.panel1};border:1px solid ${t.borde};border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.08);"></div>
            </div>
          </div>
        </div>
        <span style="font-size:11px;margin-top:5px;display:block;"><strong>${t.nombre}</strong></span>
      </div>
    `;
  }).join('');
}

async function aplicarTemaMetalizado(clave){
  const t = TEMAS_CLAROS_METALIZADOS.find(x => x.clave === clave);
  if(!t) return;

  db.config = db.config || {};
  db.config.temaMetalizado = t.clave;
  db.config.colorAcento = t.acento;
  db.config.colorFondo = t.fondo;
  db.config.colorSidebar1 = t.sidebar1;
  db.config.colorSidebar2 = t.sidebar2;
  db.config.colorTopbar1 = t.topbar1;
  db.config.colorTopbar2 = t.topbar2;
  db.config.colorPanel1 = t.panel1;
  db.config.colorPanel2 = t.panel2;
  db.config.cardBorder = t.borde;
  db.config.colorTexto = t.texto;
  db.config.modoClaro = true;

  aplicarEstilosMetalizadosEnDOM(t);
  renderizarTemasClaros();

  // Guardado inmediato en base de datos para evitar que el refresco de fondo lo borre
  try {
    await dbGuardarInmediato();
    mostrarToast(`✨ Tema ${t.nombre} guardado y fijado permanentemente.`, 'exito');
  } catch(e) {
    mostrarToast('⚠️ Tema aplicado localmente (pendiente de sincronización).', 'info');
  }
}

function aplicarEstilosMetalizadosEnDOM(t){
  const root = document.documentElement.style;
  root.setProperty('--blue-accent', t.acento);
  root.setProperty('--primary-color', t.acento);
  root.setProperty('--bg-dark', t.fondo);
  root.setProperty('--sidebar-bg-1', t.sidebar1);
  root.setProperty('--sidebar-bg-2', t.sidebar2);
  root.setProperty('--topbar-bg-1', t.topbar1);
  root.setProperty('--topbar-bg-2', t.topbar2);
  root.setProperty('--panel-bg-1', t.panel1);
  root.setProperty('--panel-bg-2', t.panel2);
  root.setProperty('--card-border', t.borde);
  root.setProperty('--text-main', t.texto);
  document.body.classList.add('modo-claro');
}

function renderizarConfigApariencia(){
  const cfg = db.config || {};
  
  if(document.getElementById('cfgTamanoLetra')) document.getElementById('cfgTamanoLetra').value = cfg.tamanoLetra || 'md';
  if(document.getElementById('cfgColorTexto')) document.getElementById('cfgColorTexto').value = cfg.colorTexto || '#0f172a';
  if(document.getElementById('cfgFormRadius')) document.getElementById('cfgFormRadius').value = cfg.formRadius !== undefined ? cfg.formRadius : '6';
  if(document.getElementById('cfgFormBorderColor')) document.getElementById('cfgFormBorderColor').value = cfg.formBorderColor || '#cbd5e1';
  if(document.getElementById('cfgFormTamanoBotones')) document.getElementById('cfgFormTamanoBotones').value = cfg.formTamanoBotones || 'md';
  if(document.getElementById('cfgTipoLetra')) document.getElementById('cfgTipoLetra').value = cfg.fontFamily || "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif";

  renderizarTemasClaros();
  if(typeof actualizarPreviewLoginMini === 'function') actualizarPreviewLoginMini();
}

async function guardarApariencia(){
  const cfg = db.config;
  cfg.tamanoLetra = document.getElementById('cfgTamanoLetra')?.value || 'md';
  cfg.colorTexto = document.getElementById('cfgColorTexto')?.value || '#0f172a';
  cfg.formRadius = document.getElementById('cfgFormRadius')?.value || '6';
  cfg.formBorderColor = document.getElementById('cfgFormBorderColor')?.value || '#cbd5e1';
  cfg.formTamanoBotones = document.getElementById('cfgFormTamanoBotones')?.value || 'md';
  cfg.fontFamily = document.getElementById('cfgTipoLetra')?.value || "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif";

  try{
    await dbGuardarInmediato();
    aplicarConfiguracionVisual();
    mostrarToast('✅ Configuración de apariencia guardada con éxito.', 'exito');
  }catch(err){
    mostrarToast('⚠️ No se pudo guardar la apariencia: ' + err.message, 'error');
  }
}

function restablecerColorTexto(){
  if(document.getElementById('cfgColorTexto')) document.getElementById('cfgColorTexto').value = '#0f172a';
  document.documentElement.style.setProperty('--text-main', '#0f172a');
}

function restablecerBordeFormulario(){
  if(document.getElementById('cfgFormBorderColor')) document.getElementById('cfgFormBorderColor').value = '#cbd5e1';
  document.documentElement.style.setProperty('--form-border-color', '#cbd5e1');
}

function actualizarPreviewLoginMini(){
  const c1 = document.getElementById('cfgLoginColor1')?.value || '#7c3aed';
  const c2 = document.getElementById('cfgLoginColor2')?.value || '#4c1d95';
  const pMini = document.getElementById('previewLoginMini');
  if(pMini){
    pMini.style.setProperty('--preview-login-color-1', c1);
    pMini.style.setProperty('--preview-login-color-2', c2);
  }
}

