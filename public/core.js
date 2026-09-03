function aplicarConfiguracionVisual(){
  const cfg = db.config || {};
  const acento = cfg.colorAcento || '#0088ff';
  const root = document.documentElement.style;

  root.setProperty('--blue-accent', acento);
  root.setProperty('--primary-color', acento);

  // Si hay un tema metalizado guardado, lo restauramos por completo con sus variables
  if(cfg.temaMetalizado && typeof TEMAS_CLAROS_METALIZADOS !== 'undefined'){
    const t = TEMAS_CLAROS_METALIZADOS.find(x => x.clave === cfg.temaMetalizado);
    if(t){
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
  } else if(cfg.modoClaro) {
    document.body.classList.add('modo-claro');
  } else {
    document.body.classList.remove('modo-claro');
  }

  const lblNom = document.getElementById('lblNombreEmpresa');
  if(lblNom) lblNom.innerText = cfg.nombre || 'Prevenglobal';
  const lblSub = document.getElementById('lblSubtituloEmpresa');
  if(lblSub) lblSub.innerText = cfg.subtitulo || '';
  const brand = document.getElementById('brandTitleSidebar');
  if(brand) brand.innerText = cfg.nombre || 'Prevenglobal';

  const logoNav = document.getElementById('sidebarLogo');
  const icoNav = document.getElementById('sidebarIconoDefault');
  if(logoNav && icoNav){
    if(cfg.logo){ logoNav.src = cfg.logo; logoNav.style.display = 'block'; icoNav.style.display = 'none'; }
    else { logoNav.style.display = 'none'; icoNav.style.display = 'inline'; }
  }
}
