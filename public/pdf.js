

// ===== pdf.js — extraído de prevenglobal__25_.html (líneas 3057-3151) =====
/* =========================================================
   PDF
========================================================= */
let ordenPdfActualId = null;
function verPDF(ordenId){
  ordenPdfActualId = ordenId;
  const o = db.ordenes.find(x=>x.id===ordenId);
  const cliente = buscarCliente(o.clienteId), sede = buscarSede(o.clienteId,o.sedeId), equipo = buscarEquipo(o.clienteId,o.sedeId,o.equipoId), tecnico = buscarTecnico(o.tecnicoId);
  const logoHtml = db.config.logo ? `<img src="${db.config.logo}">` : '';
  let camposSimplesHtml = '';
  let camposEspecialesHtml = '';
  const plantillaOrden = buscarPlantilla(o.plantillaId);
  if(plantillaOrden && o.cierre){
    plantillaOrden.campos.forEach(campo=>{
      const respuesta = (o.cierre.respuestas && o.cierre.respuestas[campo.id]);
      if(campo.tipo==='checklist'){
        const resp = respuesta || {};
        const itemsHtml = (campo.items||[]).map(it=>`<div style="font-size:12px;">${resp[it.id]?'☑':'☐'} ${it.texto}</div>`).join('');
        camposEspecialesHtml += `<div class="pdf-box"><h4>${campo.label}</h4>${itemsHtml}</div>`;
      } else if(campo.tipo==='foto'){
        const fotosCampo = (o.cierre.fotosPorCampo && o.cierre.fotosPorCampo[campo.id]) || [];
        if(fotosCampo.length) camposEspecialesHtml += `<div class="pdf-box"><h4>${campo.label}</h4><div class="pdf-fotos">${fotosCampo.map(f=>`<img src="${f}">`).join('')}</div></div>`;
      } else {
        const vacio = respuesta===undefined || respuesta===null || String(respuesta).trim()==='';
        if(!vacio) camposSimplesHtml += `<tr><td style="width:45%;">${campo.label}</td><td>${respuesta}</td></tr>`;
      }
    });
  }
  const camposSimplesBox = camposSimplesHtml ? `<div class="pdf-box"><h4>Actividades realizadas y datos técnicos encontrados en sitio</h4><table class="pdf-tabla-datos" cellpadding="4">${camposSimplesHtml}</table></div>` : '';
  const fotosHtml = (o.cierre && o.cierre.fotos && o.cierre.fotos.length) ? `<div class="pdf-box"><h4>Soporte fotográfico</h4><div class="pdf-fotos">${normalizarFotosEvidencia(o.cierre.fotos).map(f=>f.desc ? `<figure><img src="${f.src}"><figcaption>${f.desc}</figcaption></figure>` : `<img src="${f.src}">`).join('')}</div></div>` : '';
  const bloqueDatosTecnicos = (camposSimplesBox || camposEspecialesHtml) ? `${camposSimplesBox}${camposEspecialesHtml}` : '';
  const diagnosticoTexto = o.cierre ? (o.cierre.diagnostico || '').trim() : '';
  const diagnosticoHtml = (o.cierre && !diagnosticoTexto) ? '' : `<div class="pdf-box"><h4>Diagnóstico técnico y observaciones</h4>
      <p style="font-size:12px;color:#333;margin:0;">${o.cierre ? diagnosticoTexto : 'Sin cierre registrado.'}</p>
    </div>`;
  const hayFirmaTecnico = o.cierre && o.cierre.firmaTecnico;
  const hayFirmaCliente = o.cierre && o.cierre.firmaCliente;
  const anchoFirma = (hayFirmaTecnico && hayFirmaCliente) ? '45%' : '100%';
  const firmaTecnicoHtml = hayFirmaTecnico ? `<div style="width:${anchoFirma};text-align:center;"><img src="${o.cierre.firmaTecnico}" style="max-height:60px;"><div style="border-top:1px solid #000;padding-top:5px;font-size:12px;">Firma Técnico</div></div>` : '';
  const firmaClienteHtml = hayFirmaCliente ? `<div style="width:${anchoFirma};text-align:center;"><img src="${o.cierre.firmaCliente}" style="max-height:60px;"><div style="border-top:1px solid #000;padding-top:5px;font-size:12px;">Firma Cliente</div></div>` : '';
  const firmasHtml = (hayFirmaTecnico || hayFirmaCliente) ? `<div class="pdf-box"><h4>Firmas</h4><div style="margin-top:4px;display:flex;justify-content:space-between;gap:20px;">${firmaTecnicoHtml}${firmaClienteHtml}</div></div>` : '';

  // Hoja de vida del equipo: otras órdenes del mismo equipo (sin contar esta), como historial resumido.
  const historialPrevio = equipo ? db.ordenes.filter(x=>x.equipoId===equipo.id && x.id!==o.id).sort((a,b)=>(b.fechaProgramada||'').localeCompare(a.fechaProgramada||'')) : [];
  const hojaVidaHtml = historialPrevio.length ? `<div class="pdf-box"><h4>Hoja de Vida del Equipo (intervenciones anteriores)</h4>
      <table class="pdf-tabla-datos" cellpadding="4">
        ${historialPrevio.map(x=>`<tr><td style="width:20%;">${x.fechaProgramada||'Sin fecha'}</td><td style="width:20%;">${x.numero}</td><td style="width:30%;">${x.tipo}</td><td>${badgeEstado(x.estado)}</td></tr>`).join('')}
      </table>
    </div>` : '';

  document.getElementById('pdfContenido').innerHTML = `
    <div class="pdf-header">
      <div>${logoHtml}<h2 style="color:#0088ff;margin:0;">${db.config.nombre}</h2><small>${db.config.subtitulo}</small>${db.config.direccion?`<br><small>${db.config.direccion}</small>`:''}</div>
      <div style="text-align:right;"><strong>Informe de Servicio Técnico</strong><br><small>Emitido: ${new Date().toLocaleDateString('es-CO')}</small></div>
    </div>

    <div style="background:#f1f5f9;padding:15px;border-radius:6px;margin-bottom:20px;">
      <small style="color:#64748b;font-weight:bold;">DOCUMENTO OPERATIVO</small>
      <h3 style="margin:5px 0 0 0;color:#0f172a;">${o.numero}</h3>
      <p style="margin:4px 0 0 0;font-size:12px;color:#475569;">${cliente?cliente.nombre:''}</p>
    </div>

    <div class="pdf-box"><h4>Datos de la Orden de Servicio</h4>
      <table style="width:100%;font-size:12px;" cellpadding="4">
        <tr><td style="width:45%;"><strong>Estado</strong></td><td>${o.estado}</td></tr>
        <tr><td><strong>Prioridad</strong></td><td>${o.prioridad}</td></tr>
        <tr><td><strong>Tipo</strong></td><td>${o.tipo}</td></tr>
        <tr><td><strong>Técnico</strong></td><td>${tecnico?tecnico.nombre:'—'}</td></tr>
        ${o.fechaProgramada ? `<tr><td><strong>Fecha programada</strong></td><td>${o.fechaProgramada}${o.horaProgramada?' · '+o.horaProgramada:''}</td></tr>` : ''}
      </table>
    </div>

    <div class="pdf-box"><h4>Cliente, Sede y Equipo</h4>
      <table style="width:100%;font-size:12px;" cellpadding="4">
        <tr><td style="width:45%;"><strong>Cliente</strong></td><td>${cliente?cliente.nombre:''}</td></tr>
        ${(cliente && cliente.numeroDocumento) ? `<tr><td><strong>${cliente.tipoDocumento||'NIT'}</strong></td><td>${cliente.numeroDocumento}</td></tr>` : ''}
        <tr><td><strong>Sede</strong></td><td>${sede?sede.nombre:'Sin sede'}</td></tr>
        <tr><td><strong>Equipo</strong></td><td>${equipo?equipo.nombre:''}</td></tr>
        ${(equipo && equipo.marca) ? `<tr><td><strong>Marca</strong></td><td>${equipo.marca}</td></tr>` : ''}
        ${(equipo && equipo.modelo) ? `<tr><td><strong>Modelo</strong></td><td>${equipo.modelo}</td></tr>` : ''}
        ${(equipo && equipo.serie) ? `<tr><td><strong>Serie</strong></td><td>${equipo.serie}</td></tr>` : ''}
        ${(equipo && equipo.capacidad) ? `<tr><td><strong>Capacidad</strong></td><td>${equipo.capacidad}</td></tr>` : ''}
        ${(equipo && equipo.voltaje) ? `<tr><td><strong>Voltaje</strong></td><td>${equipo.voltaje}</td></tr>` : ''}
        ${(equipo && equipo.refrigerante) ? `<tr><td><strong>Refrigerante</strong></td><td>${equipo.refrigerante}</td></tr>` : ''}
      </table>
    </div>

    ${hojaVidaHtml}
    ${fotosHtml}
    ${diagnosticoHtml}
    ${bloqueDatosTecnicos}
    ${firmasHtml}`;
  abrirModal('modalPDF');
}

