# Backups automáticos — Prevenglobal

Se configuró un backup diario automático que **no depende del almacenamiento
de Railway** (que es temporal en el contenedor de la app) — corre en GitHub
Actions y descarga un `.sql` completo de tu base de datos cada día.

## Activarlo (una sola vez)

1. En tu repositorio de GitHub, ve a **Settings → Secrets and variables → Actions**.
2. Crea un secreto llamado `DATABASE_URL` con la URL de conexión de tu base
   de datos de Railway (la misma que usas en `.env`, la encuentras en
   Railway → servicio Postgres → pestaña "Connect").
3. Listo. El workflow `.github/workflows/backup-postgres.yml` correrá
   automáticamente todos los días a las 3:00 a.m. hora Colombia.

## Cómo descargar un backup

1. En GitHub, ve a la pestaña **Actions** de tu repositorio.
2. Entra a "Backup diario de PostgreSQL (Prevenglobal)".
3. Elige la ejecución del día que necesitas → al final de la página hay un
   artefacto descargable ("backup-prevenglobal") con el archivo `.sql`.
4. Los backups se conservan 30 días automáticamente.

## Cómo restaurar un backup (en caso de emergencia)

```bash
psql "TU_DATABASE_URL" < prevenglobal-backup-2026-08-02_08-00.sql
```

⚠️ Esto sobreescribe los datos existentes — solo úsalo si de verdad
necesitas volver a un punto anterior.

## También puedes correrlo manualmente

En GitHub → Actions → "Backup diario de PostgreSQL" → botón "Run workflow",
para generar un backup al instante sin esperar al horario programado
(útil justo antes de un cambio grande de esquema).
