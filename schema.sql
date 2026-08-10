-- =========================================================
-- PREVENGLOBAL — ESQUEMA COMPATIBLE CON EL FRONTEND REAL
-- ---------------------------------------------------------
-- Tu frontend (index.html + los 14 .js) no pide "un cliente" o
-- "una orden" por separado: pide y guarda TODO el estado de la
-- empresa de un solo golpe (GET/PUT /api/state), igual que hacia
-- tu backend viejo con el archivo data/<slug>.json.
--
-- Por eso aqui no hay tablas de clientes/equipos/ordenes por
-- separado -- hay UNA tabla "empresas" con una columna JSONB
-- (estado_app) que guarda exactamente ese mismo paquete completo,
-- pero en Postgres en vez de un archivo, asi Railway nunca lo
-- borra al redesplegar.
-- =========================================================

CREATE TABLE empresas (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  nombre         TEXT NOT NULL,
  estado_app     JSONB NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
