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
let liquidacionEstado = {}; // { [id]: {esOcasional, nombreOcasional, tipoPago:'dias'|'horas', dias, valorDia, horas, valorHora, ajustes:[], descuentos:[]} }
                             // El id es el id numérico del técnico (como texto), o "oc-<...>" para personal ocasional.
let contadorOcasional = 0;

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
    <label style="display:flex;align-items:center;gap:6px;background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:400;margin:0;color:#1e293b;">
      <input type="checkbox" style="width:auto;margin:0;" onchange="toggleTecnicoLiquidacion(${t.id}, this.checked)">
      ${t.nombre}
    </label>`).join('') || '<p class="empty-state">No hay técnicos activos registrados.</p>';
}
function nuevaPersonaLiquidacionVacia(){
  return { esOcasional:false, nombreOcasional:'', tipoPago:'dias', dias:0, valorDia:0, horas:0, valorHora:0, ajustes:[], descuentos:[] };
}
function toggleTecnicoLiquidacion(tecnicoId, marcado){
  const id = String(tecnicoId);
  if(marcado){
    liquidacionEstado[id] = liquidacionEstado[id] || nuevaPersonaLiquidacionVacia();
  } else {
    delete liquidacionEstado[id];
  }
  renderizarDetallesLiquidacion();
}
function agregarPersonalOcasional(){
  contadorOcasional++;
  const id = 'oc-' + Date.now() + '-' + contadorOcasional;
  liquidacionEstado[id] = Object.assign(nuevaPersonaLiquidacionVacia(), { esOcasional:true });
  renderizarDetallesLiquidacion();
}
function quitarPersonalOcasional(id){
  delete liquidacionEstado[id];
  renderizarDetallesLiquidacion();
}
function calcularTotalesPersonaLiquidacion(persona){
  const valorBase = persona.tipoPago==='horas'
    ? (persona.horas||0) * (persona.valorHora||0)
    : (persona.dias||0) * (persona.valorDia||0);
  const totalAjustes = persona.ajustes.reduce((a,x)=>a+(x.monto||0),0);
  const totalDescuentos = persona.descuentos.reduce((a,x)=>a+(x.monto||0),0);
  const totalNeto = valorBase + totalAjustes - totalDescuentos;
  return { valorBase, totalAjustes, totalDescuentos, totalNeto };
}
function renderizarDetallesLiquidacion(){
  const cont = document.getElementById('liqDetallesPersonas');
  const ids = Object.keys(liquidacionEstado);
  if(!ids.length){
    cont.innerHTML = '<p class="empty-state">Marca arriba a las personas que vas a liquidar, o agrega personal ocasional.</p>';
  } else {
    cont.innerHTML = ids.map(id=>renderizarTarjetaPersonaLiquidacion(id)).join('');
  }
  actualizarResumenGeneralLiquidacion();
}
function renderizarTarjetaPersonaLiquidacion(id){
  const persona = liquidacionEstado[id];
  const t = persona.esOcasional ? null : buscarTecnico(parseInt(id));
  const { valorBase, totalNeto } = calcularTotalesPersonaLiquidacion(persona);
  const filasAjustes = persona.ajustes.map((a,idx)=>`
    <div class="field-row" style="margin-bottom:4px;">
      <div><input type="text" placeholder="Concepto (ej. Bono, Hora extra)" value="${a.concepto||''}" oninput="actualizarItemLiquidacion('${id}','ajustes',${idx},'concepto',this.value)"></div>
      <div><input type="number" placeholder="Monto" value="${a.monto||''}" oninput="actualizarItemLiquidacion('${id}','ajustes',${idx},'monto',this.value)"></div>
      <div><input type="text" placeholder="Nota (opcional)" value="${a.nota||''}" oninput="actualizarItemLiquidacion('${id}','ajustes',${idx},'nota',this.value)"></div>
      <div style="flex:0;"><button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarItemLiquidacion('${id}','ajustes',${idx})">X</button></div>
    </div>`).join('');
  const filasDescuentos = persona.descuentos.map((d,idx)=>`
    <div class="field-row" style="margin-bottom:4px;">
      <div><input type="text" placeholder="Concepto (ej. Préstamo, Ausencia)" value="${d.concepto||''}" oninput="actualizarItemLiquidacion('${id}','descuentos',${idx},'concepto',this.value)"></div>
      <div><input type="number" placeholder="Monto" value="${d.monto||''}" oninput="actualizarItemLiquidacion('${id}','descuentos',${idx},'monto',this.value)"></div>
      <div><input type="text" placeholder="Nota (opcional)" value="${d.nota||''}" oninput="actualizarItemLiquidacion('${id}','descuentos',${idx},'nota',this.value)"></div>
      <div style="flex:0;"><button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarItemLiquidacion('${id}','descuentos',${idx})">X</button></div>
    </div>`).join('');
  const camposCantidad = persona.tipoPago==='horas' ? `
    <div><label style="font-size:11px;">Horas laboradas</label><input type="number" min="0" value="${persona.horas}" oninput="actualizarCampoLiquidacion('${id}','horas',this.value)"></div>
    <div><label style="font-size:11px;">Valor por hora</label><input type="number" min="0" value="${persona.valorHora}" oninput="actualizarCampoLiquidacion('${id}','valorHora',this.value)"></div>` : `
    <div><label style="font-size:11px;">Días laborados</label><input type="number" min="0" value="${persona.dias}" oninput="actualizarCampoLiquidacion('${id}','dias',this.value)"></div>
    <div><label style="font-size:11px;">Valor por día</label><input type="number" min="0" value="${persona.valorDia}" oninput="actualizarCampoLiquidacion('${id}','valorDia',this.value)"></div>`;
  const encabezado = persona.esOcasional ? `
    <div class="field-row" style="align-items:center;">
      <div style="flex:2;"><input type="text" placeholder="Nombre de la persona" value="${persona.nombreOcasional||''}" style="font-weight:700;" oninput="actualizarNombreOcasional('${id}',this.value)"></div>
      <div><span style="font-size:10px;background:#f59e0b;color:#fff;padding:3px 10px;border-radius:10px;white-space:nowrap;">PERSONAL OCASIONAL</span></div>
      <div><select onchange="cambiarTipoPagoOcasional('${id}',this.value)">
        <option value="dias" ${persona.tipoPago==='dias'?'selected':''}>Pagar por días</option>
        <option value="horas" ${persona.tipoPago==='horas'?'selected':''}>Pagar por horas</option>
      </select></div>
      <div style="flex:0;"><button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarPersonalOcasional('${id}')">Quitar</button></div>
    </div>` : `<strong>${t?t.nombre:'—'}</strong>`;
  return `<div class="panel" id="tarjeta-liq-${id}" style="background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:12px;color:#1e293b;">
    ${encabezado}
    <div class="field-row" style="margin-top:8px;">
      ${camposCantidad}
      <div><label style="font-size:11px;">Valor base</label><input type="text" disabled id="valorBase-${id}" value="${formatoCOP(valorBase)}"></div>
    </div>
    <label style="font-size:11px;margin-top:8px;">Ajustes / bonificaciones (+)</label>
    ${filasAjustes}
    <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="agregarItemLiquidacion('${id}','ajustes')">+ Agregar ajuste</button>
    <label style="font-size:11px;margin-top:10px;">Descuentos (-)</label>
    ${filasDescuentos}
    <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="agregarItemLiquidacion('${id}','descuentos')">+ Agregar descuento</button>
    <div id="totalNeto-${id}" style="text-align:right;font-weight:700;margin-top:10px;border-top:1px solid var(--card-border);padding-top:8px;">
      Total neto a pagar: ${formatoCOP(totalNeto)}
    </div>
  </div>`;
}
function actualizarResumenGeneralLiquidacion(){
  const ids = Object.keys(liquidacionEstado);
  const totalGeneral = ids.reduce((suma,id)=>suma + calcularTotalesPersonaLiquidacion(liquidacionEstado[id]).totalNeto, 0);
  document.getElementById('liqResumenTexto').innerText = ids.length ? `${ids.length} persona(s) seleccionada(s) · Total a pagar: ${formatoCOP(totalGeneral)}` : '';
}
// Actualiza SOLO los números ya calculados de una tarjeta (valor base y total neto),
// sin reconstruir el HTML de la tarjeta — así el campo donde se está escribiendo
// nunca se destruye ni se vuelve a crear, y se puede escribir de forma fluida,
// sin que el cursor salte ni se pierda el foco en cada tecla.
function actualizarTotalesVisualesPersona(id){
  const persona = liquidacionEstado[id];
  if(!persona) return;
  const { valorBase, totalNeto } = calcularTotalesPersonaLiquidacion(persona);
  const elBase = document.getElementById('valorBase-'+id);
  const elTotal = document.getElementById('totalNeto-'+id);
  if(elBase) elBase.value = formatoCOP(valorBase);
  if(elTotal) elTotal.innerText = 'Total neto a pagar: ' + formatoCOP(totalNeto);
  actualizarResumenGeneralLiquidacion();
}
function actualizarCampoLiquidacion(id, campo, valor){
  liquidacionEstado[id][campo] = parseFloat(valor) || 0;
  actualizarTotalesVisualesPersona(id);
}
function actualizarNombreOcasional(id, valor){
  liquidacionEstado[id].nombreOcasional = valor; // el campo ya quedó escrito solo, no hace falta redibujar nada
}
function cambiarTipoPagoOcasional(id, valor){
  liquidacionEstado[id].tipoPago = valor;
  renderizarDetallesLiquidacion(); // este sí cambia qué campos se muestran (días↔horas), toca redibujar esa tarjeta
}
function agregarItemLiquidacion(id, tipo){
  liquidacionEstado[id][tipo].push({ concepto:'', monto:0, nota:'' });
  renderizarDetallesLiquidacion(); // agrega una fila nueva: sí cambia la estructura, toca redibujar
}
function quitarItemLiquidacion(id, tipo, idx){
  liquidacionEstado[id][tipo].splice(idx,1);
  renderizarDetallesLiquidacion(); // quita una fila: sí cambia la estructura, toca redibujar
}
function actualizarItemLiquidacion(id, tipo, idx, campo, valor){
  liquidacionEstado[id][tipo][idx][campo] = (campo==='monto') ? (parseFloat(valor)||0) : valor;
  if(campo==='monto') actualizarTotalesVisualesPersona(id); // solo actualiza los números, no redibuja la fila donde se escribe
}
function siguienteConsecutivoNomina(){
  db.config.consecutivoNomina = (db.config.consecutivoNomina || 0) + 1;
  return 'NOM-' + String(db.config.consecutivoNomina).padStart(5,'0');
}
async function confirmarLiquidacionNomina(){
  const ids = Object.keys(liquidacionEstado);
  if(!ids.length){ mostrarToast('Selecciona al menos una persona, o agrega personal ocasional, para liquidar.'); return; }
  for(const id of ids){
    if(liquidacionEstado[id].esOcasional && !liquidacionEstado[id].nombreOcasional.trim()){
      mostrarToast('Escribe el nombre de cada persona ocasional que agregaste.'); return;
    }
  }
  const periodoDesde = document.getElementById('liqPeriodoDesde').value;
  const periodoHasta = document.getElementById('liqPeriodoHasta').value;
  if(!periodoDesde || !periodoHasta){ mostrarToast('Define el periodo a liquidar (desde/hasta).'); return; }
  const fechaLiquidacion = new Date().toISOString().slice(0,10);
  db.liquidacionesNomina = db.liquidacionesNomina || [];
  const nuevos = [];
  let generados = 0;
  ids.forEach(id=>{
    const persona = liquidacionEstado[id];
    const totales = calcularTotalesPersonaLiquidacion(persona);
    generados++;
    nuevos.push({
      id: Date.now() + generados,
      numero: siguienteConsecutivoNomina(),
      fecha: fechaLiquidacion,
      periodoDesde, periodoHasta,
      tecnicoId: persona.esOcasional ? null : parseInt(id),
      esOcasional: !!persona.esOcasional,
      personalOcasionalNombre: persona.esOcasional ? persona.nombreOcasional.trim() : null,
      tipoPago: persona.tipoPago,
      diasLaborados: persona.dias, valorDia: persona.valorDia,
      horasLaboradas: persona.horas, valorHora: persona.valorHora,
      valorBase: totales.valorBase,
      ajustes: persona.ajustes.filter(a=>a.concepto || a.monto),
      descuentos: persona.descuentos.filter(d=>d.concepto || d.monto),
      totalAjustes: totales.totalAjustes, totalDescuentos: totales.totalDescuentos,
      totalNeto: totales.totalNeto,
      estadoPago: 'pendiente', fechaPago: null
    });
  });
  db.liquidacionesNomina.push(...nuevos);
  try{
    await dbGuardarInmediato();
  }catch(err){
    nuevos.forEach(n=>{ const i = db.liquidacionesNomina.indexOf(n); if(i>-1) db.liquidacionesNomina.splice(i,1); });
    mostrarToast('⚠️ No se pudo registrar la liquidación: ' + err.message, 'error');
    return;
  }
  registrarLog('Liquidar', 'Nómina', `${generados} persona(s) · periodo ${periodoDesde} a ${periodoHasta}`);
  cerrarModal('modalLiquidacionNomina');
  mostrarToast(`Liquidación registrada: ${generados} comprobante(s) generado(s). Descárgalos desde el historial.`);
  renderizarHistorialNomina();
}
function limpiarFiltrosNomina(){
  document.getElementById('nomBuscarTexto').value = '';
  document.getElementById('nomFiltroTecnico').value = '';
  document.getElementById('nomFiltroDesde').value = '';
  document.getElementById('nomFiltroHasta').value = '';
  renderizarHistorialNomina();
}
function poblarFiltroTecnicoNomina(){
  const sel = document.getElementById('nomFiltroTecnico');
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + db.tecnicos.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');
  sel.value = valorActual; // conserva la selección hecha, si esa persona sigue existiendo
}
function renderizarHistorialNomina(){
  db.liquidacionesNomina = db.liquidacionesNomina || [];
  poblarFiltroTecnicoNomina();

  const texto = (document.getElementById('nomBuscarTexto').value || '').trim().toLowerCase();
  const tecnicoFiltro = document.getElementById('nomFiltroTecnico').value;
  const desde = document.getElementById('nomFiltroDesde').value;
  const hasta = document.getElementById('nomFiltroHasta').value;

  let lista = db.liquidacionesNomina.filter(l=>{
    if(tecnicoFiltro && (l.esOcasional || String(l.tecnicoId)!==tecnicoFiltro)) return false;
    if(desde && l.fecha < desde) return false;
    if(hasta && l.fecha > hasta) return false;
    if(texto){
      const nombre = l.esOcasional ? (l.personalOcasionalNombre||'') : (buscarTecnico(l.tecnicoId)?.nombre||'');
      if(!nombre.toLowerCase().includes(texto) && !l.numero.toLowerCase().includes(texto)) return false;
    }
    return true;
  });

  // Orden explícito y siempre confiable: más reciente primero por fecha de
  // liquidación, y si dos quedaron el mismo día, por el momento exacto en que
  // se crearon — ya no depende del orden en que casualmente quedaron guardadas.
  lista = lista.sort((a,b)=> b.fecha.localeCompare(a.fecha) || b.id - a.id);

  document.getElementById('tablaNomina').innerHTML = lista.map(l=>{
    const nombreMostrado = l.esOcasional
      ? `${l.personalOcasionalNombre||'—'} <span style="font-size:9px;background:#f59e0b;color:#fff;padding:1px 6px;border-radius:8px;">OCASIONAL</span>`
      : (buscarTecnico(l.tecnicoId)?.nombre || '—');
    const infoEstadoPago = infoEstadoPagoNomina(l.estadoPago);
    const estadoPagoHtml = `<span style="font-size:10px;font-weight:700;background:${infoEstadoPago.fondo};color:${infoEstadoPago.texto};padding:3px 10px;border-radius:12px;white-space:nowrap;" title="${l.montoAbonado ? 'Abonado: '+formatoCOP(l.montoAbonado)+' de '+formatoCOP(l.totalNeto) : ''}"><i class="fas ${infoEstadoPago.icono}"></i> ${infoEstadoPago.etiqueta}</span>`;
    return `<tr>
      <td>${l.numero}</td><td>${nombreMostrado}</td><td>${l.periodoDesde} a ${l.periodoHasta}</td>
      <td>${formatoCOP(l.totalNeto)}</td>
      <td>${estadoPagoHtml}</td>
      <td>
        <button class="btn-custom btn-secondary-custom btn-sm-custom" onclick="verComprobanteNomina(${l.id})"><i class="fas fa-file-invoice"></i> Ver comprobante</button>
        <button class="btn-custom btn-success-custom btn-sm-custom solo-admin" data-permiso="nomina_editar" onclick="cambiarEstadoPagoNomina(${l.id})"><i class="fas fa-hand-holding-dollar"></i> Estado de pago</button>
        <button class="btn-custom btn-secondary-custom btn-sm-custom solo-admin" data-permiso="nomina_editar" onclick="editarLiquidacionNomina(${l.id})"><i class="fas fa-pen"></i> Editar</button>
        <button class="btn-custom btn-danger-custom btn-sm-custom solo-admin" data-permiso="nomina_eliminar" onclick="eliminarLiquidacionNomina(${l.id})"><i class="fas fa-trash"></i> Eliminar</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-state">Sin liquidaciones que coincidan con la búsqueda.</td></tr>';

  // Total general de justo lo que está filtrado/visible en la tabla en este momento.
  const totalGeneral = lista.reduce((suma,l)=>suma + l.totalNeto, 0);
  const pieTabla = document.getElementById('pieTotalNomina');
  if(pieTabla){
    pieTabla.innerHTML = lista.length
      ? `<tr style="font-weight:700;background:#eff6ff;color:#1e3a5f;border-top:2px solid #bfdbfe;"><td colspan="3" style="text-align:right;">Total (${lista.length} comprobante${lista.length===1?'':'s'}):</td><td colspan="3">${formatoCOP(totalGeneral)}</td></tr>`
      : '';
  }
  aplicarRBACaUI();
}
let comprobanteNominaActualId = null;
function verComprobanteNomina(id){
  comprobanteNominaActualId = id;
  const l = (db.liquidacionesNomina||[]).find(x=>x.id===id);
  if(!l) return;
  const nombrePersona = l.esOcasional ? (l.personalOcasionalNombre||'—') : (buscarTecnico(l.tecnicoId)?.nombre||'—');
  const etiquetaTipo = l.esOcasional ? ' <small style="color:#b45309;">(Personal ocasional)</small>' : '';
  const filaCantidad = l.tipoPago==='horas'
    ? `<tr><td><strong>Horas laboradas</strong></td><td>${l.horasLaboradas}</td></tr>
       <tr><td><strong>Valor por hora</strong></td><td>${formatoCOP(l.valorHora)}</td></tr>`
    : `<tr><td><strong>Días laborados</strong></td><td>${l.diasLaborados}</td></tr>
       <tr><td><strong>Valor por día</strong></td><td>${formatoCOP(l.valorDia)}</td></tr>`;
  const logoHtml = db.config.logo ? `<img src="${db.config.logo}">` : '';
  const filasAjustes = l.ajustes.map(a=>`<tr><td>${a.concepto||'Ajuste'}${a.nota?` — <small>${a.nota}</small>`:''}</td><td style="text-align:right;color:#16a34a;">+ ${formatoCOP(a.monto)}</td></tr>`).join('');
  const filasDescuentos = l.descuentos.map(d=>`<tr><td>${d.concepto||'Descuento'}${d.nota?` — <small>${d.nota}</small>`:''}</td><td style="text-align:right;color:#dc2626;">− ${formatoCOP(d.monto)}</td></tr>`).join('');
  const marcaAgua = { pagado:{texto:'PAGADO',color:'22,163,74'}, parcial:{texto:'PAGO PARCIAL',color:'29,78,216'}, abonado:{texto:'ABONADO',color:'109,40,217'} }[l.estadoPago];
  document.getElementById('comprobanteNominaContenido').innerHTML = `
    ${marcaAgua ? `<div style="position:absolute;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-22deg);font-size:52px;font-weight:900;color:rgba(${marcaAgua.color},.28);border:6px solid rgba(${marcaAgua.color},.28);padding:4px 26px;border-radius:14px;pointer-events:none;z-index:5;letter-spacing:4px;white-space:nowrap;">${marcaAgua.texto}</div>` : ''}
    <div class="pdf-header">
      <div>${logoHtml}<h2 style="color:#0088ff;margin:0;">${db.config.nombre}</h2><small>${db.config.subtitulo||''}</small></div>
      <div style="text-align:right;"><strong>Comprobante de Pago de Nómina</strong><br><small>N.º ${l.numero}</small><br><small>Fecha: ${new Date(l.fecha+'T00:00:00').toLocaleDateString('es-CO')}</small></div>
    </div>
    <div class="pdf-box"><h4>Datos de la liquidación</h4>
      <table class="pdf-tabla-datos" cellpadding="4">
        <tr><td style="width:45%;"><strong>Persona liquidada</strong></td><td>${nombrePersona}${etiquetaTipo}</td></tr>
        <tr><td><strong>Periodo liquidado</strong></td><td>${l.periodoDesde} a ${l.periodoHasta}</td></tr>
        ${filaCantidad}
        <tr><td><strong>Valor base</strong></td><td>${formatoCOP(l.valorBase)}</td></tr>
      </table>
    </div>
    ${filasAjustes ? `<div class="pdf-box"><h4>Ajustes / Bonificaciones</h4><table class="pdf-tabla-datos" cellpadding="4">${filasAjustes}</table></div>` : ''}
    ${filasDescuentos ? `<div class="pdf-box"><h4>Descuentos</h4><table class="pdf-tabla-datos" cellpadding="4">${filasDescuentos}</table></div>` : ''}
    <div class="pdf-box" style="background:#eff6ff;border-color:#bfdbfe;">
      <h4 style="margin:0 0 4px 0;">Total neto pagado</h4>
      <p style="font-size:22px;font-weight:700;color:#1d4ed8;margin:0;">${formatoCOP(l.totalNeto)}</p>
      ${(l.estadoPago==='parcial'||l.estadoPago==='abonado') ? `<p style="font-size:12px;margin:8px 0 0;color:#475569;">Abonado hasta ahora: <strong>${formatoCOP(l.montoAbonado||0)}</strong> · Saldo pendiente: <strong style="color:#b45309;">${formatoCOP(l.totalNeto-(l.montoAbonado||0))}</strong></p>` : ''}
    </div>
    <div class="pdf-box" style="margin-top:30px;">
      <div style="text-align:center;width:260px;margin:20px auto 0;">
        ${db.config.firmaRepresentante ? `<img src="${db.config.firmaRepresentante}" style="max-height:60px;max-width:220px;">` : ''}
        <div style="border-top:1px solid #000;padding-top:6px;font-size:12px;">
          ${db.config.nombreRepresentante || 'Representante Legal'}<br><small style="color:#64748b;">${db.config.nombre}</small>
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
  const enlaceWhatsApp = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;

  // En celular con panel nativo de compartir, el PDF se adjunta directo — no
  // hace falta el enlace de WhatsApp aparte. En computador (sin ese panel),
  // WhatsApp se abre YA MISMO, en respuesta directa al clic: si se espera a
  // que el PDF termine de generarse primero, el navegador bloquea la ventana
  // en silencio (sin avisar nada), y por eso antes parecía que "no hacía nada".
  const puedeCompartirArchivosNativo = !!(navigator.share && navigator.canShare);
  let ventanaWhatsApp = null;
  if(!puedeCompartirArchivosNativo){
    ventanaWhatsApp = window.open(enlaceWhatsApp, '_blank');
    if(!ventanaWhatsApp){
      mostrarToast('⚠️ El navegador bloqueó la ventana de WhatsApp. Busca el ícono de "ventana emergente bloqueada" en la barra de direcciones, permítela para este sitio, e intenta de nuevo.', 'error');
      return;
    }
  }

  verComprobanteNomina(id); // arma el contenido del comprobante en #comprobanteNominaContenido
  const nombreArchivo = `Comprobante_${l.numero}_${t.nombre}`.replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf';
  const elemento = document.getElementById('comprobanteNominaContenido');
  const opciones = { margin:10, filename:nombreArchivo, image:{type:'jpeg',quality:0.95}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'letter',orientation:'portrait'}, pagebreak:{ mode:['css','legacy'] } };

  if(typeof html2pdf === 'undefined'){
    if(puedeCompartirArchivosNativo) window.open(enlaceWhatsApp, '_blank');
    registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (sin comprobante adjunto automático — sin conexión)`);
    return;
  }
  html2pdf().set(opciones).from(elemento).outputPdf('blob').then(blob=>{
    cerrarModal('modalComprobanteNomina');
    const archivoPdf = new File([blob], nombreArchivo, { type:'application/pdf' });

    if(puedeCompartirArchivosNativo && navigator.canShare({ files:[archivoPdf] })){
      navigator.share({ files:[archivoPdf], title:`Comprobante ${l.numero}`, text: mensaje }).then(()=>{
        registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (comprobante compartido directo desde el celular)`);
      }).catch(()=>{ /* el usuario cerró el panel de compartir sin elegir nada: no se registra como enviado */ });
      return;
    }

    // Este dispositivo no comparte archivos de forma nativa: WhatsApp ya está
    // abierto desde el principio del clic — solo falta descargar el PDF para adjuntarlo.
    const url = URL.createObjectURL(blob);
    const enlaceDescarga = document.createElement('a');
    enlaceDescarga.href = url; enlaceDescarga.download = nombreArchivo; enlaceDescarga.click();
    URL.revokeObjectURL(url);
    mostrarToast(`Se descargó el comprobante "${nombreArchivo}". WhatsApp ya está abierto con el mensaje listo: adjunta ese archivo en el chat (📎 → Documento) antes de enviarlo.`);
    registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (con comprobante PDF descargado para adjuntar)`);
  }).catch(()=>{
    if(!ventanaWhatsApp && !puedeCompartirArchivosNativo) window.open(enlaceWhatsApp, '_blank');
    mostrarToast('No se pudo generar el PDF automáticamente. WhatsApp está abierto; genera el comprobante desde "Ver comprobante" y adjúntalo manualmente.');
    registrarLog('Enviar WhatsApp', 'Nómina', `${l.numero} a ${t.nombre} (sin comprobante adjunto automático)`);
  });
}
function toggleIngresoClienteEsporadico(){
  const esEsporadico = document.getElementById('ingresoClienteEsporadico').checked;
  document.getElementById('wrapperIngresoClienteExistente').style.display = esEsporadico ? 'none' : 'block';
  document.getElementById('wrapperIngresoClienteEsporadico').style.display = esEsporadico ? 'block' : 'none';
  if(!esEsporadico) document.getElementById('ingresoClienteEsporadicoNombre').value = '';
}
async function agregarIngreso(){
  const esEsporadico = document.getElementById('ingresoClienteEsporadico').checked;
  const clienteId = esEsporadico ? null : (document.getElementById('ingresoCliente').value ? parseInt(document.getElementById('ingresoCliente').value) : null);
  const clienteEsporadicoNombre = esEsporadico ? document.getElementById('ingresoClienteEsporadicoNombre').value.trim() : null;
  if(esEsporadico && !clienteEsporadicoNombre){ mostrarToast('Escribe el nombre del cliente esporádico.'); return; }
  const concepto = document.getElementById('ingresoConcepto').value.trim();
  const monto = parseFloat(document.getElementById('ingresoMonto').value);
  const fecha = document.getElementById('ingresoFecha').value;
  if(!concepto){ mostrarToast('Escribe el concepto del ingreso.'); return; }
  if(!monto || monto<=0){ mostrarToast('Escribe un monto válido.'); return; }
  if(!fecha){ mostrarToast('Selecciona la fecha del ingreso.'); return; }
  db.ingresos = db.ingresos || [];
  const nuevo = { id:Date.now(), clienteId, esClienteEsporadico: esEsporadico, clienteEsporadicoNombre, concepto, monto, fecha };
  db.ingresos.push(nuevo);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.ingresos.pop();
    mostrarToast('⚠️ No se pudo registrar el ingreso: ' + err.message, 'error');
    return;
  }
  const nombreClienteLog = esEsporadico ? clienteEsporadicoNombre : (buscarCliente(clienteId)?.nombre || 'General');
  registrarLog('Crear', 'Ingreso', `${nombreClienteLog} · ${concepto} · ${formatoCOP(monto)}`);
  document.getElementById('ingresoConcepto').value=''; document.getElementById('ingresoMonto').value=''; document.getElementById('ingresoFecha').value='';
  document.getElementById('ingresoClienteEsporadico').checked = false; toggleIngresoClienteEsporadico();
  document.getElementById('contaMesFiltro').value = fecha.slice(0,7); // así siempre se ve de inmediato lo que se acaba de registrar
  renderizarContabilidad();
  mostrarToast(`✅ Ingreso registrado: ${nombreClienteLog} — ${formatoCOP(monto)}`, 'exito');
}
async function eliminarIngreso(id){
  if(!confirm('¿Eliminar este ingreso?')) return;
  const listaAnterior = db.ingresos.slice();
  db.ingresos = db.ingresos.filter(i=>i.id!==id);
  registrarEliminacion('ingresos', id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.ingresos = listaAnterior;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  renderizarContabilidad();
}
async function agregarGasto(){
  const categoria = document.getElementById('gastoCategoria').value;
  const descripcion = document.getElementById('gastoDescripcion').value.trim();
  const monto = parseFloat(document.getElementById('gastoMonto').value);
  const fecha = document.getElementById('gastoFecha').value;
  if(!descripcion){ mostrarToast('Escribe una breve descripción del gasto.'); return; }
  if(!monto || monto<=0){ mostrarToast('Escribe un monto válido.'); return; }
  if(!fecha){ mostrarToast('Selecciona la fecha del gasto.'); return; }
  db.gastos = db.gastos || [];
  const nuevo = { id:Date.now(), categoria, descripcion, monto, fecha };
  db.gastos.push(nuevo);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.gastos.pop();
    mostrarToast('⚠️ No se pudo registrar el gasto: ' + err.message, 'error');
    return;
  }
  registrarLog('Crear', 'Gasto', `${categoria} · ${descripcion} · ${formatoCOP(monto)}`);
  document.getElementById('gastoDescripcion').value=''; document.getElementById('gastoMonto').value=''; document.getElementById('gastoFecha').value='';
  renderizarContabilidad();
  mostrarToast(`✅ Gasto registrado: ${categoria} — ${formatoCOP(monto)}`, 'exito');
}
async function eliminarGasto(id){
  if(!confirm('¿Eliminar este gasto?')) return;
  const listaAnterior = db.gastos.slice();
  db.gastos = db.gastos.filter(g=>g.id!==id);
  registrarEliminacion('gastos', id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.gastos = listaAnterior;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  renderizarContabilidad();
}
function renderizarContabilidad(){
  db.liquidacionesNomina = db.liquidacionesNomina || []; db.gastos = db.gastos || []; db.pedidosTienda = db.pedidosTienda || []; db.ingresos = db.ingresos || [];
  const filtroMes = document.getElementById('contaMesFiltro');
  if(!filtroMes.value) filtroMes.value = mesActualISO();
  const mes = filtroMes.value; // "YYYY-MM"

  const nominaDelMes = db.liquidacionesNomina.filter(l=>l.fecha && l.fecha.startsWith(mes));
  const gastosDelMes = db.gastos.filter(g=>g.fecha && g.fecha.startsWith(mes));
  const pedidosDelMes = db.pedidosTienda.filter(p=>p.fecha && p.fecha.startsWith(mes));
  const ingresosDelMes = db.ingresos.filter(i=>i.fecha && i.fecha.startsWith(mes));

  const totalNomina = nominaDelMes.reduce((a,l)=>a+l.totalNeto,0);
  const totalGastos = gastosDelMes.reduce((a,g)=>a+g.monto,0);
  const totalIngresos = pedidosDelMes.reduce((a,p)=>a+p.total,0) + ingresosDelMes.reduce((a,i)=>a+i.monto,0);
  const balance = totalIngresos - totalNomina - totalGastos;

  document.getElementById('contaCardIngresos').innerText = formatoCOP(totalIngresos);
  document.getElementById('contaCardNomina').innerText = formatoCOP(totalNomina);
  document.getElementById('contaCardGastos').innerText = formatoCOP(totalGastos);
  const cardBalance = document.getElementById('contaCardBalance');
  cardBalance.innerText = formatoCOP(balance);
  cardBalance.style.color = balance >= 0 ? '#15803d' : '#b91c1c';

  renderizarHistorialNomina();

  const selIngresoCliente = document.getElementById('ingresoCliente');
  const valorSelActual = selIngresoCliente.value;
  selIngresoCliente.innerHTML = '<option value="">(Ninguno / general)</option>' + db.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');
  selIngresoCliente.value = valorSelActual;

  document.getElementById('tablaIngresos').innerHTML = ingresosDelMes.slice().reverse().map(i=>{
    const nombreCliente = i.esClienteEsporadico
      ? `${i.clienteEsporadicoNombre||'—'} <span style="font-size:9px;background:#f59e0b;color:#fff;padding:1px 6px;border-radius:8px;">ESPORÁDICO</span>`
      : (i.clienteId ? (buscarCliente(i.clienteId)?.nombre || '—') : '<span style="color:var(--text-muted);">General</span>');
    return `<tr><td>${i.fecha}</td><td>${nombreCliente}</td><td>${i.concepto}</td><td>${formatoCOP(i.monto)}</td>
      <td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarIngreso(${i.id})">X</button></td></tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-state">Sin ingresos manuales registrados este mes.</td></tr>';

  document.getElementById('tablaGastos').innerHTML = gastosDelMes.map(g=>`
    <tr><td>${g.fecha}</td><td>${g.categoria}</td><td>${g.descripcion}</td><td>${formatoCOP(g.monto)}</td>
      <td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarGasto(${g.id})">X</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Sin gastos registrados este mes.</td></tr>';

  document.getElementById('tablaPedidosTiendaConta').innerHTML = pedidosDelMes.map(p=>`
    <tr><td>${p.numero}</td><td>${new Date(p.fecha).toLocaleDateString('es-CO')}</td><td>${p.nombre}</td><td>${formatoCOP(p.total)}</td><td><small>${p.estadoPago}</small></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Sin pedidos de la tienda este mes.</td></tr>';

  document.getElementById('cfgRecargoMateriales').value = db.config.recargoMateriales ?? 1.3;
  document.getElementById('cfgPorcentajeTercero').value = db.config.porcentajePagoTercero ?? 0.45;
  document.getElementById('cfgMetaMensual').value = db.config.metaMensualUtilidad ?? 5000000;
  if(!document.getElementById('coFecha').value) document.getElementById('coFecha').value = new Date().toISOString().slice(0,10);
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
async function agregarControlOperativo(){
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
  try{
    await dbGuardarInmediato();
  }catch(err){
    mostrarToast('⚠️ No se pudo guardar el servicio: ' + err.message, 'error');
    db.controlOperativo.pop(); // no dejar el registro "fantasma" en pantalla si el servidor lo rechazó
    return;
  }
  registrarLog('Crear', 'ControlOperativo', `${servicioCliente} · ${formatoCOP(precioCliente)}`);
  ['coServicioCliente'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('coHoras').value=0; document.getElementById('coComp').value=1; document.getElementById('coValorHora').value=0;
  document.getElementById('coMateriales').value=0; document.getElementById('coLogistica').value=0; document.getElementById('coPagoTecnico').value=0;
  document.getElementById('coDineroAbonado').value=0;
  actualizarPreviewCotizador();
  // Antes, si la fecha del servicio no caía en el mes que se estaba viendo en el
  // filtro de arriba, el registro se guardaba bien pero desaparecía de la tabla —
  // parecía que "no había hecho nada". Ahora el filtro se ajusta solo al mes del
  // servicio que se acaba de crear, para que siempre se vea de inmediato.
  document.getElementById('contaMesFiltro').value = fecha.slice(0,7);
  renderizarContabilidad();
  mostrarToast(`✅ Servicio agregado: ${servicioCliente} — ${formatoCOP(precioCliente)}`, 'exito');
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
  const filaTotal = `<tr style="font-weight:700;background:#eff6ff;color:#1e3a5f;"><td>TOTAL ANUAL</td><td>${formatoCOP(totalAprobada)}</td><td>${formatoCOP(totalPendiente)}</td><td>${formatoCOP(totalGeneral)}</td><td>${formatoCOP(metaAnual)}</td>
    <td>${metaAnual?(totalAprobada/metaAnual*100).toFixed(1):0}%</td><td>${metaAnual?(totalGeneral/metaAnual*100).toFixed(1):0}%</td></tr>`;
  document.getElementById('tablaCuadroMandoAnual').innerHTML = filas + filaTotal;
}
async function cambiarPasswordTecnico(id){
  const t = buscarTecnico(id);
  if(!t) return;
  const nueva = prompt(`Nueva contraseña para ${t.nombre}:`);
  if(!nueva) return;
  const anterior = t.password;
  t.password = nueva;
  try{
    await dbGuardarInmediato();
  }catch(err){
    t.password = anterior;
    mostrarToast('⚠️ No se pudo cambiar la contraseña: ' + err.message, 'error');
    return;
  }
  registrarLog('Cambiar contraseña', 'Técnico', t.nombre);
  mostrarToast('✅ Contraseña actualizada.', 'exito');
}
async function eliminarTecnicoConfig(id){
  if(!confirm('¿Eliminar este técnico?')) return;
  const t = buscarTecnico(id);
  const respaldo = db.tecnicos.slice();
  db.tecnicos = db.tecnicos.filter(t=>t.id!==id);
  registrarEliminacion('tecnicos', id);
  try{
    await dbGuardarInmediato();
  }catch(err){
    db.tecnicos = respaldo;
    mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
    return;
  }
  if(t) registrarLog('Eliminar', 'Técnico', t.nombre);
  mostrarToast('Técnico eliminado.', 'exito');
  if(document.getElementById('cfgTecId').value == id) cancelarEdicionTecnico();
  renderizarTecnicosConfig();
}

/* ---------------------------------------------------------
   EDITAR / ELIMINAR liquidaciones de nómina — por ser
   información de pagos, se pide la clave de administrador cada
   vez, aunque ya se haya iniciado sesión como admin. Se valida
   contra el servidor real (el mismo login de siempre), nunca en
   el navegador.
--------------------------------------------------------- */
function verificarClaveAdminYEjecutar(accion){
  const clave = prompt('Escribe la clave de administrador para continuar:');
  if(clave===null) return; // canceló, no hace nada
  if(!clave){ mostrarToast('Escribe la clave de administrador.'); return; }
  fetch(API_BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: empresaActual, tipo:'admin', usuario: db.config.adminUsuario, password: clave })
  }).then(r=> r.ok ? accion() : Promise.reject())
    .catch(()=> mostrarToast('Clave de administrador incorrecta.'));
}

let edicionLiquidacion = null; // {id, tipoPago, dias, valorDia, horas, valorHora, ajustes:[], descuentos:[]}
function editarLiquidacionNomina(id){
  verificarClaveAdminYEjecutar(()=>abrirModalEditarLiquidacion(id));
}
function abrirModalEditarLiquidacion(id){
  const l = (db.liquidacionesNomina||[]).find(x=>x.id===id);
  if(!l) return;
  const nombreMostrado = l.esOcasional ? `${l.personalOcasionalNombre||'—'} (Personal ocasional)` : (buscarTecnico(l.tecnicoId)?.nombre||'—');
  edicionLiquidacion = {
    id: l.id, tipoPago: l.tipoPago || 'dias',
    dias: l.diasLaborados||0, valorDia: l.valorDia||0,
    horas: l.horasLaboradas||0, valorHora: l.valorHora||0,
    ajustes: JSON.parse(JSON.stringify(l.ajustes||[])),
    descuentos: JSON.parse(JSON.stringify(l.descuentos||[]))
  };
  document.getElementById('editNominaNumero').innerText = l.numero;
  document.getElementById('editNominaTecnicoNombre').innerText = nombreMostrado;
  document.getElementById('editLiqPeriodoDesde').value = l.periodoDesde;
  document.getElementById('editLiqPeriodoHasta').value = l.periodoHasta;
  renderizarEdicionLiquidacion();
  abrirModal('modalEditarNomina');
}
function renderizarEdicionLiquidacion(){
  const totales = calcularTotalesPersonaLiquidacion(edicionLiquidacion);
  const filasAjustes = edicionLiquidacion.ajustes.map((a,idx)=>`
    <div class="field-row" style="margin-bottom:4px;">
      <div><input type="text" placeholder="Concepto" value="${a.concepto||''}" oninput="actualizarItemEdicion('ajustes',${idx},'concepto',this.value)"></div>
      <div><input type="number" placeholder="Monto" value="${a.monto||''}" oninput="actualizarItemEdicion('ajustes',${idx},'monto',this.value)"></div>
      <div><input type="text" placeholder="Nota (opcional)" value="${a.nota||''}" oninput="actualizarItemEdicion('ajustes',${idx},'nota',this.value)"></div>
      <div style="flex:0;"><button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarItemEdicion('ajustes',${idx})">X</button></div>
    </div>`).join('');
  const filasDescuentos = edicionLiquidacion.descuentos.map((d,idx)=>`
    <div class="field-row" style="margin-bottom:4px;">
      <div><input type="text" placeholder="Concepto" value="${d.concepto||''}" oninput="actualizarItemEdicion('descuentos',${idx},'concepto',this.value)"></div>
      <div><input type="number" placeholder="Monto" value="${d.monto||''}" oninput="actualizarItemEdicion('descuentos',${idx},'monto',this.value)"></div>
      <div><input type="text" placeholder="Nota (opcional)" value="${d.nota||''}" oninput="actualizarItemEdicion('descuentos',${idx},'nota',this.value)"></div>
      <div style="flex:0;"><button type="button" class="btn-custom btn-danger-custom btn-sm-custom" onclick="quitarItemEdicion('descuentos',${idx})">X</button></div>
    </div>`).join('');
  const camposCantidad = edicionLiquidacion.tipoPago==='horas' ? `
    <div><label style="font-size:11px;">Horas laboradas</label><input type="number" min="0" value="${edicionLiquidacion.horas}" oninput="actualizarCampoEdicion('horas',this.value)"></div>
    <div><label style="font-size:11px;">Valor por hora</label><input type="number" min="0" value="${edicionLiquidacion.valorHora}" oninput="actualizarCampoEdicion('valorHora',this.value)"></div>` : `
    <div><label style="font-size:11px;">Días laborados</label><input type="number" min="0" value="${edicionLiquidacion.dias}" oninput="actualizarCampoEdicion('dias',this.value)"></div>
    <div><label style="font-size:11px;">Valor por día</label><input type="number" min="0" value="${edicionLiquidacion.valorDia}" oninput="actualizarCampoEdicion('valorDia',this.value)"></div>`;
  document.getElementById('editLiqDetalle').innerHTML = `
    <div class="field-row" style="margin-top:8px;">
      ${camposCantidad}
      <div><label style="font-size:11px;">Valor base</label><input type="text" disabled id="editValorBase" value="${formatoCOP(totales.valorBase)}"></div>
    </div>
    <label style="font-size:11px;margin-top:8px;">Ajustes / bonificaciones (+)</label>
    ${filasAjustes}
    <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="agregarItemEdicion('ajustes')">+ Agregar ajuste</button>
    <label style="font-size:11px;margin-top:10px;">Descuentos (-)</label>
    ${filasDescuentos}
    <button type="button" class="btn-custom btn-secondary-custom btn-sm-custom" onclick="agregarItemEdicion('descuentos')">+ Agregar descuento</button>
    <div id="editTotalNeto" style="text-align:right;font-weight:700;margin-top:10px;border-top:1px solid var(--card-border);padding-top:8px;">
      Total neto a pagar: ${formatoCOP(totales.totalNeto)}
    </div>`;
}
// Igual que en la creación: actualiza solo los números, sin reconstruir el HTML,
// para que el campo donde se está escribiendo no pierda el foco ni el cursor.
function actualizarTotalesVisualesEdicion(){
  const totales = calcularTotalesPersonaLiquidacion(edicionLiquidacion);
  const elBase = document.getElementById('editValorBase');
  const elTotal = document.getElementById('editTotalNeto');
  if(elBase) elBase.value = formatoCOP(totales.valorBase);
  if(elTotal) elTotal.innerText = 'Total neto a pagar: ' + formatoCOP(totales.totalNeto);
}
function actualizarCampoEdicion(campo, valor){
  edicionLiquidacion[campo] = parseFloat(valor)||0;
  actualizarTotalesVisualesEdicion();
}
function agregarItemEdicion(tipo){ edicionLiquidacion[tipo].push({concepto:'',monto:0,nota:''}); renderizarEdicionLiquidacion(); }
function quitarItemEdicion(tipo, idx){ edicionLiquidacion[tipo].splice(idx,1); renderizarEdicionLiquidacion(); }
function actualizarItemEdicion(tipo, idx, campo, valor){
  edicionLiquidacion[tipo][idx][campo] = (campo==='monto') ? (parseFloat(valor)||0) : valor;
  if(campo==='monto') actualizarTotalesVisualesEdicion();
}
// Un solo lugar con la info visual de cada estado de pago posible — así
// cualquier ajuste futuro a colores/textos se hace en un solo sitio.
function infoEstadoPagoNomina(estado){
  const mapa = {
    pendiente: { etiqueta:'Pendiente por pagar', fondo:'#fef3c7', texto:'#92400e', icono:'fa-clock' },
    pagado:    { etiqueta:'Pagada completa',      fondo:'#dcfce7', texto:'#166534', icono:'fa-circle-check' },
    parcial:   { etiqueta:'Pagada parcialmente',  fondo:'#dbeafe', texto:'#1e40af', icono:'fa-coins' },
    abonado:   { etiqueta:'Abonada',              fondo:'#ede9fe', texto:'#5b21b6', icono:'fa-hand-holding-dollar' }
  };
  return mapa[estado] || mapa.pendiente;
}
let nominaEstadoPagoActualId = null;
function cambiarEstadoPagoNomina(id){
  // Cambiar el estado de pago (o el monto abonado) siempre pide la clave de
  // administrador primero — igual que Editar liquidación — antes de mostrar
  // siquiera el selector, para que nadie lo cambie por accidente o sin permiso.
  verificarClaveAdminYEjecutar(()=>abrirModalEstadoPagoNomina(id));
}
function abrirModalEstadoPagoNomina(id){
  const l = (db.liquidacionesNomina||[]).find(x=>x.id===id);
  if(!l) return;
  nominaEstadoPagoActualId = id;
  const nombrePersona = l.esOcasional ? (l.personalOcasionalNombre||'—') : (buscarTecnico(l.tecnicoId)?.nombre||'—');
  document.getElementById('lblNominaEstadoPago').innerText = `${l.numero} — ${nombrePersona} — Total: ${formatoCOP(l.totalNeto)}`;
  document.getElementById('selEstadoPagoNomina').value = l.estadoPago || 'pendiente';
  document.getElementById('inputMontoAbonadoNomina').value = l.montoAbonado || '';
  toggleMontoAbonadoNomina();
  abrirModal('modalEstadoPagoNomina');
}
function toggleMontoAbonadoNomina(){
  const estado = document.getElementById('selEstadoPagoNomina').value;
  document.getElementById('wrapperMontoAbonadoNomina').style.display = (estado==='parcial' || estado==='abonado') ? 'block' : 'none';
}
async function guardarEstadoPagoNomina(){
  const l = (db.liquidacionesNomina||[]).find(x=>x.id===nominaEstadoPagoActualId);
  if(!l) return;
  const nuevoEstado = document.getElementById('selEstadoPagoNomina').value;
  const montoAbonadoRaw = document.getElementById('inputMontoAbonadoNomina').value;
  let montoAbonado = null;
  if(nuevoEstado==='parcial' || nuevoEstado==='abonado'){
    montoAbonado = parseFloat(montoAbonadoRaw);
    if(!montoAbonado || montoAbonado<=0){ mostrarToast('Escribe el monto abonado hasta ahora.'); return; }
    if(montoAbonado >= l.totalNeto){ mostrarToast('El monto abonado no puede ser igual o mayor al total — para eso usa "Pagada completa".'); return; }
  }
  const respaldo = { estadoPago: l.estadoPago, fechaPago: l.fechaPago, montoAbonado: l.montoAbonado };
  l.estadoPago = nuevoEstado;
  l.fechaPago = nuevoEstado==='pendiente' ? null : new Date().toISOString().slice(0,10);
  l.montoAbonado = montoAbonado;
  try{
    await dbGuardarInmediato();
  }catch(err){
    Object.assign(l, respaldo);
    mostrarToast('⚠️ No se pudo actualizar el estado de pago: ' + err.message, 'error');
    return;
  }
  const nombrePersona = l.esOcasional ? (l.personalOcasionalNombre||'—') : (buscarTecnico(l.tecnicoId)?.nombre||'—');
  registrarLog('Cambiar estado de pago', 'Nómina', `${l.numero} — ${nombrePersona} → ${infoEstadoPagoNomina(nuevoEstado).etiqueta}${montoAbonado?' ('+formatoCOP(montoAbonado)+')':''}`);
  cerrarModal('modalEstadoPagoNomina');
  mostrarToast(`✅ Estado de pago actualizado: ${infoEstadoPagoNomina(nuevoEstado).etiqueta}.`, 'exito');
  renderizarHistorialNomina();
}
async function guardarEdicionLiquidacionNomina(){
  const l = (db.liquidacionesNomina||[]).find(x=>x.id===edicionLiquidacion.id);
  if(!l) return;
  const periodoDesde = document.getElementById('editLiqPeriodoDesde').value;
  const periodoHasta = document.getElementById('editLiqPeriodoHasta').value;
  if(!periodoDesde || !periodoHasta){ mostrarToast('Define el periodo (desde/hasta).'); return; }
  const totales = calcularTotalesPersonaLiquidacion(edicionLiquidacion);
  const respaldo = JSON.parse(JSON.stringify(l)); // por si el guardado falla, se puede restaurar
  l.periodoDesde = periodoDesde; l.periodoHasta = periodoHasta;
  l.diasLaborados = edicionLiquidacion.dias; l.valorDia = edicionLiquidacion.valorDia;
  l.horasLaboradas = edicionLiquidacion.horas; l.valorHora = edicionLiquidacion.valorHora;
  l.ajustes = edicionLiquidacion.ajustes.filter(a=>a.concepto || a.monto);
  l.descuentos = edicionLiquidacion.descuentos.filter(d=>d.concepto || d.monto);
  l.valorBase = totales.valorBase; l.totalAjustes = totales.totalAjustes;
  l.totalDescuentos = totales.totalDescuentos; l.totalNeto = totales.totalNeto;
  try{
    await dbGuardarInmediato();
  }catch(err){
    Object.assign(l, respaldo);
    mostrarToast('⚠️ No se guardó el cambio: ' + err.message, 'error');
    return;
  }
  registrarLog('Editar', 'Nómina', `${l.numero} — nuevo total: ${formatoCOP(l.totalNeto)}`);
  cerrarModal('modalEditarNomina');
  mostrarToast('Liquidación actualizada.');
  renderizarHistorialNomina();
}
function eliminarLiquidacionNomina(id){
  verificarClaveAdminYEjecutar(async ()=>{
    const l = (db.liquidacionesNomina||[]).find(x=>x.id===id);
    if(!l) return;
    if(!confirm(`¿Eliminar el comprobante ${l.numero}? Esta acción no se puede deshacer.`)) return;
    const listaAnterior = db.liquidacionesNomina.slice();
    db.liquidacionesNomina = db.liquidacionesNomina.filter(x=>x.id!==id);
    registrarEliminacion('liquidacionesNomina', id);
    try{
      await dbGuardarInmediato();
    }catch(err){
      db.liquidacionesNomina = listaAnterior;
      mostrarToast('⚠️ No se pudo eliminar: ' + err.message, 'error');
      return;
    }
    registrarLog('Eliminar', 'Nómina', l.numero);
    mostrarToast('Comprobante eliminado.');
    renderizarHistorialNomina();
  });
}

