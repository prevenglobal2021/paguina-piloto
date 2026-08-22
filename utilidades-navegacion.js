// ===== utilidades-navegacion.js — extraído de prevenglobal__25_.html (líneas 1957-2126) =====
/* =========================================================
   UTILIDADES DE CONSULTA
========================================================= */
function buscarCliente(id){ return db.clientes.find(c=>c.id===id); }
// Antes de aplicar negrita/viñetas/etc., el área de texto necesita tener un
// cursor o selección activa DENTRO de ella — con solo .focus() no basta si
// el usuario nunca tocó el texto primero. Esto coloca el cursor al final
// del texto si todavía no había ninguno puesto ahí.
function enfocarYColocarCursor(idEditor){
  const el = document.getElementById(idEditor);
  if(!el) return null;
  el.focus();
  const seleccion = window.getSelection();
  const yaHayCursorAdentro = seleccion.rangeCount > 0 && el.contains(seleccion.getRangeAt(0).commonAncestorContainer);
  if(!yaHayCursorAdentro){
    const rango = document.createRange();
    rango.selectNodeContents(el);
    rango.collapse(false); // al final del texto ya escrito
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
  }
  return el;
}
// Aplica el formato de la barra tipo Word. Algunos navegadores de celular
// rechazan ciertos comandos (por ejemplo, "resaltar" a veces necesita el
// nombre alterno "backColor" en vez de "hiliteColor") — si el primer intento
// no funciona, se reintenta automáticamente con el alterno antes de avisar
// que ese formato no es compatible con ese navegador.
function ejecutarFormatoRico(idEditor, comando, valor){
  const el = enfocarYColocarCursor(idEditor);
  if(!el) return;
  // Tipo y tamaño de letra necesitan texto SELECCIONADO para verse — con
  // solo el cursor parpadeando (sin nada resaltado), el navegador no muestra
  // ningún cambio, aunque el comando "funcione" por dentro. Si no hay nada
  // seleccionado, se selecciona todo lo ya escrito, para que el cambio se
  // vea de inmediato en todo el texto.
  if(comando==='fontName' || comando==='fontSize'){
    const seleccion = window.getSelection();
    const haySeleccionConTexto = seleccion.rangeCount > 0 && !seleccion.getRangeAt(0).collapsed;
    if(!haySeleccionConTexto && el.textContent.trim()){
      const rango = document.createRange();
      rango.selectNodeContents(el);
      seleccion.removeAllRanges();
      seleccion.addRange(rango);
    }
  }
  let exito = false;
  try{ exito = document.execCommand(comando, false, valor===undefined?null:valor); }catch(e){ exito = false; }
  if(!exito && comando==='hiliteColor'){
    try{ exito = document.execCommand('backColor', false, valor); }catch(e){ /* tampoco este navegador lo admite */ }
  }
  if(!exito){
    mostrarToast('Ese formato no es compatible con este navegador — prueba actualizar la app o usar otro navegador.', 'error');
  }
  actualizarEstadoBotonesFormato(idEditor);
}
// Ilumina los botones (negrita/cursiva/subrayado) cuando el cursor está
// sobre texto que ya tiene ese formato — igual que en Word, para saber de
// un vistazo qué está activo, sin tener que adivinar.
function actualizarEstadoBotonesFormato(idEditor){
  const el = document.getElementById(idEditor);
  if(!el) return;
  const barra = el.previousElementSibling;
  if(!barra || !barra.classList.contains('editor-rico-toolbar')) return;
  const mapaComandos = { 'Negrita':'bold', 'Cursiva':'italic', 'Subrayado':'underline' };
  barra.querySelectorAll('button[title]').forEach(boton=>{
    const comando = mapaComandos[boton.title];
    if(!comando) return;
    let activo = false;
    try{ activo = document.queryCommandState(comando); }catch(e){ activo = false; }
    boton.classList.toggle('activo', activo);
  });
}
document.addEventListener('selectionchange', ()=>{
  const activo = document.activeElement;
  if(activo && activo.classList && activo.classList.contains('editor-rico-area')) actualizarEstadoBotonesFormato(activo.id);
});
// Genera la barra de formato tipo Word + el área de texto enriquecido, para
// cualquier campo de "observaciones" de la plataforma — un solo componente
// reutilizado tanto en el diagnóstico general como en los campos dinámicos
// de plantilla de tipo "Observación larga".
function generarEditorRico(idEditor, contenidoInicial, soloLectura, atributoDataCampo){
  const idSeguro = idEditor.replace(/'/g,"\\'");
  const evitarPerderFoco = 'onmousedown="event.preventDefault()" ontouchstart="event.preventDefault()"';
  return `<div class="editor-rico-toolbar" ${soloLectura?'style="display:none;"':''}>
    <select ${evitarPerderFoco} onchange="ejecutarFormatoRico('${idSeguro}','fontName',this.value);" title="Tipo de letra">
      <option value="Arial,sans-serif">Arial</option>
      <option value="Georgia,serif">Georgia</option>
      <option value="'Courier New',monospace">Courier</option>
      <option value="Verdana,sans-serif">Verdana</option>
    </select>
    <select ${evitarPerderFoco} onchange="ejecutarFormatoRico('${idSeguro}','fontSize',this.value);" title="Tamaño de letra">
      <option value="2">Pequeño</option>
      <option value="3" selected>Normal</option>
      <option value="5">Grande</option>
      <option value="7">Muy grande</option>
    </select>
    <span class="editor-rico-separador"></span>
    <button type="button" ${evitarPerderFoco} onclick="ejecutarFormatoRico('${idSeguro}','bold');" title="Negrita"><b>N</b></button>
    <button type="button" ${evitarPerderFoco} onclick="ejecutarFormatoRico('${idSeguro}','italic');" title="Cursiva"><i>K</i></button>
    <button type="button" ${evitarPerderFoco} onclick="ejecutarFormatoRico('${idSeguro}','underline');" title="Subrayado"><u>S</u></button>
    <span class="editor-rico-separador"></span>
    <input type="color" value="#fef08a" ${evitarPerderFoco} onchange="ejecutarFormatoRico('${idSeguro}','hiliteColor',this.value);" title="Resaltar texto">
    <span class="editor-rico-separador"></span>
    <button type="button" ${evitarPerderFoco} onclick="ejecutarFormatoRico('${idSeguro}','insertUnorderedList');" title="Viñetas"><i class="fas fa-list-ul"></i></button>
    <button type="button" ${evitarPerderFoco} onclick="ejecutarFormatoRico('${idSeguro}','removeFormat');" title="Quitar formato"><i class="fas fa-eraser"></i></button>
  </div>
  <div class="editor-rico-area" id="${idEditor}" ${atributoDataCampo?`data-campo="${atributoDataCampo}"`:''} contenteditable="${soloLectura?'false':'true'}" data-placeholder="Escribe aquí...">${contenidoInicial||''}</div>`;
}
/* =========================================================
   UBICACIÓN GPS — botón reutilizable para cualquier campo de
   dirección de la plataforma. Usa el GPS del dispositivo y
   convierte las coordenadas a una dirección legible (servicio
   gratuito de OpenStreetMap, sin necesidad de clave ni configurar
   nada). Si no se puede convertir a texto, deja las coordenadas
   tal cual — nunca deja el campo vacío por un fallo de conversión.
========================================================= */
async function obtenerUbicacionGPS(inputId, botonId){
  if(!navigator.geolocation){ mostrarToast('Tu navegador no permite obtener la ubicación GPS.', 'error'); return; }
  const boton = document.getElementById(botonId);
  const input = document.getElementById(inputId);
  const textoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo ubicación...';
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const { latitude, longitude } = pos.coords;
    let direccion = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    try{
      const resp = await fetchConLimite(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {}, 10);
      if(resp.ok){
        const data = await resp.json();
        if(data && data.display_name) direccion = data.display_name;
      }
    }catch(err){ /* si falla la conversión a texto, se dejan las coordenadas — nunca se deja el campo vacío */ }
    if(input.tagName==='TEXTAREA' && input.value.trim()){
      input.value = input.value.trim() + ' — ' + direccion; // en campos de notas, se agrega sin borrar lo ya escrito
    } else {
      input.value = direccion;
    }
    mostrarToast('📍 Ubicación obtenida correctamente.');
    boton.disabled = false; boton.innerHTML = textoOriginal;
  }, (err)=>{
    boton.disabled = false; boton.innerHTML = textoOriginal;
    let msg = 'No se pudo obtener tu ubicación.';
    if(err.code === 1) msg = 'Permiso de ubicación denegado — actívalo en la configuración de tu navegador o celular.';
    else if(err.code === 2) msg = 'No se pudo determinar tu ubicación (señal GPS no disponible en este momento).';
    else if(err.code === 3) msg = 'Se agotó el tiempo esperando la ubicación. Intenta de nuevo.';
    mostrarToast(msg, 'error');
  }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
}
/* =========================================================
   FIRMA TÁCTIL — componente único, reutilizado en:
   - Firma del técnico y del cliente al cerrar una orden de servicio.
   - Firma del representante en Configuración de empresa.
   En celular, en vertical, la caja de firma se GIRA 90° con CSS para dar
   todo el ancho de la pantalla como espacio de firma. El lienzo (canvas)
   NO se gira internamente — solo se traduce matemáticamente la posición
   del dedo/mouse a las coordenadas reales del lienzo, para que el trazo
   quede exactamente donde se tocó, sin desalinearse por el giro visual.
========================================================= */
let firmaTactilContexto = null; // 'tecnico' | 'cliente' | 'representante'
let firmaTactilCtx = null;
let firmaTactilRotada = false;
let firmaTactilDibujando = false;
let firmaTecnicoTemp = null, firmaClienteTemp = null;

