// ===== factura-electronica.js — Botón y ventana de factura electrónica (Factus / DIAN) =====
// Solo lo ve el administrador. Si la empresa no está habilitada en el servidor,
// no aparece nada y la lista de facturas se ve exactamente como antes.

let feConfig = null;          // { configurado, autorizada, simulacion } — se pide una sola vez
let feEstados = {};           // { [facturaId]: fila del servidor }
let feCargando = false;

function feActiva(){
  return !!(feConfig && feConfig.autorizada && (feConfig.configurado || feConfig.simulacion));
}

// Una factura queda BLOQUEADA (no editable ni eliminable) solo cuando la DIAN
// ya la validó de verdad. Lo simulado o rechazado nunca bloquea nada.
function facturaBloqueadaFE(facturaId){
  const e = feEstados[facturaId];
  return !!(e && e.validada && !e.simulada);
}

async function feCargarEstados(){
  if(feCargando || typeof esAdmin !== 'function' || !esAdmin() || !sesionServidor) return;
  feCargando = true;
  try{
    if(!feConfig){
      const r = await fetch(API_BASE + '/api/factus/estado', { headers: headersAutenticados() });
      feConfig = r.ok ? await r.json() : { autorizada:false };
    }
    if(feActiva()){
      const r = await fetch(API_BASE + '/api/factus/facturas', { headers: headersAutenticados() });
      const filas = r.ok ? await r.json() : [];
      feEstados = {};
      filas.forEach(f => { feEstados[Number(f.factura_id)] = f; });
    }
  }catch(err){ /* sin conexión: la lista se ve normal, sin esta función */ }
  feCargando = false;
  if(feActiva() && typeof renderizarCotizacionesFacturas === 'function') renderizarCotizacionesFacturas(true);
}

// Botón que se agrega a cada fila de la lista de facturas.
function botonFacturaElectronica(f){
  if(!feActiva() || f.esBorrador) return '';
  const e = feEstados[f.id];
  let etiqueta = 'Emitir electrónica', clase = 'btn-secondary-custom', icono = 'fa-certificate';
  if(e && e.validada && !e.simulada){ etiqueta = 'Electrónica ✓'; clase = 'btn-success-custom'; }
  else if(e && e.simulada){ etiqueta = 'Simulada'; clase = 'btn-secondary-custom'; icono = 'fa-flask'; }
  else if(e && e.ultimo_error){ etiqueta = 'Rechazada'; clase = 'btn-danger-custom'; }
  return `<button class="btn-custom ${clase} btn-sm-custom" onclick="abrirFacturaElectronica(${f.id})" title="Factura electrónica (DIAN)"><i class="fas ${icono}"></i> ${etiqueta}</button>`;
}

