create table if not exists public.audience (
  id uuid primary key default gen_random_uuid(),
  persona_id text not null unique references public.personas(id) on delete cascade,
  start_patience double precision not null,
  seat_count integer not null default 5,
  sensitivity jsonb not null,
  replenish jsonb not null,
  calibrated_from integer default 0
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'personas'
      and column_name = 'start_patience'
  ) then
    insert into public.audience (
      persona_id,
      start_patience,
      seat_count,
      sensitivity,
      replenish,
      calibrated_from
    )
    select
      id,
      start_patience,
      seat_count,
      sensitivity,
      replenish,
      calibrated_from
    from public.personas
    on conflict (persona_id) do update set
      start_patience = excluded.start_patience,
      seat_count = excluded.seat_count,
      sensitivity = excluded.sensitivity,
      replenish = excluded.replenish,
      calibrated_from = excluded.calibrated_from;
  end if;
end $$;

update public.personas set context = '' where context is null;
alter table public.personas alter column context set not null;
alter table public.personas drop column if exists start_patience;
alter table public.personas drop column if exists seat_count;
alter table public.personas drop column if exists sensitivity;
alter table public.personas drop column if exists replenish;
alter table public.personas drop column if exists calibrated_from;
