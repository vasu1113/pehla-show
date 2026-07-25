-- audience.calibrated_from is dead.
--
-- It arrived when `audience` still doubled as the persona table. Since the
-- split, calibrated_from is a property of the PERSONA (how many real
-- abandonment statements the brief was mined from) and lives on
-- public.personas. A spawned seat inherits nothing from it — a row in
-- `audience` is one simulated listener in one run, not a library entry.
--
-- Nothing writes it: store_supabase.py never sets it, and the frontend reads
-- calibrated_from only off /personas. Leaving it in place invites someone to
-- read a per-seat 0 as "this listener is ungrounded" when the grounding count
-- is one table over.

alter table public.audience drop column if exists calibrated_from;
