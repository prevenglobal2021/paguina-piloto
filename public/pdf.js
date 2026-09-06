// ===== pdf.js — extraído de prevenglobal__25_.html (líneas 3057-3151) =====
/* =========================================================
   PDF
========================================================= */
let ordenPdfActualId = null;

// Arma las fotos en FILAS explícitas de a 4 (cada fila es su propio <div>).
// Antes se usaba una sola cuadrícula (CSS Grid) para todas las fotos juntas
// — pero la herramienta que arma el PDF no siempre reconoce bien dónde
// termina una fila dentro de una cuadrícula, y a veces corta una foto a la
// mitad entre dos páginas. Con cada fila como su propio bloque indivisible,
// la página salta ANTES o DESPUÉS de la fila completa, nunca a la mitad.
function generarFilasFotosPDF(fotos, porFila){
  porFila = porFila || 4;
  const figura = f => f.desc ? `<figure><img src="${f.src}" onclick="verImagenAmpliada('${f.src}')"><figcaption>${f.desc}</figcaption></figure>` : `<img src="${f.src}" onclick="verImagenAmpliada('${f.src}')">`;
  let html = '';
  for(let inicio=0; inicio<fotos.length; inicio+=porFila){
    const fila = fotos.slice(inicio, inicio+porFila);
    html += `<div class="pdf-fotos-fila">${fila.map(figura).join('')}</div>`;
  }
  return html;
}

// Genera el bloque de informe (diagnóstico + actividades + fotos) de UN
// equipo — se usa tanto para órdenes de un solo equipo como, dentro de un
// bucle, para cada equipo de una orden con varios. Antes esta función no
// existía: el documento SIEMPRE leía o.cierre.diagnostico/o.cierre.fotos
// directamente, que quedan vacíos en una orden de varios equipos (ahí la
// información real vive en o.cierre.porEquipo) — por eso el informe y las
// fotos no aparecían al imprimir, descargar o enviar por WhatsApp.
function generarBloqueInformeEquipoPDF(datosCierre, plantilla){
  datosCierre = datosCierre || {};
  let camposSimplesHtml = '';
  let camposEspecialesHtml = '';
  if(plantilla){
    plantilla.campos.forEach(campo=>{
      const respuesta = (datosCierre.respuestas && datosCierre.respuestas[campo.id]);
      if(campo.tipo==='checklist'){
        const resp = respuesta || {};
        const itemsHtml = (campo.items||[]).map(it=>`<div style="font-size:12px;">${resp[it.id]?'☑':'☐'} ${it.texto}</div>`).join('');
        camposEspecialesHtml += `<div class="pdf-box"><h4>${campo.label}</h4>${itemsHtml}</div>`;
      } else if(campo.tipo==='foto'){
        const fotosCampo = normalizarFotosEvidencia((datosCierre.fotosPorCampo && datosCierre.fotosPorCampo[campo.id]) || []);
        if(fotosCampo.length){
          let contenidoFotos;
          if(campo.bloqueImagenes){
            let bloques = '';
            for(let inicio=0; inicio<fotosCampo.length; inicio+=campo.bloqueImagenes){
              const numeroBloque = Math.floor(inicio/campo.bloqueImagenes) + 1;
              const trozo = fotosCampo.slice(inicio, inicio+campo.bloqueImagenes);
              bloques += `<p style="font-size:10px;color:#64748b;margin:8px 0 4px;font-weight:700;">BLOQUE ${numeroBloque}</p>${generarFilasFotosPDF(trozo, 4)}`;
            }
            contenidoFotos = bloques;
          } else {
            contenidoFotos = generarFilasFotosPDF(fotosCampo, 4);
          }
          camposEspecialesHtml += `<div class="pdf-box"><h4>${campo.label}</h4>${contenidoFotos}</div>`;
        }
      } else {
        const vacio = respuesta===undefined || respuesta===null || String(respuesta).trim()==='';
        if(!vacio) camposSimplesHtml += `<tr><td style="width:45%;">${campo.label}</td><td>${respuesta}</td></tr>`;
      }
    });
  }
  const camposSimplesBox = camposSimplesHtml ? `<div class="pdf-box"><h4>Actividades realizadas y datos técnicos encontrados en sitio</h4><table class="pdf-tabla-datos" cellpadding="4">${camposSimplesHtml}</table></div>` : '';
  const fotosGenerales = normalizarFotosEvidencia(datosCierre.fotos);
  const fotosHtml = fotosGenerales.length ? `<div class="pdf-box"><h4>Soporte fotográfico</h4>${generarFilasFotosPDF(fotosGenerales, 4)}</div>` : '';
  const diagnosticoTexto = (datosCierre.diagnostico || '').trim();
  const diagnosticoHtml = diagnosticoTexto ? `<div class="pdf-box"><h4>Diagnóstico técnico y observaciones</h4>
      <p style="font-size:12px;color:#333;margin:0;">${diagnosticoTexto}</p>
    </div>` : '';
  return `${diagnosticoHtml}${fotosHtml}${camposSimplesBox}${camposEspecialesHtml}`;
}

