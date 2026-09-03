// ===== config-general.js — Configuración General, Empresa y Apariencia =====
/* =========================================================
   CONFIGURACIÓN GENERAL Y APARIENCIA (ESTRUCTURA ORIGINAL COMPLETA)
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
  if(logoTempBase64 !== undefined) db.config.logo = logoTempBase64;
  if(firmaTempBase64 !== undefined) db.config.firmaRepresentante = firmaTempBase64;

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

/* ---------------------------------------------------------
   APARIENCIA: Temas, Tipografía y Colores Marcados
--------------------------------------------------------- */
const COLORES_MARCADOS_EXTRA = [
  { nombre: 'Azul Eléctrico Cobalto', hex: '#0055ff' },
  { nombre: 'Rojo Fuego Industrial', hex: '#dc2626' },
  { nombre: 'Naranja Mecánico', hex: '#ea580c' },
  { nombre: 'Verde Esmeralda Fuerte', hex: '#059669' },
  { nombre: 'Violeta Neón Intenso', hex: '#7c3aed' },
  { nombre: 'Ámbar Alerta Marcado', hex: '#d97706' },
  { nombre: 'Cian Neón', hex: '#06b6d4' },
  { nombre: 'Grafito Mate Oscuro', hex: '#1e293b' }
];

function renderizarConfigApariencia(){
  const cfg = db.config || {};
  
  if(document.getElementById('cfgTamanoLetra')) document.getElementById('cfgTamanoLetra').value = cfg.tamanoLetra || 'md';
  if(document.getElementById('cfgColorTexto')) document.getElementById('cfgColorTexto').value = cfg.colorTexto || '#1e293b';
  if(document.getElementById('cfgFormRadius')) document.getElementById('cfgFormRadius').value = cfg.formRadius !== undefined ? cfg.formRadius : '6';
  if(document.getElementById('cfgFormBorderColor')) document.getElementById('cfgFormBorderColor').value = cfg.formBorderColor || '#cbd5e1';
  if(document.getElementById('cfgFormTamanoBotones')) document.getElementById('cfgFormTamanoBotones').value = cfg.formTamanoBotones || 'md';
  if(document.getElementById('cfgTipoLetra')) document.getElementById('cfgTipoLetra').value = cfg.fontFamily || "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif";

  if(typeof renderizarTemasClaros === 'function') renderizarTemasClaros();

  // Inyectar el selector de colores marcados debajo del grid de temas
  const contTemas = document.getElementById('temasClarosGrid');
  if(contTemas && !document.getElementById('paletaColoresMarcados')){
    const cont = document.createElement('div');
    cont.id = 'paletaColoresMarcados';
    cont.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px dashed #cbd5e1;';
    cont.innerHTML = `
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
        Colores de acento vivos y de alto contraste:
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        ${COLORES_MARCADOS_EXTRA.map(c=>`
          <button type="button" onclick="aplicarColorAcentoMarcado('${c.hex}')" 
            title="${c.nombre} (${c.hex})" 
            style="width:32px;height:32px;border-radius:6px;background:${c.hex};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer;transition:transform .12s ease;"
            onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
          </button>
        `).join('')}
      </div>
    `;
    contTemas.parentNode.appendChild(cont);
  }
}

function aplicarColorAcentoMarcado(hex){
  db.config.colorAcento = hex;
  document.documentElement.style.setProperty('--blue-accent', hex);
  mostrarToast(`Color de acento cambiado a ${hex}. Guarda para confirmar.`, 'info');
}

async function guardarApariencia(){
  const cfg = db.config;
  cfg.tamanoLetra = document.getElementById('cfgTamanoLetra')?.value || 'md';
  cfg.colorTexto = document.getElementById('cfgColorTexto')?.value || '#1e293b';
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
