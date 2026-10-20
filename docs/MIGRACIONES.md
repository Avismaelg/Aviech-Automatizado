# Migraciones de la base de datos

Los cambios de estructura de la base (nuevas tablas, columnas, políticas) viven
como archivos SQL numerados en **`supabase/sql/`** (001, 002, …). Son idempotentes:
se pueden ejecutar varias veces sin romper nada.

## Cómo se aplican (automático)

1. Se agrega un archivo nuevo `supabase/sql/00X_algo.sql` y se sube (`git push`).
2. GitHub ejecuta el workflow **“Migrar base de datos”** automáticamente:
   - aplica **todos** los archivos `supabase/sql/*.sql` en orden,
   - verifica la base (tablas, columnas, conteos, una prueba de inserciones que
     se revierte y una simulación de permisos RLS),
   - guarda el resultado en **`supabase/verificacion-ultima.txt`** y lo sube al repo.

También se puede lanzar a mano: GitHub → pestaña **Actions** →
**Migrar base de datos** → **Run workflow**.

## Requisito (una sola vez)

El repositorio necesita el secreto **`SUPABASE_DBURL`** con la cadena de conexión
al *pooler* (puerto 5432). Ya quedó configurado; si algún día hay que cambiarlo:
GitHub → Settings → Secrets and variables → Actions → New repository secret.

## A mano (alternativa)

Supabase → SQL Editor → pegar el contenido del archivo → Run.
El orden importa: primero 001, luego 002, etc.

## Historial

| Archivo | Contenido |
|---|---|
| `001_clientes.sql` | Tabla `clientes` + políticas RLS |
| `002_servicios_pagos.sql` | Tabla `servicios`, tabla `pagos`, campos `empresa` y `estado` en clientes |
| `003_rnc_clientes.sql` | Columna `rnc` en clientes (RNC dominicano, República Dominicana) |
| `004_gastos.sql` | Tabla `gastos` (regla del dinero ×3) + políticas RLS |
| `005_facturas.sql` | Tablas `facturas` (NCF/e-NCF, ITBIS, estados, pago vinculado) y `factura_items` (líneas) + políticas RLS |
| `006_igualas.sql` | Tabla `igualas` (contratos mensuales) + políticas RLS |
| `007_crm.sql` | Tablas del CRM: empresas, contactos, oportunidades y actividades + políticas RLS |
| `008_seo.sql` | Historial de auditorías SEO + políticas RLS |
| `009_crm_descartadas.sql` | Columna `descartada` en `crm_empresas` para no volver a prospectar |
| `010_asistente_historial.sql` | Tabla `asistente_mensajes` con historial por usuario y RLS estricta |

> **Nota (20-oct-2026):** en la copia `Aviech-Automatizado` el secreto
> `SUPABASE_DBURL` todavía no está configurado. Las migraciones 009 y 010 están
> escritas y fusionadas, pero pendientes de aplicar. Pasos en
> `docs/CAMBIOS-FASE-2.md`.
