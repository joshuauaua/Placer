-- PLACER — what kind of project it is, chosen on the second step of starting one.
--
-- Three kinds, which work as templates for the rest of the setup:
--
--   steward   whoever starts it owns the space, or has decision-making power over it,
--             and wants to involve other people in what to do with it
--   advocate  they do not have that power, and want to bring people together to try
--             and create change
--   other     neither of those
--
-- Null for a project started before there was a choice to make, rather than a guess
-- at which kind it was.
--
-- Run after projects.sql. Safe to re-run.

alter table public.projects add column if not exists project_type text;

alter table public.projects drop constraint if exists projects_project_type_known;
alter table public.projects add constraint projects_project_type_known
  check (project_type is null or project_type in ('steward', 'advocate', 'other'));

-- Reading is already the whole table (projects.sql). Insert and update are granted
-- column by column, so the new column has to be named in both.
grant insert (project_type) on public.projects to authenticated;
grant update (project_type) on public.projects to authenticated;

-- Verify:
--   select project_type, count(*) from public.projects group by 1;
