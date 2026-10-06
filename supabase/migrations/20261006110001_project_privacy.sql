-- Generated from supabase/project-privacy.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — private projects, and asking to be let in.
--
-- A project is public or private. A public one is what every project has been: anyone
-- can read it, find it, and take part in what is open on it. A private one is seen,
-- and taken part in, only by its owner, its collaborators, and people they have let
-- in. Nobody else is told it exists: it is in no listing, no search, no map and no
-- notification. Somebody given its link, and signed in, can ask to be let in; the
-- owner or a collaborator approves or declines.
--
-- Everything below is the same test, project_can_view, put in front of every way a
-- project, or something that belongs to one, can be read:
--
--   1. projects.visibility, 'public' or 'private'
--   2. project_access_requests, and the functions that ask, decide and take back
--   3. project_can_view, and the preview a locked page is shown
--   4. the project itself, its links and its tools
--   5. imaginations made for it, and the comments on them
--   6. its rooms: reading, joining and contributing — and, while the contributions
--      policy is being rewritten anyway, the read it always should have given
--      signed-in people, who could not see a room's tally at all before
--   7. search, its activity count and its open rooms
--   8. the notifications that announce a new project
--
-- Functions defined in other files are replaced here with the check added; those files
-- describe the rest of what each one does. Run this once in the Supabase SQL editor
-- after every file it names (or `supabase db push`). It is written to be safe to re-run.


-- 1. Public or private.

alter table public.projects add column if not exists visibility text not null default 'public';

alter table public.projects drop constraint if exists projects_visibility_known;
alter table public.projects add constraint projects_visibility_known
  check (visibility in ('public', 'private'));

grant insert (visibility) on public.projects to authenticated;
grant update (visibility) on public.projects to authenticated;


-- 2. Asking to be let in. One row per person per project: 'pending' until an owner or
--    collaborator decides, then 'approved' or 'declined'. Taking somebody's access
--    away deletes their row, so they may ask again; a declined request stays, so a
--    no is not asked again and again.

