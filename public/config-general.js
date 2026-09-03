// ===== config-general.js — Configuración General, Empresa y Apariencia =====
/* =========================================================
   CONFIGURACIÓN GENERAL Y APARIENCIA (ESTRUCTURA ORIGINAL CONSERVADA)
========================================================= */

function renderizarConfigGeneral(){
  const cfg = db.config || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  
  setVal('cfgNombreEmpresa', cfg.nombre);
  setVal('cfgSubtitulo', cfg.subtitulo);
  setVal('cfgDireccion', cfg.direccion);
  setVal('cfgMision', cfg.mision);
  setVal('cfgVision', cfg.vision);
  setVal('cfgAdminUsuario', cfg.adminUsuario);
  setVal('cfgAdminPassword', '');
  
  const imgLogo = document.getElementById('cfgPreviewLogo');
  if(imgLogo){
    if(cfg.logo){
      imgLogo.src = cfg.logo;
      imgLogo.style.display = 'block';
    } else {
      imgLogo.style.display = 'none';
    }
  }
}

async function guardarConfigGeneral(){
  const getVal = id => (document.getElementById(id)?.value || '').trim();
  const nombre = getVal('cfgNombreEmpresa');
  const adminUsuario = getVal('cfgAdminUsuario');

  if(!nombre){ mostrarToast('El nombre de la empresa es obligatorio.'); return; }
  if(!adminUsuario){ mostrarToast('El usuario administrador es obligatorio.'); return; }

  db.config.nombre = nombre;
  db.config.subtitulo = getVal('cfgSubtitulo');
  db.config.direccion = getVal('cfgDireccion');
  db.config.mision = getVal('cfgMision');
  db.config.vision = getVal('cfgVision');
  db.config.adminUsuario = adminUsuario;

  const adminPass = document.getElementById('cfgAdminPassword')?.value;
  if(adminPass && adminPass.trim().length >= 4){
    db.config.adminPassword = adminPass.trim();
  }

  try{
    await dbGuardarInmediato();
    mostrarToast('✅ Configuración general guardada.', 'exito');
    if(typeof aplicarMarcaGlobal === 'function') aplicarMarcaGlobal();
  }catch(err){
    mostrarToast('⚠️ Error al guardar: ' + err.message, 'error');
  }
}

function manejarLogoEmpresa(event){
  const file = event.target.files[0];
  if(!file) return;
  comprimirImagen(file, 500, 0.85).then(dataUrl=>{
    db.config.logo = dataUrl;
    const imgLogo = document.getElementById('cfgPreviewLogo');
    if(imgLogo){
      imgLogo.src = dataUrl;
      imgLogo.style.display = 'block';
    }
    mostrarToast('Logo cargado. Guarda los cambios para aplicar.', 'info');
  });
}

function quitarLogoEmpresa(){
  db.config.logo = null;
  const imgLogo = document.getElementById('cfgPreviewLogo');
  if(imgLogo) imgLogo.style.display = 'none';
  const inputLogo = document.getElementById('cfgInputLogo');
  if(inputLogo) inputLogo.value = '';
}

/* ---------------------------------------------------------
   APARIENCIA: Estructura original intacta + Colores Adicionados
--------------------------------------------------------- */
function renderizarConfigApariencia(){
  const cfg = db.config || {};
  
  // 1. Respetar y llenar los campos originales si existen en el HTML
  const acentoInput = document.getElementById('cfgColorAcento');
  if(acentoInput) acentoInput.value = cfg.colorAcento || '#0088ff';

  const fondoInput = document.getElementById('cfgColorFondo');
  if(fondoInput) fondoInput.value = cfg.colorFondo || '#0b111e';

  const modoClaroCheck = document.getElementById('cfgModoClaro');
  if(modoClaroCheck) modoClaroCheck.checked = !!cfg.modoClaro;

  // 2. Extender contenedor de paletas sin borrar lo preexistente
  let contPaletas = document.getElementById('paletaColoresMarcados');
  if(!contPaletas && acentoInput && acentoInput.parentNode){
    contPaletas = document.createElement('div');
    contPaletas.id = 'paletaColoresMarcados';
    contPaletas.style.cssText = 'margin-top:10px;margin-bottom:12px;';
    acentoInput.parentNode.insertBefore(contPaletas, acentoInput.nextSibling);
  }

  // Paleta original extendida con tonos vivos y de alta visibilidad
  const coloresDisponibles = [
    // Tonos originales
    { nombre: 'Azul Original', hex: '#0088ff' },
    { nombre: 'Azul Marino Clásico', hex: '#1e40af' },
    { nombre: 'Verde Clásico', hex: '#10b981' },
    { nombre: 'Naranja Clásico', hex: '#f97316' },
    { nombre: 'Púrpura Clásico', hex: '#8b5cf6' },
    { nombre: 'Gris Grafito Clásico', hex: '#334155' },
    // Colores marcados adicionales
    { nombre: 'Azul Cobalto Intenso', hex: '#0055ff' },
    { nombre: 'Rojo Fuego Operativo', hex: '#dc2626' },
    { nombre: 'Naranja Mecánico Marcado', hex: '#ea580c' },
    { nombre: 'Verde Esmeralda Fuerte', hex: '#059669' },
    { nombre: 'Violeta Eléctrico', hex: '#7c3aed' },
    { nombre: 'Ámbar Alerta Fuerte', hex: '#d97706' },
    { nombre: 'Cian Neón Fuerte', hex: '#06b6d4' },
    { nombre: 'Rosa Neón Intenso', hex: '#e11d48' }
  ];

  if(contPaletas){
    contPaletas.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
        Seleccionar Color de Acento Rápido:
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        ${coloresDisponibles.map(c=>`
          <button type="button" onclick="seleccionarColorAcentoDirecto('${c.hex}')" 
            title="${c.nombre} (${c.hex})" 
            style="width:30px;height:30px;border-radius:6px;background:${c.hex};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:pointer;transition:transform .12s ease;"
            onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
          </button>
        `).join('')}
      </div>
    `;
  }
}

function seleccionarColorAcentoDirecto(hex){
  const input = document.getElementById('cfgColorAcento');
  if(input) input.value = hex;
  document.documentElement.style.setProperty('--accent-color', hex);
  document.documentElement.style.setProperty('--primary-color', hex);
}

async function guardarConfigApariencia(){
  const colorAcento = document.getElementById('cfgColorAcento')?.value || db.config.colorAcento || '#0088ff';
  const colorFondo = document.getElementById('cfgColorFondo')?.value || db.config.colorFondo || '#0b111e';
  const modoClaro = document.getElementById('cfgModoClaro') ? document.getElementById('cfgModoClaro').checked : !!db.config.modoClaro;

  db.config.colorAcento = colorAcento;
  db.config.colorFondo = colorFondo;
  db.config.modoClaro = modoClaro;

  try{
    await dbGuardarInmediato();
    aplicarEstilosGlobales();
    mostrarToast('✅ Apariencia actualizada correctamente.', 'exito');
  }catch(err){
    mostrarToast('⚠️ Error al guardar apariencia: ' + err.message, 'error');
  }
}

function aplicarEstilosGlobales(){
  const cfg = db.config || {};
  const acento = cfg.colorAcento || '#0088ff';
  document.documentElement.style.setProperty('--accent-color', acento);
  document.documentElement.style.setProperty('--primary-color', acento);
  if(cfg.modoClaro){
    document.body.classList.add('modo-claro');
  } else {
    document.body.classList.remove('modo-claro');
  }
}
