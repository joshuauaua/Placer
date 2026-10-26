-- PLACER — retiring posted imaginations.
--
-- An imagination was what the Idea Visualizer made on its own, posted straight to the
-- community map: a row in public.imaginations, with votes and comments of its own. The
-- tool is now one Toolkit tool among the rest, and like the rest, what it makes on its
-- own is kept on its maker's profile as an inquiry (profile-inquiries.sql), private to
-- them. Publishing an inquiry to the map is to come, and will not be these tables.
--
-- So this:
--
--   1. copies every imagination into its owner's inquiries, as an Idea Visualizer one,
--      in the shape the app saves today (ideaInquiryConfig in src/lib/ideaVisualizer.js).
--      The preview stays where it is in the media bucket; the inquiry keeps its key.
--   2. forgets every follow of an imagination, and every notification about one.
--   3. takes imaginations out of a project's numbers: project_public_summary's
--      interactions, and project_stats, which returned their count and upvotes.
--   4. drops imaginations, imagination_votes and imagination_comments, and the
--      functions only they used.
--
-- Push this only once no deployed app reads those tables: the frontend that stopped
-- writing them (Idea Visualizer saves to the profile) and stopped reading them (no
-- imaginations on the map, the dashboard or a project's page) has to be live first.
--
-- Run after every other file in this directory. Safe to re-run: step 1 only runs
-- while the table is there, and skips an imagination already copied.

-- 1. Into their owners' inquiries.
do $$
begin
  if to_regclass('public.imaginations') is null then
    return;
  end if;

  insert into public.profile_inquiries (owner_id, tool, title, note, config, created_at)
  select
    i.user_id,
    'reimagine-a-space',
    left(trim(i.title), 120),
    left(coalesce(i.blurb, ''), 1000),
    jsonb_build_object(
      'category',     i.category,
      'loc',          i.loc,
      'position',     case when i.lat is not null and i.lng is not null
                           then jsonb_build_object('lat', i.lat, 'lng', i.lng) end,
      'source',       i.source,
      'pov',          i.pov,
      'fov',          i.fov,
      'canvasAssets', i.canvas_assets,
      'projectId',    i.project_id,
      'preview',      i.preview_path,
      -- Where it came from, which is also what makes this step safe to repeat.
      'imaginationId', i.id
    ),
    i.created_at
  from public.imaginations i
  where not exists (
    select 1 from public.profile_inquiries q
     where q.tool = 'reimagine-a-space' and q.config->>'imaginationId' = i.id::text
  );
end;
$$;


-- 2. Follows and notifications that point at an imagination.
delete from public.follows where followed_type = 'imagination';

alter table public.follows drop constraint if exists follows_type_known;
alter table public.follows add constraint follows_type_known
  check (followed_type in ('user', 'project', 'city', 'organisation'));

delete from public.notifications where link_type = 'imagination';

alter table public.notifications drop constraint if exists notifications_link_type_known;
alter table public.notifications add constraint notifications_link_type_known
  check (link_type is null or link_type in ('project', 'organisation'));


-- 3. A project's numbers, without imaginations.
--
-- As migration 20261020100001_project_updates_collaborators left it, less the imaginations in
-- `interactions`: what has been contributed to its rooms, and its comments.
create or replace function public.project_public_summary(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.project_can_view(p_project_id) then
    return null;
  end if;

  select p.owner_id into v_owner from public.projects p where p.id = p_project_id;

  return jsonb_build_object(
    'views', (select coalesce(sum(d.views), 0)::int
                from public.project_view_days d where d.project_id = p_project_id),
    'followers', (select count(*)::int from public.follows f
                   where f.followed_type = 'project' and f.followed_id = p_project_id::text),
    'interactions',
      (select count(*)::int from public.toolkit_contributions c
         join public.toolkit_rooms r on r.id = c.room_id
        where r.project_id = p_project_id)
      + (select count(*)::int from public.project_comments m where m.project_id = p_project_id),
    'owner', (
      select jsonb_build_object(
        'id', pr.id,
        'name', pr.display_name,
        'bio', pr.bio,
        'location', pr.location,
        'avatar_path', pr.avatar_path,
        'joined_at', pr.created_at,
        'projects', (select count(*)::int from public.projects o
                      where o.owner_id = pr.id and o.visibility = 'public'))
        from public.profiles pr where pr.id = v_owner),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.user_id,
               'name', coalesce(pr.display_name, c.display_name, 'Collaborator'),
               'avatar_path', pr.avatar_path)
             order by c.created_at)
        from public.project_collaborators c
        left join public.profiles pr on pr.id = c.user_id
       where c.project_id = p_project_id), '[]'::jsonb),
    'can_post_update', public.project_can_edit(p_project_id) or public.project_is_organiser(p_project_id),
    'can_post_as_organisation', public.project_is_organiser(p_project_id)
  );
end;
$$;

revoke all on function public.project_public_summary(uuid) from public;
grant execute on function public.project_public_summary(uuid) to anon, authenticated;

-- What it returns changes, so it has to be dropped rather than replaced. As
-- migration 20261002090001_toolkit_rename left it, less the two imagination columns.
drop function if exists public.project_stats(uuid);
create function public.project_stats(p_project_id uuid)
returns table (
  toolkit_rooms_count integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_collaborators c
          where c.project_id = p.id and c.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'only a project''s owner or collaborators may read its dashboard';
  end if;

  return query
    select (select count(*)::int from public.toolkit_rooms r where r.project_id = p_project_id);
end;
$$;

revoke all on function public.project_stats(uuid) from public;
grant execute on function public.project_stats(uuid) to authenticated;


-- 4. The tables, and what only they used. Their policies and triggers go with them.
-- Not `cascade`: anything else still depending on them should stop this, not be
-- dropped along with it.
drop table if exists public.imagination_votes;
drop table if exists public.imagination_comments;
drop table if exists public.imaginations;

drop function if exists public.imagination_vote(uuid, text);
drop function if exists public.imagination_touch_updated_at();
drop function if exists public.notifications_on_comment();
drop function if exists public.notifications_on_vote();
drop function if exists public.notifications_on_imagination_posted();

-- Check it landed:
--   select to_regclass('public.imaginations');                       -- null
--   select count(*) from public.profile_inquiries where config ? 'imaginationId';
--   select count(*) from public.follows where followed_type = 'imagination';   -- 0
-- Expect the second to be however many imaginations there were (3 when this was written).
