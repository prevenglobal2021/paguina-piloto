/* =========================================================
   RESTABLECER-PASSWORD-ADMIN — se corre manualmente, cuando un
   administrador de empresa (no el superadmin) perdió su acceso.
   Guarda la contraseña directo en la base de datos, usando el mismo
   método de cifrado que usa el servidor real (así queda 100%
   compatible con el login normal).

   Uso:  node restablecer-password-admin.js <slug-de-la-empresa> [contraseña-elegida]
   Ejemplos:
     node restablecer-password-admin.js prevenglobal
       (genera una contraseña temporal al azar)
     node restablecer-password-admin.js prevenglobal MiClaveFacil123
       (usa exactamente la contraseña que escribas, sin generar nada al azar —
        recomendado si vas a teclearla a mano en el celular, para evitar
        errores de tipeo con contraseñas generadas al azar)
========================================================= */
require('dotenv').config();
const crypto = require('crypto');
const { Pool } = require('pg');

const slug = (process.argv[2] || '').trim().toLowerCase();
const passwordElegida = process.argv[3] || null;

if (!slug) {
  console.log('\n❌ Falta indicar el código (slug) de la empresa.');
  console.log('   Uso: node restablecer-password-admin.js prevenglobal [contraseña-opcional]\n');
  process.exit(1);
}

if (passwordElegida && passwordElegida.length < 4) {
  console.log('\n❌ La contraseña que escribiste es muy corta (mínimo 4 caracteres).\n');
  process.exit(1);
}

function hashPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

function generarPasswordTemporal() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 12; i++) pass += alfabeto[crypto.randomInt(alfabeto.length)];
  return pass;
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query('SELECT estado_app, activa FROM empresas WHERE slug = $1', [slug]);
    if (!r.rows[0]) {
      console.log(`\n❌ No existe ninguna empresa con el código "${slug}".`);
      process.exit(1);
    }

    if (r.rows[0].activa === false) {
      console.log(`\n⚠️  Aviso: la empresa "${slug}" está DESACTIVADA. Aunque restablezcamos la contraseña, no podrá iniciar sesión hasta reactivarla desde el panel de superadmin.`);
    }

    const data = r.rows[0].estado_app;
    const correoActual = (data.config || {}).adminUsuario || '(sin correo registrado)';
    const passwordFinal = passwordElegida || generarPasswordTemporal();
    data.config.adminPasswordHash = hashPassword(passwordFinal);

    await pool.query('UPDATE empresas SET estado_app = $1, actualizado_en = now() WHERE slug = $2', [JSON.stringify(data), slug]);

    console.log('\n✅ Contraseña de administrador restablecida correctamente.');
    console.log(`   Empresa:               ${slug}`);
    console.log(`   Correo (sin cambios):  ${correoActual}`);
    console.log(`   Contraseña nueva:      ${passwordFinal}`);
    console.log('\nGuarda esta contraseña ahora — no se volverá a mostrar. Puedes cambiarla después desde Configuración → Empresa y Perfil dentro de la plataforma.');
  } catch (err) {
    console.error('\n❌ Error restableciendo la contraseña:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