function feEscapar(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function feAsegurarModal(){
  let m = document.getElementById('modalFacturaElectronica');
  if(m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'modalFacturaElectronica';
  m.innerHTML = `<div class="modal-box modal-sm"><button class="close-modal" onclick="cerrarModal('modalFacturaElectronica')">✖</button><div id="feContenido"></div></div>`;
  document.body.appendChild(m);
  return m;
}

async function abrirFacturaElectronica(facturaId){
  const f = (db.facturas || []).find(x => x.id === facturaId);
  if(!f) return;
  feAsegurarModal();
  abrirModal('modalFacturaElectronica');
  feDibujar(f, '<p style="color:var(--text-muted);">Consultando…</p>');
  try{
    const r = await fetch(API_BASE + '/api/factus/facturas/' + facturaId, { headers: headersAutenticados() });
    const e = r.ok ? await r.json() : { emitida:false };
    if(e.emitida) feEstados[facturaId] = Object.assign({ factura_id: facturaId }, e); else delete feEstados[facturaId];
    feDibujar(f, feCuerpo(f, e));
  }catch(err){
    feDibujar(f, '<p style="color:var(--red-alert);">No se pudo consultar el estado. Revisa tu conexión.</p>');
  }
}

function feDibujar(f, cuerpoHtml){
  const simulacion = feConfig && feConfig.simulacion;
  document.getElementById('feContenido').innerHTML = `
    <h3 style="margin-top:0;"><i class="fas fa-certificate"></i> Factura electrónica — ${feEscapar(f.numero)}</h3>
    ${simulacion ? `<div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:10px;"><b>MODO PRÁCTICA (simulación):</b> no se envía nada a la DIAN ni a Factus. Sirve para probar cómo funciona; lo que emitas aquí no es una factura real.</div>` : ''}
    ${cuerpoHtml}`;
}

function feCuerpo(f, e){
  if(e.emitida && e.validada && !e.simulada){
    return `
      <div style="background:#dcfce7;border:1px solid #16a34a;color:#166534;padding:10px;border-radius:8px;">
        <b>✓ Factura electrónica validada por la DIAN</b><br>
        <span style="font-size:12px;">Número: <b>${feEscapar(e.numero_factus)}</b></span><br>
        <span style="font-size:11px;word-break:break-all;">CUFE: ${feEscapar(e.cufe)}</span><br>
        <span style="font-size:11px;">Validada: ${feEscapar(e.validada_en || '—')}</span>
      </div>
      <p style="font-size:12px;color:var(--text-muted);">Esta factura ya no se puede editar ni eliminar. Si hay un error, se corrige con una nota crédito.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
        <button class="btn-custom btn-success-custom" onclick="feVerPdf(${f.id})"><i class="fas fa-file-pdf"></i> Ver PDF oficial</button>
        <button class="btn-custom btn-danger-custom" onclick="feMostrarFormularioNotaCredito(${f.id})"><i class="fas fa-rotate-left"></i> Anular (Nota Crédito)</button>
      </div>
      <div id="feFormNotaCredito" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--card-border);">
        <label style="font-size:12px;">Tipo de anulación:</label>
        <select id="feNotaCreditoTipo" style="margin-bottom:8px;" onchange="document.getElementById('feWrapMontoParcial').style.display = this.value==='parcial' ? 'block' : 'none';">
          <option value="total">Anulación total (se revierte toda la factura)</option>
          <option value="parcial">Corrección parcial (se revierte solo una parte)</option>
        </select>
        <div id="feWrapMontoParcial" style="display:none;">
          <label style="font-size:12px;">Monto a corregir:</label>
          <input type="number" id="feNotaCreditoMonto" placeholder="Ej. 50000" style="margin-bottom:8px;">
        </div>
        <label style="font-size:12px;">¿Cómo se le devuelve/ajusta el pago al cliente?</label>
        <select id="feNotaCreditoMedioPago" style="margin-bottom:8px;">
          <option value="efectivo">Efectivo</option>
          <option value="electronico">Pago electrónico (transferencia, etc.)</option>
        </select>
        <label style="font-size:12px;">Motivo (obligatorio, lo exige la DIAN):</label>
        <textarea id="feNotaCreditoMotivo" rows="2" placeholder="Ej. Error en el valor facturado, el cliente desistió del servicio..."></textarea>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn-custom btn-danger-custom" onclick="feConfirmarNotaCredito(${f.id})">Confirmar anulación</button>
          <button class="btn-custom btn-secondary-custom" onclick="document.getElementById('feFormNotaCredito').style.display='none';">Cancelar</button>
        </div>
      </div>`;
  }
  let aviso = '';
  if(e.emitida && e.simulada){
    aviso = `<div style="background:#e0f2fe;border:1px solid #0284c7;color:#075985;padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:10px;">Ya se hizo una emisión de práctica (<b>${feEscapar(e.numero_factus)}</b>). Puedes repetirla las veces que quieras.</div>`;
  } else if(e.emitida && e.ultimo_error){
    aviso = `<div style="background:#fee2e2;border:1px solid #dc2626;color:#991b1b;padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:10px;"><b>El último intento no se completó:</b><br>${feEscapar(e.ultimo_error)}</div>`;
  }
  return `
    ${aviso}
    <p style="font-size:13px;margin:6px 0;"><b>Total:</b> ${formatoCOP(f.total)}</p>
    <label style="font-size:12px;">¿Cómo pagó el cliente?</label>
    <select id="feMedioPago" style="margin-bottom:10px;">
      <option value="efectivo">Efectivo</option>
      <option value="electronico">Pago electrónico (transferencia, etc.)</option>
    </select>
    <div id="feMensaje" style="font-size:12px;margin-bottom:8px;display:none;"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn-custom btn-success-custom" id="feBotonEmitir" onclick="feEmitir(${f.id})"><i class="fas fa-paper-plane"></i> ${feConfig && feConfig.simulacion ? 'Emitir (práctica)' : 'Emitir factura electrónica'}</button>
      ${e.emitida ? `<button class="btn-custom btn-danger-custom" onclick="feEliminarIntento(${f.id})"><i class="fas fa-trash"></i> Eliminar intento</button>` : ''}
    </div>`;
}

async function feEliminarIntento(facturaId){
  if(!confirm('¿Eliminar este intento de factura electrónica? Como todavía no fue validada por la DIAN, se puede borrar sin problema — podrás volver a emitirla desde cero.')) return;
  try{
    const resp = await fetch(`/api/factus/facturas/${facturaId}`, { method:'DELETE', headers: headersAutenticados() });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok) throw new Error(data.error || 'No se pudo eliminar.');
    mostrarToast('✅ Intento eliminado — ya puedes emitirla de nuevo.', 'exito');
    abrirFacturaElectronica(facturaId);
  }catch(err){ mostrarToast('⚠️ ' + err.message, 'error'); }
}

function feMostrarFormularioNotaCredito(facturaId){
  document.getElementById('feFormNotaCredito').style.display = 'block';
}

async function feConfirmarNotaCredito(facturaId){
  const motivo = document.getElementById('feNotaCreditoMotivo').value.trim();
  const tipo = document.getElementById('feNotaCreditoTipo').value;
  const medioPago = document.getElementById('feNotaCreditoMedioPago').value;
  const montoParcial = document.getElementById('feNotaCreditoMonto').value;
  if(!motivo){ mostrarToast('Escribe el motivo de la anulación — la DIAN lo exige.'); return; }
  if(tipo==='parcial' && !(Number(montoParcial) > 0)){ mostrarToast('Indica el monto a corregir.'); return; }
  if(!confirm('¿Confirmar la anulación de esta factura mediante nota crédito? Esta acción también queda registrada ante la DIAN.')) return;
  try{
    const resp = await fetch(`/api/factus/facturas/${facturaId}/nota-credito`, {
      method:'POST', headers: headersAutenticados({'Content-Type':'application/json'}),
      body: JSON.stringify({ motivo, tipo, medioPago, montoParcial })
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok) throw new Error(data.error || 'No se pudo generar la nota crédito.');
    mostrarToast('✅ Nota crédito generada correctamente.', 'exito');
    abrirFacturaElectronica(facturaId);
  }catch(err){ mostrarToast('⚠️ ' + err.message, 'error'); }
}

async function feEmitir(facturaId){
  const f = (db.facturas || []).find(x => x.id === facturaId);
  if(!f) return;
  const simulacion = feConfig && feConfig.simulacion;
  if(!simulacion && !confirm('Vas a emitir una factura electrónica REAL. Una vez validada por la DIAN ya no se podrá editar ni eliminar. ¿Continuar?')) return;
  const boton = document.getElementById('feBotonEmitir');
  const msj = document.getElementById('feMensaje');
  const mostrar = (t, error) => { msj.style.display = 'block'; msj.style.color = error ? 'var(--red-alert)' : 'var(--green-success)'; msj.innerText = t; };
  boton.disabled = true; const original = boton.innerHTML; boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando…';
  try{
    await dbGuardarInmediato(); // asegura que el servidor tenga la factura tal como está en pantalla
    const r = await fetch(API_BASE + '/api/factus/facturas/' + facturaId + '/emitir', {
      method: 'POST',
      headers: headersAutenticados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ medioPago: document.getElementById('feMedioPago').value })
    });
    const data = await r.json().catch(() => ({}));
    if(!r.ok){
      mostrar(data.error || 'No se pudo emitir.', true);
      boton.disabled = false; boton.innerHTML = original;
      return;
    }
    if(typeof registrarLog === 'function') registrarLog('Emitir factura electrónica', 'Factura', `${f.numero} → ${data.numero || ''}${data.simulada ? ' (simulación)' : ''}`);
    await feCargarEstados();
    abrirFacturaElectronica(facturaId);
  }catch(err){
    mostrar('No se pudo conectar con el servidor. Intenta de nuevo.', true);
    boton.disabled = false; boton.innerHTML = original;
  }
}

// El PDF requiere sesión, así que se pide con el permiso y se abre como archivo temporal.
async function feVerPdf(facturaId){
  try{
    const r = await fetch(API_BASE + '/api/factus/facturas/' + facturaId + '/pdf', { headers: headersAutenticados() });
    if(!r.ok){ const d = await r.json().catch(() => ({})); mostrarToast(d.error || 'No se pudo abrir el PDF.'); return; }
    const url = URL.createObjectURL(await r.blob());
    window.open(url, '_blank');
  }catch(err){ mostrarToast('No se pudo abrir el PDF.'); }
}
