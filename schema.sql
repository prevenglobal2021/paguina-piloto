-- =========================================================
-- PREVENGLOBAL — ESQUEMA EMPRESA ÚNICA (PostgreSQL)
-- Fase actual: una sola empresa (la tuya), sin multiempresa,
-- sin planes/suscripciones ni facturación por Siigo todavía.
-- La columna empresa_id se deja en todas las tablas para que,
-- cuando quieras volver a multiempresa, no haya que migrar datos:
-- solo se vuelve a agregar la capa de negocio (planes, pagos,
-- estado, slug) sobre esta misma base.
-- =========================================================

-- ---------- EMPRESA (una sola fila en esta fase) ----------

CREATE TABLE empresas (
  id             SERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  config_tienda  JSONB NOT NULL DEFAULT '{}'::jsonb, -- color, whatsapp, facebook, instagram, testimonios, secciones, banner, galería, logo, etc.
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tu empresa. Cambia el nombre si quieres antes de cargar el esquema.
INSERT INTO empresas (nombre) VALUES ('Prevenglobal');

-- ---------- CAPA OPERATIVA ----------

CREATE TABLE usuarios (
  id             SERIAL PRIMARY KEY,
  empresa_id     INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  rol            TEXT NOT NULL DEFAULT 'tecnico' CHECK (rol IN ('admin','supervisor','tecnico')),
  activo         BOOLEAN NOT NULL DEFAULT true,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clientes (
  id             SERIAL PRIMARY KEY,
  empresa_id     INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sedes (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id   INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL
);

CREATE TABLE equipos (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id    INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  sede_id       INTEGER REFERENCES sedes(id) ON DELETE SET NULL,  -- opcional, según lo pedido antes
  nombre        TEXT NOT NULL,
  marca         TEXT, modelo TEXT, serie TEXT,
  capacidad     TEXT, voltaje TEXT, refrigerante TEXT,
  qr_id         TEXT,
  ficha_tecnica TEXT,
  fotos         JSONB NOT NULL DEFAULT '[]',
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plantillas (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  campos       JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE tecnicos (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre       TEXT NOT NULL
);

CREATE TABLE ordenes (
  id                SERIAL PRIMARY KEY,
  empresa_id        INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero            TEXT NOT NULL,
  equipo_id         INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  tecnico_id        INTEGER REFERENCES tecnicos(id) ON DELETE SET NULL,
  plantilla_id      INTEGER REFERENCES plantillas(id) ON DELETE SET NULL,
  tipo              TEXT,
  estado            TEXT NOT NULL DEFAULT 'Programado',
  fecha_programada  TIMESTAMPTZ,
  hora_programada   TEXT,
  cierre            JSONB,                     -- diagnóstico, fotos, firma, etc.
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventario_bodegas (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL
);

CREATE TABLE inventario_items (
  id             SERIAL PRIMARY KEY,
  empresa_id     INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  bodega_id      INTEGER NOT NULL REFERENCES inventario_bodegas(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  stock          NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_minimo   NUMERIC(12,2) NOT NULL DEFAULT 0,
  fotos          JSONB NOT NULL DEFAULT '[]',
  qr_id          TEXT
);

CREATE TABLE inventario_movimientos (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES inventario_items(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('entrada','salida')),
  cantidad     NUMERIC(12,2) NOT NULL,
  usuario_id   INTEGER REFERENCES usuarios(id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id   INTEGER REFERENCES usuarios(id),
  accion       TEXT NOT NULL,       -- 'crear','editar','eliminar'
  entidad      TEXT NOT NULL,       -- 'orden','equipo','cliente', etc.
  entidad_id   INTEGER,
  detalle      JSONB,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- MÓDULO OPCIONAL: TIENDA EN LÍNEA (plus vendible aparte) ----------

CREATE TABLE tienda_productos (
  id              SERIAL PRIMARY KEY,
  empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  inventario_item_id INTEGER REFERENCES inventario_items(id) ON DELETE SET NULL, -- opcional: ligar a inventario
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  precio          NUMERIC(12,2) NOT NULL,
  fotos           JSONB NOT NULL DEFAULT '[]',
  stock_visible   NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tienda_pedidos (
  id              SERIAL PRIMARY KEY,
  empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_nombre  TEXT NOT NULL,
  cliente_correo  TEXT,
  cliente_telefono TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','pagado','en_proceso','enviado','cancelado')),
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  referencia_pago TEXT,        -- id de transacción de la pasarela de pago
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tienda_pedido_items (
  id              SERIAL PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES tienda_pedidos(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES tienda_productos(id),
  cantidad        NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL
);

-- ---------- Índices clave para rendimiento con varias empresas ----------
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_sedes_empresa ON sedes(empresa_id);
CREATE INDEX idx_equipos_empresa ON equipos(empresa_id);
CREATE INDEX idx_equipos_cliente ON equipos(cliente_id);
CREATE INDEX idx_ordenes_empresa ON ordenes(empresa_id);
CREATE INDEX idx_ordenes_equipo ON ordenes(equipo_id);
CREATE INDEX idx_inventario_items_empresa ON inventario_items(empresa_id);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_tienda_productos_empresa ON tienda_productos(empresa_id);
CREATE INDEX idx_tienda_pedidos_empresa ON tienda_pedidos(empresa_id);
CREATE INDEX idx_tienda_pedido_items_pedido ON tienda_pedido_items(pedido_id);
