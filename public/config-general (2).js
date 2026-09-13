// ===== config-general.js — Configuración General, Empresa, Logo Adaptable y Temas Metalizados =====
/* =========================================================
   CONFIGURACIÓN: EMPRESA Y PERFIL
========================================================= */
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

    // Vista previa inmediata en la barra lateral en tiempo real antes de guardar
    actualizarLogoEnBarraLateral(logoTempBase64);
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
    mostrarToast('✅ Logo y configuración general guardados correctamente.', 'exito');
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
   TEMAS EMPRESARIALES METALIZADOS
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
   ACTUALIZACIÓN AUTOMÁTICA DEL LOGO EN TODA LA BARRA LATERAL
   (empresa) — el ícono/banner GLOBAL de plataforma (SuperAdmin) se
   aplica aparte, en cargarYAplicarBannerLateralGlobal() (core.js);
   el logo de la EMPRESA siempre manda sobre ese ícono global cuando
   ambos existen — ver el final de esta función.
========================================================= */
function actualizarLogoEnBarraLateral(logoSrc){
  const src = logoSrc || db.config?.logo;
  const sidebarHeader = document.querySelector('aside > div:first-child') || document.querySelector('.sidebar-header');
  if(!sidebarHeader) return;

  let logoContenedor = sidebarHeader.querySelector('.contenedor-logo-encuadrado');
  if(!logoContenedor){
    sidebarHeader.innerHTML = '';
    logoContenedor = document.createElement('div');
    logoContenedor.className = 'contenedor-logo-encuadrado';
    sidebarHeader.appendChild(logoContenedor);
  }

  if(src){
    logoContenedor.innerHTML = `
      <div class="marco-logo-encuadrado">
        <img src="${src}" class="img-logo-barra-lateral" alt="${db.config?.nombre || 'Prevenglobal'}">
      </div>
      <span class="txt-nombre-empresa-barra">${db.config?.nombre || 'Prevenglobal'}</span>
    `;
    logoContenedor.style.display = 'flex';
  } else if(typeof bannerLateralIconoGlobalCache !== 'undefined' && bannerLateralIconoGlobalCache){
    // Sin logo propio de la empresa: se usa el ícono global que haya
    // configurado el SuperAdmin (en vez del copo de nieve genérico).
    logoContenedor.innerHTML = `
      <div class="icono-reemplazo-logo"><img src="${bannerLateralIconoGlobalCache}" style="max-width:60px;max-height:60px;border-radius:8px;"></div>
      <span class="txt-nombre-empresa-barra">${db.config?.nombre || 'Prevenglobal'}</span>
    `;
  } else {
    logoContenedor.innerHTML = `
      <div class="icono-reemplazo-logo"><i class="fas fa-snowflake"></i></div>
      <span class="txt-nombre-empresa-barra">${db.config?.nombre || 'Prevenglobal'}</span>
    `;
  }
}

/* =========================================================
   INYECCIÓN VISUAL TOTAL EN EL DOM
========================================================= */
function aplicarConfiguracionVisual(){
  const cfg = db.config || {};
  const tema = TEMAS_CLAROS.find(t => t.acento === cfg.colorAcento && t.colorFondoSolido === cfg.colorFondo) || TEMAS_CLAROS[0];
  const root = document.documentElement;

  // Variables "nuevas" (sistema de temas metalizados)
  root.style.setProperty('--accent-color', cfg.colorAcento || tema.acento);
  root.style.setProperty('--bg-body', tema.colorFondoSolido);
  root.style.setProperty('--text-main', tema.texto);
  root.style.setProperty('--text-color', tema.texto);
  root.style.setProperty('--text-muted', tema.textoMuted);
  root.style.setProperty('--card-bg', tema.panel2);
  root.style.setProperty('--panel-bg', tema.panel2);
  root.style.setProperty('--card-border', tema.borde);

  // Variables "antiguas" — el CSS original de index.html todavía las usa
  // en muchos lugares; se mantienen sincronizadas con el mismo tema elegido
  // arriba, para que un cambio de tema se vea reflejado en TODA la plataforma,
  // no solo en las partes que ya usan las variables nuevas.
  root.style.setProperty('--blue-accent', tema.acento);
  root.style.setProperty('--primary-color', tema.acento);
  root.style.setProperty('--bg-dark', tema.colorFondoSolido);
  root.style.setProperty('--sidebar-bg-1', tema.sidebar1);
  root.style.setProperty('--sidebar-bg-2', tema.sidebar2);
  root.style.setProperty('--topbar-bg-1', tema.topbar1);
  root.style.setProperty('--topbar-bg-2', tema.topbar2);
  root.style.setProperty('--panel-bg-1', tema.panel1);
  root.style.setProperty('--panel-bg-2', tema.panel2);
  document.body.classList.add('modo-claro');

  const lblNom = document.getElementById('lblNombreEmpresa');
  if(lblNom) lblNom.innerText = cfg.nombre || 'Prevenglobal';
  const lblSub = document.getElementById('lblSubtituloEmpresa');
  if(lblSub) lblSub.innerText = cfg.subtitulo || '';

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
      width: 270px !important;
    }

    /* ENCUADRE TOTAL DEL LOGO EN LA BARRA LATERAL IZQUIERDA */
    aside > div:first-child, .sidebar-header {
      padding: 12px 14px 14px 14px !important;
      border-bottom: 2px solid ${tema.borde} !important;
      background: ${tema.sidebar2}22 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .contenedor-logo-encuadrado {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      gap: 10px !important;
    }

    .marco-logo-encuadrado {
      width: 100% !important;
      height: 170px !important; /* Altura optimizada para encuadre 10x10 cm en pantalla */
      background: ${tema.esOscuro ? '#090d16' : '#ffffff'} !important;
      border: 2px solid ${tema.borde} !important;
      border-radius: 12px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 10px !important;
      box-sizing: border-box !important;
      box-shadow: 0 4px 14px rgba(0,0,0, ${tema.esOscuro ? '0.5' : '0.12'}) !important;
      overflow: hidden !important;
    }

    .img-logo-barra-lateral {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important; /* Mantiene la proporción perfecta del logo sin cortarlo ni deformarlo */
      display: block !important;
    }

    .txt-nombre-empresa-barra {
      font-size: 15px !important;
      font-weight: 800 !important;
      letter-spacing: .03em !important;
      color: ${tema.texto} !important;
      text-transform: uppercase !important;
      text-align: center !important;
    }

    .icono-reemplazo-logo {
      width: 100% !important;
      height: 120px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 48px !important;
      color: ${tema.acento} !important;
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

  // Renderizar o actualizar el logo encuadrado de inmediato
  actualizarLogoEnBarraLateral();
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
    localStorage.removeItem(claveDbLocal());
    location.reload();
  }
}
