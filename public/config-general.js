// ===== config-general.js — Configuración General, Empresa y Apariencia =====
/* =========================================================
   CONFIGURACIÓN GENERAL Y APARIENCIA
========================================================= */

function renderizarConfigGeneral(){
  const cfg = db.config || {};
  document.getElementById('cfgNombreEmpresa').value = cfg.nombre || '';
  document.getElementById('cfgSubtitulo').value = cfg.subtitulo || '';
  document.getElementById('cfgDireccion').value = cfg.direccion || '';
  document.getElementById('cfgMision').value = cfg.mision || '';
  document.getElementById('cfgVision').value = cfg.vision || '';
  document.getElementById('cfgAdminUsuario').value = cfg.adminUsuario || '';
  document.getElementById('cfgAdminPassword').value = '';
  
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
  const nombre = document.getElementById('cfgNombreEmpresa').value.trim();
  const subtitulo = document.getElementById('cfgSubtitulo').value.trim();
  const direccion = document.getElementById('cfgDireccion').value.trim();
  const mision = document.getElementById('cfgMision').value.trim();
  const vision = document.getElementById('cfgVision').value.trim();
  const adminUsuario = document.getElementById('cfgAdminUsuario').value.trim();
  const adminPassword = document.getElementById('cfgAdminPassword').value;

  if(!nombre){ mostrarToast('El nombre de la empresa es obligatorio.'); return; }
  if(!adminUsuario){ mostrarToast('El usuario administrador es obligatorio.'); return; }

  db.config.nombre = nombre;
  db.config.subtitulo = subtitulo;
  db.config.direccion = direccion;
  db.config.mision = mision;
  db.config.vision = vision;
  db.config.adminUsuario = adminUsuario;
  if(adminPassword && adminPassword.trim().length >= 4){
    db.config.adminPassword = adminPassword.trim();
  }

  try{
    await dbGuardarInmediato();
    mostrarToast('✅ Configuración general guardada.', 'exito');
    aplicarMarcaGlobal();
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
  document.getElementById('cfgInputLogo').value = '';
}

/* ---------------------------------------------------------
   APARIENCIA: Colores marcados y estilos
--------------------------------------------------------- */
const PALETA_COLORES_MARCADOS = [
  { nombre: 'Azul Industrial Intenso', hex: '#0055ff' },
  { nombre: 'Rojo Fuego Operativo', hex: '#dc2626' },
  { nombre: 'Naranja Mecánico', hex: '#ea580c' },
  { nombre: 'Verde Esmeralda Vivo', hex: '#059669' },
  { nombre: 'Violeta Eléctrico', hex: '#7c3aed' },
  { nombre: 'Ámbar Alerta Fuerte', hex: '#d97706' },
  { nombre: 'Cian Neón', hex: '#06b6d4' },
  { nombre: 'Grafito Oscuro Mate', hex: '#1e293b' },
  { nombre: 'Azul Océano Profundo', hex: '#0369a1' },
  { nombre: 'Rosa Neón Fuerte', hex: '#e11d48' }
];

function renderizarConfigApariencia(){
  const cfg = db.config || {};
  const acentoInput = document.getElementById('cfgColorAcento');
  if(acentoInput) acentoInput.value = cfg.colorAcento || '#0055ff';

  const fondoInput = document.getElementById('cfgColorFondo');
  if(fondoInput) fondoInput.value = cfg.colorFondo || '#0b111e';

  const modoClaroCheck = document.getElementById('cfgModoClaro');
  if(modoClaroCheck) modoClaroCheck.checked = !!cfg.modoClaro;

  // Generación de la paleta con colores más marcados
  let contPaleta = document.getElementById('paletaColoresMarcados');
  if(!contPaleta && acentoInput){
    contPaleta = document.createElement('div');
    contPaleta.id = 'paletaColoresMarcados';
    contPaleta.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;margin-bottom:15px;align-items:center;';
    acentoInput.parentNode.appendChild(contPaleta);
  }

  if(contPaleta){
    contPaleta.innerHTML = `
      <div style="width:100%;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">
        Colores recomendados de alto contraste:
      </div>
      ${PALETA_COLORES_MARCADOS.map(c=>`
        <button type="button" onclick="seleccionarColorAcento('${c.hex}')" 
          title="${c.nombre} (${c.hex})" 
          style="width:34px;height:34px;border-radius:50%;background:${c.hex};border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer;transition:transform .15s ease;"
          onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
        </button>
      `).join('')}
    `;
  }
}

function seleccionarColorAcento(hex){
  const input = document.getElementById('cfgColorAcento');
  if(input) input.value = hex;
  aplicarColorTemporal(hex);
}

function aplicarColorTemporal(hex){
  document.documentElement.style.setProperty('--accent-color', hex);
  document.documentElement.style.setProperty('--primary-color', hex);
}

async function guardarConfigApariencia(){
  const colorAcento = document.getElementById('cfgColorAcento').value;
  const colorFondo = document.getElementById('cfgColorFondo').value;
  const modoClaro = document.getElementById('cfgModoClaro').checked;

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
  const acento = cfg.colorAcento || '#0055ff';
  document.documentElement.style.setProperty('--accent-color', acento);
  document.documentElement.style.setProperty('--primary-color', acento);
  if(cfg.modoClaro){
    document.body.classList.add('modo-claro');
  } else {
    document.body.classList.remove('modo-claro');
  }
}
