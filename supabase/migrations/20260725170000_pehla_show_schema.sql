create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  title text,
  raw_text text not null,
  content_hash text not null unique,
  word_count integer,
  is_demo_asset boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.runs (
  id text primary key check (id ~ '^run_[0-9a-f]{6}$'),
  script_id uuid not null references public.scripts(id) on delete cascade,
  parent_run_id text references public.runs(id) on delete set null,
  variant text not null default 'original' check (variant in ('original', 'fixed')),
  status text not null default 'analysing' check (status in ('analysing', 'ready', 'error')),
  result_json jsonb,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index runs_script_variant_pinned_idx
  on public.runs (script_id, variant, is_pinned);

create table public.beat_cache (
  content_hash text primary key,
  beats jsonb not null,
  created_at timestamptz not null default now()
);

create table public.personas (
  id text primary key,
  label text not null,
  context text,
  start_patience double precision not null,
  seat_count integer not null default 5,
  sensitivity jsonb not null,
  replenish jsonb not null,
  calibrated_from integer default 0
);

create table public.film_frames (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  beat_id integer not null,
  storage_path text not null,
  prompt text,
  created_at timestamptz not null default now(),
  unique (script_id, beat_id)
);

create table public.validation (
  id uuid primary key default gen_random_uuid(),
  source_title text not null,
  observed jsonb not null,
  predicted jsonb not null,
  rank_actual integer,
  rank_predicted integer,
  cliff_match boolean,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('film-frames', 'film-frames', false), ('audio', 'audio', false)
on conflict (id) do update set public = excluded.public;
