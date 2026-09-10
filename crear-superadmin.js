/* =========================================================
   CREAR-SUPERADMIN — se corre UNA sola vez, manualmente,
   desde la consola de Railway (pestaña "Console" del servicio
   prevenglobal-backend). Crea el primer usuario superadmin con
   una contraseña temporal, se la envía por correo y también la
   muestra en pantalla como respaldo.

   Uso:  node crear-superadmin.js correo@ejemplo.com
   Si no se pasa el correo, usa prevenglobal2021@gmail.com.
========================================================= */
require('dotenv').config();
const crypto = require('crypto');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const email = (process.argv[2] || 'prevenglobal2021@gmail.com').trim().toLowerCase();

function hashPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

function generarPasswordTemporal() {
  // 12 caracteres, fácil de leer y de teclear (sin 0/O/1/l/I confusos).
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 12; i++) pass += alfabeto[crypto.randomInt(alfabeto.length)];
  return pass;
}

async function enviarCorreo(destino, passwordTemporal) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('\n[aviso] GMAIL_USER/GMAIL_APP_PASSWORD no configurados — no se pudo enviar el correo, pero la contraseña quedó creada igual (ver abajo).');
    return false;
  }
  const transportador = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await transportador.sendMail({
    from: `"Prevenglobal — Panel General" <${process.env.GMAIL_USER}>`,
    to: destino,
    subject: 'Tu acceso de superadministrador — Prevenglobal',
    html: `<p>Se creó tu usuario de <strong>superadministrador</strong> (panel multiempresa).</p>
           <p><strong>Correo:</strong> ${destino}<br>
           <strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
           <p>Por seguridad, el sistema te pedirá cambiarla apenas inicies sesión por primera vez.</p>`,
  });
  return true;
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    const yaExiste = await pool.query('SELECT id FROM super_admins WHERE email = $1', [email]);
    if (yaExiste.rows[0]) {
      console.log(`\nYa existe un superadmin con el correo ${email}. No se creó ninguno nuevo.`);
      console.log('Si perdiste la contraseña, usa la recuperación por correo desde el panel, o borra esa fila y vuelve a correr este script.');
      process.exit(0);
    }

    const passwordTemporal = generarPasswordTemporal();
    const hash = hashPassword(passwordTemporal);

    await pool.query(
      'INSERT INTO super_admins (email, password_hash, debe_cambiar_password) VALUES ($1, $2, true)',
      [email, hash]
    );

    const enviado = await enviarCorreo(email, passwordTemporal);

    console.log('\n✅ Superadmin creado correctamente.');
    console.log(`   Correo:              ${email}`);
    console.log(`   Contraseña temporal: ${passwordTemporal}`);
    console.log(enviado ? '   (también se envió por correo)' : '   (guarda esta contraseña ahora — no se volverá a mostrar)');
    console.log('\nAl iniciar sesión por primera vez, el sistema pedirá cambiarla.');
  } catch (err) {
    console.error('\n❌ Error creando el superadmin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
