// Prueba de conexión con Factus (sandbox). NO usa ni modifica datos de la
// plataforma: arma una factura de ejemplo, la envía, y descarga su PDF para
// ver en qué formato responde Factus.
//
// Uso (en el servidor):
//   sudo docker exec prevenglobal-app-1 node probar-factus.js
const factus = require('./factus');

(async () => {
  if (!factus.configurado()) {
    console.log('FALTAN las claves de Factus en el .env del servidor (FACTUS_CLIENT_ID, FACTUS_CLIENT_SECRET, FACTUS_USER, FACTUS_PASSWORD).');
    process.exit(1);
  }
  try {
    await factus.obtenerToken(true);
    console.log('1) Inicio de sesión en Factus: OK');
  } catch (e) {
    console.log('1) Inicio de sesión en Factus: FALLÓ ->', e.message, e.status || '', JSON.stringify(e.detalle || {}));
    process.exit(1);
  }

  const referencia = 'PRUEBA-' + Date.now();
  const { cuerpo, total } = factus.construirFactura({
    slug: 'prueba',
    medioPago: 'efectivo',
    referencia,
    cliente: { nombre: 'Empresa de Prueba S.A.S.', tipoDocumento: 'NIT', numeroDocumento: '900123456', direccion: 'Calle 1 # 1-1', telefono: '3001234567' },
    factura: {
      numero: referencia, impuestoPorcentaje: 0, descuentoGeneralPorcentaje: 0, notas: 'Factura de prueba (sandbox)',
      items: [
        { descripcion: 'Mantenimiento de equipo de refrigeración', cantidad: 2, precioUnitario: 100000, descuentoPorcentaje: 10 },
        { descripcion: 'Repuesto', cantidad: 1, precioUnitario: 50000, descuentoPorcentaje: 0 }
      ]
    }
  });
  console.log('2) Total que calcula la plataforma:', total, '(esperado 230000: 2x100000 con 10% de descuento = 180000, más 50000)');

  const r = await factus.validarFactura(cuerpo);
  console.log('3) Respuesta de Factus al crear la factura -> HTTP', r.status);
  console.log(JSON.stringify(r.data, null, 2).slice(0, 4000));
  if (!r.ok) { console.log('La factura NO se creó. Copia el mensaje de arriba y pásamelo.'); process.exit(1); }

  const numero = r.data && r.data.data && r.data.data.number;
  if (!numero) { console.log('No vino el número de factura; revisa la respuesta de arriba.'); process.exit(1); }
  try {
    const pdf = await factus.descargarPdf(numero);
    console.log('4) PDF descargado: OK,', pdf.length, 'bytes', pdf.slice(0, 5).toString() === '%PDF-' ? '(es un PDF válido)' : '(¡no parece PDF!)');
  } catch (e) {
    console.log('4) PDF: FALLÓ ->', e.message, e.status || '', JSON.stringify(e.detalle || {}));
  }
})().catch(e => { console.log('Error inesperado:', e.message); process.exit(1); });
