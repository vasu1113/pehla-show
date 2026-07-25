alter table public.runs drop constraint if exists runs_script_id_fkey;
alter table public.runs
  add constraint runs_script_id_fkey
  foreign key (script_id) references public.scripts(id);

alter table public.runs drop constraint if exists runs_parent_run_id_fkey;
alter table public.runs
  add constraint runs_parent_run_id_fkey
  foreign key (parent_run_id) references public.runs(id);

alter table public.film_frames drop constraint if exists film_frames_script_id_fkey;
alter table public.film_frames
  add constraint film_frames_script_id_fkey
  foreign key (script_id) references public.scripts(id);

alter table public.audience drop constraint if exists audience_persona_id_fkey;
alter table public.audience
  add constraint audience_persona_id_fkey
  foreign key (persona_id) references public.personas(id);
