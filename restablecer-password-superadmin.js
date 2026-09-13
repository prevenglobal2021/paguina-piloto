/* =========================================================
   RESTABLECER-PASSWORD-SUPERADMIN — se corre manualmente, cuando el
   superadministrador de la plataforma perdió su contraseña.
   Guarda la contraseña directo en la base de datos, usando el mismo
   método de cifrado que usa el servidor real.

   Uso:  node restablecer-password-superadmin.js <correo> <contraseña-nueva>
   Ejemplo:
     node restablecer-password-superadmin.js 18625pedro@gmail.com MiClave2024
========================================================= */
require('dotenv').config();
const crypto = require('crypto');
const { Pool } = require('pg');

const correo = (process.argv[2] || '').trim().toLowerCase();
const passwordNueva = process.argv[3] || '';

if (!correo || !passwordNueva) {
  console.log('\n❌ Faltan datos.');
  console.log('   Uso: node restablecer-password-superadmin.js <correo> <contraseña-nueva>\n');
  process.exit(1);
}

if (passwordNueva.length < 4) {
  console.log('\n❌ La contraseña es muy corta (mínimo 4 caracteres).\n');
  process.exit(1);
}

function hashPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    const hash = hashPassword(passwordNueva);
    const r = await pool.query(
      'UPDATE super_admins SET password_hash = $1, debe_cambiar_password = false WHERE email = $2 RETURNING id',
      [hash, correo]
    );

    if (!r.rows[0]) {
      console.log(`\n❌ No existe ningún superadmin con el correo "${correo}".`);
      console.log('   Verifica que el correo esté exactamente igual (mayúsculas/minúsculas no importan, pero sí espacios o typos).\n');
      process.exit(1);
    }

    console.log('\n✅ Contraseña del superadministrador restablecida correctamente.');
    console.log(`   Correo:            ${correo}`);
    console.log(`   Contraseña nueva:  ${passwordNueva}`);
    console.log('\nYa puedes entrar con estos datos (elige "Como Administrador" en el login).');
  } catch (err) {
    console.error('\n❌ Error restableciendo la contraseña:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
