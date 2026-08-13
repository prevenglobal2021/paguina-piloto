// ===== cotizador.js — extraído de prevenglobal__25_.html (líneas 3782-4031) =====
/* =========================================================
   MÓDULO DE NEGOCIO / CONTABILIDAD
   Nómina de técnicos, gastos generales del negocio, e ingresos
   provenientes de los pedidos de la Tienda Virtual. Es la base
   para ir ampliando el tema contable poco a poco.
========================================================= */
function mesActualISO(){
  const hoy = new Date();
  return hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0');
}
/* =========================================================
   NÓMINA — liquidación completa con comprobante en PDF
   Reemplaza el formulario simple anterior (un solo monto suelto)
   por un flujo de liquidación real: selección de personas, días
   laborados, ajustes/descuentos con nota, y comprobante numerado
   por persona. El balance mensual de Contabilidad ahora se calcula
   desde este nuevo registro (db.liquidacionesNomina) en vez del
   arreglo viejo db.nomina.
========================================================= */
let liquidacionEstado = {}; // { [tecnicoId]: {dias, valorDia, ajustes:[], descuentos:[]} }

function abrirModalLiquidacionNomina(){
  liquidacionEstado = {};
  const hoy = new Date().toISOString().slice(0,10);
  document.getElementById('liqPeriodoDesde').value = hoy;
  document.getElementById('liqPeriodoHasta').value = hoy;
  renderizarListaTecnicosLiquidacion();
  renderizarDetallesLiquidacion();
  abrirModal('modalLiquidacionNomina');
}
function renderizarListaTecnicosLiquidacion(){
  const cont = document.getElementById('liqListaTecnicos');
  const activos = db.tecnicos.filter(t=>t.activo!==false);
  cont.innerHTML = activos.map(t=>`
    <label style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.15);padding:6px 12px;border-radius:6px;font-size:13px;font-weight:400;margin:0;">
      <input type="checkbox" style="width:auto;margin:0;" onchange="toggleTecnicoLiquidacion(${t.id}, this.checked)">
      ${t.nombre}
    </label>`).join('') || '<p class="empty-state">No hay técnicos activos registrados.</p>';
}
function toggleTecnicoLiquidacion(tecnicoId, marcado){
  if(marcado){
    liquidacionEstado[tecnicoId] = liquidacionEstado[tecnicoId] || { dias:0, valorDia:0, ajustes:[], descuentos:[] };
  } else {
    delete liquidacionEstado[tecnicoId];
  }
  renderizarDetallesLiquidacion();
}
function calcularTotalesPersonaLiquidacion(persona){
  const valorBase = (persona.dias||0) * (persona.valorDia||0);
  const totalAjustes = persona.ajustes.reduce((a,x)=>a+(x.monto||0),0);
  const totalDescuentos = persona.descuentos.reduce((a,x)=>a+(x.monto||0),0);
  const totalNeto = valorBase + totalAjustes - totalDescuentos;
  return { valorBase, totalAjustes, totalDescuentos, totalNeto };
}
function renderizarDetallesLiquidacion(){
  const cont = document.getElementById('liqDetallesPersonas');
  const ids = Object.keys(liquidacionEstado);
  if(!ids.length){
    cont.innerHTML = '<p class="empty-state">Marca arriba a las personas que vas a liquidar.</p>';
    document.getElementById('liqResumenTexto').innerText = '';
    return;
  }
  let totalGeneral = 0;
  cont.innerHTML = ids.map(idStr=>{
    const tecnicoId = parseInt(idStr);
    const t = buscarTecnico(tecnicoId);
    const persona = liquidacionEstado[tecnicoId];
    const { valorBase, totalNeto } = calcularTotalesPersonaLiquidacion(persona);
    totalGeneral += totalNeto;
    const filasAjustes = persona.ajustes.map((a,idx)=>`
      <div class="field-row" style="margin-bottom:4px;">
        <div><input type="text" placeholder="Concepto (ej. Bono, Hora extra)" value="${a.concepto||''}" oninput="actualizarItemLiquidacion(${tecnicoId},'ajustes',${idx},'concepto',this.value)"></div>
        <div><input type="number" placeholder="Monto" value="${a.monto||''}" oninput="actualizarItemLiquidacion(${tecnicoId},'ajustes',${idx},'monto',this.value)"></div>
        <div><input type="text" placeholder="Nota (opcional)" value="${a.nota||''}" oninput="actualizarItemLiquidacion(${tecnicoId},'ajustes',${idx},'nota',this.value)"></div>
        <div style="flex:0;"><button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarItemLiquidacion(${tecnicoId},'ajustes',${idx})">X</button></div>
      </div>`).join('');
    const filasDescuentos = persona.descuentos.map((d,idx)=>`
      <div class="field-row" style="margin-bottom:4px;">
        <div><input type="text" placeholder="Concepto (ej. Préstamo, Ausencia)" value="${d.concepto||''}" oninput="actualizarItemLiquidacion(${tecnicoId},'descuentos',${idx},'concepto',this.value)"></div>
        <div><input type="number" placeholder="Monto" value="${d.monto||''}" oninput="actualizarItemLiquidacion(${tecnicoId},'descuentos',${idx},'monto',this.value)"></div>
        <div><input type="text" placeholder="Nota (opcional)" value="${d.nota||''}" oninput="actualizarItemLiquidacion(${tecnicoId},'descuentos',${idx},'nota',this.value)"></div>
        <div style="flex:0;"><button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarItemLiquidacion(${tecnicoId},'descuentos',${idx})">X</button></div>
      </div>`).join('');
    return `<div class="panel" style="background:rgba(0,0,0,.15);margin-bottom:12px;">
      <strong>${t?t.nombre:'—'}</strong>
      <div class="field-row" style="margin-top:8px;">
        <div><label style="font-size:11px;">Días laborados</label><input type="number" min="0" value="${persona.dias}" oninput="actualizarCampoLiquidacion(${tecnicoId},'dias',this.value)"></div>
        <div><label style="font-size:11px;">Valor por día</label><input type="number" min="0" value="${persona.valorDia}" oninput="actualizarCampoLiquidacion(${tecnicoId},'valorDia',this.value)"></div>
        <div><label style="font-size:11px;">Valor base</label><input type="text" disabled value="${formatoCOP(valorBase)}"></div>
      </div>
      <label style="font-size:11px;margin-top:8px;">Ajustes / bonificaciones (+)</label>
      ${filasAjustes}
      <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="agregarItemLiquidacion(${tecnicoId},'ajustes')">+ Agregar ajuste</button>
      <label style="font-size:11px;margin-top:10px;">Descuentos (-)</label>
      ${filasDescuentos}
      <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="agregarItemLiquidacion(${tecnicoId},'descuentos')">+ Agregar descuento</button>
      <div style="text-align:right;font-weight:700;margin-top:10px;border-top:1px solid var(--card-border);padding-top:8px;">
        Total neto a pagar: ${formatoCOP(totalNeto)}
      </div>
    </div>`;
  }).join('');
  document.getElementById('liqResumenTexto').innerText = `${ids.length} persona(s) seleccionada(s) · Total a pagar: ${formatoCOP(totalGeneral)}`;
}
function actualizarCampoLiquidacion(tecnicoId, campo, valor){
  liquidacionEstado[tecnicoId][campo] = parseFloat(valor) || 0;
  renderizarDetallesLiquidacion();
}
function agregarItemLiquidacion(tecnicoId, tipo){
  liquidacionEstado[tecnicoId][tipo].push({ concepto:'', monto:0, nota:'' });
  renderizarDetallesLiquidacion();
}
function quitarItemLiquidacion(tecnicoId, tipo, idx){
  liquidacionEstado[tecnicoId][tipo].splice(idx,1);
  renderizarDetallesLiquidacion();
}
function actualizarItemLiquidacion(tecnicoId, tipo, idx, campo, valor){
  liquidacionEstado[tecnicoId][tipo][idx][campo] = (campo==='monto') ? (parseFloat(valor)||0) : valor;
  if(campo!=='monto') return; // no hace falta redibujar todo por cada letra escrita en texto/nota
  renderizarDetallesLiquidacion();
}
function siguienteConsecutivoNomina(){
  db.config.consecutivoNomina = (db.config.consecutivoNomina || 0) + 1;
  return 'NOM-' + String(db.config.consecutivoNomina).padStart(5,'0');
}
function confirmarLiquidacionNomina(){
  const ids = Object.keys(liquidacionEstado);
  if(!ids.length){ mostrarToast('Selecciona al menos una persona para liquidar.'); return; }
  const periodoDesde = document.getElementById('liqPeriodoDesde').value;
  const periodoHasta = document.getElementById('liqPeriodoHasta').value;
  if(!periodoDesde || !periodoHasta){ mostrarToast('Define el periodo a liquidar (desde/hasta).'); return; }
  const fechaLiquidacion = new Date().toISOString().slice(0,10);
  db.liquidacionesNomina = db.liquidacionesNomina || [];
  let generados = 0;
  ids.forEach(idStr=>{
    const tecnicoId = parseInt(idStr);
    const persona = liquidacionEstado[tecnicoId];
    const totales = calcularTotalesPersonaLiquidacion(persona);
    db.liquidacionesNomina.push({
      id: Date.now() + generados,
      numero: siguienteConsecutivoNomina(),
      fecha: fechaLiquidacion,
      periodoDesde, periodoHasta,
      tecnicoId,
      diasLaborados: persona.dias, valorDia: persona.valorDia,
      valorBase: totales.valorBase,
      ajustes: persona.ajustes.filter(a=>a.concepto || a.monto),
      descuentos: persona.descuentos.filter(d=>d.concepto || d.monto),
      totalAjustes: totales.totalAjustes, totalDescuentos: totales.totalDescuentos,
      totalNeto: totales.totalNeto
    });
    generados++;
  });
  dbGuardarInmediato();
  registrarLog('Liquidar', 'Nómina', `${generados} persona(s) · periodo ${periodoDesde} a ${periodoHasta}`);
  cerrarModal('modalLiquidacionNomina');
  mostrarToast(`Liquidación registrada: ${generados} comprobante(s) generado(s). Descárgalos desde el historial.`);
  renderizarHistorialNomina();
}
function renderizarHistorialNomina(){
  const filtroMes = document.getElementById('contaMesFiltro');
  const mes = filtroMes.value || mesActualISO();
  db.liquidacionesNomina = db.liquidacionesNomina || [];
  const delMes = db.liquidacionesNomina.filter(l=>l.fecha && l.fecha.startsWith(mes));
  document.getElementById('tablaNomina').innerHTML = delMes.slice().reverse().map(l=>{
    const t = buscarTecnico(l.tecnicoId);
    return `<tr>
      <td>${l.numero}</td><td>${t?t.nombre:'—'}</td><td>${l.periodoDesde} a ${l.periodoHasta}</td>
      <td>${formatoCOP(l.totalNeto)}</td>
      <td><button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verComprobanteNomina(${l.id})"><i class="fas fa-file-invoice"></i> Ver comprobante</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-state">Sin liquidaciones registradas este mes.</td></tr>';
}
let comprobanteNominaActualId = null;
function verComprobanteNomina(id){
  comprobanteNominaActualId = id;
  const l = (db.liquidacionesNomina||[]).find(x=>x.id===id);
  if(!l) return;
  const t = buscarTecnico(l.tecnicoId);
  const logoHtml = db.config.logo ? `<img src="${db.config.logo}">` : '';
  const filasAjustes = l.ajustes.map(a=>`<tr><td>${a.concepto||'Ajuste'}${a.nota?` — <small>${a.nota}</small>`:''}</td><td style="text-align:right;color:#16a34a;">+ ${formatoCOP(a.monto)}</td></tr>`).join('');
  const filasDescuentos = l.descuentos.map(d=>`<tr><td>${d.concepto||'Descuento'}${d.nota?` — <small>${d.nota}</small>`:''}</td><td style="text-align:right;color:#dc2626;">− ${formatoCOP(d.monto)}</td></tr>`).join('');
  document.getElementById('comprobanteNominaContenido').innerHTML = `
    <div class="pdf-header">
      <div>${logoHtml}<h2 style="color:#0088ff;margin:0;">${db.config.nombre}</h2><small>${db.config.subtitulo||''}</small></div>
      <div style="text-align:right;"><strong>Comprobante de Pago de Nómina</strong><br><small>N.º ${l.numero}</small><br><small>Fecha: ${new Date(l.fecha+'T00:00:00').toLocaleDateString('es-CO')}</small></div>
    </div>
    <div class="pdf-box"><h4>Datos de la liquidación</h4>
      <table class="pdf-tabla-datos" cellpadding="4">
        <tr><td style="width:45%;"><strong>Persona liquidada</strong></td><td>${t?t.nombre:'—'}</td></tr>
        <tr><td><strong>Periodo liquidado</strong></td><td>${l.periodoDesde} a ${l.periodoHasta}</td></tr>
        <tr><td><strong>Días laborados</strong></td><td>${l.diasLaborados}</td></tr>
        <tr><td><strong>Valor por día</strong></td><td>${formatoCOP(l.valorDia)}</td></tr>
        <tr><td><strong>Valor base</strong></td><td>${formatoCOP(l.valorBase)}</td></tr>
      </table>
    </div>
    ${filasAjustes ? `<div class="pdf-box"><h4>Ajustes / Bonificaciones</h4><table class="pdf-tabla-datos" cellpadding="4">${filasAjustes}</table></div>` : ''}
    ${filasDescuentos ? `<div class="pdf-box"><h4>Descuentos</h4><table class="pdf-tabla-datos" cellpadding="4">${filasDescuentos}</table></div>` : ''}
    <div class="pdf-box" style="background:#eff6ff;border-color:#bfdbfe;">
      <h4 style="margin:0 0 4px 0;">Total neto pagado</h4>
      <p style="font-size:22px;font-weight:700;color:#1d4ed8;margin:0;">${formatoCOP(l.totalNeto)}</p>
    </div>
    <div class="pdf-box" style="margin-top:30px;">
      <div style="text-align:center;width:260px;margin:20px auto 0;">
        <div style="border-top:1px solid #000;padding-top:6px;font-size:12px;">
          Juan<br><small style="color:#64748b;">Representante — ${db.config.nombre}</small>
        </div>
      </div>
    </div>`;
  abrirModal('modalComprobanteNomina');
}
function enviarComprobanteNominaPorWhatsApp(id){
  const l = (db.liquidacionesNomina||[]).find(x=>x.id===id);
  if(!l) return;
  const t = buscarTecnico(l.tecnicoId);
  if(!t || !t.telefono){ mostrarToast('Esta persona no tiene teléfono registrado en su ficha de técnico.'); return; }
  const telefonoLimpio = t.telefono.replace(/[^0-9]/g,'');
  const mensaje = `Hola ${t.nombre}, adjuntamos tu comprobante de pago de nómina N.º ${l.numero}, correspondiente al periodo ${l.periodoDesde} a ${l.periodoHasta}. Cualquier duda con gusto la resolvemos.`;
  const abrirChatWhatsApp = ()=> window.open(`https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');

  verComprobanteNomina(id); // arma el contenido del comprobante en #comprobanteNominaContenido
  const nombreArchivo = `Comprobante_${l.numero}_${t.nombre}`.replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf';
  const elemento = document.getElementById('comprobanteNominaContenido');
  const opciones = { margin:10, filename:nombreArchivo, image:{type:'jpeg',quality:0.95}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'letter',orientation:'portrait'}, pagebreak:{ mode:['css','legacy'] } };

  if(typeof html2pdf === 'undefined'){
    abrirChatWhatsApp();
    registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (sin comprobante adjunto automático — sin conexión)`);
    return;
  }
  html2pdf().set(opciones).from(elemento).outputPdf('blob').then(blob=>{
    cerrarModal('modalComprobanteNomina');
    const archivoPdf = new File([blob], nombreArchivo, { type:'application/pdf' });

    if(navigator.canShare && navigator.canShare({ files:[archivoPdf] })){
      navigator.share({ files:[archivoPdf], title:`Comprobante ${l.numero}`, text: mensaje }).then(()=>{
        registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (comprobante compartido directo desde el celular)`);
      }).catch(()=>{ /* el usuario cerró el panel de compartir sin elegir nada: no se registra como enviado */ });
      return;
    }

    const url = URL.createObjectURL(blob);
    const enlaceDescarga = document.createElement('a');
    enlaceDescarga.href = url; enlaceDescarga.download = nombreArchivo; enlaceDescarga.click();
    URL.revokeObjectURL(url);
    mostrarToast(`Se descargó el comprobante "${nombreArchivo}". Ahora se abre WhatsApp con el mensaje listo: adjunta ese archivo en el chat (📎 → Documento) antes de enviarlo — desde el computador, WhatsApp no permite adjuntar archivos automáticamente por este tipo de enlace. Desde el celular, este mismo botón comparte el PDF directo, sin este paso.`);
    abrirChatWhatsApp();
    registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (con comprobante PDF descargado para adjuntar)`);
  }).catch(()=>{
    mostrarToast('No se pudo generar el PDF automáticamente. Se abrirá WhatsApp; puedes generar el comprobante desde "Ver comprobante" y adjuntarlo manualmente.');
    abrirChatWhatsApp();
    registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (sin comprobante adjunto automático)`);
  });
}
function agregarGasto(){
  const categoria = document.getElementById('gastoCategoria').value;
  const descripcion = document.getElementById('gastoDescripcion').value.trim();
  const monto = parseFloat(document.getElementById('gastoMonto').value);
  const fecha = document.getElementById('gastoFecha').value;
  if(!descripcion){ mostrarToast('Escribe una breve descripción del gasto.'); return; }
  if(!monto || monto<=0){ mostrarToast('Escribe un monto válido.'); return; }
  if(!fecha){ mostrarToast('Selecciona la fecha del gasto.'); return; }
  db.gastos = db.gastos || [];
  db.gastos.push({ id:Date.now(), categoria, descripcion, monto, fecha });
  dbGuardarInmediato();
  registrarLog('Crear', 'Gasto', `${categoria} · ${descripcion} · ${formatoCOP(monto)}`);
  document.getElementById('gastoDescripcion').value=''; document.getElementById('gastoMonto').value=''; document.getElementById('gastoFecha').value='';
  renderizarContabilidad();
}
function eliminarGasto(id){
  if(!confirm('¿Eliminar este gasto?')) return;
  db.gastos = db.gastos.filter(g=>g.id!==id);
  dbGuardarInmediato();
  renderizarContabilidad();
}
function renderizarContabilidad(){
  db.liquidacionesNomina = db.liquidacionesNomina || []; db.gastos = db.gastos || []; db.pedidosTienda = db.pedidosTienda || [];
  const filtroMes = document.getElementById('contaMesFiltro');
  if(!filtroMes.value) filtroMes.value = mesActualISO();
  const mes = filtroMes.value; // "YYYY-MM"

  const nominaDelMes = db.liquidacionesNomina.filter(l=>l.fecha && l.fecha.startsWith(mes));
  const gastosDelMes = db.gastos.filter(g=>g.fecha && g.fecha.startsWith(mes));
  const pedidosDelMes = db.pedidosTienda.filter(p=>p.fecha && p.fecha.startsWith(mes));

  const totalNomina = nominaDelMes.reduce((a,l)=>a+l.totalNeto,0);
  const totalGastos = gastosDelMes.reduce((a,g)=>a+g.monto,0);
  const totalIngresos = pedidosDelMes.reduce((a,p)=>a+p.total,0);
  const balance = totalIngresos - totalNomina - totalGastos;

  document.getElementById('contaCardIngresos').innerText = formatoCOP(totalIngresos);
  document.getElementById('contaCardNomina').innerText = formatoCOP(totalNomina);
  document.getElementById('contaCardGastos').innerText = formatoCOP(totalGastos);
  const cardBalance = document.getElementById('contaCardBalance');
  cardBalance.innerText = formatoCOP(balance);
  cardBalance.style.color = balance >= 0 ? 'var(--exito-verde,#22c55e)' : 'var(--red-alert)';

  renderizarHistorialNomina();

  document.getElementById('tablaGastos').innerHTML = gastosDelMes.map(g=>`
    <tr><td>${g.fecha}</td><td>${g.categoria}</td><td>${g.descripcion}</td><td>${formatoCOP(g.monto)}</td>
      <td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarGasto(${g.id})">X</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Sin gastos registrados este mes.</td></tr>';

  document.getElementById('tablaPedidosTiendaConta').innerHTML = pedidosDelMes.map(p=>`
    <tr><td>${p.numero}</td><td>${new Date(p.fecha).toLocaleDateString('es-CO')}</td><td>${p.nombre}</td><td>${formatoCOP(p.total)}</td><td><small>${p.estadoPago}</small></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Sin pedidos de la tienda este mes.</td></tr>';

  document.getElementById('cfgRecargoMateriales').value = db.config.recargoMateriales ?? 1.3;
  document.getElementById('cfgPorcentajeTercero').value = db.config.porcentajePagoTercero ?? 0.45;
  document.getElementById('cfgMetaMensual').value = db.config.metaMensualUtilidad ?? 5000000;
  actualizarSugerenciaPagoTecnico();
  renderizarControlOperativo();
  renderizarCuadroMandoAnual();
}
function guardarParametrosCotizador(){
  db.config.recargoMateriales = parseFloat(document.getElementById('cfgRecargoMateriales').value) || 1.3;
  db.config.porcentajePagoTercero = parseFloat(document.getElementById('cfgPorcentajeTercero').value) || 0;
  db.config.metaMensualUtilidad = parseFloat(document.getElementById('cfgMetaMensual').value) || 0;
  dbGuardarInmediato();
  mostrarToast('Parámetros del cotizador guardados.');
  renderizarCuadroMandoAnual();
}
function calcularManoDeObra(horas, comp, valorHora){
  return horas > 0 ? (horas * valorHora * comp) : valorHora;
}
function actualizarSugerenciaPagoTecnico(){
  const ejecutor = document.getElementById('coEjecutor').value;
  const horas = parseFloat(document.getElementById('coHoras').value) || 0;
  const comp = parseFloat(document.getElementById('coComp').value) || 1;
  const valorHora = parseFloat(document.getElementById('coValorHora').value) || 0;
  const mano = calcularManoDeObra(horas, comp, valorHora);
  if(ejecutor === 'Tercero'){
    document.getElementById('coPagoTecnico').value = Math.round(mano * (db.config.porcentajePagoTercero ?? 0.45));
  } else {
    document.getElementById('coPagoTecnico').value = 0;
  }
  actualizarPreviewCotizador();
}
function actualizarPreviewCotizador(){
  const horas = parseFloat(document.getElementById('coHoras').value) || 0;
  const comp = parseFloat(document.getElementById('coComp').value) || 1;
  const valorHora = parseFloat(document.getElementById('coValorHora').value) || 0;
  const materiales = parseFloat(document.getElementById('coMateriales').value) || 0;
  const logistica = parseFloat(document.getElementById('coLogistica').value) || 0;
  const pagoTecnico = parseFloat(document.getElementById('coPagoTecnico').value) || 0;
  const mano = calcularManoDeObra(horas, comp, valorHora);
  const recargo = db.config.recargoMateriales ?? 1.3;
  const precioCliente = mano + (materiales * recargo) + logistica;
  const utilidadNeta = precioCliente - pagoTecnico - materiales - logistica;
  document.getElementById('coPreviewPrecio').innerText = formatoCOP(precioCliente);
  document.getElementById('coPreviewUtilidad').innerText = formatoCOP(utilidadNeta);
}
function agregarControlOperativo(){
  const fecha = document.getElementById('coFecha').value;
  const servicioCliente = document.getElementById('coServicioCliente').value.trim();
  if(!fecha){ mostrarToast('Selecciona la fecha del servicio.'); return; }
  if(!servicioCliente){ mostrarToast('Escribe el servicio o cliente.'); return; }
  const horas = parseFloat(document.getElementById('coHoras').value) || 0;
  const comp = parseFloat(document.getElementById('coComp').value) || 1;
  const valorHora = parseFloat(document.getElementById('coValorHora').value) || 0;
  const materiales = parseFloat(document.getElementById('coMateriales').value) || 0;
  const logistica = parseFloat(document.getElementById('coLogistica').value) || 0;
  const pagoTecnico = parseFloat(document.getElementById('coPagoTecnico').value) || 0;
  const mano = calcularManoDeObra(horas, comp, valorHora);
  const recargo = db.config.recargoMateriales ?? 1.3;
  const precioCliente = mano + (materiales * recargo) + logistica;
  const utilidadNeta = precioCliente - pagoTecnico - materiales - logistica;
  db.controlOperativo = db.controlOperativo || [];
  db.controlOperativo.push({
    id: Date.now(), fecha, servicioCliente,
    tipoServicio: document.getElementById('coTipoServicio').value,
    ejecutor: document.getElementById('coEjecutor').value,
    horas, comp, valorHora, materiales, logistica, pagoTecnico,
    precioCliente, utilidadNeta,
    estado: document.getElementById('coEstado').value,
    estadoCartera: document.getElementById('coCartera').value,
    dineroAbonado: parseFloat(document.getElementById('coDineroAbonado').value) || 0
  });
  dbGuardarInmediato();
  registrarLog('Crear', 'ControlOperativo', `${servicioCliente} · ${formatoCOP(precioCliente)}`);
  ['coServicioCliente'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('coHoras').value=0; document.getElementById('coComp').value=1; document.getElementById('coValorHora').value=0;
  document.getElementById('coMateriales').value=0; document.getElementById('coLogistica').value=0; document.getElementById('coPagoTecnico').value=0;
  document.getElementById('coDineroAbonado').value=0;
  actualizarPreviewCotizador();
  renderizarControlOperativo();
  renderizarCuadroMandoAnual();
}
function eliminarControlOperativo(id){
  if(!confirm('¿Eliminar este registro del control operativo?')) return;
  db.controlOperativo = db.controlOperativo.filter(r=>r.id!==id);
  dbGuardarInmediato();
  renderizarControlOperativo();
  renderizarCuadroMandoAnual();
}
function cambiarEstadoControlOperativo(id, campo, valor){
  const r = (db.controlOperativo||[]).find(x=>x.id===id);
  if(!r) return;
  r[campo] = valor;
  dbGuardarInmediato();
  renderizarCuadroMandoAnual();
}
function renderizarControlOperativo(){
  const filtroMes = document.getElementById('contaMesFiltro').value || mesActualISO();
  const lista = (db.controlOperativo||[]).filter(r=>r.fecha && r.fecha.startsWith(filtroMes));
  document.getElementById('tablaControlOperativo').innerHTML = lista.map(r=>`
    <tr>
      <td>${r.fecha}</td><td>${r.servicioCliente}</td><td>${r.tipoServicio}</td><td>${r.ejecutor}</td>
      <td>${formatoCOP(r.precioCliente)}</td><td>${formatoCOP(r.pagoTecnico)}</td><td>${formatoCOP(r.utilidadNeta)}</td>
      <td><select onchange="cambiarEstadoControlOperativo(${r.id},'estado',this.value)">
        ${['Pendiente','Aprobada','cancelado'].map(o=>`<option ${o===r.estado?'selected':''}>${o}</option>`).join('')}
      </select></td>
      <td><select onchange="cambiarEstadoControlOperativo(${r.id},'estadoCartera',this.value)">
        ${['Pendiente','Pagado'].map(o=>`<option ${o===r.estadoCartera?'selected':''}>${o}</option>`).join('')}
      </select></td>
      <td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarControlOperativo(${r.id})">X</button></td>
    </tr>`).join('') || '<tr><td colspan="10" class="empty-state">Sin servicios registrados este mes en el cotizador.</td></tr>';
  document.getElementById('coTotalPrecio').innerText = formatoCOP(lista.reduce((a,r)=>a+r.precioCliente,0));
  document.getElementById('coTotalPagoTec').innerText = formatoCOP(lista.reduce((a,r)=>a+r.pagoTecnico,0));
  document.getElementById('coTotalUtilidad').innerText = formatoCOP(lista.reduce((a,r)=>a+r.utilidadNeta,0));
}
function renderizarCuadroMandoAnual(){
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const anio = new Date().getFullYear();
  const meta = db.config.metaMensualUtilidad || 5000000;
  const datos = (db.controlOperativo||[]).filter(r=>r.fecha && r.fecha.startsWith(String(anio)));
  let totalAprobada=0, totalPendiente=0;
  const filas = meses.map((nombreMes, idx)=>{
    const mesStr = String(anio) + '-' + String(idx+1).padStart(2,'0');
    const delMes = datos.filter(r=>r.fecha.startsWith(mesStr) && r.estado!=='cancelado');
    const aprobada = delMes.filter(r=>r.estadoCartera==='Pagado').reduce((a,r)=>a+r.utilidadNeta,0);
    const pendiente = delMes.filter(r=>r.estadoCartera!=='Pagado').reduce((a,r)=>a+r.utilidadNeta,0);
    const total = aprobada + pendiente;
    totalAprobada += aprobada; totalPendiente += pendiente;
    const pctCaja = meta ? (aprobada/meta*100) : 0;
    const pctProy = meta ? (total/meta*100) : 0;
    return `<tr><td>${nombreMes}</td><td>${formatoCOP(aprobada)}</td><td>${formatoCOP(pendiente)}</td><td>${formatoCOP(total)}</td><td>${formatoCOP(meta)}</td>
      <td>${pctCaja.toFixed(1)}%</td><td>${pctProy.toFixed(1)}%</td></tr>`;
  }).join('');
  const totalGeneral = totalAprobada + totalPendiente;
  const metaAnual = meta*12;
  const filaTotal = `<tr style="font-weight:700;background:rgba(0,0,0,.2);"><td>TOTAL ANUAL</td><td>${formatoCOP(totalAprobada)}</td><td>${formatoCOP(totalPendiente)}</td><td>${formatoCOP(totalGeneral)}</td><td>${formatoCOP(metaAnual)}</td>
    <td>${metaAnual?(totalAprobada/metaAnual*100).toFixed(1):0}%</td><td>${metaAnual?(totalGeneral/metaAnual*100).toFixed(1):0}%</td></tr>`;
  document.getElementById('tablaCuadroMandoAnual').innerHTML = filas + filaTotal;
}
function cambiarPasswordTecnico(id){
  const t = buscarTecnico(id);
  if(!t) return;
  const nueva = prompt(`Nueva contraseña para ${t.nombre}:`);
  if(!nueva) return;
  t.password = nueva;
  dbGuardar();
  registrarLog('Cambiar contraseña', 'Técnico', t.nombre);
  mostrarToast('Contraseña actualizada.');
}
function eliminarTecnicoConfig(id){
  if(!confirm('¿Eliminar este técnico?')) return;
  const t = buscarTecnico(id);
  db.tecnicos = db.tecnicos.filter(t=>t.id!==id);
  registrarEliminacion('tecnicos', id);
  dbGuardar();
  if(t) registrarLog('Eliminar', 'Técnico', t.nombre);
  if(document.getElementById('cfgTecId').value == id) cancelarEdicionTecnico();
  renderizarTecnicosConfig();
}

