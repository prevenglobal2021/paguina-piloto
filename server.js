// =========================================================
// PREVENGLOBAL — server.js (fase de empresa única, PostgreSQL)
// Auth simple (un solo usuario/empresa), CRUD operativo completo,
// trazabilidad QR, módulo de tienda en línea (catálogo público).
// =========================================================
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json({ limit: '15mb' }));

// Permite que el frontend (aunque esté en otro dominio) pueda llamar esta API.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Protección contra fuerza bruta / bots: límites por IP.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máx 10 intentos de login por IP cada 15 min
  message: { error: 'Demasiados intentos de acceso. Espera unos minutos e intenta de nuevo.' },
  standardHeaders: true, legacyHeaders: false,
});
const limitePublico = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // máx 60 solicitudes cada 15 min a la tienda pública / creación de pedidos
  message: { error: 'Demasiadas solicitudes desde tu conexión. Espera unos minutos e intenta de nuevo.' },
  standardHeaders: true, legacyHeaders: false,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIA_ESTO_EN_PRODUCCION';

// ---------------------------------------------------------
// AUTENTICACIÓN — usuarios normales (dentro de una empresa)
// ---------------------------------------------------------
app.post('/api/auth/login', limiteLogin, async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query(
      `SELECT u.*, e.nombre AS empresa_nombre
       FROM usuarios u JOIN empresas e ON e.id = u.empresa_id
       WHERE u.email = $1 AND u.activo = true`,
      [email]
    );
    const usuario = userResult.rows[0];
    if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { userId: usuario.id, empresaId: usuario.empresa_id, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      empresa: { nombre: usuario.empresa_nombre }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Falta token' });
  try {
    const payload = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    req.userId = payload.userId;
    req.empresaId = payload.empresaId;
    req.rol = payload.rol;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

async function subscriptionMiddleware(req, res, next) {
  // Fase de empresa única / sin facturación todavía: todos los módulos
  // quedan disponibles siempre. Cuando se vuelva a activar multiempresa,
  // aquí se restaura la consulta a `empresas.estado` y `modulos_activos`.
  req.modulosActivos = ['ordenes', 'equipos', 'inventario', 'calendario', 'reportes', 'tienda'];
  next();
}

function requireModulo(nombreModulo) {
  return (req, res, next) => {
    if (!req.modulosActivos?.includes(nombreModulo)) {
      return res.status(403).json({ error: `Tu plan no incluye el módulo "${nombreModulo}"` });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  if (req.rol !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede hacer esto' });
  next();
}

// Para endpoints de solo consulta/reportes: admin y supervisor pueden verlos, técnico no.
function requireSupervisorOAdmin(req, res, next) {
  if (req.rol !== 'admin' && req.rol !== 'supervisor') {
    return res.status(403).json({ error: 'No tienes permisos para ver esta sección' });
  }
  next();
}

app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login' || req.path.startsWith('/public')) {
    return next();
  }
  authMiddleware(req, res, () => subscriptionMiddleware(req, res, next));
});

// ---------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------
app.get('/api/clientes', async (req, res) => {
  const result = await pool.query(
    `SELECT c.*,
       COALESCE(json_agg(json_build_object('id', s.id, 'nombre', s.nombre))
         FILTER (WHERE s.id IS NOT NULL), '[]') AS sedes
     FROM clientes c LEFT JOIN sedes s ON s.cliente_id = c.id
     WHERE c.empresa_id = $1 GROUP BY c.id ORDER BY c.nombre`,
    [req.empresaId]
  );
  res.json(result.rows);
});

app.post('/api/clientes', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
  const result = await pool.query(
    'INSERT INTO clientes (empresa_id, nombre) VALUES ($1, $2) RETURNING *',
    [req.empresaId, nombre]
  );
  res.json(result.rows[0]);
});

app.patch('/api/clientes/:id', async (req, res) => {
  await pool.query(
    'UPDATE clientes SET nombre = $1 WHERE id = $2 AND empresa_id = $3',
    [req.body.nombre, req.params.id, req.empresaId]
  );
  res.json({ ok: true });
});

app.delete('/api/clientes/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM clientes WHERE id = $1 AND empresa_id = $2', [req.params.id, req.empresaId]);
  res.json({ ok: true });
});

