/* =========================================================
   MODO OFFLINE — plataforma web (computador).
   ---------------------------------------------------------
   La app YA guardaba en el dispositivo (localStorage) y YA reintentaba
   sola al reconectar (ver dbGuardarInmediato/marcarErrorSync en
   core.js) — eso no se tocó. Lo que faltaba y se agrega aquí:

   1) Un "punto de referencia" (baseline) de cómo estaban los datos la
      última vez que se sincronizó con éxito, guardado en IndexedDB
      (más espacio que localStorage — importante porque hay fotos).
   2) Con ese punto de referencia, calcular CUÁNTOS registros están
      pendientes de subir (para el aviso "3 pendientes"), y detectar
      cuándo el MISMO registro cambió tanto en el celular offline como
      en el servidor — en ese caso NUNCA se sobrescribe en silencio:
      se guarda la versión del servidor como la oficial, y la versión
      offline se aparta en "Conflictos por revisar" para que un
      administrador decida.
   3) Reacciona al instante cuando vuelve la conexión (antes se
      esperaba hasta 15 segundos al siguiente reintento).
========================================================= */

// Además de las 11 que ya se fusionaban, se agregan las que faltaban
// para cubrir Asistencia, Cotizaciones y Facturas, tal como se pidió.
['asistencias','cotizaciones','facturas'].forEach(clave=>{
  if(!CLAVES_FUSIONABLES.includes(clave)) CLAVES_FUSIONABLES.push(clave);
});

/* ---------------- IndexedDB: almacén simple clave-valor ---------------- */
const OFFLINE_DB_NOMBRE = 'prevenglobal_offline';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE = 'kv';

