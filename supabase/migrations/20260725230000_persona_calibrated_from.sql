-- calibrated_from is the number of real abandonment statements behind a
-- persona - a property of the library entry, not of one spawned individual.
-- The personas/audience split moved it to audience, which left the library
-- unable to carry its own grounding claim. The UI surfaces this number next
-- to the persona, so it lives with the persona.
alter table public.personas
  add column if not exists calibrated_from integer not null default 0;