// ---------------------------------------------------------
// SEDES
// ---------------------------------------------------------
app.post('/api/sedes', async (req, res) => {
  const { clienteId, nombre } = req.body;
  const result = await pool.query(
    'INSERT INTO sedes (empresa_id, cliente_id, nombre) VALUES ($1,$2,$3) RETURNING *',
    [req.empresaId, clienteId, nombre]
  );
  res.json(result.rows[0]);
});

app.delete('/api/sedes/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM sedes WHERE id = $1 AND empresa_id = $2', [req.params.id, req.empresaId]);
  res.json({ ok: true });
});

// ---------------------------------------------------------
// EQUIPOS (incluye trazabilidad QR)
// ---------------------------------------------------------
app.get('/api/equipos', requireModulo('equipos'), async (req, res) => {
  const { clienteId, sedeId } = req.query;
  const condiciones = ['empresa_id = $1'];
  const valores = [req.empresaId];
  if (clienteId) { valores.push(clienteId); condiciones.push(`cliente_id = $${valores.length}`); }
  if (sedeId) { valores.push(sedeId); condiciones.push(`sede_id = $${valores.length}`); }
  const result = await pool.query(
    `SELECT * FROM equipos WHERE ${condiciones.join(' AND ')} ORDER BY nombre`, valores
  );
  res.json(result.rows);
});

app.post('/api/equipos', requireModulo('equipos'), async (req, res) => {
  const e = req.body;
  if (!e.clienteId || !e.nombre) return res.status(400).json({ error: 'Faltan datos obligatorios' });
  const result = await pool.query(
    `INSERT INTO equipos (empresa_id, cliente_id, sede_id, nombre, marca, modelo, serie,
       capacidad, voltaje, refrigerante, ficha_tecnica, fotos)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [req.empresaId, e.clienteId, e.sedeId || null, e.nombre, e.marca, e.modelo, e.serie,
     e.capacidad, e.voltaje, e.refrigerante, e.fichaTecnica, JSON.stringify(e.fotos || [])]
  );
  const equipo = result.rows[0];
  await pool.query('UPDATE equipos SET qr_id = $1 WHERE id = $2', [`EQ-${equipo.id}`, equipo.id]);
  res.json({ ...equipo, qr_id: `EQ-${equipo.id}` });
});

app.patch('/api/equipos/:id', requireModulo('equipos'), async (req, res) => {
  const e = req.body;
  await pool.query(
    `UPDATE equipos SET nombre=$1, marca=$2, modelo=$3, serie=$4, capacidad=$5, voltaje=$6,
       refrigerante=$7, ficha_tecnica=$8, fotos=$9, sede_id=$10
     WHERE id = $11 AND empresa_id = $12`,
    [e.nombre, e.marca, e.modelo, e.serie, e.capacidad, e.voltaje, e.refrigerante,
     e.fichaTecnica, JSON.stringify(e.fotos || []), e.sedeId || null, req.params.id, req.empresaId]
  );
  res.json({ ok: true });
});

app.get('/api/equipos/:id/trazabilidad', requireModulo('equipos'), async (req, res) => {
  const equipo = (await pool.query(
    'SELECT * FROM equipos WHERE id = $1 AND empresa_id = $2', [req.params.id, req.empresaId]
  )).rows[0];
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const ordenes = await pool.query(
    `SELECT o.*, t.nombre AS tecnico_nombre, p.nombre AS plantilla_nombre
     FROM ordenes o
     LEFT JOIN tecnicos t ON t.id = o.tecnico_id
     LEFT JOIN plantillas p ON p.id = o.plantilla_id
     WHERE o.equipo_id = $1 AND o.empresa_id = $2
     ORDER BY o.fecha_programada ASC`,
    [req.params.id, req.empresaId]
  );
  res.json({ equipo, ordenes: ordenes.rows });
});

// ---------------------------------------------------------
// TÉCNICOS Y PLANTILLAS
// ---------------------------------------------------------
app.get('/api/tecnicos', async (req, res) => {
  const result = await pool.query('SELECT * FROM tecnicos WHERE empresa_id = $1 ORDER BY nombre', [req.empresaId]);
  res.json(result.rows);
});
app.post('/api/tecnicos', requireAdmin, async (req, res) => {
  const result = await pool.query(
    'INSERT INTO tecnicos (empresa_id, nombre) VALUES ($1,$2) RETURNING *',
    [req.empresaId, req.body.nombre]
  );
  res.json(result.rows[0]);
});

app.get('/api/plantillas', async (req, res) => {
  const result = await pool.query('SELECT * FROM plantillas WHERE empresa_id = $1 ORDER BY nombre', [req.empresaId]);
  res.json(result.rows);
});
app.post('/api/plantillas', requireAdmin, async (req, res) => {
  const result = await pool.query(
    'INSERT INTO plantillas (empresa_id, nombre, campos) VALUES ($1,$2,$3) RETURNING *',
    [req.empresaId, req.body.nombre, JSON.stringify(req.body.campos || [])]
  );
  res.json(result.rows[0]);
});

// ---------------------------------------------------------
// ÓRDENES DE SERVICIO
// ---------------------------------------------------------
app.get('/api/ordenes', requireModulo('ordenes'), async (req, res) => {
  const { desde, hasta } = req.query;
  const condiciones = ['o.empresa_id = $1'];
  const valores = [req.empresaId];
  if (desde) { valores.push(desde); condiciones.push(`o.fecha_programada >= $${valores.length}`); }
  if (hasta) { valores.push(hasta); condiciones.push(`o.fecha_programada <= $${valores.length}`); }
  const result = await pool.query(
    `SELECT o.*, e.nombre AS equipo_nombre, t.nombre AS tecnico_nombre
     FROM ordenes o
     JOIN equipos e ON e.id = o.equipo_id
     LEFT JOIN tecnicos t ON t.id = o.tecnico_id
     WHERE ${condiciones.join(' AND ')} ORDER BY o.fecha_programada`,
    valores
  );
  res.json(result.rows);
});

app.post('/api/ordenes', requireModulo('ordenes'), async (req, res) => {
  const o = req.body;
  const result = await pool.query(
    `INSERT INTO ordenes (empresa_id, numero, equipo_id, tecnico_id, plantilla_id, tipo,
       fecha_programada, hora_programada)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.empresaId, o.numero, o.equipoId, o.tecnicoId || null, o.plantillaId || null,
     o.tipo, o.fechaProgramada, o.horaProgramada]
  );
  res.json(result.rows[0]);
});

