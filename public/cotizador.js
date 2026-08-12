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
function agregarNomina(){
  const tecnicoId = parseInt(document.getElementById('nominaTecnico').value);
  const concepto = document.getElementById('nominaConcepto').value.trim();
  const monto = parseFloat(document.getElementById('nominaMonto').value);
  const fecha = document.getElementById('nominaFecha').value;
  const estado = document.getElementById('nominaEstado').value;
  if(!tecnicoId){ mostrarToast('Selecciona el técnico.'); return; }
  if(!monto || monto<=0){ mostrarToast('Escribe un monto válido.'); return; }
  if(!fecha){ mostrarToast('Selecciona la fecha del pago.'); return; }
  db.nomina = db.nomina || [];
  db.nomina.push({ id:Date.now(), tecnicoId, concepto: concepto||'Pago de nómina', monto, fecha, estado });
  dbGuardarInmediato();
  registrarLog('Crear', 'Nómina', `${(buscarTecnico(tecnicoId)||{}).nombre||''} · ${formatoCOP(monto)}`);
  document.getElementById('nominaConcepto').value=''; document.getElementById('nominaMonto').value=''; document.getElementById('nominaFecha').value='';
  renderizarContabilidad();
}
function eliminarNomina(id){
  if(!confirm('¿Eliminar este registro de nómina?')) return;
  db.nomina = db.nomina.filter(n=>n.id!==id);
  dbGuardarInmediato();
  renderizarContabilidad();
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
  db.nomina = db.nomina || []; db.gastos = db.gastos || []; db.pedidosTienda = db.pedidosTienda || [];
  const filtroMes = document.getElementById('contaMesFiltro');
  if(!filtroMes.value) filtroMes.value = mesActualISO();
  const mes = filtroMes.value; // "YYYY-MM"

  const selTec = document.getElementById('nominaTecnico');
  selTec.innerHTML = db.tecnicos.map(t=>`<option value="${t.id}">${t.nombre}${t.activo===false?' (inactivo)':''}</option>`).join('') || '<option value="">Sin técnicos registrados</option>';

  const nominaDelMes = db.nomina.filter(n=>n.fecha && n.fecha.startsWith(mes));
  const gastosDelMes = db.gastos.filter(g=>g.fecha && g.fecha.startsWith(mes));
  const pedidosDelMes = db.pedidosTienda.filter(p=>p.fecha && p.fecha.startsWith(mes));

  const totalNomina = nominaDelMes.filter(n=>n.estado==='Pagado').reduce((a,n)=>a+n.monto,0);
  const totalGastos = gastosDelMes.reduce((a,g)=>a+g.monto,0);
  const totalIngresos = pedidosDelMes.reduce((a,p)=>a+p.total,0);
  const balance = totalIngresos - totalNomina - totalGastos;

  document.getElementById('contaCardIngresos').innerText = formatoCOP(totalIngresos);
  document.getElementById('contaCardNomina').innerText = formatoCOP(totalNomina);
  document.getElementById('contaCardGastos').innerText = formatoCOP(totalGastos);
  const cardBalance = document.getElementById('contaCardBalance');
  cardBalance.innerText = formatoCOP(balance);
  cardBalance.style.color = balance >= 0 ? 'var(--exito-verde,#22c55e)' : 'var(--red-alert)';

  document.getElementById('tablaNomina').innerHTML = nominaDelMes.map(n=>{
    const t = buscarTecnico(n.tecnicoId);
    return `<tr><td>${n.fecha}</td><td>${t?t.nombre:'—'}</td><td>${n.concepto}</td><td>${formatoCOP(n.monto)}</td>
      <td><span style="color:${n.estado==='Pagado'?'var(--exito-verde,#22c55e)':'#f59e0b'};font-weight:700;font-size:11px;">${n.estado}</span></td>
      <td><button class="btn-custom btn-danger-custom btn-sm-custom" onclick="eliminarNomina(${n.id})">X</button></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-state">Sin pagos de nómina registrados este mes.</td></tr>';

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
  dbGuardar();
  if(t) registrarLog('Eliminar', 'Técnico', t.nombre);
  if(document.getElementById('cfgTecId').value == id) cancelarEdicionTecnico();
  renderizarTecnicosConfig();
}

