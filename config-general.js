// ===== config-general.js — extraído de prevenglobal__25_.html (líneas 4032-4234) =====
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
  inputEl.disabled = true; // evita que se pueda volver a intentar subir mientras se procesa la actual
  if(btnGuardar) btnGuardar.disabled = true; // evita guardar antes de que la imagen termine de procesarse
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
      // Solo se reemplaza la imagen guardada si el procesamiento fue exitoso —
      // si algo falla, lo que ya estaba configurado antes queda intacto.
      loginImagenTempBase64 = data.imagen;
      actualizarPreviewLoginMini();
      estadoEl.innerText = '✅ Imagen lista (recortada a 1080x1920, vista previa arriba). Falta guardar los cambios.';
      estadoEl.style.color = 'var(--exito-verde,#22c55e)';
    }).catch(err=>{
      estadoEl.innerText = '⚠️ ' + err.message;
      estadoEl.style.color = 'var(--red-alert)';
      inputEl.value = ''; // limpia la selección fallida, para que quede claro que hay que elegir otra
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
    mostrarToast('✅ Pantalla de login guardada. Se verá así la próxima vez que alguien inicie sesión.', 'exito');
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
    mostrarToast('✅ Perfil de empresa, representante y firma guardados.', 'exito');
  }catch(err){
    mostrarToast('⚠️ No se guardó: ' + err.message, 'error');
  }
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
   CONFIGURACIÓN: APARIENCIA (temas del dashboard)
   Antes se podía elegir CUALQUIER color con un selector libre,
   incluidos tonos oscuros. Ahora solo se puede elegir entre estos
   6 temas ya armados, todos claros o metalizados claros —
   así es imposible dejar la plataforma con un tema oscuro.
========================================================= */
const TEMAS_CLAROS = [
  { nombre:'Claro Corporativo', acento:'#2563eb', fondo:'#f4f6f9', texto:'#1e293b', sidebar1:'#ffffff', sidebar2:'#f1f5f9', topbar1:'#ffffff', topbar2:'#f8fafc', panel1:'#ffffff', panel2:'#f8fafc' },
  { nombre:'Metalizado Claro', acento:'#0d9488', fondo:'#eef3f4', texto:'#1e2b2e', sidebar1:'#e7edf0', sidebar2:'#cfdbe0', topbar1:'#f0f5f4', topbar2:'#d9e6e4', panel1:'#ffffff', panel2:'#eef3f4' },
  { nombre:'Verde Esmeralda Claro', acento:'#16a34a', fondo:'#f0fdf4', texto:'#14532d', sidebar1:'#ffffff', sidebar2:'#dcfce7', topbar1:'#ffffff', topbar2:'#ecfdf5', panel1:'#ffffff', panel2:'#f0fdf4' },
  { nombre:'Azul Marino Claro', acento:'#1d4ed8', fondo:'#eff6ff', texto:'#1e3a5f', sidebar1:'#ffffff', sidebar2:'#dbeafe', topbar1:'#ffffff', topbar2:'#eff6ff', panel1:'#ffffff', panel2:'#eff6ff' },
  { nombre:'Plata Azulada Metalizada', acento:'#0369a1', fondo:'#eef2f5', texto:'#1e293b', sidebar1:'#e2e8f0', sidebar2:'#cbd5e1', topbar1:'#eef2f5', topbar2:'#dde4ea', panel1:'#ffffff', panel2:'#eef2f5' },
  { nombre:'Menta Fresca', acento:'#0d9488', fondo:'#f0fdfa', texto:'#134e4a', sidebar1:'#ffffff', sidebar2:'#ccfbf1', topbar1:'#ffffff', topbar2:'#f0fdfa', panel1:'#ffffff', panel2:'#ecfeff' },
];
let temaClaroSeleccionadoIdx = 0;
function renderizarTemasClaros(){
  const cont = document.getElementById('temasClarosGrid');
  if(!cont) return;
  // Si el tema ya guardado coincide con alguno del catálogo, lo marca como seleccionado al abrir.
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
  db.config.modoClaro = true; // siempre claro, ya no existe la opción oscura
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
  try{
    await dbGuardarInmediato();
    aplicarConfiguracionVisual();
    mostrarToast('✅ Apariencia guardada correctamente.', 'exito');
    cerrarModal('modalConfigCentro');
  }catch(err){
    mostrarToast('⚠️ No se guardó: ' + err.message, 'error');
  }
}
function restablecerColorTexto(){
  const tema = TEMAS_CLAROS[temaClaroSeleccionadoIdx] || TEMAS_CLAROS[0];
  db.config.colorTexto = null;
  document.getElementById('cfgColorTexto').value = tema.texto;
  dbGuardar(); aplicarConfiguracionVisual();
}
function restablecerBordeFormulario(){
  db.config.formBorderColor = null;
  document.getElementById('cfgFormBorderColor').value = '#cbd5e1';
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
