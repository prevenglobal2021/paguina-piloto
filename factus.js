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
const problemaFactus = (msg) => { const e = new Error(msg); e.status = 422; return e; };

// Arma el bloque "customer" que pide Factus — lo usan tanto una factura
// nueva como una nota crédito, siempre con las mismas reglas.
function construirCustomer(cliente) {
  if (!cliente) throw problemaFactus('Para emitir factura electrónica el cliente debe estar registrado (no sirve "Cliente no registrado"). Regístralo con su NIT o cédula.');
  const tipo = TIPO_DOCUMENTO[cliente.tipoDocumento];
  if (!tipo) throw problemaFactus(`El tipo de documento "${cliente.tipoDocumento || 'sin definir'}" todavía no está habilitado para facturación electrónica (por ahora solo NIT y C.C.).`);
  const numeroLimpio = String(cliente.numeroDocumento || '').replace(/\D/g, '');
  if (!numeroLimpio) throw problemaFactus('El cliente no tiene número de documento.');
  // Si es NIT guardado como "900123456-7", el guion y el dígito de verificación NO se envían (Factus lo calcula).
  const identificacion = (cliente.tipoDocumento === 'NIT' && String(cliente.numeroDocumento).includes('-'))
    ? String(cliente.numeroDocumento).split('-')[0].replace(/\D/g, '')
    : numeroLimpio;
  const customer = {
    identification_document_code: tipo.codigo,
    identification: identificacion,
    legal_organization_code: tipo.organizacion,
    tribute_code: 'ZZ',
    country_code: 'CO'
  };
  const nombre = String(cliente.nombre || '').trim();
  if (tipo.organizacion === '1') customer.company = nombre; else customer.names = nombre;
  if (cliente.direccion) customer.address = String(cliente.direccion).slice(0, 200);
  if (cliente.telefono) customer.phone = String(cliente.telefono).replace(/\D/g, '').slice(0, 20);
  if (cliente.email) customer.email = String(cliente.email);
  return customer;
}

function construirFactura({ factura, cliente, slug, medioPago, referencia }) {
  const problema = problemaFactus;

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
    customer: construirCustomer(cliente),
    items
  };
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

// Catálogo DIAN de motivos de nota crédito. Solo se incluye el código "2"
// (Anulación de factura electrónica) porque es el único que aparece
// confirmado en un ejemplo oficial real de Factus (ver api-factus-v2.json,
// carpeta "Notas crédito"). Para una corrección PARCIAL, el código exacto
// depende del motivo real (devolución, descuento, ajuste de precio, etc.)
// — se deja como un campo editable en vez de adivinar cuál aplica.
const MOTIVO_NOTA_CREDITO_ANULACION_TOTAL = '2';

// El id del rango de numeración de notas crédito es propio de cada cuenta
// de Factus — en vez de pedírselo a la persona a mano, se busca solo:
// Factus marca estos rangos con document:"22" (confirmado en el ejemplo
// oficial "Crear rango para notas credito"). Se guarda en memoria una vez
// encontrado, para no consultarlo en cada nota crédito.
let rangoNotaCreditoIdCache = null;
async function obtenerRangoNotaCreditoId() {
  if (rangoNotaCreditoIdCache) return rangoNotaCreditoIdCache;
  if (process.env.FACTUS_RANGO_NOTA_CREDITO_ID) {
    rangoNotaCreditoIdCache = Number(process.env.FACTUS_RANGO_NOTA_CREDITO_ID);
    return rangoNotaCreditoIdCache;
  }
  const resp = await llamar('GET', '/v2/numbering-ranges');
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) { const e = new Error('No se pudo consultar los rangos de numeración en Factus.'); e.status = resp.status; e.detalle = data; throw e; }
  const lista = Array.isArray(data) ? data : (data.data || []);
  // "22" es el código de documento que Factus usa para notas crédito.
  const rango = lista.find(r => String(r.document) === '22' || String(r.document_type) === '22');
  if (!rango) {
    const e = new Error('No se encontró en Factus un rango de numeración para notas crédito (document: "22"). Hay que crear uno desde el panel de Factus, o definir FACTUS_RANGO_NOTA_CREDITO_ID en el .env con su id.');
    e.status = 409;
    throw e;
  }
  rangoNotaCreditoIdCache = rango.id || rango.numbering_range_id;
  return rangoNotaCreditoIdCache;
}

/* Arma y valida una nota crédito ante Factus/DIAN, para anular (total) o
   corregir (parcial) una factura YA validada.
   - tipo 'total': se revierten los mismos ítems de la factura original.
   - tipo 'parcial': una sola línea con el monto y motivo que indique el
     administrador (no se intenta adivinar cuáles ítems originales
     corresponden a la corrección).
   Devuelve { numero, cufe } si Factus valida la nota, o lanza un error
   claro si no. */
async function emitirNotaCredito({ facturaOriginal, cliente, numeroFactura, motivo, tipo, montoParcial, medioPago, referencia }) {
  const problema = (msg) => { const e = new Error(msg); e.status = 422; return e; };
  if (!numeroFactura) throw problema('Falta el número de la factura original emitida por Factus.');
  if (!cliente) throw problema('No se encontró el cliente de la factura original.');
  if (!MEDIO_PAGO[medioPago]) throw problema('Indica el medio de pago de la nota crédito.');

  const numberingRangeId = await obtenerRangoNotaCreditoId();

  let items, montoTotal;
  if (tipo === 'parcial') {
    const monto = Number(montoParcial);
    if (!(monto > 0)) throw problema('Indica el monto a corregir (mayor que cero).');
    items = [{
      code_reference: 'CORRECCION-01',
      name: String(motivo).slice(0, 250),
      quantity: '1.00',
      price: dos(monto),
      unit_measure_code: '94',
      standard_code: '999',
      taxes: [{ is_excluded: true }]
    }];
    montoTotal = monto;
  } else {
    if (!facturaOriginal || !Array.isArray(facturaOriginal.items) || !facturaOriginal.items.length) throw problema('No se encontraron los ítems de la factura original para anularla.');
    const { cuerpo } = construirFactura({ factura: facturaOriginal, cliente, medioPago, referencia: 'nc-' + referencia });
    items = cuerpo.items;
    montoTotal = Number(cuerpo.payment_details[0].amount);
  }

  const cuerpo = {
    reference_code: referencia,
    correction_concept_code: tipo === 'parcial' ? '1' : MOTIVO_NOTA_CREDITO_ANULACION_TOTAL,
    customization_id: '20', // confirmado en el ejemplo oficial de Factus para notas crédito
    bill_number: numeroFactura,
    numbering_range_id: numberingRangeId,
    payment_details: [{ payment_form: 1, payment_method_code: MEDIO_PAGO[medioPago], amount: dos(montoTotal) }],
    observation: String(motivo).slice(0, 500),
    customer: construirCustomer(cliente),
    items
  };

  const resp = await llamar('POST', '/v2/credit-notes/validate', cuerpo);
  const data = await resp.json().catch(() => ({}));
  const d = (data && data.data) || {};
  if (!resp.ok || !d.is_validated) {
    const e = new Error((data && data.message) || 'Factus no validó la nota crédito.');
    e.status = resp.ok ? 422 : resp.status;
    e.detalle = d.errors || data.errors || data;
    throw e;
  }
  return { numero: d.number, cufe: d.cufe };
}

module.exports = { configurado, empresaAutorizada, construirFactura, validarFactura, borrarNoValidada, emitirNotaCredito, descargarPdf, obtenerToken, MEDIO_PAGO };
