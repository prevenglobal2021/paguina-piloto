/* =========================================================
   PUENTE CON LA APP NATIVA DE ANDROID (Capacitor)
   Este archivo no hace nada cuando la plataforma se abre desde un
   navegador normal (PC o celular vía Chrome/Safari) — solo se activa
   cuando corre DENTRO del APK, donde Capacitor inyecta automáticamente
   el objeto window.Capacitor con acceso a funciones nativas del celular
   (compartir, archivos). No se necesita empaquetar/compilar nada extra
   del lado web: Capacitor ya inyecta esto en cualquier página que la
   app cargue, incluida esta plataforma real en Railway.
========================================================= */
function corriendoDentroDeLaApp(){
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// Comparte un archivo (PDF) usando el selector NATIVO de compartir de
// Android — el mismo que aparece al tocar "Compartir" en cualquier app,
// donde WhatsApp aparece como una opción y el archivo llega adjunto
// directo, sin depender del navegador ni de descargas manuales. Devuelve
// true si lo logró compartir así; false si no corresponde (por ejemplo,
// porque se está usando desde un navegador normal) o si algo falló, para
// que quien llama pueda seguir con su propio método como respaldo.
async function compartirArchivoNativo(blob, nombreArchivo, tituloCompartir){
  if(!corriendoDentroDeLaApp()) return false;
  try{
    const base64 = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onloadend = () => resolve(lector.result.split(',')[1]);
      lector.onerror = reject;
      lector.readAsDataURL(blob);
    });
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    const Filesystem = plugins && plugins.Filesystem;
    const Share = plugins && plugins.Share;
    if(!Filesystem || !Share) throw new Error('Los plugins nativos de archivos/compartir no están disponibles.');

    const escrito = await Filesystem.writeFile({
      path: nombreArchivo,
      data: base64,
      directory: 'CACHE',
      recursive: true
    });
    if(!escrito || !escrito.uri) throw new Error('Android no devolvió una URI para el PDF.');

    await Share.share({
      title: tituloCompartir || 'Compartir documento',
      text: '',
      url: escrito.uri,
      dialogTitle: 'Compartir documento por WhatsApp'
    });
    return true;
  }catch(err){
    console.error('No se pudo compartir de forma nativa, se sigue con el método normal:', err);
    return false;
  }
}

/* =========================================================
   SECCIÓN "CONFIGURACIÓN DE LA APP" — solo visible dentro del APK
========================================================= */
function inicializarSeccionConfigApp(){
  if(!corriendoDentroDeLaApp()) return; // en navegador (PC), no aplica — no se muestra nada
  const enlaceMenu = document.getElementById('enlaceConfigApp');
  if(enlaceMenu) enlaceMenu.style.display = 'list-item';
}
function abrirConfigApp(){
  const nombreUsuario = (typeof nombreUsuarioActual === 'function') ? nombreUsuarioActual() : '—';
  const rol = (sesionActual && sesionActual.rol) ? (sesionActual.rol==='admin' ? 'Administrador' : 'Técnico') : '—';
  const empresa = (typeof empresaActual !== 'undefined' && empresaActual) ? empresaActual : '—';
  document.getElementById('configAppUsuario').innerText = nombreUsuario;
  document.getElementById('configAppRol').innerText = rol;
  document.getElementById('configAppEmpresa').innerText = empresa;
  document.getElementById('configAppVersion').innerText = (window.Capacitor && window.Capacitor.getPlatform) ? '1.0.0 (Android)' : '1.0.0';
  abrirModal('modalConfigApp');
}
function cerrarSesionDesdeConfigApp(){
  cerrarModal('modalConfigApp');
  if(typeof cerrarSesion === 'function') cerrarSesion();
}

document.addEventListener('DOMContentLoaded', inicializarSeccionConfigApp);

/* =========================================================
   NOTIFICACIONES PUSH (alarmas de órdenes próximas a ejecutar)
   Solo hace algo dentro del APK — en navegador normal, no aplica.
   Se activa una vez que el técnico inició sesión (necesita saber su
   ID para poder avisarle a él específicamente).
========================================================= */
async function registrarNotificacionesPush(tecnicoId){
  if(!corriendoDentroDeLaApp() || !tecnicoId) return;
  const plugins = window.Capacitor && window.Capacitor.Plugins;
  const PushNotifications = plugins && plugins.PushNotifications;
  if(!PushNotifications) return;

  try{
    const permiso = await PushNotifications.checkPermissions();
    let estado = permiso.receive;
    if(estado === 'prompt' || estado === 'prompt-with-rationale'){
      const solicitado = await PushNotifications.requestPermissions();
      estado = solicitado.receive;
    }
    if(estado !== 'granted') return; // el técnico no dio permiso — no insistimos, no rompe nada más

    PushNotifications.addListener('registration', async (token) => {
      try{
        await fetch(API_BASE + '/api/tecnico/push-token', {
          method: 'POST',
          headers: headersAutenticados({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ tecnicoId, token: token.value })
        });
      }catch(err){ console.error('No se pudo guardar el token de notificaciones:', err); }
    });
    PushNotifications.addListener('registrationError', (err) => {
      console.error('Error registrando notificaciones push:', err);
    });

    await PushNotifications.register();
  }catch(err){
    console.error('No se pudo activar las notificaciones push (no afecta el resto de la app):', err);
  }
}
