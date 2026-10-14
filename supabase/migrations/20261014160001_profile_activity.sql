-- Generated from supabase/profile-activity.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — what a public profile shows of somebody's time on PLACER.
--
-- A profile's page (/people/<id>) says when the account joined and lists the projects
-- it is involved in. Neither was public: profiles are owner-only past what
-- profile_public() returns, and the collaborator roster is readable only by the
-- project's own people. profile_public_activity() answers both for one account:
--
--   joined_at  the day the profile was made;
--   projects   every project it owns or collaborates on that the caller may see
--              (project_can_view, project-privacy.sql) — so a private project shows
--              only to those already let into it — newest first, each with its
--              role: 'owner' or 'collaborator'.
--
-- Its comments need nothing new: project_comments is readable wherever its project
-- is (project-public-page.sql), so the page asks for them by author directly.
--
-- Null for an account that does not exist. Run this once in the Supabase SQL editor,
-- after project-privacy.sql and media-photos.sql. It is safe to re-run.

create or replace function public.profile_public_activity(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_joined timestamptz;
begin
  select pr.created_at into v_joined from public.profiles pr where pr.id = p_user_id;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'joined_at', v_joined,
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'name', p.name,
               'summary', p.summary,
               'description', p.description,
               'image_path', p.image_path,
               'start_date', p.start_date,
               'end_date', p.end_date,
               'role', case when p.owner_id = p_user_id then 'owner' else 'collaborator' end)
             order by p.created_at desc)
        from public.projects p
       where (p.owner_id = p_user_id
              or exists (select 1 from public.project_collaborators c
                          where c.project_id = p.id and c.user_id = p_user_id))
         and public.project_can_view(p.id)), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.profile_public_activity(uuid) from public;
grant execute on function public.profile_public_activity(uuid) to anon, authenticated;


-- Verify:
--   select public.profile_public_activity((select id from public.profiles limit 1));
