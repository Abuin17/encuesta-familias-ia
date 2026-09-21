-- Encuesta a familias: IA y adolescentes
-- Ejecutar una vez en el editor SQL de Supabase (proyecto en region eu-central-1, Frankfurt).
-- Principio: anonimato total. Ninguna tabla guarda IP, agente de usuario, fecha u hora exactas
-- ni datos de contacto.

create extension if not exists pgcrypto;

-- Respuestas. Sin created_at a proposito: solo la semana de campo.
create table if not exists respuestas (
  id          uuid primary key default gen_random_uuid(),
  canal       smallint not null check (canal in (1, 2)),        -- 1 EXAMIA, 2 redes
  semana      smallint not null check (semana between 1 and 52),
  orden_cd    smallint not null check (orden_cd in (1, 2)),     -- 1: C antes que D, 2: D antes que C
  filtrada    boolean  not null default false,                  -- supero el bloque A y la cuota
  completa    boolean  not null default false,
  duracion    integer  check (duracion is null or duracion between 0 and 86400),
  datos       jsonb    not null default '{}'::jsonb             -- respuestas por bloque: {"A": {...}, "B": {...}}
);

-- Codigos de un solo uso para el canal EXAMIA. Solo el hash; nunca se relaciona con una respuesta.
create table if not exists codigos (
  hash   text primary key,
  canal  smallint not null default 1,
  usado  boolean  not null default false
);

-- Cuotas maximas por perfil. Cuando actual >= objetivo, ese perfil deja de entrar.
create table if not exists cuotas (
  dimension  text    not null,
  categoria  text    not null,
  objetivo   integer not null check (objetivo >= 0),
  actual     integer not null default 0,
  primary key (dimension, categoria)
);

-- Contadores agregados sin datos individuales (no aptos, cuota llena).
create table if not exists contadores (
  clave  text primary key,
  n      integer not null default 0
);

-- Seguridad: RLS activada y ninguna politica. La API publica de Supabase no puede leer ni escribir.
-- La aplicacion entra con la cadena de conexion del servidor (rol postgres), que no pasa por RLS.
alter table respuestas enable row level security;
alter table codigos    enable row level security;
alter table cuotas     enable row level security;
alter table contadores enable row level security;

revoke all on respuestas, codigos, cuotas, contadores from anon, authenticated;

-- Cuotas iniciales para 1.200 respuestas brutas. Son techos, no objetivos minimos:
-- el total de cada dimension supera 1.200 para no cerrar el campo antes de tiempo.
-- Ajustables en cualquier momento desde el editor de tablas.
insert into cuotas (dimension, categoria, objetivo) values
  ('A3', '8-12',   500),
  ('A3', '13-15',  450),
  ('A3', '16-17',  350),
  ('A4', 'chico',  700),
  ('A4', 'chica',  700),
  ('A8', 'madre',  840),
  ('A7', 'madrid', 480),
  ('A7', 'andalucia', 480),
  ('A7', 'cataluna',  480),
  ('A7', 'valencia',  480),
  ('A7', 'norte',     480),
  ('A7', 'resto',     480),
  ('canal', '1', 800),
  ('canal', '2', 600)
on conflict do nothing;

insert into contadores (clave) values ('no_apto'), ('cuota_llena'), ('sin_consentimiento')
on conflict do nothing;
