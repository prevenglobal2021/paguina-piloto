// Revisa, para cada empresa, las órdenes de servicio programadas dentro de
// los próximos 30 minutos, y le manda una notificación push al técnico
// asignado (una sola vez por orden — queda marcada para no repetirla).
// Se ejecuta cada 5 minutos vía cron, dentro del contenedor de la app
// (docker exec), reutilizando la misma base de datos y las mismas
// variables de entorno que el servidor principal.

process.env.TZ = 'America/Bogota'; // fechas/horas de las órdenes son locales de Colombia

const { Pool } = require('pg');
const admin = require('firebase-admin');

const urlBaseDatos = process.env.DATABASE_URL || '';
const esBaseLocal = /localhost|127\.0\.0\.1/.test(urlBaseDatos);
const pool = new Pool({
  connectionString: urlBaseDatos,
  ssl: process.env.DB_SSL === 'false' ? false : (esBaseLocal ? false : { rejectUnauthorized: false }),
});

const RUTA_CLAVE_FIREBASE = process.env.FIREBASE_CREDENCIALES || '/app/firebase-service-account.json';
admin.initializeApp({ credential: admin.credential.cert(require(RUTA_CLAVE_FIREBASE)) });

const MINUTOS_ANTICIPACION = 30;
const VENTANA_MINUTOS = 5; // igual al intervalo del cron, para no dejar huecos ni duplicar

async function revisarOrdenesProximas() {
  const ahora = new Date();
  const inicioVentana = new Date(ahora.getTime() + (MINUTOS_ANTICIPACION - VENTANA_MINUTOS / 2) * 60000);
  const finVentana = new Date(ahora.getTime() + (MINUTOS_ANTICIPACION + VENTANA_MINUTOS / 2) * 60000);

  const { rows: empresas } = await pool.query('SELECT slug, estado_app FROM empresas');
  let avisosEnviados = 0;

  for (const empresa of empresas) {
    const data = empresa.estado_app;
    if (!data || !Array.isArray(data.ordenes) || !Array.isArray(data.tecnicos)) continue;

    let cambio = false;

    for (const orden of data.ordenes) {
      if (!orden.tecnicoId || !orden.fechaProgramada || !orden.horaProgramada) continue;
      if (orden.alarmaEnviada) continue;

      const momentoOrden = new Date(`${orden.fechaProgramada}T${orden.horaProgramada}:00`);
      if (isNaN(momentoOrden.getTime())) continue;
      if (momentoOrden < inicioVentana || momentoOrden > finVentana) continue;

      const tecnico = data.tecnicos.find(t => String(t.id) === String(orden.tecnicoId));
      if (!tecnico || !tecnico.fcmToken) continue;

      try {
        await admin.messaging().send({
          token: tecnico.fcmToken,
          notification: {
            title: 'Orden próxima a ejecutar',
            body: `Tienes una orden programada a las ${orden.horaProgramada} (en unos ${MINUTOS_ANTICIPACION} minutos).`
          },
          data: { ordenId: String(orden.id || '') }
        });
        orden.alarmaEnviada = true;
        cambio = true;
        avisosEnviados++;
        console.log(`[${new Date().toISOString()}] Alarma enviada — empresa ${empresa.slug}, orden ${orden.id}, técnico ${tecnico.nombre}`);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error enviando alarma (empresa ${empresa.slug}, orden ${orden.id}):`, err.message);
        // Si el token ya no es válido (celular reinstaló la app, etc.), lo borramos
        // para no seguir intentando en vano.
        if (err.code === 'messaging/registration-token-not-registered') {
          tecnico.fcmToken = null;
          cambio = true;
        }
      }
    }

    if (cambio) {
      await pool.query('UPDATE empresas SET estado_app = $1 WHERE slug = $2', [JSON.stringify(data), empresa.slug]);
    }
  }

  console.log(`[${new Date().toISOString()}] Revisión completa. Alarmas enviadas: ${avisosEnviados}.`);
  await pool.end();
}

revisarOrdenesProximas().catch(err => {
  console.error('Error general revisando órdenes próximas:', err);
  process.exit(1);
});
