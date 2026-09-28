/* =========================================================
   FACTUS — facturación electrónica (DIAN). FASE 1: sandbox.

   Todo pasa por el servidor: las claves viven SOLO en el archivo .env
   del servidor (nunca en el código ni en GitHub), y el navegador jamás
   habla directo con Factus.

   Variables del .env que usa este módulo:
     FACTUS_URL            (por defecto https://api-sandbox.factus.com.co)
     FACTUS_CLIENT_ID
     FACTUS_CLIENT_SECRET
     FACTUS_USER           (correo de la cuenta Factus)
     FACTUS_PASSWORD
     FACTUS_EMPRESAS       (slugs de empresa autorizados a emitir, por
                            defecto solo "prevenglobal" — así una empresa
                            nunca factura por la cuenta de otra)
========================================================= */

const FACTUS_URL = (process.env.FACTUS_URL || 'https://api-sandbox.factus.com.co').replace(/\/+$/, '');
const EMPRESAS_AUTORIZADAS = (process.env.FACTUS_EMPRESAS || 'prevenglobal').split(',').map(s => s.trim()).filter(Boolean);

// Códigos confirmados en los ejemplos oficiales de Factus. Los que no
// aparecen aquí NO se adivinan: la emisión se detiene con un mensaje claro.
const TIPO_DOCUMENTO = {
  'NIT':  { codigo: '31', organizacion: '1' }, // persona jurídica
  'C.C.': { codigo: '13', organizacion: '2' }  // persona natural
};
// Medios de pago. "electronico" usa 42 (el que trae el ejemplo oficial de
// Factus); antes de facturar en PRODUCCIÓN hay que confirmar con el contador
// el código exacto de la transferencia/pago electrónico que se recibe.
const MEDIO_PAGO = { efectivo: '10', electronico: '42' };

let tokenCache = null; // { access, refresh, venceEn }

function configurado() {
  return !!(process.env.FACTUS_CLIENT_ID && process.env.FACTUS_CLIENT_SECRET && process.env.FACTUS_USER && process.env.FACTUS_PASSWORD);
}
function empresaAutorizada(slug) { return EMPRESAS_AUTORIZADAS.includes(slug); }

async function pedirToken(campos) {
  const fd = new FormData();
  Object.entries(campos).forEach(([k, v]) => fd.append(k, v));
  const r = await fetch(FACTUS_URL + '/oauth/token', { method: 'POST', headers: { Accept: 'application/json' }, body: fd });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    const e = new Error('Factus no aceptó las credenciales (revisa el .env del servidor).');
    e.status = r.status; e.detalle = data;
    throw e;
  }
  // No se confía en un tiempo fijo: se usa el "expires_in" real que responda Factus.
  tokenCache = {
    access: data.access_token,
    refresh: data.refresh_token || null,
    venceEn: Date.now() + Math.max(30, (Number(data.expires_in) || 600) - 60) * 1000
  };
  return tokenCache.access;
}

async function obtenerToken(forzar) {
  if (!configurado()) { const e = new Error('Factus no está configurado en el servidor (faltan las claves en el .env).'); e.status = 503; throw e; }
  if (!forzar && tokenCache && Date.now() < tokenCache.venceEn) return tokenCache.access;
  if (!forzar && tokenCache && tokenCache.refresh) {
    try {
      return await pedirToken({
        grant_type: 'refresh_token',
        client_id: process.env.FACTUS_CLIENT_ID,
        client_secret: process.env.FACTUS_CLIENT_SECRET,
        refresh_token: tokenCache.refresh
      });
    } catch (e) { /* si renovar falla, se inicia sesión de nuevo abajo */ }
  }
  return pedirToken({
    grant_type: 'password',
    client_id: process.env.FACTUS_CLIENT_ID,
    client_secret: process.env.FACTUS_CLIENT_SECRET,
    username: process.env.FACTUS_USER,
    password: process.env.FACTUS_PASSWORD
  });
}

