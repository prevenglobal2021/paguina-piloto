/* =========================================================
   CAMBIAR-CORREO-SUPERADMIN — se corre manualmente, cuando el
   correo del superadministrador choca con el de una empresa (o
   simplemente se quiere cambiar). Mientras el superadmin comparta
   correo con el administrador de una empresa, el login SIEMPRE
   revisará primero esa empresa y nunca llegará a comprobar la
   cuenta de superadmin — por eso este correo debe ser único.

   Uso:  node cambiar-correo-superadmin.js <correo-actual> <correo-nuevo>
   Ejemplo:
     node cambiar-correo-superadmin.js prevenglobal2021@gmail.com superadmin@prevenglobal.app
========================================================= */
require('dotenv').config();
const { Pool } = require('pg');

const correoActual = (process.argv[2] || '').trim().toLowerCase();
const correoNuevo = (process.argv[3] || '').trim().toLowerCase();

if (!correoActual || !correoNuevo) {
  console.log('\n❌ Faltan datos.');
  console.log('   Uso: node cambiar-correo-superadmin.js <correo-actual> <correo-nuevo>\n');
  process.exit(1);
}

if (!correoNuevo.includes('@')) {
  console.log('\n❌ El correo nuevo no parece válido.\n');
  process.exit(1);
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    // Aviso preventivo: si el correo nuevo coincide con el admin de
    // alguna empresa, tendríamos exactamente el mismo problema otra vez.
    const rEmpresas = await pool.query('SELECT slug, estado_app FROM empresas');
    const chocaConEmpresa = rEmpresas.rows.find(f => ((f.estado_app.config || {}).adminUsuario || '').trim().toLowerCase() === correoNuevo);
    if (chocaConEmpresa) {
      console.log(`\n❌ Ese correo nuevo ya es el administrador de la empresa "${chocaConEmpresa.slug}". Elige uno distinto para el superadmin.\n`);
      process.exit(1);
    }

    const r = await pool.query(
      'UPDATE super_admins SET email = $1 WHERE email = $2 RETURNING id',
      [correoNuevo, correoActual]
    );

    if (!r.rows[0]) {
      console.log(`\n❌ No se encontró ningún superadmin con el correo "${correoActual}".\n`);
      process.exit(1);
    }

    console.log('\n✅ Correo del superadministrador actualizado correctamente.');
    console.log(`   Correo anterior: ${correoActual}`);
    console.log(`   Correo nuevo:    ${correoNuevo}`);
    console.log('\nLa contraseña no cambió — sigue siendo la misma que ya tenías. Usa el correo nuevo para entrar de ahora en adelante.');
  } catch (err) {
    console.error('\n❌ Error actualizando el correo:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
