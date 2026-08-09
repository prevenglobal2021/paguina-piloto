# Guía de prueba — Prevenglobal backend (empresa única)

Esta versión es más simple que la anterior: **una sola empresa** (la tuya),
sin panel de super-admin, sin suscripciones y sin la integración con Siigo
todavía. Se agregan después, cuando confirmes que esto funciona bien.

Necesitas: una terminal y `curl` (o Postman/Insomnia si prefieres interfaz
visual — misma lógica, cambia solo la forma de escribir la petición).

---

## PARTE 1 — Levantar el entorno de prueba

1. En tu proyecto de pruebas de Railway, reemplaza los archivos del servicio
   por los de esta carpeta (`server.js`, `package.json`, `schema.sql`,
   `.env.example`).
2. En la pestaña "Variables" del servicio, define:
   ```
   DATABASE_URL   -> se autocompleta si el plugin de Postgres está en el mismo proyecto
   JWT_SECRET     -> cualquier texto largo aleatorio
   ```
3. En la pestaña "Query" de tu base de datos Postgres, pega y ejecuta todo
   el contenido de `schema.sql`. Esto crea las tablas **y ya deja creada tu
   empresa** (fila única en la tabla `empresas`, llamada "Prevenglobal" —
   puedes cambiarle el nombre después con un `UPDATE` si quieres).
4. Railway despliega automático. Anota la URL pública (`TU_URL`).

## PARTE 2 — Crear tu primer usuario admin

No hay pantalla de registro todavía (es tu única empresa, se crea el primer
usuario a mano, una sola vez):

1. Genera el hash de tu clave. Con Node instalado en tu compu:
   ```
   node -e "require('bcryptjs').hash('TU_CLAVE_SEGURA', 10).then(console.log)"
   ```
   Copia el resultado (empieza con `$2a$` o `$2b$`).
2. En la consola "Query" de Railway, inserta tu usuario (empresa_id = 1,
   porque es la única que existe):
   ```sql
   INSERT INTO usuarios (empresa_id, nombre, email, password_hash, rol)
   VALUES (1, 'Tu Nombre', 'tucorreo@ejemplo.com', 'PEGA_AQUI_EL_HASH', 'admin');
   ```

## PARTE 3 — Probar el flujo completo

### 3.1 Login (ya no pide código de empresa, solo correo y clave)
```bash
curl -X POST TU_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tucorreo@ejemplo.com","password":"TU_CLAVE_SEGURA"}'
```
Guarda el `token` que devuelve (`TOKEN`) — lo usarás en todo lo demás.

### 3.2 Crear un cliente, sede y equipo
```bash
curl -X POST TU_URL/api/clientes -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" -d '{"nombre":"Cliente de Prueba"}'
# -> CLIENTE_ID

curl -X POST TU_URL/api/sedes -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" -d '{"clienteId":CLIENTE_ID,"nombre":"Sede Principal"}'
# -> SEDE_ID

curl -X POST TU_URL/api/equipos -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clienteId":CLIENTE_ID,"sedeId":SEDE_ID,"nombre":"Nevera Vitrina 1","marca":"XYZ"}'
# -> EQUIPO_ID (revisa que la respuesta traiga qr_id: "EQ-<id>")
```

### 3.3 Crear una orden de servicio y cerrarla
```bash
curl -X POST TU_URL/api/ordenes -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"numero":"OS-0001","equipoId":EQUIPO_ID,"tipo":"Mantenimiento","fechaProgramada":"2026-08-10T09:00:00Z","horaProgramada":"09:00"}'
# -> ORDEN_ID

curl -X POST TU_URL/api/ordenes/ORDEN_ID/cerrar -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"diagnostico":"Todo en orden, se hizo limpieza general"}'
```

### 3.4 Verificar trazabilidad QR
```bash
curl TU_URL/api/equipos/EQUIPO_ID/trazabilidad -H "Authorization: Bearer TOKEN"
```

### 3.5 Inventario con movimiento de stock
```bash
curl -X POST TU_URL/api/inventario/bodegas -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" -d '{"nombre":"Bodega Central"}'
# -> BODEGA_ID

curl -X POST TU_URL/api/inventario/items -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bodegaId":BODEGA_ID,"nombre":"Compresor 1/4HP","stock":5,"stockMinimo":2}'
# -> ITEM_ID

curl -X POST TU_URL/api/inventario/items/ITEM_ID/movimiento -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" -d '{"tipo":"salida","cantidad":2}'
# debe devolver nuevoStock: 3
```

### 3.6 Tienda en línea (catálogo público, sin login, sin código de empresa)
```bash
curl -X POST TU_URL/api/tienda/productos -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Filtro de gas","precio":25000,"stockVisible":10}'

curl TU_URL/api/public/tienda

curl -X POST TU_URL/api/public/pedidos \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan Pérez","clienteCorreo":"juan@correo.com","items":[{"productoId":1,"cantidad":2}]}'
```

---

## Qué significa que todo esto pase

Si los 6 pasos de la Parte 3 responden sin error (código 200/201, sin
`"error"` en la respuesta), la base de datos, el login, el CRUD completo,
la trazabilidad QR, el inventario transaccional y la tienda están
funcionando correctamente.

## Lo que queda pendiente para después

- **Frontend**: tu HTML actual sigue en `localStorage` y no habla con esta
  API todavía — es el siguiente paso una vez confirmes que el backend pasó
  estas pruebas.
- **Multiempresa y suscripciones**: se vuelven a activar sobre esta misma
  base de datos (la estructura ya deja `empresa_id` en todas las tablas)
  cuando decidas vender la plataforma a otras empresas.
- **Facturación por Siigo**: se vuelve a integrar cuando la retomes; ya
  tienes el código de la vez anterior guardado si lo necesitas.