function abrirFirmaTactil(contexto, firmaExistente){
  firmaTactilContexto = contexto;
  const titulos = { tecnico:'Firma del Técnico', cliente:'Firma de quien recibe el servicio', representante:'Firma del Representante' };
  document.getElementById('firmaTactilTitulo').innerText = titulos[contexto] || 'Firma';
  const overlay = document.getElementById('firmaTactilOverlay');
  const caja = document.getElementById('firmaTactilCaja');
  overlay.classList.add('activa');
  // Bloqueo robusto del fondo mientras se firma: además de ocultar el scroll,
  // se fija la posición de la página (evita el "rebote" de iOS al arrastrar
  // el dedo cerca de los bordes, que antes también sacudía la pantalla de firma).
  document.body.dataset.scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${window.scrollY}px`;
  document.body.style.width = '100%';

  firmaTactilRotada = window.matchMedia('(max-width:900px) and (orientation:portrait)').matches;
  if(firmaTactilRotada){
    // Tamaño fijo en píxeles, calculado UNA SOLA VEZ aquí — a propósito NO se
    // usa 100vh/100vw en el CSS, porque esa medida cambia sola en el navegador
    // del celular cuando la barra de direcciones aparece/desaparece mientras
    // se firma, y eso era lo que hacía que la pantalla se reacomodara a medio
    // trazo. Con un valor fijo, la caja de firma ya no se mueve por el resto
    // de la sesión, sin importar qué haga el navegador alrededor.
    caja.style.width = window.innerHeight + 'px';
    caja.style.height = window.innerWidth + 'px';
    caja.classList.add('firma-tactil-rotada');
  } else {
    caja.style.width = ''; caja.style.height = '';
    caja.classList.remove('firma-tactil-rotada');
  }
  // Pequeña espera para que el navegador termine de acomodar la caja ya
  // dimensionada antes de medir el tamaño real del lienzo interno.
  setTimeout(()=>{
    const canvas = document.getElementById('firmaTactilCanvas');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    firmaTactilCtx = ctx;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(firmaExistente){
      const img = new Image();
      img.onload = ()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);
      img.src = firmaExistente;
    }
    activarDibujoFirmaTactil(canvas, ctx);
  }, 60);
}
function activarDibujoFirmaTactil(canvas, ctx){
  const posicion = e=>{
    const rect = canvas.getBoundingClientRect();
    const t = e.touches && e.touches[0];
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;
    const dx = clientX - rect.left, dy = clientY - rect.top;
    // Sin girar: la posición es directa. Girado 90°: la pantalla reporta el
    // toque en su propio sistema de coordenadas (ya rotado), así que se
    // traduce de vuelta al sistema del lienzo (fórmula verificada para un
    // giro de 90°: x_real = distancia_desde_arriba, y_real = alto_del_lienzo - distancia_desde_la_izquierda).
    return firmaTactilRotada ? { x: dy, y: canvas.height - dx } : { x: dx, y: dy };
  };
  const iniciar = e=>{ e.preventDefault(); firmaTactilDibujando=true; ctx.beginPath(); const p=posicion(e); ctx.moveTo(p.x,p.y); };
  const mover = e=>{ if(!firmaTactilDibujando) return; e.preventDefault(); const p=posicion(e); ctx.lineWidth=2.5; ctx.strokeStyle="#1e293b"; ctx.lineCap='round'; ctx.lineTo(p.x,p.y); ctx.stroke(); };
  const soltar = ()=>{ firmaTactilDibujando=false; };
  canvas.onmousedown=iniciar; canvas.onmousemove=mover; canvas.onmouseup=soltar; canvas.onmouseleave=soltar;
  canvas.ontouchstart=iniciar; canvas.ontouchmove=mover; canvas.ontouchend=soltar; canvas.ontouchcancel=soltar;
}
function limpiarFirmaTactil(){
  const canvas = document.getElementById('firmaTactilCanvas');
  if(firmaTactilCtx && canvas) firmaTactilCtx.clearRect(0,0,canvas.width,canvas.height);
}
function confirmarFirmaTactil(){
  const canvas = document.getElementById('firmaTactilCanvas');
  const dataUrl = canvas.toDataURL();
  if(firmaTactilContexto==='tecnico'){ firmaTecnicoTemp = dataUrl; actualizarPreviewFirmaOrden('tecnico'); }
  else if(firmaTactilContexto==='cliente'){ firmaClienteTemp = dataUrl; actualizarPreviewFirmaOrden('cliente'); }
  else if(firmaTactilContexto==='representante'){ firmaTempBase64 = dataUrl; actualizarPreviewFirmaRepresentante(); }
  cerrarFirmaTactil();
}
function cerrarFirmaTactil(){
  document.getElementById('firmaTactilOverlay').classList.remove('activa');
  const scrollY = parseInt(document.body.dataset.scrollY || '0');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollY);
}
function actualizarPreviewFirmaOrden(contexto){
  const dataUrl = contexto==='tecnico' ? firmaTecnicoTemp : firmaClienteTemp;
  const img = document.getElementById(contexto==='tecnico' ? 'detPreviewFirmaTecnico' : 'detPreviewFirmaCliente');
  const placeholder = document.getElementById(contexto==='tecnico' ? 'detPreviewFirmaTecnicoPlaceholder' : 'detPreviewFirmaClientePlaceholder');
  if(!img) return;
  if(dataUrl){ img.src = dataUrl; img.style.display='block'; if(placeholder) placeholder.style.display='none'; }
}
// Extrae la URL real de una foto sin importar si quedó guardada como texto
// plano (formato viejo) o como {src, desc} (formato nuevo, con descripción)
// — así ningún lugar de la plataforma se rompe por el cambio de formato.
function srcDeFoto(f){ return (typeof f === 'string') ? f : ((f && f.src) || ''); }
// Misma idea que ya existía para las fotos de cierre de orden (normalizarFotosEvidencia),
// pero de nombre genérico para usarla en cualquier galería de la plataforma.
function normalizarGaleria(fotos){
  return (fotos||[]).map(f => (typeof f === 'string') ? { src:f, desc:'' } : { src:f.src, desc:f.desc||'' });
}
/* =========================================================
   GALERÍA DE FOTOS CON DESCRIPCIÓN — componente único, reutilizado
   en todos los formularios que suben varias imágenes (inventario,
   clientes, equipos, órdenes). Cuadrícula uniforme (recortada sin
   deformar) con un campo de descripción corta debajo de cada foto.
========================================================= */
function renderizarGaleriaFotos(contenedorId, fotos, contexto, campoId, tamanoBloque){
  const cont = document.getElementById(contenedorId);
  if(!cont) return;
  const lista = normalizarGaleria(fotos);
  const sufijoCampo = campoId!==undefined ? ',' + campoId : '';
  // El marcado de UNA foto (marco + botón de quitar + descripción) es el mismo
  // sin importar si se muestra suelta o agrupada en un bloque — así el
  // componente sigue siendo uno solo, reutilizado en todos lados.
  const itemHtml = (f, idx) => `
    <div class="galeria-foto-item">
      <div class="galeria-foto-marco">
        <img src="${f.src}">
        <button type="button" class="galeria-foto-quitar" onclick="eliminarFotoGaleria('${contexto}',${idx}${sufijoCampo})">✖</button>
      </div>
      <input type="text" class="galeria-foto-desc" placeholder="Descripción (opcional)" value="${(f.desc||'').replace(/"/g,'&quot;')}" oninput="actualizarDescripcionGaleria('${contexto}',${idx},this.value${sufijoCampo})">
    </div>`;

  if(!tamanoBloque || tamanoBloque < 1){
    // Sin agrupar: igual que siempre, una sola cuadrícula continua.
    cont.classList.remove('galeria-por-bloques');
    cont.innerHTML = lista.map(itemHtml).join('');
    return;
  }

  // Agrupado en bloques (definido al diseñar la plantilla, campo por campo):
  // cada bloque es su propia mini-cuadrícula con etiqueta ("Bloque 1", "Bloque
  // 2"...), usando el MISMO marcado por foto de arriba — solo cambia cómo se
  // reparten entre sub-contenedores.
  cont.classList.add('galeria-por-bloques');
  let html = '';
  for(let inicio=0; inicio<lista.length; inicio+=tamanoBloque){
    const numeroBloque = Math.floor(inicio/tamanoBloque) + 1;
    const trozo = lista.slice(inicio, inicio+tamanoBloque);
    const itemsHtml = trozo.map((f,i)=>itemHtml(f, inicio+i)).join('');
    html += `<div class="galeria-bloque">
      <div class="galeria-bloque-titulo">Bloque ${numeroBloque} <span style="font-weight:400;text-transform:none;">(${trozo.length}/${tamanoBloque})</span></div>
      <div class="galeria-fotos">${itemsHtml}</div>
    </div>`;
  }
  cont.innerHTML = html || '';
}
function obtenerArregloGaleria(contexto, campoId){
  if(contexto==='inventario') return fotosInventarioTemp;
  if(contexto==='cliente') return imagenesClienteTemp;
  if(contexto==='equipoModal') return fotosEquipoModalTemp;
  if(contexto==='ordenGeneral') return fotosDetalleTemp;
  if(contexto==='ordenCampo') return fotosCamposDetalleTemp[campoId];
  return null;
}
function rerenderizarGaleria(contexto, campoId){
  if(contexto==='inventario') renderizarFotosInventarioPreview();
  else if(contexto==='cliente') renderizarImagenesClientePreview();
  else if(contexto==='equipoModal') renderizarFotosEquipoModalPreview();
  else if(contexto==='ordenGeneral') renderizarFotosDetallePreview();
  else if(contexto==='ordenCampo') renderizarFotoCampoDetallePreview(campoId);
}
function eliminarFotoGaleria(contexto, idx, campoId){
  const arr = obtenerArregloGaleria(contexto, campoId);
  if(!arr) return;
  arr.splice(idx,1);
  if(contexto==='cliente') imagenesClienteModificado = true;
  rerenderizarGaleria(contexto, campoId);
}
function actualizarDescripcionGaleria(contexto, idx, valor, campoId){
  const arr = obtenerArregloGaleria(contexto, campoId);
  if(!arr || arr[idx]===undefined) return;
  if(typeof arr[idx] === 'string') arr[idx] = { src: arr[idx], desc: valor };
  else arr[idx].desc = valor;
  if(contexto==='cliente') imagenesClienteModificado = true;
  // No hace falta redibujar toda la cuadrícula por cada letra escrita — el
  // campo de texto ya quedó con lo que se escribió, y el dato ya se guardó arriba.
}
// Nombre del cliente de una orden, ya sea uno registrado o uno nuevo (no
// registrado, ingresado directo en la orden) — usar esto en vez de
// buscarCliente(o.clienteId) directo en cualquier lugar donde se muestre
// el cliente de una orden, para que el caso de "cliente nuevo" siempre
// se vea correcto en vez de "—".
function nombreClienteOrden(o){
  if(o.esClienteNuevo) return o.clienteNuevoNombre || '(cliente nuevo sin nombre)';
  const c = buscarCliente(o.clienteId);
  return c ? c.nombre : '—';
}
function etiquetaClienteNuevoHtml(o){
  return o.esClienteNuevo ? ' <span style="font-size:9px;background:#f59e0b;color:#fff;padding:1px 6px;border-radius:8px;white-space:nowrap;">CLIENTE NUEVO</span>' : '';
}
function equiposSinSedeDe(c){ if(!c.equiposSinSede) c.equiposSinSede = []; return c.equiposSinSede; }
function buscarSede(clienteId,sedeId){ const c=buscarCliente(clienteId); return c ? c.sedes.find(s=>s.id===sedeId) : null; }
function buscarEquipo(clienteId,sedeId,equipoId){
  const c = buscarCliente(clienteId);
  if(!c) return null;
  if(!sedeId){ return equiposSinSedeDe(c).find(e=>e.id===equipoId) || null; }
  const s=buscarSede(clienteId,sedeId); return s ? s.equipos.find(e=>e.id===equipoId) : null;
}
function ubicarEquipoPorId(equipoId){
  for(const c of db.clientes){
    for(const s of c.sedes) for(const e of s.equipos)
      if(e.id===equipoId) return {cliente:c, sede:s, equipo:e};
    for(const e of equiposSinSedeDe(c))
      if(e.id===equipoId) return {cliente:c, sede:null, equipo:e};
  }
  return null;
}
function buscarPlantilla(id){ return db.plantillas.find(p=>p.id===id); }
function buscarTecnico(id){ return db.tecnicos.find(t=>t.id===id); }
function badgeEstado(estado){
  const map={ "Programado":"badge-programado", "En Ejecución":"badge-ejecucion", "Finalizado":"badge-finalizado" };
  return `<span class="badge-estado ${map[estado]||'badge-programado'}">${estado}</span>`;
}

/* =========================================================
   NAVEGACIÓN / INICIO
   Con la pantalla de acceso reactivada: solo se entra a la app
   si hay una empresa + sesión de servidor válidas guardadas;
   si no, se muestra el login (empezando por el paso de empresa).
========================================================= */
window.onload = function(){
  // Enlace de recuperación de contraseña (?resetToken=...): pantalla aparte,
  // sin sesión, no toca el login ni el resto de la app.
  if(detectarTokenReset()) return;
  // Enlace público de tienda (?tienda=codigo-empresa): no toca el login ni el resto
  // de la app — es una vista completamente aparte, de solo catálogo, sin sesión.
  const slugTiendaPublica = new URLSearchParams(location.search).get('tienda');
  if(slugTiendaPublica){
    ocultarSkeletonBoot();
    iniciarTiendaPublica(slugTiendaPublica.toLowerCase().trim());
    return;
  }
  setTimeout(ocultarSkeletonBoot, 2500); // red de seguridad, por si ningún otro punto lo oculta
  aplicarConfiguracionVisual();
  actualizarBadgeConexion();
  window.addEventListener('online', actualizarBadgeConexion);
  window.addEventListener('offline', actualizarBadgeConexion);
  document.querySelector('.sidebar-menu').addEventListener('click', e=>{
    if(e.target.closest('a') && window.innerWidth <= 640) cerrarMenuMovil();
  });

  const sinServidor = ['file:','content:',''].includes(location.protocol) || !location.protocol.startsWith('http'); // archivo abierto directamente (PC o Android), sin backend real
  const loginDesactivado = db.config.loginRequerido === false; // interruptor en Configuración

  if(sinServidor || loginDesactivado){
    if(!sesionActual){ sesionActual = { rol:'admin', tecnicoId:null }; localStorage.setItem(SESION_KEY, JSON.stringify(sesionActual)); }
    aplicarRBACaUI(); mostrarSeccion('agenda'); manejarParametroQR();
    if(!sinServidor) cargarEstadoDesdeBackend(); // si hay servidor pero el login está desactivado, igual sincroniza
    return;
  }

  if(empresaActual && sesionServidor && sesionActual){
    aplicarRBACaUI(); mostrarSeccion('agenda'); manejarParametroQR();
    cargarEstadoDesdeBackend();
  } else {
    mostrarLogin();
  }
};
function actualizarBadgeConexion(){
  const el = document.getElementById('badgeConexion');
  if(!el) return;
  if(!navigator.onLine){
    el.innerHTML = '🔴 Sin conexión — guardando localmente'; el.style.color = 'var(--orange-warning)';
  } else if(syncEstado === 'error'){
    el.innerHTML = '⚠️ No se guardó en el servidor — toca para reintentar'; el.style.color = 'var(--orange-warning)';
    el.style.cursor = 'pointer';
    el.onclick = () => sincronizarConBackend();
  } else if(syncEstado === 'pendiente'){
    el.innerHTML = '🟡 Guardando...'; el.style.color = 'var(--orange-warning)';
    el.style.cursor = 'default'; el.onclick = null;
  } else {
    el.innerHTML = '🟢 En línea'; el.style.color = 'var(--green-success)';
    el.style.cursor = 'default'; el.onclick = null;
  }
}

/* Menú lateral deslizante en teléfonos (capa aditiva, no cambia el comportamiento en pantallas grandes) */
function toggleMenuMovil(){ document.querySelector('.left-sidebar').classList.toggle('abierto'); }
function cerrarMenuMovil(){ document.querySelector('.left-sidebar').classList.remove('abierto'); }

function mostrarSeccion(nombre){
  ocultarSkeletonBoot();
  document.querySelectorAll('.seccion').forEach(el=>el.style.display='none');
  document.getElementById('seccion-'+nombre).style.display='block';
  document.querySelectorAll('.sidebar-menu a[data-sec]').forEach(a=>a.classList.remove('active'));
  const link = document.querySelector(`.sidebar-menu a[data-sec="${nombre}"]`);
  if(link) link.classList.add('active');
  if(nombre==='agenda') renderizarAgenda();
  if(nombre==='equipos') renderizarEquiposGlobal('');
  if(nombre==='trazabilidad') inicializarTrazabilidad();
  if(nombre==='inventario') renderizarInventario();
  if(nombre==='tienda') renderizarTienda();
  else {
    const btnWa = document.getElementById('tiendaBotonWhatsapp');
    if(btnWa) btnWa.style.display = 'none';
    if(intervaloBannerTienda){ clearInterval(intervaloBannerTienda); intervaloBannerTienda = null; }
  }
  if(nombre==='kpi') renderizarKPIs();
  if(nombre==='contabilidad') renderizarContabilidad();
  actualizarKPIs();
  aplicarRBACaUI();
  cerrarMenuMovil();
}

function aplicarConfiguracionVisual(){
  document.getElementById('lblNombreEmpresa').innerText = db.config.nombre;
  document.getElementById('brandTitleSidebar').innerText = db.config.nombre;
  document.getElementById('lblSubtituloEmpresa').innerText = db.config.subtitulo;
  aplicarAparienciaTienda();
  document.documentElement.style.setProperty('--blue-accent', db.config.colorAcento);
  document.documentElement.style.setProperty('--bg-dark', db.config.colorFondo);
  document.documentElement.style.setProperty('--sidebar-bg-1', db.config.colorSidebar1 || '#24272e');
  document.documentElement.style.setProperty('--sidebar-bg-2', db.config.colorSidebar2 || '#15171c');
  document.documentElement.style.setProperty('--topbar-bg-1', db.config.colorTopbar1 || '#24272e');
  document.documentElement.style.setProperty('--topbar-bg-2', db.config.colorTopbar2 || '#191b20');
  document.documentElement.style.setProperty('--panel-bg-1', db.config.colorPanel1 || '#212429');
  document.documentElement.style.setProperty('--panel-bg-2', db.config.colorPanel2 || '#191b20');
  document.documentElement.style.setProperty('--font-family', db.config.fontFamily || "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif");
  document.body.classList.toggle('modo-claro', !!db.config.modoClaro);
  if(db.config.colorTexto) document.documentElement.style.setProperty('--text-main', db.config.colorTexto);
  else document.documentElement.style.removeProperty('--text-main');
  if(db.config.formBorderColor) document.documentElement.style.setProperty('--form-border-color', db.config.formBorderColor);
  else document.documentElement.style.removeProperty('--form-border-color');
  document.documentElement.style.setProperty('--form-radius', (db.config.formRadius!==undefined ? db.config.formRadius : 6) + 'px');
  document.body.classList.remove('letra-pequena','letra-grande');
  if(db.config.tamanoLetra==='sm') document.body.classList.add('letra-pequena');
  if(db.config.tamanoLetra==='lg') document.body.classList.add('letra-grande');
  const mapaTamanoBotones = { sm:{padding:'6px 12px',fontSize:'12px'}, md:{padding:'8px 16px',fontSize:'13px'}, lg:{padding:'11px 22px',fontSize:'15px'} };
  const tb = mapaTamanoBotones[db.config.formTamanoBotones] || mapaTamanoBotones.md;
  document.documentElement.style.setProperty('--form-btn-padding', tb.padding);
  document.documentElement.style.setProperty('--form-btn-font-size', tb.fontSize);
  const logoImg = document.getElementById('sidebarLogo');
  const iconoDefault = document.getElementById('sidebarIconoDefault');
  if(db.config.logo){ logoImg.src = db.config.logo; logoImg.style.display='block'; iconoDefault.style.display='none'; }
  else { logoImg.style.display='none'; iconoDefault.style.display='inline'; }
  const topbarLogo = document.getElementById('topbarLogo');
  if(topbarLogo){ if(db.config.logo){ topbarLogo.src = db.config.logo; topbarLogo.style.display='block'; } else { topbarLogo.style.display='none'; } }
}

function actualizarKPIs(){
  document.getElementById('kpiProgramados').innerText = db.ordenes.filter(o=>o.estado==='Programado').length;
  document.getElementById('kpiEjecucion').innerText = db.ordenes.filter(o=>o.estado==='En Ejecución').length;
  document.getElementById('kpiFinalizados').innerText = db.ordenes.filter(o=>o.estado==='Finalizado').length;
  let totalEquipos=0; db.clientes.forEach(c=>{ c.sedes.forEach(s=>totalEquipos+=s.equipos.length); totalEquipos+=equiposSinSedeDe(c).length; });
  document.getElementById('kpiEquipos').innerText = totalEquipos;
}

/* Notificaciones tipo "toast" — reemplazan las ventanas mostrarToast() del navegador.
   mostrarToast(mensaje, tipo) donde tipo es 'info' (por defecto), 'exito' o 'error'. */
function mostrarToast(mensaje, tipo){
  tipo = tipo || (/no se pud|error|falta|inválid|obligatorio|escribe|selecciona|debes|ya existe/i.test(mensaje) ? 'error' : /listo|guardad|creado|actualizad|registrad|exitos|correct|copiado/i.test(mensaje) ? 'exito' : 'info');
  const cont = document.getElementById('toastContainer');
  if(!cont){ console.log(mensaje); return; }
  const icono = tipo==='exito' ? '✅' : tipo==='error' ? '⚠️' : 'ℹ️';
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = `<span class="toast-icono">${icono}</span><span class="toast-texto">${mensaje}</span><span class="toast-cerrar" onclick="this.parentElement.remove()">✖</span>`;
  cont.appendChild(el);
  setTimeout(()=>{
    el.classList.add('saliendo');
    setTimeout(()=>el.remove(), 250);
  }, 4200);
}
