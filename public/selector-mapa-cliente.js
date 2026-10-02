// ===== selector-mapa-cliente.js — Selector de dirección con mapa (OpenStreetMap) =====
/* =========================================================
   Permite buscar la dirección de un cliente escribiéndola, o haciendo
   clic directamente en el mapa, y guarda tanto el texto de la dirección
   como las coordenadas exactas. Usa OpenStreetMap (mapa) y Nominatim
   (buscador de direcciones) — ambos gratis, sin clave de API ni tarjeta.

   Reglas de uso de Nominatim que este archivo respeta a propósito:
   - Máximo 1 búsqueda por segundo (aquí se usa muchísimo menos: solo
     cuando la persona presiona "Buscar" o hace clic en el mapa).
   - Nada de autocompletado mientras se escribe — la búsqueda solo se
     dispara con el botón o la tecla Enter, nunca letra por letra.
   - Se muestra el crédito a "OpenStreetMap contributors", como exige
     su política de uso.
========================================================= */

let mapaClienteInstancia = null;
let marcadorClienteInstancia = null;
let mapaClienteUbicacionElegida = null; // { lat, lng, direccion }
let mapaClienteBuscando = false; // evita 2 búsquedas al mismo tiempo

// Centro del mapa por defecto (capital) y código de país para cada empresa,
// según lo que configure en Configuración > General. Así, una empresa en
// Chile o Venezuela ve su propio país, sin tocar código — cada una
// configura el suyo por separado (db.config es propio de cada empresa).
const CENTRO_POR_PAIS = {
  CO:[4.7110,-74.0721], VE:[10.4806,-66.9036], CL:[-33.4489,-70.6693], MX:[19.4326,-99.1332],
  PE:[-12.0464,-77.0428], EC:[-0.1807,-78.4678], AR:[-34.6037,-58.3816], PA:[8.9824,-79.5199],
  CR:[9.9281,-84.0907], DO:[18.4861,-69.9312], GT:[14.6349,-90.5069], BO:[-16.4897,-68.1193],
  PY:[-25.2637,-57.5759], UY:[-34.9011,-56.1645], HN:[14.0723,-87.1921], SV:[13.6929,-89.2182],
  NI:[12.1364,-86.2514], ES:[40.4168,-3.7038]
};

function paisBusquedaMapaActual(){
  return (db.config && db.config.paisBusquedaMapa) || 'CO';
}

function abrirSelectorMapaCliente(){
  abrirModal('modalSelectorMapaCliente');
  document.getElementById('mapaClienteBuscador').value = '';
  document.getElementById('mapaClienteResultados').innerHTML = '';
  document.getElementById('mapaClienteDireccionTexto').textContent = '';
  document.getElementById('btnConfirmarMapaCliente').disabled = true;
  mapaClienteUbicacionElegida = null;

  // Centro inicial: si el cliente ya tiene coordenadas guardadas, parte de ahí;
  // si no, el centro del país configurado para esta empresa.
  const latActual = parseFloat(document.getElementById('cfgCliLat').value);
  const lngActual = parseFloat(document.getElementById('cfgCliLng').value);
  const hayUbicacionPrevia = !isNaN(latActual) && !isNaN(lngActual);
  const centroInicial = hayUbicacionPrevia ? [latActual, lngActual] : (CENTRO_POR_PAIS[paisBusquedaMapaActual()] || CENTRO_POR_PAIS.CO);

  // El contenedor del mapa no puede medir 0px cuando todavía está oculto, así
  // que se crea el mapa después de que el modal ya esté visible.
  setTimeout(() => {
    const contenedor = document.getElementById('mapaClienteContenedor');
    if(mapaClienteInstancia){ mapaClienteInstancia.remove(); mapaClienteInstancia = null; }
    mapaClienteInstancia = L.map(contenedor).setView(centroInicial, hayUbicacionPrevia ? 16 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapaClienteInstancia);

    marcadorClienteInstancia = L.marker(centroInicial, { draggable: true }).addTo(mapaClienteInstancia);
    if(!hayUbicacionPrevia) mapaClienteInstancia.removeLayer(marcadorClienteInstancia);

    mapaClienteInstancia.on('click', (e) => usarPuntoEnMapaCliente(e.latlng.lat, e.latlng.lng));
    marcadorClienteInstancia.on('dragend', () => {
      const pos = marcadorClienteInstancia.getLatLng();
      usarPuntoEnMapaCliente(pos.lat, pos.lng);
    });

    if(hayUbicacionPrevia){
      mapaClienteUbicacionElegida = { lat: latActual, lng: lngActual, direccion: document.getElementById('cfgCliDireccion').value || '' };
      document.getElementById('mapaClienteDireccionTexto').textContent = mapaClienteUbicacionElegida.direccion || `${latActual}, ${lngActual}`;
      document.getElementById('btnConfirmarMapaCliente').disabled = false;
    }
  }, 50);
}