app.patch('/api/ordenes/:id', requireModulo('ordenes'), async (req, res) => {
  const actual = (await pool.query(
    'SELECT estado FROM ordenes WHERE id = $1 AND empresa_id = $2', [req.params.id, req.empresaId]
  )).rows[0];
  if (!actual) return res.status(404).json({ error: 'Orden no encontrada' });
  if (actual.estado === 'Finalizado') {
    return res.status(403).json({ error: 'La orden ya está finalizada y es de solo lectura' });
  }
  const o = req.body;
  await pool.query(
    `UPDATE ordenes SET tecnico_id=$1, fecha_programada=$2, hora_programada=$3, tipo=$4, plantilla_id=$5
     WHERE id = $6 AND empresa_id = $7`,
    [o.tecnicoId || null, o.fechaProgramada, o.horaProgramada, o.tipo, o.plantillaId || null,
     req.params.id, req.empresaId]
  );
  res.json({ ok: true });
});

app.post('/api/ordenes/:id/cerrar', requireModulo('ordenes'), async (req, res) => {
  await pool.query(
    `UPDATE ordenes SET estado = 'Finalizado', cierre = $1 WHERE id = $2 AND empresa_id = $3`,
    [JSON.stringify(req.body), req.params.id, req.empresaId]
  );
  res.json({ ok: true });
});

