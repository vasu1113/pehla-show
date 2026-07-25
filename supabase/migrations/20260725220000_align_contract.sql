-- Track A identifiers are strings, so UUID columns must preserve their values as text.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and data_type = 'uuid'
      and (table_name, column_name) in (('scripts', 'id'), ('runs', 'id'),
        ('runs', 'script_id'), ('runs', 'parent_run_id'), ('film_frames', 'script_id'))
  ) then
    alter table public.runs drop constraint if exists runs_script_id_fkey;
    alter table public.runs drop constraint if exists runs_parent_run_id_fkey;
    alter table public.film_frames drop constraint if exists film_frames_script_id_fkey;
    if exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'scripts' and column_name = 'id' and data_type = 'uuid') then
      alter table public.scripts alter column id drop default;
      alter table public.scripts alter column id type text using id::text;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'runs' and column_name = 'id' and data_type = 'uuid') then
      alter table public.runs alter column id drop default;
      alter table public.runs alter column id type text using id::text;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'runs' and column_name = 'script_id' and data_type = 'uuid') then
      alter table public.runs alter column script_id type text using script_id::text;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'runs' and column_name = 'parent_run_id' and data_type = 'uuid') then
      alter table public.runs alter column parent_run_id type text using parent_run_id::text;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'film_frames' and column_name = 'script_id' and data_type = 'uuid') then
      alter table public.film_frames alter column script_id type text using script_id::text;
    end if;
    alter table public.runs add constraint runs_script_id_fkey
      foreign key (script_id) references public.scripts(id);
    alter table public.runs add constraint runs_parent_run_id_fkey
      foreign key (parent_run_id) references public.runs(id);
    alter table public.film_frames add constraint film_frames_script_id_fkey
      foreign key (script_id) references public.scripts(id);
  end if;
end $$;

-- Pinned Track A run IDs contain underscores and must pass the canonical check.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.runs'::regclass
      and conname = 'runs_id_format'
      and contype = 'c'
      and convalidated
      and position('^run_[0-9a-z_]+$' in pg_get_constraintdef(oid)) > 0
  ) then
    alter table public.runs drop constraint if exists runs_id_format;
    alter table public.runs drop constraint if exists runs_id_check;
    alter table public.runs add constraint runs_id_format
      check (id ~ '^run_[0-9a-z_]+$');
  end if;
end $$;

-- result_json is the sole authority for warnings, preventing two stores from drifting.
alter table public.runs drop column if exists warnings;

-- Personas are reusable prompt briefs, with library metadata retained across upgrades.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'personas' and column_name = 'context'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'personas' and column_name = 'prompt'
  ) then
    alter table public.personas rename column context to prompt;
  end if;
end $$;

alter table public.personas
  add column if not exists persona_type text,
  add column if not exists updated_at timestamptz not null default now();

-- Audience rows are individual screened people, so personas may repeat across seats.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attname = 'persona_id'
    where c.conrelid = 'public.audience'::regclass
      and c.contype = 'u'
      and cardinality(c.conkey) = 1
      and c.conkey[1] = a.attnum
  loop
    execute format('alter table public.audience drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.audience drop column if exists seat_count;

alter table public.audience
  add column if not exists run_id text references public.runs(id),
  add column if not exists seat integer check (seat between 0 and 29),
  add column if not exists name text,
  add column if not exists variant_index integer check (variant_index between 0 and 4),
  add column if not exists left_at_sec integer,
  add column if not exists left_at_beat integer,
  add column if not exists reason_code text,
  add column if not exists reason_label text,
  add column if not exists evidence text,
  add column if not exists patience_trace jsonb;

create index if not exists audience_run_id_seat_idx
  on public.audience (run_id, seat);