function verPDF(ordenId){
  ordenPdfActualId = ordenId;
  const o = db.ordenes.find(x=>x.id===ordenId);
  const cliente = buscarCliente(o.clienteId), sede = buscarSede(o.clienteId,o.sedeId), tecnico = buscarTecnico(o.tecnicoId);
  const nombreClientePdf = nombreClienteOrden(o);
  const logoHtml = db.config.logo ? `<img src="${db.config.logo}">` : '';
  const esMultiEquipo = o.equiposIds && o.equiposIds.length > 1;
  const equipo = esMultiEquipo ? null : buscarEquipo(o.clienteId, o.sedeId, o.equipoId);

  let bloqueInformeHtml;
  if(esMultiEquipo){
    const cierrePorEquipo = (o.cierre && o.cierre.porEquipo) || {};
    bloqueInformeHtml = o.equiposIds.map(equipoId=>{
      const info = ubicarEquipoPorId(equipoId);
      const datosEquipo = (o.equiposDatos||[]).find(d=>d.equipoId===equipoId) || {};
      const plantillaEquipo = buscarPlantilla(datosEquipo.plantillaId);
      const nombreEq = info ? info.equipo.nombre + (info.equipo.serie ? ' — '+info.equipo.serie : '') : 'Equipo #'+equipoId;
      return `<div style="margin:22px 0 10px;padding:8px 12px;background:#0f172a;border-radius:6px;">
          <strong style="color:#fff;font-size:13px;"><i class="fas fa-snowflake"></i> ${nombreEq}</strong>
        </div>
        ${generarBloqueInformeEquipoPDF(cierrePorEquipo[equipoId], plantillaEquipo)}`;
    }).join('');
  } else {
    const plantillaOrden = buscarPlantilla(o.plantillaId);
    bloqueInformeHtml = (o.cierre) ? generarBloqueInformeEquipoPDF(o.cierre, plantillaOrden) : '';
  }

  const hayFirmaTecnico = o.cierre && o.cierre.firmaTecnico;
  const hayFirmaCliente = o.cierre && o.cierre.firmaCliente;
  const anchoFirma = (hayFirmaTecnico && hayFirmaCliente) ? '45%' : '100%';
  const firmaTecnicoHtml = hayFirmaTecnico ? `<div style="width:${anchoFirma};text-align:center;"><img src="${o.cierre.firmaTecnico}" style="max-height:60px;"><div style="border-top:1px solid #000;padding-top:5px;font-size:12px;">Firma Técnico</div></div>` : '';
  const firmaClienteHtml = hayFirmaCliente ? `<div style="width:${anchoFirma};text-align:center;"><img src="${o.cierre.firmaCliente}" style="max-height:60px;"><div style="border-top:1px solid #000;padding-top:5px;font-size:12px;">Firma Cliente</div></div>` : '';
  const firmasHtml = (hayFirmaTecnico || hayFirmaCliente) ? `<div class="pdf-box"><h4>Firmas</h4><div style="margin-top:4px;display:flex;justify-content:space-between;gap:20px;">${firmaTecnicoHtml}${firmaClienteHtml}</div></div>` : '';

  const historialPrevio = equipo ? db.ordenes.filter(x=>x.equipoId===equipo.id && x.id!==o.id).sort((a,b)=>(b.fechaProgramada||'').localeCompare(a.fechaProgramada||'')) : [];
  const hojaVidaHtml = historialPrevio.length ? `<div class="pdf-box"><h4>Hoja de Vida del Equipo (intervenciones anteriores)</h4>
      <table class="pdf-tabla-datos" cellpadding="4">
        ${historialPrevio.map(x=>`<tr><td style="width:20%;">${x.fechaProgramada||'Sin fecha'}</td><td style="width:20%;">${x.numero}</td><td style="width:30%;">${x.tipo}</td><td>${badgeEstado(x.estado)}</td></tr>`).join('')}
      </table>
    </div>` : '';

  const filaEquipo = esMultiEquipo
    ? `<tr><td style="width:45%;"><strong>Equipos incluidos</strong></td><td>${o.equiposIds.map(id=>{ const info = ubicarEquipoPorId(id); return info ? info.equipo.nombre : 'Equipo #'+id; }).join(', ')}</td></tr>`
    : `<tr><td style="width:45%;"><strong>Equipo</strong></td><td>${equipo?equipo.nombre:''}</td></tr>
       ${(equipo && equipo.marca) ? `<tr><td><strong>Marca</strong></td><td>${equipo.marca}</td></tr>` : ''}
       ${(equipo && equipo.modelo) ? `<tr><td><strong>Modelo</strong></td><td>${equipo.modelo}</td></tr>` : ''}
       ${(equipo && equipo.serie) ? `<tr><td><strong>Serie</strong></td><td>${equipo.serie}</td></tr>` : ''}
       ${(equipo && equipo.capacidad) ? `<tr><td><strong>Capacidad</strong></td><td>${equipo.capacidad}</td></tr>` : ''}
       ${(equipo && equipo.voltaje) ? `<tr><td><strong>Voltaje</strong></td><td>${equipo.voltaje}</td></tr>` : ''}
       ${(equipo && equipo.refrigerante) ? `<tr><td><strong>Refrigerante</strong></td><td>${equipo.refrigerante}</td></tr>` : ''}`;

  document.getElementById('pdfContenido').innerHTML = `
    <div class="pdf-header">
      <div>${logoHtml}<h2 style="color:#0088ff;margin:0;">${db.config.nombre}</h2><small>${db.config.subtitulo}</small>${db.config.direccion?`<br><small>${db.config.direccion}</small>`:''}</div>
      <div style="text-align:right;"><strong>Informe de Servicio Técnico</strong><br><small>Emitido: ${new Date().toLocaleDateString('es-CO')}</small></div>
    </div>

    <div style="background:#f1f5f9;padding:15px;border-radius:6px;margin-bottom:20px;">
      <small style="color:#64748b;font-weight:bold;">DOCUMENTO OPERATIVO</small>
      <h3 style="margin:5px 0 0 0;color:#0f172a;">${o.numero}</h3>
      <p style="margin:4px 0 0 0;font-size:12px;color:#475569;">${nombreClientePdf}${o.esClienteNuevo?' <small style="color:#b45309;">(Cliente nuevo)</small>':''}</p>
    </div>

    <div class="pdf-box"><h4>Datos de la Orden de Servicio</h4>
      <table style="width:100%;font-size:12px;" cellpadding="4">
        <tr><td style="width:45%;"><strong>Estado</strong></td><td>${o.estado}</td></tr>
        <tr><td><strong>Prioridad</strong></td><td>${o.prioridad}</td></tr>
        <tr><td><strong>Tipo</strong></td><td>${o.tipo}</td></tr>
        <tr><td><strong>Técnico</strong></td><td>${tecnico?tecnico.nombre:'—'}</td></tr>
        ${o.fechaProgramada ? `<tr><td><strong>Fecha programada</strong></td><td>${o.fechaProgramada}${o.horaProgramada?' · '+o.horaProgramada:''}</td></tr>` : ''}
      </table>
      ${o.notas ? `<div style="margin-top:10px;padding:10px;background:#eff6ff;border-left:3px solid #2563eb;border-radius:4px;"><strong style="font-size:11px;color:#2563eb;text-transform:uppercase;">Notas del servicio</strong><p style="margin:3px 0 0;font-size:12px;color:#1e3a5f;">${o.notas}</p></div>` : ''}
    </div>

    <div class="pdf-box"><h4>Cliente, Sede y Equipo</h4>
      <table style="width:100%;font-size:12px;" cellpadding="4">
        <tr><td style="width:45%;"><strong>Cliente</strong></td><td>${nombreClientePdf}${o.esClienteNuevo?' (Cliente nuevo, no registrado)':''}</td></tr>
        ${(cliente && cliente.numeroDocumento) ? `<tr><td><strong>${cliente.tipoDocumento||'NIT'}</strong></td><td>${cliente.numeroDocumento}</td></tr>` : ''}
        <tr><td><strong>Sede</strong></td><td>${o.esClienteNuevo ? (o.clienteNuevoDireccion || 'Sin dirección') : (sede?sede.nombre:'Sin sede')}</td></tr>
        ${filaEquipo}
      </table>
    </div>

    ${hojaVidaHtml}
    ${bloqueInformeHtml}
    ${firmasHtml}`;
  abrirModal('modalPDF');
}
