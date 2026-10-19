-- Generated from supabase/project-subtitle.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — a project's subtitle, the line under its name at the top of its page.
--
-- It was the description (`summary`, project-summary.sql), which the page also shows
-- in full under About the project, so the same words were on it twice. `subtitle` is a
-- line of its own, set in the project's setup next to its name. Empty for every
-- project until somebody writes one, and an empty one shows nothing.
--
-- Run after projects.sql. Safe to re-run.

alter table public.projects add column if not exists subtitle text not null default '';

alter table public.projects drop constraint if exists projects_subtitle_size;
alter table public.projects add constraint projects_subtitle_size
  check (length(subtitle) <= 200);

-- Reading is already the whole table (projects.sql). Insert and update are granted
-- column by column, so the new column has to be named in both.
grant insert (subtitle) on public.projects to authenticated;
grant update (subtitle) on public.projects to authenticated;

-- Verify:
--   select count(*) filter (where subtitle <> '') as with_subtitle, count(*) from public.projects;