// ---------------------------------------------------------
// INVENTARIO
// ---------------------------------------------------------
app.get('/api/inventario/bodegas', requireModulo('inventario'), async (req, res) => {
  const result = await pool.query('SELECT * FROM inventario_bodegas WHERE empresa_id = $1 ORDER BY nombre', [req.empresaId]);
  res.json(result.rows);
});
app.post('/api/inventario/bodegas', requireModulo('inventario'), requireAdmin, async (req, res) => {
  const result = await pool.query(
    'INSERT INTO inventario_bodegas (empresa_id, nombre) VALUES ($1,$2) RETURNING *',
    [req.empresaId, req.body.nombre]
  );
  res.json(result.rows[0]);
});

app.get('/api/inventario/items', requireModulo('inventario'), async (req, res) => {
  const result = await pool.query(
    `SELECT i.*, b.nombre AS bodega_nombre FROM inventario_items i
     JOIN inventario_bodegas b ON b.id = i.bodega_id
     WHERE i.empresa_id = $1 ORDER BY i.nombre`,
    [req.empresaId]
  );
  res.json(result.rows);
});

app.post('/api/inventario/items', requireModulo('inventario'), async (req, res) => {
  const it = req.body;
  const result = await pool.query(
    `INSERT INTO inventario_items (empresa_id, bodega_id, nombre, stock, stock_minimo, fotos)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.empresaId, it.bodegaId, it.nombre, it.stock || 0, it.stockMinimo || 0, JSON.stringify(it.fotos || [])]
  );
  const item = result.rows[0];
  await pool.query('UPDATE inventario_items SET qr_id = $1 WHERE id = $2', [`ITEM-${item.id}`, item.id]);
  res.json({ ...item, qr_id: `ITEM-${item.id}` });
});

app.post('/api/inventario/items/:id/movimiento', requireModulo('inventario'), async (req, res) => {
  const { tipo, cantidad } = req.body;
  if (!['entrada', 'salida'].includes(tipo) || !(cantidad > 0)) {
    return res.status(400).json({ error: 'Movimiento inválido' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = (await client.query(
      'SELECT * FROM inventario_items WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [req.params.id, req.empresaId]
    )).rows[0];
    if (!item) throw new Error('Item no encontrado');

    const nuevoStock = tipo === 'entrada' ? Number(item.stock) + Number(cantidad) : Number(item.stock) - Number(cantidad);
    if (nuevoStock < 0) throw new Error('Stock insuficiente para esa salida');

    await client.query('UPDATE inventario_items SET stock = $1 WHERE id = $2', [nuevoStock, item.id]);
    await client.query(
      'INSERT INTO inventario_movimientos (empresa_id, item_id, tipo, cantidad, usuario_id) VALUES ($1,$2,$3,$4,$5)',
      [req.empresaId, item.id, tipo, cantidad, req.userId]
    );
    await client.query('COMMIT');
    res.json({ ok: true, nuevoStock });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------
// TIENDA EN LÍNEA — módulo opcional vendible aparte
// ---------------------------------------------------------
app.get('/api/tienda/productos', requireModulo('tienda'), async (req, res) => {
  const result = await pool.query('SELECT * FROM tienda_productos WHERE empresa_id = $1 ORDER BY nombre', [req.empresaId]);
  res.json(result.rows);
});

app.post('/api/tienda/productos', requireModulo('tienda'), requireAdmin, async (req, res) => {
  const p = req.body;
  const result = await pool.query(
    `INSERT INTO tienda_productos (empresa_id, inventario_item_id, nombre, descripcion, precio, fotos, stock_visible)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.empresaId, p.inventarioItemId || null, p.nombre, p.descripcion, p.precio, JSON.stringify(p.fotos || []), p.stockVisible || 0]
  );
  res.json(result.rows[0]);
});

app.patch('/api/tienda/productos/:id', requireModulo('tienda'), requireAdmin, async (req, res) => {
  const p = req.body;
  await pool.query(
    `UPDATE tienda_productos SET nombre=$1, descripcion=$2, precio=$3, fotos=$4, stock_visible=$5, activo=$6
     WHERE id = $7 AND empresa_id = $8`,
    [p.nombre, p.descripcion, p.precio, JSON.stringify(p.fotos || []), p.stockVisible, p.activo, req.params.id, req.empresaId]
  );
  res.json({ ok: true });
});

