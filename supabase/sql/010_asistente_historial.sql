-- AviTech Panel — Migración 010: historial del Asistente IA
-- Guarda los mensajes por usuario y conversación. RLS estricta: cada usuario
-- solo puede leer, insertar y borrar sus propios mensajes.
--
-- Se aplica automáticamente con el workflow "Migrar base de datos" de GitHub,
-- o a mano: Supabase → SQL Editor → pegar todo → Run.
-- Es idempotente: puede ejecutarse varias veces sin romper nada.

create table if not exists public.asistente_mensajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversacion_id uuid not null default gen_random_uuid(),
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null check (char_length(contenido) between 1 and 12000),
  created_at timestamptz not null default now()
);

-- Compatibilidad si la tabla se creó en una versión anterior sin conversación.
alter table public.asistente_mensajes
  add column if not exists conversacion_id uuid not null default gen_random_uuid();

create index if not exists asistente_mensajes_usuario_fecha_idx
  on public.asistente_mensajes (user_id, created_at desc);

create index if not exists asistente_mensajes_conversacion_idx
  on public.asistente_mensajes (user_id, conversacion_id, created_at);

alter table public.asistente_mensajes enable row level security;

drop policy if exists asistente_mensajes_propios on public.asistente_mensajes;
create policy asistente_mensajes_propios
  on public.asistente_mensajes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
