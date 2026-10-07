-- Generated from supabase/project-summary.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — a project's description, asked for above its goals when it is set up.
--
-- `description` has always held the goals (projects.sql section 1): what the project
-- is trying to find out or bring about. `summary` is the plain account of what the
-- project is, the line a card or a map preview shows of it. It is a column of its own
-- rather than a rename of `description`, so no project already set up has its goals
-- moved or relabelled. Empty for those, and for anyone who leaves it blank.
--
-- Run after projects.sql. Safe to re-run.

alter table public.projects add column if not exists summary text not null default '';

alter table public.projects drop constraint if exists projects_summary_size;
alter table public.projects add constraint projects_summary_size
  check (length(summary) <= 1000);

-- Reading is already the whole table (projects.sql). Insert and update are granted
-- column by column, so the new column has to be named in both.
grant insert (summary) on public.projects to authenticated;
grant update (summary) on public.projects to authenticated;

-- Verify:
--   select count(*) filter (where summary <> '') as described, count(*) from public.projects;