app.get('/api/tienda/pedidos', requireModulo('tienda'), async (req, res) => {
  const result = await pool.query(
    `SELECT ped.*, COALESCE(json_agg(json_build_object(
        'productoId', it.producto_id, 'cantidad', it.cantidad, 'precioUnitario', it.precio_unitario
      )) FILTER (WHERE it.id IS NOT NULL), '[]') AS items
     FROM tienda_pedidos ped
     LEFT JOIN tienda_pedido_items it ON it.pedido_id = ped.id
     WHERE ped.empresa_id = $1 GROUP BY ped.id ORDER BY ped.creado_en DESC`,
    [req.empresaId]
  );
  res.json(result.rows);
});

app.patch('/api/tienda/pedidos/:id', requireModulo('tienda'), requireAdmin, async (req, res) => {
  await pool.query(
    'UPDATE tienda_pedidos SET estado = $1 WHERE id = $2 AND empresa_id = $3',
    [req.body.estado, req.params.id, req.empresaId]
  );
  res.json({ ok: true });
});

// ---- Lado PÚBLICO — sin login, catálogo de tu única empresa ----
app.get('/api/public/tienda', limitePublico, async (req, res) => {
  const empresa = (await pool.query(
    'SELECT id, nombre, config_tienda FROM empresas ORDER BY id LIMIT 1'
  )).rows[0];
  if (!empresa) return res.status(404).json({ error: 'Empresa no configurada' });
  const productos = await pool.query(
    'SELECT id, nombre, descripcion, precio, fotos FROM tienda_productos WHERE empresa_id = $1 AND activo = true ORDER BY nombre',
    [empresa.id]
  );
  const cfg = empresa.config_tienda || {};
  res.json({
    nombre: empresa.nombre,
    productos: productos.rows,
    color: cfg.color, imgEstilo: cfg.imgEstilo, tamanoTarjeta: cfg.tamanoTarjeta,
    logo: cfg.logo, banner: cfg.banner, galeria: cfg.galeria,
    telefono: cfg.telefono, whatsapp: cfg.whatsapp,
    facebook: cfg.facebook, instagram: cfg.instagram,
    secciones: cfg.secciones, testimonios: cfg.testimonios,
  });
});

// La propia empresa edita la configuración visual/de contacto de su tienda pública
app.patch('/api/tienda/config', requireModulo('tienda'), requireAdmin, async (req, res) => {
  await pool.query('UPDATE empresas SET config_tienda = $1 WHERE id = $2', [JSON.stringify(req.body), req.empresaId]);
  res.json({ ok: true });
});
app.get('/api/tienda/config', requireModulo('tienda'), async (req, res) => {
  const result = await pool.query('SELECT config_tienda FROM empresas WHERE id = $1', [req.empresaId]);
  res.json(result.rows[0]?.config_tienda || {});
});

app.post('/api/public/pedidos', limitePublico, async (req, res) => {
  const empresa = (await pool.query('SELECT id FROM empresas ORDER BY id LIMIT 1')).rows[0];
  if (!empresa) return res.status(404).json({ error: 'Empresa no configurada' });

  const { clienteNombre, clienteCorreo, clienteTelefono, items } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'El pedido no tiene productos' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total = 0;
    const detallesGuardados = [];
    for (const it of items) {
      const producto = (await client.query(
        'SELECT * FROM tienda_productos WHERE id = $1 AND empresa_id = $2 AND activo = true',
        [it.productoId, empresa.id]
      )).rows[0];
      if (!producto) throw new Error(`Producto ${it.productoId} no disponible`);
      total += Number(producto.precio) * Number(it.cantidad);
      detallesGuardados.push({ productoId: producto.id, cantidad: it.cantidad, precio: producto.precio });
    }
    const pedido = (await client.query(
      `INSERT INTO tienda_pedidos (empresa_id, cliente_nombre, cliente_correo, cliente_telefono, total)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [empresa.id, clienteNombre, clienteCorreo, clienteTelefono, total]
    )).rows[0];
    for (const d of detallesGuardados) {
      await client.query(
        'INSERT INTO tienda_pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES ($1,$2,$3,$4)',
        [pedido.id, d.productoId, d.cantidad, d.precio]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, pedidoId: pedido.id, total });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Prevenglobal backend corriendo en puerto ${PORT}`));