// Identifica a Prevenglobal ante Nominatim, como pide su política de uso
// (los navegadores no dejan fijar el encabezado User-Agent desde
// JavaScript, así que el "Referer" que el propio navegador ya envía
// cumple ese mismo requisito).
async function llamarNominatim(ruta, parametros){
  const url = `https://nominatim.openstreetmap.org/${ruta}?${new URLSearchParams({ format: 'jsonv2', ...parametros })}`;
  const resp = await fetch(url);
  if(!resp.ok) throw new Error('No se pudo conectar con el buscador de direcciones (OpenStreetMap). Intenta de nuevo en un momento.');
  return resp.json();
}

async function buscarDireccionMapaCliente(){
  const texto = document.getElementById('mapaClienteBuscador').value.trim();
  if(!texto){ mostrarToast('Escribe una dirección para buscar.'); return; }
  if(mapaClienteBuscando) return; // ya hay una búsqueda en curso
  mapaClienteBuscando = true;
  const resultadosDiv = document.getElementById('mapaClienteResultados');
  resultadosDiv.innerHTML = '<small style="color:var(--text-muted);">Buscando...</small>';
  try{
    const resultados = await llamarNominatim('search', { q: texto, countrycodes: paisBusquedaMapaActual().toLowerCase(), limit: '5', addressdetails: '0' });
    if(!resultados.length){
      resultadosDiv.innerHTML = '<small style="color:var(--text-muted);">No se encontraron direcciones con ese texto — prueba escribiendo la ciudad, o haz clic directamente en el mapa.</small>';
      return;
    }
    resultadosDiv.innerHTML = resultados.map((r, i) =>
      `<div class="resultado-busqueda-mapa" style="padding:6px 8px;border:1px solid var(--card-border);border-radius:6px;margin-top:4px;cursor:pointer;font-size:13px;" onclick="elegirResultadoMapaCliente(${i})">${r.display_name}</div>`
    ).join('');
    window._resultadosMapaCliente = resultados; // guardado temporal, solo para el clic de arriba
  }catch(err){
    resultadosDiv.innerHTML = '';
    mostrarToast('⚠️ ' + err.message, 'error');
  }finally{
    mapaClienteBuscando = false;
  }
}

function elegirResultadoMapaCliente(indice){
  const r = (window._resultadosMapaCliente || [])[indice];
  if(!r) return;
  const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
  document.getElementById('mapaClienteResultados').innerHTML = '';
  document.getElementById('mapaClienteBuscador').value = r.display_name;
  mapaClienteInstancia.setView([lat, lng], 17);
  marcadorClienteInstancia.setLatLng([lat, lng]);
  if(!mapaClienteInstancia.hasLayer(marcadorClienteInstancia)) marcadorClienteInstancia.addTo(mapaClienteInstancia);
  mapaClienteUbicacionElegida = { lat, lng, direccion: r.display_name };
  document.getElementById('mapaClienteDireccionTexto').textContent = r.display_name;
  document.getElementById('btnConfirmarMapaCliente').disabled = false;
}

async function usarPuntoEnMapaCliente(lat, lng){
  marcadorClienteInstancia.setLatLng([lat, lng]);
  if(!mapaClienteInstancia.hasLayer(marcadorClienteInstancia)) marcadorClienteInstancia.addTo(mapaClienteInstancia);
  document.getElementById('mapaClienteDireccionTexto').textContent = 'Buscando la dirección de este punto...';
  document.getElementById('btnConfirmarMapaCliente').disabled = true;
  try{
    const r = await llamarNominatim('reverse', { lat, lon: lng });
    const direccion = (r && r.display_name) || '';
    mapaClienteUbicacionElegida = { lat, lng, direccion };
    document.getElementById('mapaClienteDireccionTexto').textContent = direccion || `${lat.toFixed(6)}, ${lng.toFixed(6)} (sin dirección exacta encontrada — igual se guardan las coordenadas)`;
  }catch(err){
    mapaClienteUbicacionElegida = { lat, lng, direccion: '' };
    document.getElementById('mapaClienteDireccionTexto').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)} (no se pudo buscar el texto de la dirección, pero las coordenadas sí se pueden guardar)`;
  }finally{
    document.getElementById('btnConfirmarMapaCliente').disabled = false;
  }
}

function confirmarSelectorMapaCliente(){
  if(!mapaClienteUbicacionElegida) return;
  if(mapaClienteUbicacionElegida.direccion) document.getElementById('cfgCliDireccion').value = mapaClienteUbicacionElegida.direccion;
  document.getElementById('cfgCliLat').value = mapaClienteUbicacionElegida.lat.toFixed(6);
  document.getElementById('cfgCliLng').value = mapaClienteUbicacionElegida.lng.toFixed(6);
  mostrarToast('✅ Ubicación tomada del mapa.', 'exito');
  cerrarModal('modalSelectorMapaCliente');
}
