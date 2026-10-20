-- Generated from supabase/project-workshop-room.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — a project's Workshop Room: tools kept apart from its page.
--
-- A project's public page has had one place for its tools: the Project tab. Some are
-- for a workshop instead — run with a group in the room rather than left up for
-- anybody passing — and now have a tab of their own, the Workshop Room, shown the
-- same way. Which one a tool is in is chosen for the tool, not for each of its rooms:
-- all of a Poll's rooms go where the Poll is.
--
--   project_tools.placement   'page' (the Project tab, as before) or 'workshop'
--
-- Every tool a project already has stays on its page. The same owner and
-- collaborators who add a tool and set it up (project-setup.sql,
-- project-tool-config.sql) choose and change where it goes.
--
-- Run this once in the Supabase SQL editor after project-tool-config.sql. It is
-- written to be safe to re-run.

alter table public.project_tools add column if not exists placement text not null default 'page';

alter table public.project_tools drop constraint if exists project_tools_placement_shape;
alter table public.project_tools add constraint project_tools_placement_shape
  check (placement in ('page', 'workshop'));

grant insert (placement) on public.project_tools to authenticated;
grant update (placement) on public.project_tools to authenticated;


-- Verify:
--   select tool, placement from public.project_tools limit 5;
