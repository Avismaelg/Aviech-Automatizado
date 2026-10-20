-- AviTech Panel — Migración 009: empresas descartadas
-- Permite marcar una empresa del CRM como descartada para no volver a
-- prospectarla. La política RLS existente de `crm_empresas` ya cubre la
-- columna nueva; no se debilita ningún permiso.
--
-- Se aplica automáticamente con el workflow "Migrar base de datos" de GitHub,
-- o a mano: Supabase → SQL Editor → pegar todo → Run.
-- Es idempotente: puede ejecutarse varias veces sin romper nada.

alter table public.crm_empresas
  add column if not exists descartada boolean not null default false;

comment on column public.crm_empresas.descartada is
  'true = empresa descartada; no volver a prospectar (se puede reactivar editándola).';

create index if not exists crm_empresas_descartada_idx
  on public.crm_empresas (descartada);
