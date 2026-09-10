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
    const img = new Image();
    img.onload = () => {
      // Ajuste automático: solo reduce si hace falta (nunca agranda una
      // imagen pequeña) y siempre conserva la proporción original, para
      // que el logo nunca se vea estirado ni deformado sin importar el
      // tamaño o la forma del archivo que se suba. De paso, evita que
      // fotos gigantes de celular infravioleten la base de datos.
      const maxLado = 480;
      let { width, height } = img;
      if(width > maxLado || height > maxLado){
        const escala = Math.min(maxLado / width, maxLado / height);
        width = Math.round(width * escala);
        height = Math.round(height * escala);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      logoTempBase64 = canvas.toDataURL('image/png'); // PNG conserva la transparencia del logo
      const prev = document.getElementById('previewLogoConfig');
      prev.src = logoTempBase64; prev.style.display='inline-block';
      document.getElementById('previewLogoConfigPlaceholder').style.display='none';
    };
    img.onerror = () => mostrarToast('No se pudo leer esa imagen. Intenta con otro archivo.', 'error');
    img.src = e.target.result;
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
    mostrarToast('⚠️ No se pudo guardar el acceso de administrador: ' + err.message, 'error');
    return;
  }
  document.getElementById('cfgAdminPasswordNueva').value = '';
  registrarLog('Actualizar acceso', 'Administrador', usuario || '—');
  mostrarToast('✅ Acceso de administrador actualizado.', 'exito');
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
  db.config.logo = logoTempBase64;
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
  db.config.formTamanoBotones = document.getElementById('cfgFormTamanoBotones').value;
  try{
    await dbGuardarInmediato();
    aplicarConfiguracionVisual();
    mostrarToast('✅ Apariencia guardada correctamente.', 'exito');
    cerrarModal('modalConfigCentro');
  }catch(err){
    mostrarToast('⚠️ No se guardó: ' + err.message, 'error');
  }
}
async function restablecerColorTexto(){
  db.config.colorTexto = null;
  const tema = TEMAS_CLAROS[temaClaroSeleccionadoIdx] || TEMAS_CLAROS[0];
  document.getElementById('cfgColorTexto').value = tema.texto;
  try{ await dbGuardarInmediato(); }catch(err){ mostrarToast('⚠️ No se pudo restablecer: ' + err.message, 'error'); return; }
  aplicarConfiguracionVisual();
  mostrarToast('✅ Color de letra restablecido.', 'exito');
}
async function restablecerBordeFormulario(){
  db.config.formBorderColor = null;
  document.getElementById('cfgFormBorderColor').value = '#cbd5e1';
  try{ await dbGuardarInmediato(); }catch(err){ mostrarToast('⚠️ No se pudo restablecer: ' + err.message, 'error'); return; }
  aplicarConfiguracionVisual();
  mostrarToast('✅ Color de borde restablecido.', 'exito');
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
async function agregarEtiqueta(lista, inputId){
  const valor = document.getElementById(inputId).value.trim();
  if(!valor){ mostrarToast('Escribe una etiqueta.'); return; }
  if(db.config[lista].includes(valor)){ mostrarToast('Esa etiqueta ya existe.'); return; }
  db.config[lista].push(valor);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.config[lista].pop();
    mostrarToast('⚠️ No se pudo guardar: ' + err.message, 'error');
    return;
  }
  document.getElementById(inputId).value = '';
  renderizarEtiquetas();
}
async function eliminarEtiqueta(lista, idx){
  if(db.config[lista].length<=1){ mostrarToast('Debe quedar al menos una etiqueta en la lista.'); return; }
  if(!confirm('¿Eliminar esta etiqueta? Las órdenes que ya la usan conservarán el texto guardado.')) return;
  const respaldo = db.config[lista].slice();
  db.config[lista].splice(idx,1);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.config[lista] = respaldo;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  mostrarToast('✅ Etiqueta eliminada.', 'exito');
  renderizarEtiquetas();
}

