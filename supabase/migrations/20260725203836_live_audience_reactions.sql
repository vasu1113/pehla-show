-- Run-level reactions are the model's actual short, grounded audience voice.
-- They stay separate from the five physical seats per persona: one persona
-- scores each beat once, then its five patience variants simulate departures.
create table public.audience_reactions (
  id uuid primary key default gen_random_uuid(),
  run_id text not null references public.runs(id),
  persona_id text not null references public.personas(id),
  beat_id integer not null,
  timestamp integer not null check (timestamp >= 0),
  delta smallint not null check (delta between -3 and 3),
  reason_code text not null,
  evidence text not null,
  reaction_line text not null check (char_length(reaction_line) between 1 and 120),
  unique (run_id, persona_id, beat_id)
);

create index audience_reactions_run_timestamp_idx
  on public.audience_reactions (run_id, timestamp);

-- Only the server's service role writes this analytics data. The browser reads
-- it through the application API, never through the public Data API.
alter table public.audience_reactions enable row level security;
