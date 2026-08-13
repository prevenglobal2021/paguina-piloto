// ===== tienda-admin.js — extraído de prevenglobal__25_.html (líneas 4355-4877) =====
/* =========================================================
   MÓDULO DE TIENDA VIRTUAL
   Vitrina de productos publicados desde Inventario, carrito
   de compras y registro de pedidos. El pago en línea queda
   pendiente de conectar con la pasarela que se elija — por
   ahora el pedido se guarda y un asesor da seguimiento manual.
========================================================= */
let carritoTienda = []; // [{ itemId, cantidad }]
let intervaloBannerTienda = null;

function renderizarMarcaTienda(){
  // Logo (usa el de la tienda si existe, si no el de la empresa)
  const logoImg = document.getElementById('tiendaLogoHeader');
  const logoSrc = db.config.tiendaLogo || db.config.logo;
  if(logoSrc){ logoImg.src = logoSrc; logoImg.style.display = 'block'; } else { logoImg.style.display = 'none'; }

  // Banner dinámico rotativo
  const banner = db.config.tiendaBanner || [];
  const bannerWrap = document.getElementById('tiendaBannerWrap');
  const bannerTrack = document.getElementById('tiendaBannerTrack');
  if(intervaloBannerTienda) clearInterval(intervaloBannerTienda);
  if(banner.length){
    bannerWrap.style.display = 'block';
    bannerTrack.innerHTML = banner.map(img=>`<img src="${img}">`).join('');
    let indice = 0;
    if(banner.length > 1){
      intervaloBannerTienda = setInterval(()=>{
        indice = (indice + 1) % banner.length;
        bannerTrack.style.transform = `translateX(-${indice*100}%)`;
      }, 4000);
    }
  } else {
    bannerWrap.style.display = 'none';
  }

  // Galería / carrusel de imágenes
  const galeria = db.config.tiendaGaleria || [];
  const galeriaWrap = document.getElementById('tiendaGaleriaWrap');
  if(galeria.length){
    galeriaWrap.style.display = 'flex';
    galeriaWrap.innerHTML = galeria.map(item=>{
      const img = typeof item === 'string' ? item : item.img;
      const nota = typeof item === 'string' ? '' : (item.nota||'');
      return `<div class="tienda-galeria-item"><img src="${img}">${nota?`<span>${nota}</span>`:''}</div>`;
    }).join('');
  } else {
    galeriaWrap.style.display = 'none';
  }

  // WhatsApp flotante y teléfono
  const btnWa = document.getElementById('tiendaBotonWhatsapp');
  if(db.config.tiendaWhatsapp){
    btnWa.href = `https://wa.me/${db.config.tiendaWhatsapp.replace(/\D/g,'')}`;
    btnWa.style.display = 'flex';
  } else {
    btnWa.style.display = 'none';
  }
  const footerTel = document.getElementById('tiendaTelefonoFooter');
  if(db.config.tiendaTelefono){
    footerTel.innerText = '📞 Contáctanos: ' + db.config.tiendaTelefono;
    footerTel.style.display = 'block';
  } else {
    footerTel.style.display = 'none';
  }
  document.getElementById('tiendaSecciones').innerHTML = htmlSeccionesTienda(db.config.tiendaSecciones, db.config.tiendaTestimonios);
}


function productosPublicadosTienda(){
  const buscador = (document.getElementById('tiendaBuscador')?.value || '').toLowerCase().trim();
  return db.inventario.filter(it=>{
    if(!it.publicarEnTienda) return false;
    if(!buscador) return true;
    return (it.nombre||'').toLowerCase().includes(buscador) || (it.categoria||'').toLowerCase().includes(buscador);
  });
}