create table if not exists public.project_access_requests (
  project_id   uuid        not null references public.projects (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- Copied onto the row, as imaginations.author_name is, so the dashboard can say who
  -- is asking without being able to read profiles it otherwise could not.
  display_name text        not null default '',
  status       text        not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid        references auth.users (id) on delete set null,
  primary key (project_id, user_id),
  constraint project_access_requests_status_known check (status in ('pending', 'approved', 'declined'))
);

create index if not exists project_access_requests_user_idx on public.project_access_requests (user_id);

alter table public.project_access_requests enable row level security;

-- Read by the person asking, and by the people who decide. Written only through the
-- functions below, which check what the policies cannot.
drop policy if exists "a requester or the project's people can read a request" on public.project_access_requests;
create policy "a requester or the project's people can read a request"
  on public.project_access_requests for select to authenticated
  using (user_id = auth.uid() or public.project_can_edit(project_id));

revoke all on public.project_access_requests from anon, authenticated;
grant select on public.project_access_requests to authenticated;

comment on table public.project_access_requests is
  'People asking to see a private project, and the answer. Written only through functions.';


-- 3. Who may see a project. Security definer so the policies below can ask without
--    recursing into their own table; it only ever answers about the caller.

create or replace function public.project_can_view(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project_id
       and (p.visibility = 'public'
            or p.owner_id = auth.uid()
            or public.project_collaborator_exists(p.id, auth.uid())
            or exists (
              select 1 from public.project_access_requests r
               where r.project_id = p.id and r.user_id = auth.uid() and r.status = 'approved'
            ))
  );
$$;

revoke all on function public.project_can_view(uuid) from public;
grant execute on function public.project_can_view(uuid) to anon, authenticated;

-- What somebody holding a private project's link is shown in place of it: its name,
-- whether they may see it, and where their request stands. Only for a project they
-- name by its id, which is not guessable and not listed anywhere; no row for one that
-- does not exist.
create or replace function public.project_access_preview(p_project_id uuid)
returns table (name text, visibility text, can_view boolean, request_status text)
language sql
stable
security definer
set search_path = public
as $$
  select p.name, p.visibility, public.project_can_view(p.id),
    (select r.status from public.project_access_requests r
      where r.project_id = p.id and r.user_id = auth.uid())
    from public.projects p
   where p.id = p_project_id;
$$;

revoke all on function public.project_access_preview(uuid) from public;
grant execute on function public.project_access_preview(uuid) to anon, authenticated;

-- Ask. Signed in, for a private project, once. The owner and collaborators are told.
create or replace function public.project_request_access(p_project_id uuid, p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_status text;
begin
  if v_uid is null then
    raise exception 'asking to see a project needs an account';
  end if;

  select p.name into v_name from public.projects p
   where p.id = p_project_id and p.visibility = 'private';
  if v_name is null then
    raise exception 'there is no private project with that id';
  end if;

  if public.project_can_view(p_project_id) then
    return 'approved';
  end if;

  insert into public.project_access_requests (project_id, user_id, display_name)
  values (p_project_id, v_uid, left(btrim(coalesce(p_display_name, '')), 80))
  on conflict (project_id, user_id) do nothing;

  select r.status into v_status from public.project_access_requests r
   where r.project_id = p_project_id and r.user_id = v_uid;

  if found and v_status = 'pending' then
    insert into public.notifications (user_id, category, title, body, link_type, link_id)
    select m, 'activity', 'Somebody asked to see your project',
      left(coalesce(nullif(btrim(p_display_name), ''), 'Somebody') || ' asked to see "' || v_name || '"', 500),
      'project', p_project_id::text
      from public.project_member_ids(p_project_id) m
     where m is distinct from v_uid
       and public.notification_wants(m, 'activity');
  end if;

  return v_status;
end;
$$;

revoke all on function public.project_request_access(uuid, text) from public;
grant execute on function public.project_request_access(uuid, text) to authenticated;

-- Decide. The owner or a collaborator; the person asking is told if the answer is yes.
create or replace function public.project_decide_access(p_project_id uuid, p_user_id uuid, p_approve boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.project_can_edit(p_project_id) then
    raise exception 'only a project''s owner or collaborators may decide who sees it';
  end if;

  update public.project_access_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_at = now(), decided_by = auth.uid()
   where project_id = p_project_id and user_id = p_user_id;
  if not found then
    return false;
  end if;

  if p_approve then
    select p.name into v_name from public.projects p where p.id = p_project_id;
    insert into public.notifications (user_id, category, title, body, link_type, link_id)
    select p_user_id, 'activity', 'You can now see a project',
      left('You were let in to "' || coalesce(v_name, 'a project') || '"', 500),
      'project', p_project_id::text
     where public.notification_wants(p_user_id, 'activity');
  end if;

  return true;
end;
$$;

revoke all on function public.project_decide_access(uuid, uuid, boolean) from public;
grant execute on function public.project_decide_access(uuid, uuid, boolean) to authenticated;

-- Take it back, or withdraw a request: the owner or a collaborator for anybody, or
-- somebody for themselves. Deleting the row is what lets them ask again later.
create or replace function public.project_remove_access(p_project_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id and not public.project_can_edit(p_project_id) then
    raise exception 'only a project''s owner or collaborators may take away somebody''s access';
  end if;

  delete from public.project_access_requests
   where project_id = p_project_id and user_id = p_user_id;
  return found;
end;
$$;

revoke all on function public.project_remove_access(uuid, uuid) from public;
grant execute on function public.project_remove_access(uuid, uuid) to authenticated;


-- 4. The project, its links, its tools. A public project reads exactly as before.

drop policy if exists "anyone can read a project" on public.projects;
drop policy if exists "anyone can read a public project, and its people a private one" on public.projects;
create policy "anyone can read a public project, and its people a private one"
  on public.projects for select to anon, authenticated
  using (visibility = 'public' or public.project_can_view(id));

drop policy if exists "anyone can read a project's links" on public.project_links;
drop policy if exists "anyone who can see a project can read its links" on public.project_links;
create policy "anyone who can see a project can read its links"
  on public.project_links for select to anon, authenticated
  using (public.project_can_view(project_id));

drop policy if exists "anyone can read a project's tools" on public.project_tools;
drop policy if exists "anyone who can see a project can read its tools" on public.project_tools;
create policy "anyone who can see a project can read its tools"
  on public.project_tools for select to anon, authenticated
  using (public.project_can_view(project_id));


-- 5. Imaginations made for a private project, and what is said about them. An
--    imagination made for no project is as public as ever, and its author can always
--    read their own. The comment policy asks the imaginations table, whose own policy
--    then decides.

drop policy if exists "anyone can read an imagination" on public.imaginations;
drop policy if exists "anyone can read an imagination, unless its project is private" on public.imaginations;
create policy "anyone can read an imagination, unless its project is private"
  on public.imaginations for select to anon, authenticated
  using (project_id is null or user_id = auth.uid() or public.project_can_view(project_id));

drop policy if exists "anyone can read a comment" on public.imagination_comments;
drop policy if exists "anyone who can see an imagination can read its comments" on public.imagination_comments;
create policy "anyone who can see an imagination can read its comments"
  on public.imagination_comments for select to anon, authenticated
  using (exists (select 1 from public.imaginations i where i.id = imagination_id));


-- 6. Rooms. A room opened for a private project is joined, read and contributed to
--    only by people who can see the project.

create or replace function public.toolkit_room_viewable(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.toolkit_rooms r
     where r.id = p_room_id
       and (r.project_id is null or public.project_can_view(r.project_id))
  );
$$;

revoke all on function public.toolkit_room_viewable(uuid) from public;
grant execute on function public.toolkit_room_viewable(uuid) to anon, authenticated;

-- The policy that reads a room's contributions was for anon only, so a signed-in
-- visitor — a facilitator watching their own room, somebody who had just voted on a
-- project's page — read no rows at all. It is for both now, with the same columns.
drop policy if exists "anon can read an open room's contributions" on public.toolkit_contributions;
drop policy if exists "anyone can read an open room's contributions, if they can see its project" on public.toolkit_contributions;
create policy "anyone can read an open room's contributions, if they can see its project"
  on public.toolkit_contributions for select to anon, authenticated
  using (public.toolkit_room_is_open(room_id) and public.toolkit_room_viewable(room_id));

revoke all on public.toolkit_contributions from authenticated;
grant select (room_id, display_name, state, updated_at) on public.toolkit_contributions to authenticated;
grant execute on function public.toolkit_room_is_open(uuid) to authenticated;

-- From rooms.sql, section 7, with the check added.
create or replace function public.toolkit_contribution_save(
  p_room_id uuid,
  p_token   uuid,
  p_name    text,
  p_state   jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_participant text;
begin
  if not public.toolkit_room_is_open(p_room_id) or not public.toolkit_room_viewable(p_room_id) then
    return false;
  end if;

  v_participant := encode(
    digest(p_room_id::text || ':' || p_token::text, 'sha256'), 'hex'
  );

  insert into public.toolkit_contributions (room_id, participant, display_name, state)
  values (p_room_id, v_participant, left(nullif(btrim(coalesce(p_name, '')), ''), 60), p_state)
  on conflict (room_id, participant) do update
    set state        = excluded.state,
        display_name = excluded.display_name,
        updated_at   = now();

  return true;
end;
$$;

revoke all on function public.toolkit_contribution_save(uuid, uuid, text, jsonb) from public;
grant execute on function public.toolkit_contribution_save(uuid, uuid, text, jsonb) to anon, authenticated;

-- From rooms-config.sql, section 3: a private project's room reads as no room at all
-- to somebody who cannot see the project.
create or replace function public.toolkit_room_state(p_room_id uuid)
returns table (tool text, status text, expires_at timestamptz, config jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.tool,
    case
      when r.closed_at is not null then 'closed'
      when r.expires_at <= now()  then 'expired'
      else 'open'
    end,
    r.expires_at,
    r.config
  from public.toolkit_rooms r
  where r.id = p_room_id
    and (r.project_id is null or public.project_can_view(r.project_id));
$$;

revoke all on function public.toolkit_room_state(uuid) from public;
grant execute on function public.toolkit_room_state(uuid) to anon, authenticated;

-- From rooms-lifetime.sql, sections 4 and 5: a PIN or join code for a private
-- project's room opens nothing for somebody who cannot see the project.
create or replace function public.toolkit_room_join(p_pin text)
returns table (room_id uuid, tool text)
language sql
security definer
set search_path = public
as $$
  select r.id, r.tool
  from public.toolkit_rooms r
  where r.pin = p_pin
    and r.closed_at is null
    and r.expires_at > now()
    and r.expires_at - r.created_at <= interval '2 hours'
    and (r.project_id is null or public.project_can_view(r.project_id));
$$;

revoke all on function public.toolkit_room_join(text) from public;
grant execute on function public.toolkit_room_join(text) to anon, authenticated;

create or replace function public.toolkit_room_join_code(p_code text)
returns table (room_id uuid, tool text, status text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.tool,
    case
      when r.closed_at is not null then 'closed'
      when r.expires_at <= now()  then 'expired'
      else 'open'
    end,
    coalesce(r.closed_at, r.expires_at)
  from public.toolkit_rooms r
  where r.join_code = p_code
    and (r.project_id is null or public.project_can_view(r.project_id));
$$;

revoke all on function public.toolkit_room_join_code(text) from public;
grant execute on function public.toolkit_room_join_code(text) to anon, authenticated;


-- 7. Search, a project's activity count and its open rooms.

-- From search.sql, with private projects the searcher cannot see left out.
create or replace function public.placer_search(p_query text, p_limit integer default 5)
returns table (
  kind       text,
  id         uuid,
  name       text,
  detail     text,
  image_path text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query   text := trim(coalesce(p_query, ''));
  v_limit   integer := least(greatest(coalesce(p_limit, 5), 1), 10);
  v_pattern text;
  v_prefix  text;
begin
  if auth.uid() is null then
    raise exception 'searching needs an account';
  end if;

  if length(v_query) < 2 then
    return;
  end if;

  v_query   := replace(replace(replace(left(v_query, 60), '\', '\\'), '%', '\%'), '_', '\_');
  v_pattern := '%' || v_query || '%';
  v_prefix  := v_query || '%';

  return query
    (select 'person'::text, p.id, p.display_name, nullif(p.location, ''), p.avatar_path
       from public.profiles p
      where p.display_name ilike v_pattern
      order by (p.display_name ilike v_prefix) desc, p.display_name
      limit v_limit)
    union all
    (select 'organisation'::text, o.id, o.name, nullif(o.location, ''), o.cover_path
       from public.organisations o
      where o.name ilike v_pattern
      order by (o.name ilike v_prefix) desc, o.name
      limit v_limit)
    union all
    (select 'project'::text, pr.id, pr.name, coalesce(org.name, pr.owner_name), pr.image_path
       from public.projects pr
       left join public.organisations org on org.id = pr.organisation_id
      where pr.name ilike v_pattern
        and (pr.visibility = 'public' or public.project_can_view(pr.id))
      order by (pr.name ilike v_prefix) desc, pr.name
      limit v_limit);
end;
$$;

-- From projects.sql: nothing to count for somebody who cannot see the project.
create or replace function public.project_toolkit_activity(p_project_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select case when public.project_can_view(p_project_id)
    then (select count(*)::int from public.toolkit_rooms where project_id = p_project_id)
    else 0 end;
$$;

-- From project-open-rooms.sql: none, for somebody who cannot see the project.
create or replace function public.project_open_rooms(p_project_id uuid)
returns table (room_id uuid, tool text, expires_at timestamptz, config jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.tool, r.expires_at, r.config
  from public.toolkit_rooms r
  where r.project_id = p_project_id
    and r.closed_at is null
    and r.expires_at > now()
    and public.project_can_view(p_project_id)
  order by r.created_at desc;
$$;


-- 8. A private project is announced to nobody.

-- From notifications-projects.sql.
create or replace function public.notifications_on_project_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visibility = 'private' then
    return new;
  end if;

  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select f.follower_id, 'activity', 'New project from someone you follow',
    left(new.owner_name || ' started "' || new.name || '"', 500),
    'project', new.id::text
    from public.follows f
   where f.followed_type = 'user'
     and f.followed_id = new.owner_id::text
     and f.follower_id <> new.owner_id
     and public.notification_wants(f.follower_id, 'activity')
     and not (
       new.organisation_id is not null
       and exists (
         select 1 from public.follows o
          where o.follower_id = f.follower_id
            and o.followed_type = 'organisation'
            and o.followed_id = new.organisation_id::text
       )
     );

  return new;
end;
$$;

-- From follows-organisations.sql.
create or replace function public.notifications_on_organisation_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_name text;
begin
  if new.organisation_id is null
     or new.visibility = 'private'
     or (tg_op = 'UPDATE' and new.organisation_id is not distinct from old.organisation_id) then
    return new;
  end if;

  select o.name into v_organisation_name from public.organisations o where o.id = new.organisation_id;

  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select f.follower_id, 'activity', 'New project from an organisation you follow',
    left(coalesce(v_organisation_name, 'An organisation') || ' started "' || new.name || '"', 500),
    'project', new.id::text
    from public.follows f
   where f.followed_type = 'organisation'
     and f.followed_id = new.organisation_id::text
     and f.follower_id is distinct from auth.uid()
     and public.notification_wants(f.follower_id, 'activity');

  return new;
end;
$$;


-- Verify, after running the above:
--
--   select column_name from information_schema.columns
--    where table_name = 'projects' and column_name = 'visibility';
--   select policyname from pg_policies where tablename in ('projects', 'imaginations', 'toolkit_contributions');
