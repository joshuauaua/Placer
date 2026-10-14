-- Generated from supabase/project-posts-as-organisation.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — posting a project's update or comment as its organisation.
--
-- A project run for an organisation has organisers who may speak for it: its owner
-- and the organisation's admins (project_is_organiser, project-public-page.sql). When
-- one of them posts an update or a comment they choose whether it goes out under the
-- organisation's name or their own.
--
-- organisation_id on a post is that choice: null for their own name, the project's
-- organisation for its. The author trigger checks it — it must be this project's
-- organisation, and the poster one of its organisers — and names the post after the
-- organisation instead of the person. author_id is still the person, so they can
-- remove it as before, and the database knows who wrote it.
--
-- Run this once in the Supabase SQL editor, after project-public-page.sql. It is safe
-- to re-run.

alter table public.project_updates
  add column if not exists organisation_id uuid references public.organisations (id) on delete set null;
alter table public.project_comments
  add column if not exists organisation_id uuid references public.organisations (id) on delete set null;

create or replace function public.project_post_set_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();

  if new.organisation_id is not null then
    if new.organisation_id is distinct from
         (select p.organisation_id from public.projects p where p.id = new.project_id)
       or not public.project_is_organiser(new.project_id) then
      raise exception 'only the project''s organisers may post as its organisation';
    end if;
    new.author_name := coalesce(
      (select o.name from public.organisations o where o.id = new.organisation_id), '');
  else
    new.author_name := coalesce(
      (select p.display_name from public.profiles p where p.id = auth.uid()), '');
  end if;

  return new;
end;
$$;

revoke all on function public.project_post_set_author() from public;

grant insert (organisation_id) on public.project_updates to authenticated;
grant insert (organisation_id) on public.project_comments to authenticated;


-- Verify:
--   select column_name from information_schema.columns
--    where table_name in ('project_updates', 'project_comments') and column_name = 'organisation_id';
