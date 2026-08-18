// ===== kpi.js — extraído de prevenglobal__25_.html (líneas 5114-5322) =====
/* =========================================================
   MÓDULO DE INDICADORES (KPI)
   Se agrega como sección nueva, sin tocar el resto del código
   ya construido. Usa Chart.js (cargado por CDN) para las
   gráficas y recalcula todo según el período seleccionado.
========================================================= */
let chartsKPI = { mes:null, cliente:null, estado:null, tecnico:null };
const COLORES_KPI = ['#0088ff','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
function nombreMesCorto(fechaYYYYMM){
  const [anio, mes] = fechaYYYYMM.split('-');
  const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${nombres[parseInt(mes)-1]} ${anio.slice(2)}`;
}
function claveSemanaISO(fechaStr){
  const f = new Date(fechaStr+'T00:00:00');
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  const diaLunes = (d.getUTCDay() + 6) % 7; // lunes=0 ... domingo=6
  d.setUTCDate(d.getUTCDate() - diaLunes + 3);
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const semana = 1 + Math.round((d - primerJueves) / (7*86400000));
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2,'0')}`;
}
function nombreSemanaCorto(claveSemana){
  const [anio, wpart] = claveSemana.split('-W');
  return `Sem ${wpart} '${anio.slice(2)}`;
}
function renderizarKPIs(){
  if(typeof Chart === 'undefined'){
    document.querySelector('#seccion-kpi .panel-title').insertAdjacentHTML('afterend', '<p class="empty-state">No se pudo cargar la librería de gráficas (sin conexión a internet). Los datos numéricos igual están disponibles en el resto de la plataforma.</p>');
    return;
  }
  const meses = parseInt(document.getElementById('kpiRangoMeses').value);
  const hoy = new Date();
  const fechaLimite = new Date(hoy.getFullYear(), hoy.getMonth() - (meses>=9999?1200:meses-1), 1);
  const ordenesPeriodo = db.ordenes.filter(o=>{
    if(!o.fechaProgramada) return false;
    const f = new Date(o.fechaProgramada+'T00:00:00');
    return f >= fechaLimite;
  });

  // --- Tarjetas resumen ---
  const total = ordenesPeriodo.length;
  const finalizadas = ordenesPeriodo.filter(o=>o.estado==='Finalizado');
  document.getElementById('kpiCardTotal').innerText = total;
  document.getElementById('kpiCardCumplimiento').innerText = total ? Math.round(finalizadas.length/total*100)+'%' : '0%';

  const diasCierre = finalizadas
    .filter(o=>o.cierre && o.cierre.fecha && o.fechaProgramada)
    .map(o=> (new Date(o.cierre.fecha) - new Date(o.fechaProgramada+'T00:00:00')) / 86400000)
    .filter(d=> d>=0 && d<365);
  document.getElementById('kpiCardTiempo').innerText = diasCierre.length ? (diasCierre.reduce((a,b)=>a+b,0)/diasCierre.length).toFixed(1) : '—';

  const conteoTipos = {};
  ordenesPeriodo.forEach(o=> conteoTipos[o.tipo] = (conteoTipos[o.tipo]||0)+1);
  const tipoTop = Object.entries(conteoTipos).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('kpiCardTipoTop').innerText = tipoTop ? tipoTop[0] : '—';

  // --- Gráfica: servicios por período (semana o mes), programados vs. finalizados ---
  const agrupacion = document.getElementById('kpiAgrupacion').value; // 'mes' | 'semana'
  const claveDe = agrupacion==='semana' ? claveSemanaISO : (f=>f.slice(0,7));
  const etiquetaDe = agrupacion==='semana' ? nombreSemanaCorto : nombreMesCorto;
  document.getElementById('kpiTituloGraficaMes').innerText = agrupacion==='semana'
    ? 'Servicios por semana (programados vs. finalizados)'
    : 'Servicios por mes (programados vs. finalizados)';
  const clavesOrdenadas = [...new Set(ordenesPeriodo.map(o=>claveDe(o.fechaProgramada)))].sort();
  const totalesPorClave = clavesOrdenadas.map(k=> ordenesPeriodo.filter(o=>claveDe(o.fechaProgramada)===k).length);
  const finalizadosPorClave = clavesOrdenadas.map(k=> ordenesPeriodo.filter(o=>claveDe(o.fechaProgramada)===k && o.estado==='Finalizado').length);
  if(chartsKPI.mes) chartsKPI.mes.destroy();
  chartsKPI.mes = new Chart(document.getElementById('chartServiciosPorMes'), {
    type:'bar',
    data:{ labels: clavesOrdenadas.map(etiquetaDe), datasets:[
      { label:'Programados (total)', data: totalesPorClave, backgroundColor:'#0088ff' },
      { label:'Finalizados', data: finalizadosPorClave, backgroundColor:'#22c55e' }
    ]},
    options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#94a3b8' } } }, scales:{ x:{ ticks:{ color:'#94a3b8' } }, y:{ beginAtZero:true, ticks:{ color:'#94a3b8', precision:0 } } } }
  });

  // --- Gráfica: servicios por cliente (top 8) ---
  const conteoClientes = {};
  ordenesPeriodo.forEach(o=>{ const nombre = nombreClienteOrden(o); conteoClientes[nombre] = (conteoClientes[nombre]||0)+1; });
  const topClientes = Object.entries(conteoClientes).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(chartsKPI.cliente) chartsKPI.cliente.destroy();
  chartsKPI.cliente = new Chart(document.getElementById('chartServiciosPorCliente'), {
    type:'bar',
    data:{ labels: topClientes.map(c=>c[0]), datasets:[{ label:'Servicios', data: topClientes.map(c=>c[1]), backgroundColor:'#0088ff' }] },
    options:{ indexAxis:'y', responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, ticks:{ color:'#94a3b8', precision:0 } }, y:{ ticks:{ color:'#94a3b8' } } } }
  });

  // --- Gráfica: distribución por estado ---
  const estados = ['Programado','En Ejecución','Finalizado'];
  const conteoEstados = estados.map(e=> ordenesPeriodo.filter(o=>o.estado===e).length);
  if(chartsKPI.estado) chartsKPI.estado.destroy();
  chartsKPI.estado = new Chart(document.getElementById('chartServiciosPorEstado'), {
    type:'doughnut',
    data:{ labels: estados, datasets:[{ data: conteoEstados, backgroundColor:['#f59e0b','#8b5cf6','#22c55e'] }] },
    options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#94a3b8' } } } }
  });

  // --- Gráfica: carga de trabajo por técnico ---
  const conteoTecnicos = {};
  ordenesPeriodo.forEach(o=>{ const t = buscarTecnico(o.tecnicoId); const nombre = t?t.nombre:'Sin asignar'; conteoTecnicos[nombre] = (conteoTecnicos[nombre]||0)+1; });
  const listaTecnicos = Object.entries(conteoTecnicos).sort((a,b)=>b[1]-a[1]);
  if(chartsKPI.tecnico) chartsKPI.tecnico.destroy();
  chartsKPI.tecnico = new Chart(document.getElementById('chartServiciosPorTecnico'), {
    type:'bar',
    data:{ labels: listaTecnicos.map(t=>t[0]), datasets:[{ label:'Servicios asignados', data: listaTecnicos.map(t=>t[1]), backgroundColor: listaTecnicos.map((_,i)=>COLORES_KPI[i%COLORES_KPI.length]) }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ color:'#94a3b8' } }, y:{ beginAtZero:true, ticks:{ color:'#94a3b8', precision:0 } } } }
  });

  // --- Tabla: equipos con más intervenciones ---
  const conteoEquipos = {};
  ordenesPeriodo.forEach(o=>{
    if(!o.equipoId) return;
    if(!conteoEquipos[o.equipoId]) conteoEquipos[o.equipoId] = { n:0, ultima:'' };
    conteoEquipos[o.equipoId].n++;
    if(!conteoEquipos[o.equipoId].ultima || o.fechaProgramada > conteoEquipos[o.equipoId].ultima) conteoEquipos[o.equipoId].ultima = o.fechaProgramada;
  });
  const topEquipos = Object.entries(conteoEquipos).sort((a,b)=>b[1].n-a[1].n).slice(0,8);
  document.getElementById('tablaKpiEquiposFrecuentes').innerHTML = topEquipos.map(([equipoId, datos])=>{
    const info = ubicarEquipoPorId(parseInt(equipoId));
    return `<tr><td>${info?info.equipo.nombre:'—'}</td><td>${info?info.cliente.nombre:'—'}</td><td>${datos.n}</td><td>${datos.ultima||'—'}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="empty-state">Sin datos suficientes en este período.</td></tr>';
}

function verFichaQR(itemId){
  const it = buscarItemInventario(itemId);
  const bodega = buscarBodega(it.bodegaId);
  const fotosHtml = (it.fotos||[]).map(f=>`<img src="${f}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;margin-right:6px;">`).join('');
  const movimientos = db.kardex.filter(k=>k.itemId===itemId).sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
  const historialHtml = movimientos.length ? `
    <table class="data-table" style="margin-top:6px;"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Usuario</th></tr></thead><tbody>
      ${movimientos.map(m=>`<tr><td>${new Date(m.fecha).toLocaleString('es-CO')}</td><td>${m.tipo}</td><td>${m.cantidad}</td><td>${m.usuario||'—'}</td></tr>`).join('')}
    </tbody></table>` : '<p style="font-size:11px;color:var(--text-muted);">Sin movimientos de Kardex registrados todavía.</p>';
  document.getElementById('contenidoFichaQR').innerHTML = `
    <h3>${it.nombre}</h3>
    <p style="font-size:12px;color:var(--text-muted);">Categoría: ${it.categoria||'—'}<br>
    Ubicación actual: <strong>${bodega?bodega.nombre:'—'}</strong><br>
    Stock disponible: <strong>${it.stockActual}</strong> (mínimo: ${it.stockMinimo})</p>
    <div style="margin:10px 0;">${fotosHtml||'<span style="font-size:11px;color:var(--text-muted);">Sin fotos de referencia</span>'}</div>
    <div style="text-align:center;">
      <div class="qr-box" id="qrCanvasWrapper"></div>
      <p style="font-size:10px;color:var(--text-muted);margin-top:6px;">Código: ${it.qrId}</p>
    </div>
    <h4 style="font-size:13px;margin-top:15px;">📦 Historial de movimientos (Kardex)</h4>
    ${historialHtml}`;
  abrirModal('modalFichaQR');
  const wrapper = document.getElementById('qrCanvasWrapper');
  wrapper.innerHTML = '';
  const urlItem = `${location.origin}${location.pathname}?item=${itemId}`;
  new QRCode(wrapper, { text: urlItem, width:140, height:140, correctLevel: QRCode.CorrectLevel.H });
}

/* --- KARDEX --- */
function abrirModalKardex(){
  document.getElementById('kdxItem').innerHTML = db.inventario.map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('') || '<option value="">Sin ítems</option>';
  document.getElementById('kdxBodegaDestino').innerHTML = db.bodegas.map(b=>`<option value="${b.id}">${b.nombre}</option>`).join('');
  document.getElementById('kdxCantidad').value = 1;
  toggleKardexDestino();
  abrirModal('modalKardex');
}
function toggleKardexDestino(){
  document.getElementById('wrapperKdxDestino').style.display = document.getElementById('kdxTipo').value==='transferencia' ? 'block' : 'none';
}
function guardarMovimientoKardex(){
  const itemId = parseInt(document.getElementById('kdxItem').value);
  const tipo = document.getElementById('kdxTipo').value;
  const cantidad = parseInt(document.getElementById('kdxCantidad').value) || 0;
  const it = buscarItemInventario(itemId);
  if(!it || cantidad<=0){ mostrarToast('Selecciona un ítem y una cantidad válida.'); return; }
  const mov = { id:Date.now(), itemId, tipo, cantidad, usuario:nombreUsuarioActual(), fecha:new Date().toISOString(), bodegaOrigenId: it.bodegaId, bodegaDestinoId:null };
  if(tipo==='entrada'){ it.stockActual += cantidad; }
  else if(tipo==='salida'){
    if(cantidad > it.stockActual){ mostrarToast('No hay stock suficiente para esta salida.'); return; }
    it.stockActual -= cantidad;
  } else if(tipo==='transferencia'){
    const destinoId = parseInt(document.getElementById('kdxBodegaDestino').value);
    if(cantidad > it.stockActual){ mostrarToast('No hay stock suficiente para transferir.'); return; }
    it.stockActual -= cantidad;
    it.bodegaId = destinoId; // simplificación: unidad de ítem completo se traslada a la bodega destino
    mov.bodegaDestinoId = destinoId;
  }
  db.kardex.push(mov); // el Kardex es de solo-inserción: nunca se edita ni se borra un movimiento ya registrado
  dbGuardar();
  registrarLog('Movimiento Kardex', 'Inventario', `${it.nombre}: ${tipo} x${cantidad}`);
  cerrarModal('modalKardex');
  renderizarInventario();
}
function renderizarKardex(){
  const tbody = document.getElementById('tablaKardex');
  tbody.innerHTML = db.kardex.slice().reverse().map(m=>{
    const it = buscarItemInventario(m.itemId);
    const origen = buscarBodega(m.bodegaOrigenId);
    const destino = m.bodegaDestinoId ? buscarBodega(m.bodegaDestinoId) : null;
    return `<tr><td>${new Date(m.fecha).toLocaleString('es-CO')}</td><td>${it?it.nombre:'—'}</td><td>${m.tipo}</td><td>${m.cantidad}</td><td>${origen?origen.nombre:'—'}</td><td>${destino?destino.nombre:'—'}</td><td>${m.usuario}</td></tr>`;
  }).join('') || '<tr><td colspan="7" class="empty-state">Sin movimientos registrados.</td></tr>';
}

function exportarExcel(){
  let csv = 'Orden,Cliente,Equipo,Tecnico,Estado,Tipo,Fecha\n';
  db.ordenes.forEach(o=>{
    const equipo = buscarEquipo(o.clienteId,o.sedeId,o.equipoId), tecnico = buscarTecnico(o.tecnicoId);
    csv += `${o.numero},${nombreClienteOrden(o)}${o.esClienteNuevo?' (Cliente nuevo)':''},${equipo?equipo.nombre:''},${tecnico?tecnico.nombre:''},${o.estado},${o.tipo},${o.fechaProgramada||''}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Prevenglobal_Reporte_Servicios.csv';
  link.click();
}