/* =========================================================
   BACKUP / RESET / EXPORT
========================================================= */
async function exportarBaseDatosJSON(){
  // Antes esto exportaba la copia local del navegador, que podría estar
  // desactualizada o incompleta (el mismo riesgo que causó la pérdida de
  // información). Ahora se pide directo al servidor la versión real y
  // confirmada — así el respaldo siempre refleja lo que de verdad hay guardado.
  //
  // Mejora: ahora también queda registrada la fecha de este respaldo (en el
  // servidor, visible desde cualquier dispositivo) — así la plataforma
  // puede avisar si ya ha pasado mucho tiempo sin descargar uno, en vez de
  // depender por completo de que alguien se acuerde de hacerlo "de vez en
  // cuando".
  try{
    const resp = await fetchConLimite(API_BASE + '/api/backup', { headers: headersAutenticados() }, 20);
    if(!resp.ok) throw new Error('El servidor no pudo generar el respaldo (código ' + resp.status + ').');
    const blob = await resp.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Prevenglobal_Backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    mostrarToast('✅ Respaldo descargado — es la versión real y confirmada del servidor.', 'exito');
    db.config.ultimoRespaldoManualDescargado = new Date().toISOString();
    dbGuardarInmediato().catch(()=>{}); // no crítico: si esto falla, el respaldo ya se descargó igual, solo no queda anotada la fecha
    actualizarAvisoRespaldoManual();
  }catch(err){
    mostrarToast('⚠️ No se pudo descargar el respaldo del servidor: ' + err.message + ' — se descargará la copia local como alternativa.', 'error');
    const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Prevenglobal_Backup_LOCAL_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
// Muestra cuánto tiempo lleva sin descargarse un respaldo manual, con aviso
// de color si ya pasaron más de 14 días — para que "de vez en cuando" no
// dependa solo de la memoria de alguien.
function actualizarAvisoRespaldoManual(){
  const el = document.getElementById('avisoRespaldoManual');
  if(!el) return;
  const fechaStr = db.config.ultimoRespaldoManualDescargado;
  if(!fechaStr){
    el.innerHTML = '⚪ Todavía no has descargado ningún respaldo manual.';
    el.style.color = 'var(--text-muted)';
    return;
  }
  const dias = Math.floor((Date.now() - new Date(fechaStr).getTime()) / (1000*60*60*24));
  const fechaLegible = new Date(fechaStr).toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric' });
  if(dias < 1){
    el.innerHTML = `🟢 Último respaldo descargado: hoy (${fechaLegible}).`;
    el.style.color = 'var(--green-success)';
  } else if(dias <= 14){
    el.innerHTML = `🟢 Último respaldo descargado: hace ${dias} día${dias===1?'':'s'} (${fechaLegible}).`;
    el.style.color = 'var(--green-success)';
  } else {
    el.innerHTML = `🟠 Último respaldo descargado: hace ${dias} días (${fechaLegible}) — ya es un buen momento para descargar uno nuevo.`;
    el.style.color = 'var(--orange-warning)';
  }
}
function importarClientesEquipos(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!data.clientesNuevos || !Array.isArray(data.clientesNuevos)){
        mostrarToast('El archivo no tiene el formato esperado (se espera { clientesNuevos: [...] }).');
        return;
      }
      const nombresExistentes = new Set(db.clientes.map(c=>c.nombre.trim().toLowerCase()));
      let agregados = 0, omitidosDuplicados = 0, equiposAgregados = 0;
      const respaldo = db.clientes.slice();
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
      try{
        await dbGuardarInmediato();
      }catch(err){
        db.clientes = respaldo;
        mostrarToast('⚠️ No se pudo guardar la importación: ' + err.message, 'error');
        return;
      }
      registrarLog('Importar', 'Clientes/Equipos', `${agregados} clientes, ${equiposAgregados} equipos`);
      mostrarToast(`✅ Importación completa: ${agregados} clientes nuevos agregados (${equiposAgregados} equipos). ${omitidosDuplicados} se omitieron por ya existir con ese nombre.`, 'exito');
      renderizarClientesConfig();
    }catch(err){ mostrarToast('Error al leer el archivo: ' + err.message); }
  };
  reader.readAsText(file);
}
function importarBaseDatosJSON(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async e=>{
    let data;
    try{
      data = JSON.parse(e.target.result);
    }catch(err){ mostrarToast('Error al leer el archivo JSON — asegúrate de que sea un respaldo válido.', 'error'); event.target.value=''; return; }
    if(!(data.clientes && data.plantillas && data.ordenes)){
      mostrarToast('El archivo no tiene el formato esperado de un respaldo de Prevenglobal.', 'error');
      event.target.value = '';
      return;
    }
    // Antes esto reemplazaba TODA la base de datos al instante, sin mostrar
    // qué había en el archivo ni pedir confirmación — bastaba con elegir el
    // archivo equivocado por error para perder todo lo actual sin aviso.
    // Ahora se muestra un resumen de ambos lados (lo que hay ahora vs. lo
    // que trae el archivo) y hay que confirmar a propósito antes de seguir.
    const contarEntidades = (estado) => ({
      clientes: (estado.clientes||[]).length,
      ordenes: (estado.ordenes||[]).length,
      inventario: (estado.inventario||[]).length,
      nomina: (estado.liquidacionesNomina||[]).length,
    });
    const actual = contarEntidades(db);
    const delArchivo = contarEntidades(data);
    const huboMenos = delArchivo.clientes < actual.clientes || delArchivo.ordenes < actual.ordenes;
    const advertencia = huboMenos ? '\n\n⚠️ Este archivo tiene MENOS información que la actual — probablemente sea un respaldo viejo.' : '';
    const mensaje = `Esto REEMPLAZA toda la información actual por la del archivo:\n\n`
      + `Ahora tienes: ${actual.clientes} clientes, ${actual.ordenes} órdenes, ${actual.inventario} ítems de inventario, ${actual.nomina} liquidaciones de nómina.\n`
      + `El archivo trae: ${delArchivo.clientes} clientes, ${delArchivo.ordenes} órdenes, ${delArchivo.inventario} ítems de inventario, ${delArchivo.nomina} liquidaciones de nómina.`
      + advertencia
      + `\n\n¿Continuar con el reemplazo?`;
    if(!confirm(mensaje)){ event.target.value=''; return; }
    const respaldo = db;
    db = data;
    try{
      await dbGuardarInmediato();
    }catch(err){
      db = respaldo;
      mostrarToast('⚠️ No se pudo guardar la base de datos importada: ' + err.message, 'error');
      event.target.value = '';
      return;
    }
    mostrarToast('✅ Base de datos importada con éxito.', 'exito');
    location.reload();
  };
  reader.readAsText(file);
}
function limpiarCacheLocal(){
  // Antes se llamaba "Reiniciar Base de Datos", un nombre engañoso: como la
  // información real vive en el servidor, esto nunca borró nada de verdad —
  // solo limpia la copia guardada en este navegador y trae de nuevo la
  // versión real del servidor. Útil si el navegador quedó con datos viejos
  // en caché, pero no es un borrado real de ninguna información.
  if(confirm('¿Limpiar la copia local guardada en este navegador y recargar la versión real desde el servidor? No se borra ninguna información real — solo la caché de este dispositivo.')){
    localStorage.removeItem(DB_KEY);
    location.reload();
  }
}
