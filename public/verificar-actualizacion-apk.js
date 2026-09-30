/* =========================================================
   VERIFICAR ACTUALIZACIÓN DE LA APP (APK) — solo corre dentro de la
   app nativa instalada en el celular (nunca en el navegador normal
   de computador, donde no aplica). Al abrir la app, revisa en el
   servidor si hay una versión más nueva disponible, y si la hay, le
   muestra a la persona un aviso con un botón para descargarla e
   instalarla — Android exige que la persona toque "Instalar" ella
   misma por seguridad, así que esto no la instala sola, pero le
   ahorra tener que buscar el archivo o que se lo tengan que mandar.

   Requiere el plugin @capacitor/app (si no está instalado en el
   proyecto: npm install @capacitor/app && npx cap sync). Si el
   plugin no está disponible, esto simplemente no hace nada — nunca
   rompe el resto de la app.
========================================================= */
async function verificarActualizacionAPK(){
  try{
    if(!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return; // solo dentro de la app instalada
    if(!window.Capacitor.Plugins || !window.Capacitor.Plugins.App) return; // el plugin @capacitor/app no está instalado todavía

    const infoActual = await window.Capacitor.Plugins.App.getInfo();
    const versionCodeActual = parseInt(infoActual.build, 10); // en Android, "build" es el versionCode

    const respuesta = await fetch('/version-apk.json', { cache: 'no-store' });
    if(!respuesta.ok) return; // todavía no existe ese archivo, o el servidor no respondió — no pasa nada, se sigue usando la app normal
    const remota = await respuesta.json();
    if(!remota || !remota.versionCode || !remota.url) return;

    if(remota.versionCode > versionCodeActual){
      mostrarAvisoActualizacionAPK(remota);
    }
  }catch(err){
    console.log('[verificar-actualizacion-apk] No se pudo revisar (no afecta el uso normal de la app):', err.message);
  }
}

function mostrarAvisoActualizacionAPK(remota){
  if(document.getElementById('avisoActualizacionAPK')) return; // ya se estaba mostrando
  const div = document.createElement('div');
  div.id = 'avisoActualizacionAPK';
  div.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#0088ff;color:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 6px 20px rgba(0,0,0,.3);display:flex;align-items:center;gap:12px;font-size:13px;';
  div.innerHTML = `
    <div style="flex:1;">📲 Hay una versión nueva de la app (${remota.versionName || ''}) disponible.</div>
    <button onclick="window.open('${remota.url}', '_system'); document.getElementById('avisoActualizacionAPK').remove();" style="background:#fff;color:#0088ff;border:none;border-radius:6px;padding:8px 12px;font-weight:700;font-size:13px;">Descargar</button>
    <button onclick="document.getElementById('avisoActualizacionAPK').remove();" style="background:transparent;color:#fff;border:none;font-size:18px;padding:0 4px;">✖</button>
  `;
  document.body.appendChild(div);
}

// Se revisa solo una vez, unos segundos después de que la app termine de
// cargar (para no competir con la carga inicial de datos).
setTimeout(verificarActualizacionAPK, 4000);