// Llamada autenticada; si el permiso venció justo en ese momento, reintenta una vez.
async function llamar(metodo, ruta, cuerpo) {
  const hacer = async (token) => fetch(FACTUS_URL + ruta, {
    method: metodo,
    headers: Object.assign({ Accept: 'application/json', Authorization: 'Bearer ' + token }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  let resp = await hacer(await obtenerToken(false));
  if (resp.status === 401) resp = await hacer(await obtenerToken(true));
  return resp;
}

const dos = (n) => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);

/* Convierte una factura de la plataforma en el cuerpo que pide Factus.
   Devuelve { cuerpo, total } o lanza un error con mensaje claro para el usuario. */
function construirFactura({ factura, cliente, slug, medioPago, referencia }) {
  const problema = (msg) => { const e = new Error(msg); e.status = 422; return e; };

  if (!cliente) throw problema('Para emitir factura electrónica el cliente debe estar registrado (no sirve "Cliente no registrado"). Regístralo con su NIT o cédula.');
  const tipo = TIPO_DOCUMENTO[cliente.tipoDocumento];
  if (!tipo) throw problema(`El tipo de documento "${cliente.tipoDocumento || 'sin definir'}" todavía no está habilitado para facturación electrónica (por ahora solo NIT y C.C.).`);
  const numeroLimpio = String(cliente.numeroDocumento || '').replace(/\D/g, '');
  if (!numeroLimpio) throw problema('El cliente no tiene número de documento.');
  // Si es NIT guardado como "900123456-7", el guion y el dígito de verificación NO se envían (Factus lo calcula).
  const identificacion = (cliente.tipoDocumento === 'NIT' && String(cliente.numeroDocumento).includes('-'))
    ? String(cliente.numeroDocumento).split('-')[0].replace(/\D/g, '')
    : numeroLimpio;

  if (Number(factura.impuestoPorcentaje) > 0) throw problema('Esta factura tiene un impuesto/IVA aplicado, pero la empresa no es responsable de IVA. Quítalo antes de emitir.');
  if (!Array.isArray(factura.items) || !factura.items.length) throw problema('La factura no tiene ítems.');
  if (!MEDIO_PAGO[medioPago]) throw problema('Indica el medio de pago: efectivo o electrónico.');

  const descGen = Number(factura.descuentoGeneralPorcentaje) || 0;
  let total = 0;
  const items = factura.items.map((it, i) => {
    const cant = Number(it.cantidad) || 0;
    const precio = Number(it.precioUnitario) || 0;
    if (cant <= 0 || precio < 0) throw problema(`El ítem "${it.descripcion || i + 1}" tiene cantidad o precio inválido.`);
    const bruto = cant * precio;
    const descItem = bruto * (Number(it.descuentoPorcentaje) || 0) / 100;
    const descGeneral = (bruto - descItem) * descGen / 100;
    const descTotal = descItem + descGeneral;
    total += bruto - descTotal;
    const linea = {
      code_reference: String(it.itemId || it.id || `ITEM-${i + 1}`),
      name: String(it.descripcion || `Ítem ${i + 1}`).slice(0, 250),
      quantity: dos(cant),
      price: dos(precio),
      unit_measure_code: '94',      // unidad
      standard_code: '999',
      taxes: [{ is_excluded: true }] // no responsable de IVA
    };
    if (descTotal > 0) linea.discount_amount = dos(descTotal);
    return linea;
  });

  const cuerpo = {
    reference_code: referencia,
    document: '01',
    operation_type: '10',
    send_email: false, // en sandbox no envía; el envío real se activa en la fase de producción
    payment_details: [{ payment_form: '1', payment_method_code: MEDIO_PAGO[medioPago], amount: dos(total) }],
    customer: {
      identification_document_code: tipo.codigo,
      identification: identificacion,
      legal_organization_code: tipo.organizacion,
      tribute_code: 'ZZ',
      country_code: 'CO'
    },
    items
  };
  const nombre = String(cliente.nombre || '').trim();
  if (tipo.organizacion === '1') cuerpo.customer.company = nombre; else cuerpo.customer.names = nombre;
  if (cliente.direccion) cuerpo.customer.address = String(cliente.direccion).slice(0, 200);
  if (cliente.telefono) cuerpo.customer.phone = String(cliente.telefono).replace(/\D/g, '').slice(0, 20);
  if (cliente.email) cuerpo.customer.email = String(cliente.email);
  if (factura.notas) cuerpo.observation = String(factura.notas).slice(0, 500);

  return { cuerpo, total: Math.round(total * 100) / 100 };
}

async function validarFactura(cuerpo) {
  const resp = await llamar('POST', '/v2/bills/validate', cuerpo);
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

// Anula en Factus una factura que NO llegó a validarse (para poder reintentar con el mismo código).
async function borrarNoValidada(referencia) {
  try { await llamar('DELETE', '/v2/bills/destroy/reference/' + encodeURIComponent(referencia)); } catch (e) { /* si no existía, no importa */ }
}

// Descarga el PDF. Factus puede responderlo como archivo directo o como JSON
// con el archivo en base64 — se aceptan ambas formas.
async function descargarPdf(numero) {
  const resp = await llamar('GET', `/v2/bills/${encodeURIComponent(numero)}/download-pdf`);
  const tipo = resp.headers.get('content-type') || '';
  if (!resp.ok) { const e = new Error('Factus no entregó el PDF.'); e.status = resp.status; throw e; }
  if (tipo.includes('application/pdf')) return Buffer.from(await resp.arrayBuffer());
  const json = await resp.json().catch(() => ({}));
  const d = json.data || json;
  const b64 = d.pdf_base_64_encoded || d.pdf_base64 || d.pdf || d.file || null;
  if (typeof b64 === 'string') return Buffer.from(b64, 'base64');
  const e = new Error('Factus respondió el PDF en un formato que aún no reconozco.');
  e.status = 502; e.detalle = Object.keys(d || {});
  throw e;
}

module.exports = { configurado, empresaAutorizada, construirFactura, validarFactura, borrarNoValidada, descargarPdf, obtenerToken, MEDIO_PAGO };
