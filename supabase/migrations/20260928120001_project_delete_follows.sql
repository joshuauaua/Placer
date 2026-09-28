-- Generated from supabase/project-delete.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — tidying up after a project is deleted.
--
-- Deleting a project is owner-only ("an owner can remove a project", projects.sql),
-- and most of what hangs off one already goes with it: its collaborators, links and
-- view counts are `on delete cascade`, and the imaginations and Sandbox rooms made for
-- it are `on delete set null`, so they stay on the map as ordinary ones. The project's
-- image is removed from R2 by the client once the row is gone (deleteProject in
-- src/services/projects.js).
--
-- Follows are the one thing left behind. followed_id is an opaque string rather than
-- a foreign key (follows.sql says why), so nothing cascades, and everybody who
-- followed the project would keep a dead entry in their list. This trigger removes
-- them as the project row goes.
--
-- Security definer because follows are deletable only by their own follower under
-- RLS, and the owner deleting a project is almost never that person.
--
-- Run this once in the Supabase SQL editor, after projects.sql and follows.sql. It is
-- safe to re-run.


create or replace function public.project_delete_follows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
   where followed_type = 'project'
     and followed_id = old.id::text;
  return old;
end;
$$;

revoke all on function public.project_delete_follows() from public;

drop trigger if exists projects_delete_follows on public.projects;
create trigger projects_delete_follows
  after delete on public.projects
  for each row
  execute function public.project_delete_follows();


-- Verify, after running the above:
--
--   select tgname from pg_trigger where tgrelid = 'public.projects'::regclass
--      and tgname = 'projects_delete_follows';