function abrirBaseOffline(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(OFFLINE_DB_NOMBRE, OFFLINE_DB_VERSION);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore(OFFLINE_STORE); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function offlineGuardar(clave, valor){
  try{
    const bd = await abrirBaseOffline();
    await new Promise((resolve, reject)=>{
      const tx = bd.transaction(OFFLINE_STORE, 'readwrite');
      tx.objectStore(OFFLINE_STORE).put(valor, clave);
      tx.oncomplete = resolve; tx.onerror = ()=>reject(tx.error);
    });
  }catch(err){ console.warn('[offline] no se pudo guardar en IndexedDB:', err.message); }
}
async function offlineLeer(clave){
  try{
    const bd = await abrirBaseOffline();
    return await new Promise((resolve, reject)=>{
      const tx = bd.transaction(OFFLINE_STORE, 'readonly');
      const req = tx.objectStore(OFFLINE_STORE).get(clave);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }catch(err){ console.warn('[offline] no se pudo leer de IndexedDB:', err.message); return undefined; }
}

/* ---------------- Punto de referencia (baseline) ---------------- */
// Se guarda cada vez que una sincronización con el servidor termina bien
// — es la "foto" de cómo estaban los datos en ese momento, para poder
// comparar más tarde y saber exactamente qué cambió mientras tanto.
async function guardarBaselineSincronizacion(){
  const copia = {};
  CLAVES_FUSIONABLES.forEach(clave=>{ copia[clave] = JSON.parse(JSON.stringify(db[clave] || [])); });
  await offlineGuardar('baseline', copia);
}

function indexarPorId(arr){
  const mapa = new Map();
  (arr||[]).forEach(r=>{ if(r && r.id!=null) mapa.set(r.id, r); });
  return mapa;
}

// Compara el baseline contra el estado actual y devuelve cuántos
// registros son nuevos o fueron editados desde la última sincronización
// — esto es lo que alimenta el aviso "N pendientes por sincronizar".
async function calcularPendientesOffline(){
  const baseline = await offlineLeer('baseline');
  if(!baseline) return { total: 0, detalle: {} };
  const detalle = {};
  let total = 0;
  CLAVES_FUSIONABLES.forEach(clave=>{
    const base = indexarPorId(baseline[clave]);
    const actual = db[clave] || [];
    let cambios = 0;
    actual.forEach(reg=>{
      if(!reg || reg.id==null) return;
      const previo = base.get(reg.id);
      if(!previo || JSON.stringify(previo) !== JSON.stringify(reg)) cambios++;
    });
    if(cambios){ detalle[clave] = cambios; total += cambios; }
  });
  return { total, detalle };
}

/* ---------------- Fusión con detección real de conflictos ----------------
   Reemplaza a fusionarAdicionesDesdeServidor (que solo agregaba lo nuevo,
   sin revisar si el MISMO registro había cambiado en ambos lados). Ahora,
   para cada registro que existe en ambos:
   - Si nadie más lo tocó en el servidor desde el baseline -> se respeta
     la versión de acá (el técnico), como ya pasaba.
   - Si el servidor SÍ lo cambió Y acá también se cambió -> es un choque
     real: se deja la versión del SERVIDOR como la válida (para no perder
     lo que ya está confirmado ahí), y la versión de acá se guarda aparte
     en db.conflictosSync para que un administrador la revise y decida.
--------------------------------------------------------------------- */
async function fusionarConDeteccionDeConflictos(remoto){
  if(!remoto) return false;
  asegurarEliminados();
  if(!Array.isArray(db.conflictosSync)) db.conflictosSync = [];
  const baseline = (await offlineLeer('baseline')) || {};
  let huboCambios = false;

  CLAVES_FUSIONABLES.forEach(clave=>{
    if(!Array.isArray(remoto[clave])) return;
    const base = indexarPorId(baseline[clave]);
    const localArr = db[clave] || [];
    const remotoArr = remoto[clave];
    const idsEliminados = new Set((db.eliminados && db.eliminados[clave]) || []);
    const localMapa = indexarPorId(localArr);
    const resultado = [];
    const idsVistos = new Set();

    // Recorre lo que hay en el servidor: decide si se respeta lo local,
    // se toma lo remoto, o hay un choque real que hay que apartar.
    remotoArr.forEach(regRemoto=>{
      if(!regRemoto || regRemoto.id==null || idsEliminados.has(regRemoto.id)) return;
      idsVistos.add(regRemoto.id);
      const regLocal = localMapa.get(regRemoto.id);
      const previo = base.get(regRemoto.id);
      if(!regLocal){ resultado.push(regRemoto); return; } // no existía acá -> se toma tal cual

      const localCambio = !previo || JSON.stringify(previo) !== JSON.stringify(regLocal);
      const remotoCambio = !previo || JSON.stringify(previo) !== JSON.stringify(regRemoto);

      if(localCambio && remotoCambio && JSON.stringify(regLocal) !== JSON.stringify(regRemoto)){
        // Choque real: alguien más lo cambió en el servidor MIENTRAS acá
        // también se cambiaba — no se sobrescribe nada en silencio.
        resultado.push(regRemoto);
        db.conflictosSync.push({
          id: Date.now() + Math.random(),
          entidad: clave,
          registroId: regRemoto.id,
          versionServidor: regRemoto,
          versionOffline: regLocal,
          detectadoEn: new Date().toISOString(),
          resuelto: false
        });
        huboCambios = true;
      } else if(localCambio){
        resultado.push(regLocal); // solo cambió acá -> se respeta
      } else {
        resultado.push(regRemoto); // no cambió acá (o cambió igual) -> se toma el del servidor
      }
    });

    // Lo que se creó acá offline (no existe todavía en el servidor) se agrega tal cual.
    localArr.forEach(regLocal=>{
      if(regLocal && regLocal.id!=null && !idsVistos.has(regLocal.id) && !idsEliminados.has(regLocal.id)){
        resultado.push(regLocal);
      }
    });

    if(resultado.length !== localArr.length || JSON.stringify(resultado)!==JSON.stringify(localArr)) huboCambios = true;
    db[clave] = resultado;
  });

  return huboCambios;
}

/* ---------------- Reacción inmediata al volver la conexión ---------------- */
window.addEventListener('online', ()=>{
  if(typeof actualizarBadgeConexion === 'function') actualizarBadgeConexion();
  if(typeof sincronizarConBackend === 'function') sincronizarConBackend();
});
window.addEventListener('offline', ()=>{
  if(typeof actualizarBadgeConexion === 'function') actualizarBadgeConexion();
});

/* ---------------- Revisión de conflictos (pantalla del administrador) ---------------- */
function actualizarBadgeConflictosSync(){
  const cantidad = (db.conflictosSync || []).filter(c=>!c.resuelto).length;
  const menu = document.getElementById('menuConflictosSync');
  const badge = document.getElementById('badgeConflictosSync');
  if(menu) menu.style.display = cantidad > 0 ? '' : 'none';
  if(badge) badge.innerText = cantidad > 0 ? `(${cantidad})` : '';
}

function abrirModalConflictosSync(){
  renderizarConflictosSync();
  abrirModal('modalConflictosSync');
}

// Muestra solo un resumen legible de cada versión (nombre/número si lo
// tiene, y cuándo se detectó) — no el JSON completo, para que sea fácil
// de leer de un vistazo aunque el registro tenga muchos campos.
function resumenRegistroConflicto(reg){
  if(!reg) return '(vacío)';
  return reg.nombre || reg.numero || reg.titulo || ('ID ' + reg.id);
}

function renderizarConflictosSync(){
  const cont = document.getElementById('listaConflictosSync');
  const pendientes = (db.conflictosSync || []).filter(c=>!c.resuelto);
  if(!pendientes.length){
    cont.innerHTML = '<p class="empty-state">No hay conflictos pendientes por revisar.</p>';
    return;
  }
  cont.innerHTML = pendientes.map(c=>`
    <div class="seccion-form-cliente" style="margin-top:10px;">
      <div class="seccion-form-cliente-titulo">${c.entidad} — detectado ${new Date(c.detectadoEn).toLocaleString('es-CO')}</div>
      <div class="field-row">
        <div style="background:rgba(34,197,94,.08);border-radius:8px;padding:10px;">
          <strong style="font-size:11px;color:var(--green-success);">✔ Versión actual (servidor)</strong>
          <p style="font-size:12px;margin:6px 0 10px;">${resumenRegistroConflicto(c.versionServidor)}</p>
          <button class="btn-custom btn-sm-custom" onclick="resolverConflictoSync(${c.id}, false)">Dejar esta</button>
        </div>
        <div style="background:rgba(245,158,11,.08);border-radius:8px;padding:10px;">
          <strong style="font-size:11px;color:#f59e0b;">✎ Versión sin conexión (offline)</strong>
          <p style="font-size:12px;margin:6px 0 10px;">${resumenRegistroConflicto(c.versionOffline)}</p>
          <button class="btn-custom btn-sm-custom btn-secondary-custom" onclick="resolverConflictoSync(${c.id}, true)">Usar esta en su lugar</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function resolverConflictoSync(idConflicto, usarOffline){
  const conflicto = (db.conflictosSync || []).find(c=>c.id===idConflicto);
  if(!conflicto) return;
  if(usarOffline){
    const arr = db[conflicto.entidad] || [];
    const idx = arr.findIndex(r=>r && r.id===conflicto.registroId);
    if(idx>=0) arr[idx] = conflicto.versionOffline;
  }
  conflicto.resuelto = true;
  await dbGuardarInmediato();
  renderizarConflictosSync();
  actualizarBadgeConflictosSync();
  mostrarToast(usarOffline ? '✅ Se aplicó la versión sin conexión.' : '✅ Se dejó la versión del servidor.', 'exito');
}
