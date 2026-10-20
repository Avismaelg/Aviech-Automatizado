# Cambios de la fase 2 (20-oct-2026)

Resumen de los pendientes accionables de `ESTADO-ACTUAL.md` y `FACTURACION.md`
completados en la copia `Aviech-Automatizado`.

## Completado

### Inicio
- Tarjetas de actividades atrasadas y pagos vencidos (MIE-7, commit `4a0063d`).
- Top clientes por ingresos cobrados y gastos del mes por categoría
  (MIE-10, commit `d75658f`).

### Prospección
- Exportar los hallazgos a CSV (MIE-8, commit `3e6c51f`).
- Rastreo de hasta 5 páginas de contacto por sitio (MIE-9, commit `bfff8f7`).
- Empresas descartadas en CRM y Prospección, con aviso si ya estaba descartada
  (MIE-9, commits `bfff8f7` y `36bf817`). La UI se activa cuando existe la
  columna en la base de datos.

### Asistente IA
- Historial por usuario con RLS, carga de la última conversación, nueva
  conversación y borrado con confirmación (MIE-11, commit `31c57fd`).
  La UI muestra un aviso hasta que exista la tabla.

### Calidad
- `npm run lint` y `npm run build` en verde después de cada tarea.

## Migraciones pendientes

- `supabase/sql/009_crm_descartadas.sql`
- `supabase/sql/010_asistente_historial.sql`

El workflow «Migrar base de datos» falló en el paso «Comprobar el secreto»
porque el repositorio copia no tiene `SUPABASE_DBURL` (run `39356253597`).
Mientras tanto la app sigue funcionando: oculta las funciones nuevas y conserva
el CRM y el asistente sin historial.

## Cómo activarlas

1. Añadir el secreto `SUPABASE_DBURL` en GitHub → repo copia →
   Settings → Secrets and variables → Actions (mismo valor del repo original).
2. Ejecutar Actions → «Migrar base de datos» → Run workflow (`main`).
   O ejecutar a mano los dos archivos en Supabase → SQL Editor.
3. Recargar el panel. Aparecerán el filtro «Descartadas», el botón
   «Descartar empresa» y el historial del asistente.

## Pendientes externos (no codeables)

- Datos fiscales reales en `src/lib/empresa.ts`.
- Certificado y configuración DGII e-CF.
- Rotación/eliminación del token de Supabase.
- Confirmar el respaldo automático del lunes 26-oct.
- Servicios SEO de pago (sin presupuesto/cuentas).
