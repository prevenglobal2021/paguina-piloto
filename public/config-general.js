// ===== config-general.js — extraído de prevenglobal__25_.html (líneas 4032-4234) =====
/* =========================================================
   CONFIGURACIÓN: EMPRESA Y PERFIL (logo, dirección, misión, visión)
========================================================= */
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
function guardarAjustesGenerales(){
  db.config.nombre = document.getElementById('cfgEmpresaNombre').value;
  db.config.subtitulo = document.getElementById('cfgEmpresaSub').value;
  db.config.direccion = document.getElementById('cfgEmpresaDireccion').value;
  db.config.mision = document.getElementById('cfgEmpresaMision').value;
  db.config.vision = document.getElementById('cfgEmpresaVision').value;
  db.config.logo = logoTempBase64;
  dbGuardar(); aplicarConfiguracionVisual();
  mostrarToast('Perfil de empresa guardado.');
}
function guardarPasswordAdmin(){
  const usuario = document.getElementById('cfgAdminUsuario').value.trim();
  const nueva = document.getElementById('cfgAdminPasswordNueva').value;
  if(usuario) db.config.adminUsuario = usuario;
  if(nueva) db.config.adminPassword = nueva;
  if(!usuario && !nueva) return;
  dbGuardar();
  document.getElementById('cfgAdminPasswordNueva').value = '';
  registrarLog('Actualizar acceso', 'Administrador', usuario || '—');
  mostrarToast('Acceso de administrador actualizado.');
}
function guardarInterruptorLogin(){
  db.config.loginRequerido = document.getElementById('cfgLoginRequerido').checked;
  dbGuardar();
  registrarLog('Actualizar acceso', 'Pantalla de login', db.config.loginRequerido ? 'Activada' : 'Desactivada');
}

