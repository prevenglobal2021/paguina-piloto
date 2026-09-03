// ===== config-general.js — Configuración General, Empresa y Selector de Temas =====
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
    mostrarToast('✅ Perfil y datos guardados.', 'exito');
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
   SELECTOR VISUAL DE TEMAS METALIZADOS
========================================================= */
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

  aplicarConfiguracionVisual();
  renderizarTemasClaros();

  // Guardado inmediato en base de datos para evitar que el refresco de fondo lo borre
  try {
    await dbGuardarInmediato();
    mostrarToast(`✨ Tema ${t.nombre} guardado y fijado permanentemente.`, 'exito');
  } catch(e) {
    mostrarToast('⚠️ Tema aplicado localmente (pendiente de sincronización).', 'info');
  }
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
    mostrarToast('✅ Apariencia guardada correctamente.', 'exito');
  }catch(err){
    mostrarToast('⚠️ Error al guardar: ' + err.message, 'error');
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
