do $$
begin
  if to_regclass('public.personas') is null then
    if to_regclass('public.listener_types') is not null then
      alter table public.listener_types rename to personas;
    elsif to_regclass('public.listener_type') is not null then
      alter table public.listener_type rename to personas;
    else
      raise exception 'Expected public.personas, public.listener_types, or public.listener_type';
    end if;
  end if;
end $$;

alter table public.personas
  add column if not exists seat_count integer not null default 5;