/* =========================================================
   CONFIGURACIÓN: APARIENCIA (color del dashboard)
========================================================= */
const PALETAS = [
  {acento:'#0088ff', fondo:'#0b111e'},
  {acento:'#22c55e', fondo:'#0b1a12'},
  {acento:'#8b5cf6', fondo:'#120b1e'},
  {acento:'#f59e0b', fondo:'#1e1608'},
  {acento:'#ef4444', fondo:'#1e0b0b'},
  {acento:'#0ea5e9', fondo:'#0a1520'}
];
function renderizarPaletasRapidas(){
  const cont = document.getElementById('paletasRapidas');
  cont.innerHTML = PALETAS.map(p=>`<div class="paleta-opcion" style="background:${p.acento};" onclick="aplicarPaletaRapida('${p.acento}','${p.fondo}')" title="${p.acento}"></div>`).join('');
}
function aplicarPaletaRapida(acento, fondo){
  document.getElementById('cfgColorAcento').value = acento;
  document.getElementById('cfgColorFondo').value = fondo;
}
function guardarApariencia(){
  db.config.colorAcento = document.getElementById('cfgColorAcento').value;
  db.config.colorFondo = document.getElementById('cfgColorFondo').value;
  db.config.modoClaro = document.getElementById('cfgModoClaro').checked;
  db.config.tamanoLetra = document.getElementById('cfgTamanoLetra').value;
  db.config.colorTexto = document.getElementById('cfgColorTexto').value;
  db.config.formRadius = document.getElementById('cfgFormRadius').value;
  db.config.formBorderColor = document.getElementById('cfgFormBorderColor').value;
  db.config.colorSidebar1 = document.getElementById('cfgColorSidebar1').value;
  db.config.colorSidebar2 = document.getElementById('cfgColorSidebar2').value;
  db.config.colorTopbar1 = document.getElementById('cfgColorTopbar1').value;
  db.config.colorTopbar2 = document.getElementById('cfgColorTopbar2').value;
  db.config.colorPanel1 = document.getElementById('cfgColorPanel1').value;
  db.config.colorPanel2 = document.getElementById('cfgColorPanel2').value;
  db.config.fontFamily = document.getElementById('cfgTipoLetra').value;
  dbGuardar(); aplicarConfiguracionVisual();
  mostrarToast('Apariencia actualizada.');
}
function aplicarEstiloClaroDashboard(){
  // Estilo tomado de referencia: dashboards claros, fondo blanco/gris muy suave,
  // acentos azules, menú lateral y barra superior en blanco — look limpio y corporativo.
  document.getElementById('cfgModoClaro').checked = true;
  document.getElementById('cfgColorFondo').value = '#f4f6f9';
  document.getElementById('cfgColorAcento').value = '#2563eb';
  document.getElementById('cfgColorTexto').value = '#1e293b';
  document.getElementById('cfgColorSidebar1').value = '#ffffff';
  document.getElementById('cfgColorSidebar2').value = '#f1f5f9';
  document.getElementById('cfgColorTopbar1').value = '#ffffff';
  document.getElementById('cfgColorTopbar2').value = '#f8fafc';
  document.getElementById('cfgColorPanel1').value = '#ffffff';
  document.getElementById('cfgColorPanel2').value = '#f8fafc';
  guardarApariencia();
}
function aplicarEstiloMetalizadoClaro(){
  // Paleta clara "metalizada": plateado/gris-azulado muy claro de fondo con
  // acento azul-verde (teal), menú lateral y barra superior con degradé metálico suave.
  document.getElementById('cfgModoClaro').checked = true;
  document.getElementById('cfgColorFondo').value = '#eef3f4';
  document.getElementById('cfgColorAcento').value = '#0d9488';
  document.getElementById('cfgColorTexto').value = '#1e2b2e';
  document.getElementById('cfgColorSidebar1').value = '#e7edf0';
  document.getElementById('cfgColorSidebar2').value = '#cfdbe0';
  document.getElementById('cfgColorTopbar1').value = '#f0f5f4';
  document.getElementById('cfgColorTopbar2').value = '#d9e6e4';
  document.getElementById('cfgColorPanel1').value = '#ffffff';
  document.getElementById('cfgColorPanel2').value = '#eef3f4';
  guardarApariencia();
}
const PALETAS_ACERO = [
  {sidebar1:'#3b4450', sidebar2:'#1c2126', topbar1:'#3b4450', topbar2:'#20262c', panel1:'#2c333c', panel2:'#1c2126', nombre:'Acero Grafito'},
  {sidebar1:'#445468', sidebar2:'#1a2128', topbar1:'#445468', topbar2:'#1e262d', panel1:'#2e3a48', panel2:'#1a2128', nombre:'Acero Azulado'},
  {sidebar1:'#4b5563', sidebar2:'#1f242b', topbar1:'#4b5563', topbar2:'#20242b', panel1:'#333a43', panel2:'#1f242b', nombre:'Acero Plata'},
  {sidebar1:'#334155', sidebar2:'#0f172a', topbar1:'#334155', topbar2:'#111827', panel1:'#25324a', panel2:'#0f172a', nombre:'Acero Marino'},
  {sidebar1:'#52606d', sidebar2:'#232a30', topbar1:'#52606d', topbar2:'#262d33', panel1:'#38424b', panel2:'#232a30', nombre:'Acero Titanio'},
  {sidebar1:'#0f172a', sidebar2:'#0088ff', topbar1:'#0f172a', topbar2:'#1e293b', panel1:'#182338', panel2:'#0f172a', nombre:'Acero Corporativo'}
];
function renderizarPaletasAceroSidebar(){
  const cont = document.getElementById('paletasAceroSidebar');
  if(!cont) return;
  cont.innerHTML = PALETAS_ACERO.map(p=>`<div class="paleta-opcion" style="background:linear-gradient(135deg, ${p.sidebar1}, ${p.sidebar2});" onclick="aplicarPaletaAcero('${p.sidebar1}','${p.sidebar2}','${p.topbar1}','${p.topbar2}','${p.panel1}','${p.panel2}')" title="${p.nombre}"></div>`).join('');
}
function aplicarPaletaAcero(s1, s2, t1, t2, p1, p2){
  document.getElementById('cfgColorSidebar1').value = s1;
  document.getElementById('cfgColorSidebar2').value = s2;
  document.getElementById('cfgColorTopbar1').value = t1;
  document.getElementById('cfgColorTopbar2').value = t2;
  if(p1){ document.getElementById('cfgColorPanel1').value = p1; document.getElementById('cfgColorPanel2').value = p2; }
}
function restablecerColorSidebar(){
  db.config.colorSidebar1 = '#24272e';
  db.config.colorSidebar2 = '#15171c';
  db.config.colorTopbar1 = '#24272e';
  db.config.colorTopbar2 = '#191b20';
  db.config.colorPanel1 = '#212429';
  db.config.colorPanel2 = '#191b20';
  document.getElementById('cfgColorSidebar1').value = '#24272e';
  document.getElementById('cfgColorSidebar2').value = '#15171c';
  document.getElementById('cfgColorTopbar1').value = '#24272e';
  document.getElementById('cfgColorTopbar2').value = '#191b20';
  document.getElementById('cfgColorPanel1').value = '#212429';
  document.getElementById('cfgColorPanel2').value = '#191b20';
  dbGuardar(); aplicarConfiguracionVisual();
}
function restablecerColorTexto(){
  db.config.colorTexto = null;
  document.getElementById('cfgColorTexto').value = db.config.modoClaro ? '#0f172a' : '#f8fafc';
  dbGuardar(); aplicarConfiguracionVisual();
}
function restablecerBordeFormulario(){
  db.config.formBorderColor = null;
  document.getElementById('cfgFormBorderColor').value = '#1e2a3b';
  dbGuardar(); aplicarConfiguracionVisual();
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
function agregarEtiqueta(lista, inputId){
  const valor = document.getElementById(inputId).value.trim();
  if(!valor){ mostrarToast('Escribe una etiqueta.'); return; }
  if(db.config[lista].includes(valor)){ mostrarToast('Esa etiqueta ya existe.'); return; }
  db.config[lista].push(valor);
  dbGuardar();
  document.getElementById(inputId).value = '';
  renderizarEtiquetas();
}
function eliminarEtiqueta(lista, idx){
  if(db.config[lista].length<=1){ mostrarToast('Debe quedar al menos una etiqueta en la lista.'); return; }
  if(!confirm('¿Eliminar esta etiqueta? Las órdenes que ya la usan conservarán el texto guardado.')) return;
  db.config[lista].splice(idx,1);
  dbGuardar();
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
  reader.onload = e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!data.clientesNuevos || !Array.isArray(data.clientesNuevos)){
        mostrarToast('El archivo no tiene el formato esperado (se espera { clientesNuevos: [...] }).');
        return;
      }
      const nombresExistentes = new Set(db.clientes.map(c=>c.nombre.trim().toLowerCase()));
      let agregados = 0, omitidosDuplicados = 0, equiposAgregados = 0;
      data.clientesNuevos.forEach(cNuevo=>{
        const clave = (cNuevo.nombre||'').trim().toLowerCase();
        if(!clave || nombresExistentes.has(clave)){ omitidosDuplicados++; return; }
        // Aseguramos IDs internos únicos y frescos (no confiar en los del archivo)
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
      dbGuardar();
      registrarLog('Importar', 'Clientes/Equipos', `${agregados} clientes, ${equiposAgregados} equipos`);
      mostrarToast(`Importación completa: ${agregados} clientes nuevos agregados (${equiposAgregados} equipos). ${omitidosDuplicados} se omitieron por ya existir con ese nombre.`);
      renderizarClientesConfig();
    }catch(err){ mostrarToast('Error al leer el archivo: ' + err.message); }
  };
  reader.readAsText(file);
}
function importarBaseDatosJSON(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(data.clientes && data.plantillas && data.ordenes){
        db = data; dbGuardar();
        mostrarToast('Base de datos importada con éxito.');
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
