// ===== tienda-publica.js — extraído de prevenglobal__25_.html (líneas 4878-5113) =====
/* =========================================================
   TIENDA PÚBLICA — enlace independiente, sin sesión.
   Se activa con ?tienda=<codigo-empresa> en la URL. Muestra
   SOLO el catálogo (nunca agenda, clientes, inventario interno,
   configuración, etc.) y consume un endpoint público del
   servidor que no expone datos sensibles de la empresa.
========================================================= */
let tiendaPublicaSlug = null, tiendaPublicaData = null;
let carritoPublico = []; // [{ itemId, cantidad }]
let intervaloBannerPublico = null;

function iniciarTiendaPublica(slug){
  tiendaPublicaSlug = slug;
  document.getElementById('tiendaPublicaWrapper').style.display = 'block';
  fetch('/api/tienda/' + encodeURIComponent(slug))
    .then(r=>{ if(!r.ok) throw new Error('no encontrada'); return r.json(); })
    .then(data=>{
      tiendaPublicaData = data;
      document.title = (data.nombre || 'Tienda') + ' — Tienda Virtual';
      const metaDesc = document.createElement('meta');
      metaDesc.setAttribute('property', 'og:title'); metaDesc.setAttribute('content', (data.nombre||'Tienda Virtual'));
      document.head.appendChild(metaDesc);
      const metaDesc2 = document.createElement('meta');
      metaDesc2.setAttribute('property', 'og:description'); metaDesc2.setAttribute('content', 'Equipos, repuestos y servicios disponibles — cotiza o solicita tu pedido en línea.');
      document.head.appendChild(metaDesc2);
      if(data.logo){
        const metaImg = document.createElement('meta');
        metaImg.setAttribute('property', 'og:image'); metaImg.setAttribute('content', data.logo);
        document.head.appendChild(metaImg);
      }
      document.getElementById('tpNombreTienda').innerText = '🛒 ' + (data.nombre || 'Tienda Virtual');
      document.documentElement.style.setProperty('--tienda-accent', data.color || '#0088ff');
      document.documentElement.style.setProperty('--tienda-img-fit', data.imgEstilo || 'cover');
      document.documentElement.style.setProperty('--tienda-card-min', (data.tamanoTarjeta || 230) + 'px');

      const logoImg = document.getElementById('tpLogo');
      if(data.logo){ logoImg.src = data.logo; logoImg.style.display = 'block'; }

      const bannerWrap = document.getElementById('tpBannerWrap');
      const bannerTrack = document.getElementById('tpBannerTrack');
      if((data.banner||[]).length){
        bannerWrap.style.display = 'block';
        bannerTrack.innerHTML = data.banner.map(img=>`<img src="${img}">`).join('');
        let indice = 0;
        if(data.banner.length > 1){
          intervaloBannerPublico = setInterval(()=>{
            indice = (indice+1) % data.banner.length;
            bannerTrack.style.transform = `translateX(-${indice*100}%)`;
          }, 4000);
        }
      }
      const galeriaWrap = document.getElementById('tpGaleriaWrap');
      if((data.galeria||[]).length){
        galeriaWrap.style.display = 'flex';
        galeriaWrap.innerHTML = data.galeria.map(item=>{
          const img = typeof item === 'string' ? item : item.img;
          const nota = typeof item === 'string' ? '' : (item.nota||'');
          return `<div class="tienda-galeria-item"><img src="${img}">${nota?`<span>${nota}</span>`:''}</div>`;
        }).join('');
      }
      if(data.whatsapp){
        const btnWa = document.getElementById('tpBotonWhatsapp');
        btnWa.href = `https://wa.me/${data.whatsapp.replace(/\D/g,'')}`;
        btnWa.style.display = 'flex';
      }
      if(data.telefono){
        const footerTel = document.getElementById('tpTelefonoFooter');
        footerTel.innerText = '📞 Contáctanos: ' + data.telefono;
        footerTel.style.display = 'block';
      }
      const redesWrap = document.getElementById('tpRedesSociales');
      if(data.facebook){
        const btnFb = document.getElementById('tpBotonFacebook');
        btnFb.href = data.facebook; btnFb.style.display = 'inline-block'; redesWrap.style.display = 'flex';
      }
      if(data.instagram){
        const btnIg = document.getElementById('tpBotonInstagram');
        btnIg.href = data.instagram; btnIg.style.display = 'inline-block'; redesWrap.style.display = 'flex';
      }
      document.getElementById('tpSecciones').innerHTML = htmlSeccionesTienda(data.secciones, data.testimonios);
      iniciarRotacionTestimonios(data.testimonios);
      const contPolitica = document.getElementById('tpTextoPoliticaDatos');
      if(contPolitica) contPolitica.innerHTML = textoPoliticaDatosPorDefecto(data.nombre || 'esta empresa');
      renderizarTiendaPublica();
    })
    .catch(()=>{ document.getElementById('tpErrorState').style.display = 'block'; });
}
function textoPoliticaDatosPorDefecto(nombreEmpresa){
  return `<p>En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia (protección de datos personales / habeas data), ${nombreEmpresa} informa:</p>
    <p><strong>Datos que recolectamos:</strong> nombre, teléfono, correo electrónico y dirección/notas que ingresas al hacer un pedido o solicitud de cotización.</p>
    <p><strong>Finalidad:</strong> contactarte para confirmar, coordinar el pago y la entrega de tu pedido o servicio solicitado. No se usan para ningún otro fin ni se venden a terceros.</p>
    <p><strong>Tus derechos:</strong> puedes solicitar en cualquier momento conocer, actualizar, rectificar o eliminar tus datos, escribiendo por el canal de contacto (WhatsApp o teléfono) que aparece en esta página.</p>
    <p><strong>Almacenamiento:</strong> tus datos se guardan de forma segura y solo el personal autorizado de ${nombreEmpresa} tiene acceso a ellos.</p>`;
}
function renderizarTiendaPublica(){
  if(!tiendaPublicaData) return;
  const buscador = (document.getElementById('tpBuscador').value || '').toLowerCase().trim();
  const productos = tiendaPublicaData.productos.filter(p=>{
    if(!buscador) return true;
    return (p.nombre||'').toLowerCase().includes(buscador) || (p.categoria||'').toLowerCase().includes(buscador);
  });
  document.getElementById('tpEmptyState').style.display = productos.length ? 'none' : 'block';
  document.getElementById('tpGrid').innerHTML = productos.map(it=>{
    const foto = (it.fotos && it.fotos[0]) ? `<img src="${it.fotos[0]}" class="tienda-card-img">` : `<div class="tienda-card-img-placeholder"><i class="fas fa-box-open"></i></div>`;
    const agotado = it.stockActual <= 0;
    return `<div class="tienda-card" onclick="verDetalleProductoPublico(${it.id})">
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
  actualizarBadgeCarritoPublico();
}
function verDetalleProductoPublico(itemId){
  const it = tiendaPublicaData.productos.find(p=>p.id===itemId);
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
    <button class="btn-custom" style="width:100%;" ${agotado?'disabled':''} onclick="agregarAlCarritoPublico(${it.id});cerrarModal('modalProductoTienda');">
      <i class="fas fa-cart-plus"></i> ${agotado ? 'Sin stock' : 'Agregar al carrito'}
    </button>`;
  abrirModal('modalProductoTienda');
}
function agregarAlCarritoPublico(itemId){
  const it = tiendaPublicaData.productos.find(p=>p.id===itemId);
  if(!it || it.stockActual <= 0) return;
  const existente = carritoPublico.find(c=>c.itemId===itemId);
  if(existente){ if(existente.cantidad < it.stockActual) existente.cantidad++; }
  else carritoPublico.push({ itemId, cantidad: 1 });
  actualizarBadgeCarritoPublico();
}
function actualizarBadgeCarritoPublico(){
  const badge = document.getElementById('tpBadgeCarrito');
  const total = carritoPublico.reduce((a,c)=>a+c.cantidad,0);
  badge.innerText = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}
function cambiarCantidadCarritoPublico(itemId, delta){
  const linea = carritoPublico.find(c=>c.itemId===itemId);
  if(!linea) return;
  const it = tiendaPublicaData.productos.find(p=>p.id===itemId);
  linea.cantidad = Math.max(1, Math.min(it ? it.stockActual : 99, linea.cantidad + delta));
  renderizarCarritoPublico();
}
function quitarDelCarritoPublico(itemId){
  carritoPublico = carritoPublico.filter(c=>c.itemId!==itemId);
  renderizarCarritoPublico();
}
function renderizarCarritoPublico(){
  const lista = document.getElementById('tpCarritoLista');
  document.getElementById('tpFormCheckout').style.display = 'none';
  document.getElementById('tpBtnIrACheckout').style.display = 'inline-block';
  document.getElementById('tpBtnConfirmarPedido').style.display = 'none';
  if(!carritoPublico.length){
    lista.innerHTML = '<p class="empty-state">Tu carrito está vacío. Explora la tienda y agrega productos.</p>';
    document.getElementById('tpCarritoTotal').innerText = '';
    actualizarBadgeCarritoPublico();
    return;
  }
  let total = 0;
  lista.innerHTML = carritoPublico.map(c=>{
    const it = tiendaPublicaData.productos.find(p=>p.id===c.itemId);
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
        <button onclick="cambiarCantidadCarritoPublico(${it.id},-1)">−</button>
        <span>${c.cantidad}</span>
        <button onclick="cambiarCantidadCarritoPublico(${it.id},1)">+</button>
      </div>
      <strong style="min-width:90px;text-align:right;font-size:13px;">${formatoCOP(subtotal)}</strong>
      <button class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarDelCarritoPublico(${it.id})">✖</button>
    </div>`;
  }).join('');
  document.getElementById('tpCarritoTotal').innerText = 'Total: ' + formatoCOP(total);
  actualizarBadgeCarritoPublico();
}
function abrirCarritoPublico(){
  renderizarCarritoPublico();
  abrirModal('modalCarritoPublico');
}
function mostrarFormCheckoutPublico(){
  if(!carritoPublico.length){ mostrarToast('Tu carrito está vacío.'); return; }
  document.getElementById('tpFormCheckout').style.display = 'block';
  document.getElementById('tpBtnIrACheckout').style.display = 'none';
  document.getElementById('tpBtnConfirmarPedido').style.display = 'inline-block';
}
function confirmarPedidoPublico(){
  const nombre = document.getElementById('tpCheckoutNombre').value.trim();
  const telefono = document.getElementById('tpCheckoutTelefono').value.trim();
  const email = document.getElementById('tpCheckoutEmail').value.trim();
  const notas = document.getElementById('tpCheckoutNotas').value.trim();
  if(!nombre || !telefono){ mostrarToast('Escribe al menos tu nombre y teléfono para que podamos contactarte.'); return; }
  if(!document.getElementById('tpAceptaDatos').checked){ mostrarToast('Debes aceptar el tratamiento de datos personales para continuar.'); return; }
  const items = carritoPublico.map(c=>({ itemId: c.itemId, cantidad: c.cantidad }));
  const btn = document.getElementById('tpBtnConfirmarPedido');
  btn.disabled = true; btn.innerText = 'Enviando...';
  fetch(`/api/tienda/${encodeURIComponent(tiendaPublicaSlug)}/pedido`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, telefono, email, notas, items })
  }).then(r=>r.json()).then(resp=>{
    btn.disabled = false; btn.innerText = '✔️ Confirmar pedido';
    if(!resp.ok){ mostrarToast(resp.error || 'No se pudo registrar el pedido, intenta de nuevo.'); return; }
    carritoPublico = [];
    cerrarModal('modalCarritoPublico');
    mostrarToast(`¡Pedido ${resp.numero} registrado! Un asesor te contactará al ${telefono} para coordinar el pago y la entrega.`);
    iniciarTiendaPublica(tiendaPublicaSlug); // refresca stock disponible
  }).catch(()=>{
    btn.disabled = false; btn.innerText = '✔️ Confirmar pedido';
    mostrarToast('No se pudo enviar el pedido — revisa tu conexión a internet e intenta de nuevo.');
  });
}