function renderizarTienda(){
  renderizarMarcaTienda();
  const grid = document.getElementById('tiendaGrid');
  const productos = productosPublicadosTienda();
  document.getElementById('tiendaEmptyState').style.display = productos.length ? 'none' : 'block';
  grid.innerHTML = productos.map(it=>{
    const foto = (it.fotos && it.fotos[0]) ? `<img src="${it.fotos[0]}" class="tienda-card-img">` : `<div class="tienda-card-img-placeholder"><i class="fas fa-box-open"></i></div>`;
    const agotado = it.stockActual <= 0;
    return `<div class="tienda-card" onclick="verDetalleProductoTienda(${it.id})">
      ${foto}
      <div class="tienda-card-body">
        <span class="tienda-card-categoria">${it.categoria || 'General'}</span>
        <h4 class="tienda-card-nombre">${it.nombre}</h4>
        <p class="tienda-card-desc">${it.descripcionTienda || 'Sin descripción disponible.'}</p>
        <div class="tienda-card-footer">
          <span class="tienda-card-precio">${it.precio ? formatoCOP(it.precio) : 'Cotizar'}</span>
          <span class="tienda-card-stock ${agotado?'agotado':''}">${agotado ? 'Agotado' : it.stockActual+' disp.'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  actualizarBadgeCarrito();
}
function formatoCOP(valor){
  return '$' + Math.round(valor).toLocaleString('es-CO');
}
function htmlSeccionesTienda(secciones, testimonios){
  secciones = secciones || {}; testimonios = testimonios || [];
  let html = '';
  if((secciones.equipo||[]).length){
    html += `<div class="tienda-seccion"><h3 class="tienda-seccion-titulo">Nuestro Equipo</h3><div class="tienda-seccion-linea"></div>
      <div class="tienda-fila-cards">${secciones.equipo.map(m=>`
        <div class="tienda-mini-card">${m.imagen?`<img src="${m.imagen}">`:''}<h5>${m.titulo}</h5><p>${m.subtitulo||''}</p></div>`).join('')}</div></div>`;
  }
  if((secciones.servicios||[]).length){
    html += `<div class="tienda-seccion"><h3 class="tienda-seccion-titulo">Nuestros Servicios</h3><div class="tienda-seccion-linea"></div>
      <div class="tienda-fila-cards">${secciones.servicios.map(s=>`
        <div class="tienda-servicio-card">${s.imagen?`<img src="${s.imagen}">`:''}<h5>${s.titulo}</h5><p>${s.subtitulo||''}</p></div>`).join('')}</div></div>`;
  }
  if((secciones.proyectos||[]).length){
    html += `<div class="tienda-seccion"><h3 class="tienda-seccion-titulo">Proyectos Realizados</h3><div class="tienda-seccion-linea"></div>
      <div class="tienda-fila-cards">${secciones.proyectos.map(p=>`
        <div class="tienda-proyecto-card">${p.imagen?`<img src="${p.imagen}">`:''}<div class="capa"><h5>${p.titulo}</h5></div></div>`).join('')}</div></div>`;
  }
  if((secciones.clientes||[]).length){
    html += `<div class="tienda-seccion"><h3 class="tienda-seccion-titulo">Nuestros Clientes</h3><div class="tienda-seccion-linea"></div>
      <div class="tienda-clientes-fila">${secciones.clientes.map(c=>`
        ${c.imagen?`<img src="${c.imagen}" class="tienda-cliente-logo" title="${c.titulo}">`:`<span style="font-weight:700;">${c.titulo}</span>`}`).join('')}</div></div>`;
  }
  if((secciones.certificaciones||[]).length){
    html += `<div class="tienda-seccion"><h3 class="tienda-seccion-titulo">Certificaciones</h3><div class="tienda-seccion-linea"></div>
      <div class="tienda-clientes-fila">${secciones.certificaciones.map(c=>`
        ${c.imagen?`<img src="${c.imagen}" class="tienda-cert-badge" title="${c.titulo}">`:''}`).join('')}</div></div>`;
  }
  if(testimonios.length){
    const promedio = (testimonios.reduce((a,t)=>a+(t.estrellas||5),0) / testimonios.length).toFixed(1);
    html += `<div class="tienda-seccion"><h3 class="tienda-seccion-titulo">Lo que dicen nuestros clientes</h3><div class="tienda-seccion-linea"></div>
      <p style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:-6px;">⭐ ${promedio}/5 — basado en ${testimonios.length} opiniones</p>
      <div id="tpTestimoniosTrack" class="tienda-fila-cards" style="transition:opacity .4s ease;"></div></div>`;
  }
  return html;
}
let intervaloTestimoniosPublico = null;
function iniciarRotacionTestimonios(testimonios){
  clearInterval(intervaloTestimoniosPublico);
  const track = document.getElementById('tpTestimoniosTrack');
  if(!track || !testimonios || !testimonios.length) return;
  const porPagina = window.innerWidth <= 640 ? 1 : 3;
  let offset = 0;
  const pintarSiguienteGrupo = ()=>{
    const visibles = [];
    for(let i=0;i<porPagina;i++) visibles.push(testimonios[(offset+i) % testimonios.length]);
    track.style.opacity = '0';
    setTimeout(()=>{
      track.innerHTML = visibles.map(t=>`
        <div class="tienda-testimonio-card"><div class="tienda-testimonio-estrellas">${'⭐'.repeat(t.estrellas||5)}</div><p>"${t.comentario}"</p><div class="tienda-testimonio-autor">${t.nombre}</div></div>`).join('');
      track.style.opacity = '1';
    }, 400);
    offset = (offset + porPagina) % testimonios.length;
  };
  pintarSiguienteGrupo();
  intervaloTestimoniosPublico = setInterval(pintarSiguienteGrupo, 5000);
}
function verDetalleProductoTienda(itemId){
  const it = buscarItemInventario(itemId);
  if(!it) return;
  const fotos = (it.fotos||[]).map(f=>`<img src="${f}" style="width:100%;border-radius:10px;margin-bottom:8px;">`).join('') || `<div class="tienda-card-img-placeholder" style="border-radius:10px;"><i class="fas fa-box-open"></i></div>`;
  const agotado = it.stockActual <= 0;
  document.getElementById('detalleProductoTienda').innerHTML = `
    ${fotos}
    <span class="tienda-card-categoria">${it.categoria || 'General'}</span>
    <h3 style="margin:6px 0;">${it.nombre}</h3>
    <p style="color:var(--text-muted);font-size:13px;">${it.descripcionTienda || 'Sin descripción disponible.'}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0;">
      <span class="tienda-card-precio" style="font-size:22px;">${it.precio ? formatoCOP(it.precio) : 'Precio a cotizar'}</span>
      <span class="tienda-card-stock ${agotado?'agotado':''}">${agotado ? 'Agotado' : it.stockActual+' disponibles'}</span>
    </div>
    <button class="btn-custom" style="width:100%;" ${agotado?'disabled':''} onclick="agregarAlCarrito(${it.id});cerrarModal('modalProductoTienda');">
      <i class="fas fa-cart-plus"></i> ${agotado ? 'Sin stock' : 'Agregar al carrito'}
    </button>`;
  abrirModal('modalProductoTienda');
}
function agregarAlCarrito(itemId){
  const it = buscarItemInventario(itemId);
  if(!it || it.stockActual <= 0) return;
  const existente = carritoTienda.find(c=>c.itemId===itemId);
  if(existente){
    if(existente.cantidad < it.stockActual) existente.cantidad++;
  } else {
    carritoTienda.push({ itemId, cantidad: 1 });
  }
  actualizarBadgeCarrito();
}
function actualizarBadgeCarrito(){
  const badge = document.getElementById('badgeCarrito');
  if(!badge) return;
  const total = carritoTienda.reduce((a,c)=>a+c.cantidad,0);
  badge.innerText = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}
function cambiarCantidadCarrito(itemId, delta){
  const linea = carritoTienda.find(c=>c.itemId===itemId);
  if(!linea) return;
  const it = buscarItemInventario(itemId);
  linea.cantidad = Math.max(1, Math.min(it ? it.stockActual : 99, linea.cantidad + delta));
  renderizarCarrito();
}
function quitarDelCarrito(itemId){
  carritoTienda = carritoTienda.filter(c=>c.itemId!==itemId);
  renderizarCarrito();
}
function renderizarCarrito(){
  const lista = document.getElementById('carritoLista');
  document.getElementById('carritoFormCheckout').style.display = 'none';
  document.getElementById('btnIrACheckout').style.display = 'inline-block';
  document.getElementById('btnConfirmarPedido').style.display = 'none';
  if(!carritoTienda.length){
    lista.innerHTML = '<p class="empty-state">Tu carrito está vacío. Explora la tienda y agrega productos.</p>';
    document.getElementById('carritoTotal').innerText = '';
    actualizarBadgeCarrito();
    return;
  }
  let total = 0;
  lista.innerHTML = carritoTienda.map(c=>{
    const it = buscarItemInventario(c.itemId);
    if(!it) return '';
    const subtotal = (it.precio||0) * c.cantidad;
    total += subtotal;
    const foto = (it.fotos && it.fotos[0]) ? it.fotos[0] : '';
    return `<div class="carrito-item">
      ${foto ? `<img src="${foto}">` : '<div style="width:50px;height:50px;background:#0f172a;border-radius:8px;"></div>'}
      <div class="carrito-item-info">
        <strong style="font-size:13px;">${it.nombre}</strong><br>
        <span style="font-size:12px;color:var(--text-muted);">${it.precio?formatoCOP(it.precio):'A cotizar'} c/u</span>
      </div>
      <div class="carrito-item-cant">
        <button onclick="cambiarCantidadCarrito(${it.id},-1)">−</button>
        <span>${c.cantidad}</span>
        <button onclick="cambiarCantidadCarrito(${it.id},1)">+</button>
      </div>
      <strong style="min-width:90px;text-align:right;font-size:13px;">${formatoCOP(subtotal)}</strong>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarDelCarrito(${it.id})">✖</button>
    </div>`;
  }).join('');
  document.getElementById('carritoTotal').innerText = 'Total: ' + formatoCOP(total);
  actualizarBadgeCarrito();
}
function abrirCarrito(){
  renderizarCarrito();
  abrirModal('modalCarrito');
}
function mostrarFormCheckout(){
  if(!carritoTienda.length){ mostrarToast('Tu carrito está vacío.'); return; }
  document.getElementById('carritoFormCheckout').style.display = 'block';
  document.getElementById('btnIrACheckout').style.display = 'none';
  document.getElementById('btnConfirmarPedido').style.display = 'inline-block';
}
function confirmarPedidoTienda(){
  const nombre = document.getElementById('checkoutNombre').value.trim();
  const telefono = document.getElementById('checkoutTelefono').value.trim();
  const email = document.getElementById('checkoutEmail').value.trim();
  const notas = document.getElementById('checkoutNotas').value.trim();
  if(!nombre || !telefono){ mostrarToast('Escribe al menos tu nombre y teléfono para que podamos contactarte.'); return; }
  db.pedidosTienda = db.pedidosTienda || [];
  const items = carritoTienda.map(c=>{
    const it = buscarItemInventario(c.itemId);
    return { itemId: c.itemId, nombre: it?it.nombre:'—', cantidad: c.cantidad, precio: it?it.precio:0 };
  });
  const total = items.reduce((a,i)=>a+(i.precio*i.cantidad),0);
  const pedido = {
    id: Date.now(), numero: 'PED-' + String((db.pedidosTienda.length+1)).padStart(4,'0'),
    fecha: new Date().toISOString(), nombre, telefono, email, notas, items, total,
    estadoPago: 'Pendiente (pasarela de pago no configurada aún)', estado: 'Recibido'
  };
  db.pedidosTienda.push(pedido);
  dbGuardar();
  registrarLog('Crear', 'PedidoTienda', `${pedido.numero} · ${nombre} · ${formatoCOP(total)}`);
  carritoTienda = [];
  cerrarModal('modalCarrito');
  mostrarToast(`¡Pedido ${pedido.numero} registrado! Un asesor te contactará al ${telefono} para coordinar el pago y la entrega.`);
  renderizarTienda();
}

/* --- Configuración: marca y contacto de la Tienda Virtual --- */
function cargarTabTiendaConfig(){
  document.getElementById('cfgTiendaLinkPublico').value = location.origin + location.pathname + '?tienda=' + encodeURIComponent(empresaActual || '');
  const prevLogo = document.getElementById('previewLogoTienda');
  prevLogo.innerHTML = db.config.tiendaLogo ? `<img src="${db.config.tiendaLogo}" style="max-width:100%;max-height:100%;">` : '<small style="color:var(--text-muted);">Usando el logo de la empresa</small>';
  renderizarPreviewMultiple('previewBannerTienda', db.config.tiendaBanner||[], quitarBannerTienda);
  renderizarPreviewGaleria();
  document.getElementById('cfgTiendaTelefono').value = db.config.tiendaTelefono||'';
  document.getElementById('cfgTiendaWhatsapp').value = db.config.tiendaWhatsapp||'';
  document.getElementById('cfgTiendaFacebook').value = db.config.tiendaFacebook||'';
  document.getElementById('cfgTiendaInstagram').value = db.config.tiendaInstagram||'';
  document.getElementById('cfgTiendaColor').value = db.config.tiendaColor || '#0088ff';
  document.getElementById('cfgTiendaImgEstilo').value = db.config.tiendaImgEstilo || 'cover';
  document.getElementById('cfgTiendaTamanoTarjeta').value = db.config.tiendaTamanoTarjeta || 230;
  renderizarListaSeccionTienda();
  renderizarListaTestimoniosTienda();
}
function renderizarPreviewMultiple(contenedorId, lista, fnQuitar){
  document.getElementById(contenedorId).innerHTML = lista.map((img,i)=>`
    <div style="position:relative;display:inline-block;">
      <img src="${img}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;">
      <button onclick="${fnQuitar.name}(${i})" style="position:absolute;top:-6px;right:-6px;background:var(--red-alert);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;">✖</button>
    </div>`).join('');
}
function normalizarGaleriaTienda(){
  // Compatibilidad: la galería antes guardaba solo texto (la imagen); ahora guarda
  // {img, nota} para poder ponerle una descripción breve a cada foto del carrusel.
  db.config.tiendaGaleria = (db.config.tiendaGaleria || []).map(item =>
    typeof item === 'string' ? { img: item, nota: '' } : item
  );
}
function renderizarPreviewGaleria(){
  normalizarGaleriaTienda();
  document.getElementById('previewGaleriaTienda').innerHTML = db.config.tiendaGaleria.map((item,i)=>`
    <div style="position:relative;display:inline-block;width:100px;vertical-align:top;margin:4px;">
      <div style="position:relative;">
        <img src="${item.img}" style="width:100px;height:100px;object-fit:cover;border-radius:6px;">
        <button onclick="quitarGaleriaTienda(${i})" style="position:absolute;top:-6px;right:-6px;background:var(--red-alert);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;">✖</button>
      </div>
      <input type="text" value="${(item.nota||'').replace(/"/g,'&quot;')}" placeholder="Nota breve..." style="margin-top:4px;font-size:11px;padding:5px;" onchange="guardarNotaGaleria(${i}, this.value)">
    </div>`).join('');
}
function guardarNotaGaleria(i, valor){
  if(!db.config.tiendaGaleria[i]) return;
  db.config.tiendaGaleria[i].nota = valor;
  dbGuardarInmediato();
}
function subirLogoTienda(event){
  const file = event.target.files[0];
  if(!file) return;
  comprimirImagen(file).then(dataUrl=>{
    db.config.tiendaLogo = dataUrl;
    dbGuardarInmediato();
    cargarTabTiendaConfig();
  });
  event.target.value = '';
}
function quitarLogoTienda(){
  db.config.tiendaLogo = null;
  dbGuardarInmediato();
  cargarTabTiendaConfig();
}
function subirBannerTienda(event){
  const files = Array.from(event.target.files);
  if(!files.length) return;
  db.config.tiendaBanner = db.config.tiendaBanner || [];
  Promise.allSettled(files.map(f=>comprimirImagen(f))).then(resultados=>{
    const exitosas = resultados.filter(r=>r.status==='fulfilled').map(r=>r.value);
    const fallidas = resultados.length - exitosas.length;
    if(exitosas.length) db.config.tiendaBanner.push(...exitosas);
    dbGuardarInmediato();
    cargarTabTiendaConfig();
    if(fallidas) mostrarToast(`Se subieron ${exitosas.length} imagen(es). ${fallidas} no se pudieron procesar — revisa que sean archivos de imagen válidos.`);
  });
  event.target.value = '';
}
function quitarBannerTienda(i){
  db.config.tiendaBanner.splice(i,1);
  dbGuardarInmediato();
  cargarTabTiendaConfig();
}
function subirGaleriaTienda(event){
  const files = Array.from(event.target.files);
  if(!files.length) return;
  normalizarGaleriaTienda();
  Promise.allSettled(files.map(f=>comprimirImagen(f))).then(resultados=>{
    const exitosas = resultados.filter(r=>r.status==='fulfilled').map(r=>({ img:r.value, nota:'' }));
    const fallidas = resultados.length - exitosas.length;
    if(exitosas.length) db.config.tiendaGaleria.push(...exitosas);
    dbGuardarInmediato();
    renderizarPreviewGaleria();
    if(fallidas) mostrarToast(`Se subieron ${exitosas.length} imagen(es). ${fallidas} no se pudieron procesar — revisa que sean archivos de imagen válidos.`);
  });
  event.target.value = '';
}
function quitarGaleriaTienda(i){
  db.config.tiendaGaleria.splice(i,1);
  dbGuardarInmediato();
  renderizarPreviewGaleria();
}
function secTiendaData(){
  db.config.tiendaSecciones = db.config.tiendaSecciones || { equipo:[], servicios:[], proyectos:[], clientes:[], certificaciones:[] };
  const tipo = document.getElementById('secTiendaTipo').value;
  if(!db.config.tiendaSecciones[tipo]) db.config.tiendaSecciones[tipo] = [];
  return { tipo, lista: db.config.tiendaSecciones[tipo] };
}
function agregarItemSeccionTienda(){
  const { lista } = secTiendaData();
  const titulo = document.getElementById('secTiendaTitulo').value.trim();
  const subtitulo = document.getElementById('secTiendaSubtitulo').value.trim();
  const fileInput = document.getElementById('secTiendaImagen');
  const file = fileInput.files[0];
  if(!titulo){ mostrarToast('Escribe al menos el título (nombre, servicio, proyecto o cliente).'); return; }
  const guardar = (imagen)=>{
    lista.push({ id: Date.now(), imagen: imagen||null, titulo, subtitulo });
    dbGuardarInmediato();
    document.getElementById('secTiendaTitulo').value=''; document.getElementById('secTiendaSubtitulo').value=''; fileInput.value='';
    renderizarListaSeccionTienda();
  };
  if(file) comprimirImagen(file).then(guardar);
  else guardar(null);
}
function eliminarItemSeccionTienda(tipo, id){
  db.config.tiendaSecciones[tipo] = db.config.tiendaSecciones[tipo].filter(i=>i.id!==id);
  dbGuardarInmediato();
  renderizarListaSeccionTienda();
}
function renderizarListaSeccionTienda(){
  const { tipo, lista } = secTiendaData();
  document.getElementById('listaSeccionTienda').innerHTML = lista.map(item=>`
    <div style="width:110px;text-align:center;background:rgba(0,0,0,.2);border-radius:8px;padding:8px;position:relative;">
      <button onclick="eliminarItemSeccionTienda('${tipo}',${item.id})" style="position:absolute;top:2px;right:2px;background:var(--red-alert);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;">✖</button>
      ${item.imagen ? `<img src="${item.imagen}" style="width:100%;height:70px;object-fit:cover;border-radius:6px;">` : '<div style="height:70px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);"><i class="fas fa-image"></i></div>'}
      <strong style="display:block;font-size:11px;margin-top:4px;">${item.titulo}</strong>
      <small style="color:var(--text-muted);font-size:10px;">${item.subtitulo||''}</small>
    </div>`).join('') || '<p class="empty-state" style="width:100%;">Sin elementos en esta sección todavía.</p>';
}
function generarTestimoniosAutomaticos(){
  const yaHayTestimonios = (db.config.tiendaTestimonios || []).length > 0;
  if(yaHayTestimonios && !confirm('Ya tienes testimonios cargados. ¿Reemplazarlos por 98 testimonios de ejemplo generados automáticamente?')) return;
  const nombres = [
    'Carlos Ramírez','María Fernanda Gómez','Andrés Torres','Laura Jiménez','Juan Pablo Rojas',
    'Camila Vargas','Diego Alejandro Rincón','Valentina Castro','Santiago Morales','Daniela Ortiz',
    'Felipe Cárdenas','Natalia Herrera','Julián Restrepo','Paola Sánchez','Óscar Medina',
    'Alejandra Pérez','Ricardo Duque','Marcela Suárez','Iván Bermúdez','Sandra Castaño',
    'Jorge Andrés Peña','Lina Marcela Ríos','Cristian Camilo Vega','Diana Carolina López','Manuel Escobar'
  ];
  const comentarios = [
    'Excelente atención, resolvieron mi solicitud rapidísimo.',
    'Muy profesionales, el servicio quedó impecable.',
    'Llegaron puntuales y explicaron todo con claridad.',
    'La mejor experiencia solicitando un servicio en línea.',
    'Respuesta inmediata por WhatsApp, muy recomendados.',
    'Calidad y seriedad, superó mis expectativas.',
    'Precios justos y atención muy amable.',
    'El seguimiento del pedido fue transparente en todo momento.',
    'Personal muy capacitado, se nota la experiencia.',
    'Volvería a solicitar el servicio sin dudarlo.',
    'Entrega rápida y en perfecto estado.',
    'Un servicio técnico muy confiable, quedé satisfecho.',
    'Fácil de usar la página y muy buena comunicación.',
    'Solucionaron un problema urgente el mismo día.',
    'Muy buena relación calidad-precio.',
    'Atención cercana, siempre dispuestos a ayudar.',
    'Cumplieron con lo prometido en los tiempos acordados.',
    'Excelente soporte después del servicio.',
    'Trabajo muy limpio y ordenado, se nota el profesionalismo.',
    'Recomendado totalmente, superó lo que esperaba.'
  ];
  const testimonios = [];
  for(let i=0;i<98;i++){
    const nombre = nombres[i % nombres.length];
    const comentario = comentarios[(i + Math.floor(i / nombres.length)) % comentarios.length];
    const estrellas = (i % 9 === 0) ? 4 : 5; // mayoría 5 estrellas, algunas 4 -> promedio alto tipo 4.7-4.8
    testimonios.push({ id: Date.now() + i, nombre, comentario, estrellas });
  }
  db.config.tiendaTestimonios = testimonios;
  dbGuardarInmediato();
  renderizarListaTestimoniosTienda();
  mostrarToast('Se generaron 98 testimonios de ejemplo. Puedes editarlos o borrar los que no quieras desde aquí.');
}
function agregarTestimonioTienda(){
  const nombre = document.getElementById('testNombre').value.trim();
  const comentario = document.getElementById('testComentario').value.trim();
  const estrellas = parseInt(document.getElementById('testEstrellas').value);
  if(!nombre || !comentario){ mostrarToast('Escribe el nombre del cliente y su comentario.'); return; }
  db.config.tiendaTestimonios = db.config.tiendaTestimonios || [];
  db.config.tiendaTestimonios.push({ id: Date.now(), nombre, comentario, estrellas });
  dbGuardarInmediato();
  document.getElementById('testNombre').value=''; document.getElementById('testComentario').value='';
  renderizarListaTestimoniosTienda();
}
function eliminarTestimonioTienda(id){
  db.config.tiendaTestimonios = db.config.tiendaTestimonios.filter(t=>t.id!==id);
  dbGuardarInmediato();
  renderizarListaTestimoniosTienda();
}
function renderizarListaTestimoniosTienda(){
  const lista = db.config.tiendaTestimonios || [];
  document.getElementById('listaTestimoniosTienda').innerHTML = lista.map(t=>`
    <div style="width:220px;background:rgba(0,0,0,.2);border-radius:8px;padding:10px;position:relative;">
      <button onclick="eliminarTestimonioTienda(${t.id})" style="position:absolute;top:4px;right:4px;background:var(--red-alert);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;">✖</button>
      <div style="color:#f59e0b;font-size:12px;">${'⭐'.repeat(t.estrellas)}</div>
      <p style="font-size:11px;font-style:italic;margin:6px 0;">"${t.comentario}"</p>
      <strong style="font-size:11px;">${t.nombre}</strong>
    </div>`).join('') || '<p class="empty-state" style="width:100%;">Sin testimonios todavía.</p>';
}
function copiarLinkTiendaPublica(){
  const input = document.getElementById('cfgTiendaLinkPublico');
  input.select(); input.setSelectionRange(0, 99999);
  navigator.clipboard && navigator.clipboard.writeText(input.value).then(()=>{
    mostrarToast('Enlace copiado — ya lo puedes compartir con tus clientes.');
  }).catch(()=>{ document.execCommand('copy'); mostrarToast('Enlace copiado.'); });
}
function guardarContactoTienda(){
  db.config.tiendaTelefono = document.getElementById('cfgTiendaTelefono').value.trim();
  db.config.tiendaWhatsapp = document.getElementById('cfgTiendaWhatsapp').value.trim();
  db.config.tiendaFacebook = document.getElementById('cfgTiendaFacebook').value.trim();
  db.config.tiendaInstagram = document.getElementById('cfgTiendaInstagram').value.trim();
  dbGuardarInmediato();
  mostrarToast('Datos de contacto de la tienda guardados.');
  renderizarTienda();
}
function guardarAparienciaTienda(){
  db.config.tiendaColor = document.getElementById('cfgTiendaColor').value;
  db.config.tiendaImgEstilo = document.getElementById('cfgTiendaImgEstilo').value;
  db.config.tiendaTamanoTarjeta = parseInt(document.getElementById('cfgTiendaTamanoTarjeta').value);
  dbGuardarInmediato();
  aplicarAparienciaTienda();
  mostrarToast('Apariencia de la tienda actualizada.');
}
function restablecerAparienciaTienda(){
  db.config.tiendaColor = '#0088ff'; db.config.tiendaImgEstilo = 'cover'; db.config.tiendaTamanoTarjeta = 230;
  dbGuardarInmediato();
  cargarTabTiendaConfig();
  aplicarAparienciaTienda();
}
function aplicarAparienciaTienda(){
  document.documentElement.style.setProperty('--tienda-accent', db.config.tiendaColor || '#0088ff');
  document.documentElement.style.setProperty('--tienda-img-fit', db.config.tiendaImgEstilo || 'cover');
  document.documentElement.style.setProperty('--tienda-card-min', (db.config.tiendaTamanoTarjeta || 230) + 'px');
}

