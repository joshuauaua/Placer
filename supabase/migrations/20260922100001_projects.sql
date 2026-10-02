-- Generated from supabase/projects.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — projects.
--
-- The shape: an account (or a small team of them) sets up a project — dates, where it
-- is, what it is trying to do — and PLACER gives it three things in return: a place
-- to collect external documentation, a dashboard of how the imaginations and Toolkit
-- sessions tied to it are going, and a public page that shows all of that off to
-- anyone who was not in the room. This file is what wires imaginations and Toolkit
-- rooms into a project rather than leaving them freestanding.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after auth.sql, imaginations.sql and rooms.sql — it references all three. It is
-- written to be safe to re-run.
--
-- Scope choices worth knowing about, so the schema does not look like an oversight:
--
--   - Locations are a plain array of place names, not geocoded points — a project is
--     about a neighbourhood or a programme, which does not always reduce to a pin the
--     way one imagination does. location_shapes is the real geometry alongside it:
--     polygons an account draws on a map (the Maps JavaScript API's drawing library,
--     client-side) to outline the area a project covers. It is additive, not a
--     replacement — a name and a shape are two different things about the same place,
--     and a project can have either, both, or neither.
--   - Collaborators are added by email, resolved to an existing account by a security
--     definer function (section 5) — the same reason profiles.sql never lets one
--     account look up another's: there is no directory to search, so inviting someone
--     means already knowing how to reach them.
--   - Only the owner manages collaborators. A collaborator can edit the project's
--     setup, its links, and open a Toolkit room for it, but cannot add or remove
--     other collaborators or delete the project. That is one boundary, not a full
--     roles system, and is easy to widen later if a project turns out to need one.
--
-- Two warnings the editor will raise, both expected — see auth.sql's header for why.

create extension if not exists pgcrypto;


-- A CHECK constraint cannot contain a subquery at all — not even a self-contained one
-- like `unnest(locations)` that names no other table — so validating "every element of
-- this array/jsonb column looks right" has to happen inside a stored function instead,
-- with the constraint just calling it. Both are immutable and touch nothing but their
-- argument, which is what makes that legal.
create or replace function public.text_array_entries_within(arr text[], max_len integer)
returns boolean
language sql
immutable
as $$
  select not exists (select 1 from unnest(arr) as entry where length(entry) > max_len);
$$;

create or replace function public.project_location_shapes_valid(shapes jsonb)
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1 from jsonb_array_elements(shapes) as shape
    where jsonb_typeof(shape -> 'path') is distinct from 'array'
       or jsonb_array_length(shape -> 'path') < 3
       or jsonb_array_length(shape -> 'path') > 500
  );
$$;


-- 1. The project.
create table if not exists public.projects (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null    references auth.users (id) on delete cascade,
  -- Copied onto the row rather than joined from public.profiles, the same reason
  -- imaginations.sql copies author_name: profiles are private, and the public half of
  -- who made something is published with the thing itself rather than looked up.
  owner_name   text        not null,
  name         text        not null,
  -- The goals: what the project is trying to find out or bring about.
  description  text        not null    default '',
  start_date   date,
  end_date     date,
  -- Free-text place names — see the header.
  locations    text[]      not null    default '{}',
  -- Polygons outlining where the project is — see the header. Each element is
  -- `{"path": [{"lat": ..., "lng": ...}, ...]}`; jsonb rather than a PostGIS type
  -- because nothing here queries the geometry, only stores and redisplays it exactly
  -- as drawn.
  location_shapes jsonb    not null    default '[]'::jsonb,
  created_at   timestamptz not null    default now(),
  updated_at   timestamptz not null    default now()
);

alter table public.projects enable row level security;


-- 2. Collaborators — the table only, created here rather than down in section 4 with
-- its own policies, because section 3's update policy on projects has to reference it
-- and a policy cannot name a table that does not exist yet.
create table if not exists public.project_collaborators (
  project_id   uuid        not null references public.projects (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- Snapshotted at invite time, the same reason projects.owner_name is: nothing here
  -- may join out to a stranger's profile. email is what the owner invited by, so it
  -- always exists; display_name is the profile's name at that moment, best-effort.
  email        text        not null,
  display_name text,
  created_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_collaborators enable row level security;


-- 3. Who may do what with a project.
--
-- Reading is open to everybody, signed in or not — a project's public page is the
-- point. Creating one takes an account, and updating or removing one is scoped to
-- the owner and, for update only, its collaborators.
drop policy if exists "anyone can read a project" on public.projects;
create policy "anyone can read a project"
  on public.projects
  for select
  to anon, authenticated
  using (true);

drop policy if exists "an account can start a project" on public.projects;
create policy "an account can start a project"
  on public.projects
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "an owner or collaborator can edit a project" on public.projects;
create policy "an owner or collaborator can edit a project"
  on public.projects
  for update
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.project_collaborators c
      where c.project_id = projects.id and c.user_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.project_collaborators c
      where c.project_id = projects.id and c.user_id = auth.uid()
    )
  );

drop policy if exists "an owner can remove a project" on public.projects;
create policy "an owner can remove a project"
  on public.projects
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- Column grants as well as the policies: owner_id and the timestamps are not the
-- client's to set directly. owner_id is granted on insert only, matching the
-- shape imaginations.sql uses for user_id — the check above is what stops it being
-- a free-text claim.
revoke all on public.projects from anon, authenticated;
grant select on public.projects to anon, authenticated;
grant insert (id, owner_id, owner_name, name, description, start_date, end_date, locations, location_shapes)
  on public.projects to authenticated;
grant update (owner_name, name, description, start_date, end_date, locations, location_shapes)
  on public.projects to authenticated;
grant delete on public.projects to authenticated;

alter table public.projects drop constraint if exists projects_name_shape;
alter table public.projects add constraint projects_name_shape
  check (length(trim(name)) between 1 and 120);

alter table public.projects drop constraint if exists projects_owner_name_shape;
alter table public.projects add constraint projects_owner_name_shape
  check (length(trim(owner_name)) between 1 and 50);

alter table public.projects drop constraint if exists projects_description_size;
alter table public.projects add constraint projects_description_size
  check (length(description) <= 4000);

alter table public.projects drop constraint if exists projects_dates_ordered;
alter table public.projects add constraint projects_dates_ordered
  check (start_date is null or end_date is null or start_date <= end_date);

-- A handful of places, not a gazetteer. Bounds both the count and each entry's length.
alter table public.projects drop constraint if exists projects_locations_shape;
alter table public.projects add constraint projects_locations_shape
  check (
    array_length(locations, 1) is null or (
      array_length(locations, 1) <= 20
      and public.text_array_entries_within(locations, 120)
    )
  );

-- A handful of drawn shapes, not a full GIS layer. Bounds the shape count, each
-- one's point count, and that every element is at least well-formed enough to be
-- what the drawing tool produces -- not a validation that the polygon is simple or
-- its coordinates are sane lat/lng values, which is more than a plain check needs
-- to do for data nothing here queries, only stores and redisplays (see the header).
alter table public.projects drop constraint if exists projects_location_shapes_shape;
alter table public.projects add constraint projects_location_shapes_shape
  check (
    jsonb_typeof(location_shapes) = 'array'
    and jsonb_array_length(location_shapes) <= 10
    and public.project_location_shapes_valid(location_shapes)
  );

comment on table public.projects is
  'One row per project. Public to read, owner-and-collaborators to write, owner-only to delete.';

create index if not exists projects_owner_id_idx on public.projects (owner_id);


-- 4. Collaborators' policies — the table itself was created in section 2.
--
-- No insert or delete policy at all — see section 5. A collaborator can see the
-- roster (their own membership proves they belong on the project) but only the
-- owner changes it.
--
-- The collaborator half of that check cannot be a plain exists-subquery against
-- project_collaborators itself: evaluating this policy would then re-trigger this
-- same policy on the subquery, and so on — Postgres reports that as infinite
-- recursion rather than looping forever. Routing it through a security definer
-- function reads the table with RLS bypassed, which is what breaks the loop.
create or replace function public.project_collaborator_exists(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_collaborators
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

revoke all on function public.project_collaborator_exists(uuid, uuid) from public;
grant execute on function public.project_collaborator_exists(uuid, uuid) to authenticated;

drop policy if exists "the owner or a collaborator can read the roster" on public.project_collaborators;
create policy "the owner or a collaborator can read the roster"
  on public.project_collaborators
  for select
  to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or public.project_collaborator_exists(project_id, auth.uid())
  );

-- No insert, update or delete policy for anyone: rows are written only by
-- project_add_collaborator and project_remove_collaborator (section 5), both
-- security definer and both owner-checked from inside the function. A client that
-- could insert here could add itself to any project's roster.
revoke all on public.project_collaborators from anon, authenticated;
grant select on public.project_collaborators to authenticated;

comment on table public.project_collaborators is
  'Who else may edit a project. Written only by project_add_collaborator / project_remove_collaborator.';


-- 5. Adding and removing a collaborator.
--
-- By email rather than by account id, because there is nothing in PLACER that lets
-- one account find another's id — see the header. Owner-only: a collaborator cannot
-- grow or shrink the roster, which is the one boundary this schema draws between the
-- two roles.
create or replace function public.project_add_collaborator(p_project_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target uuid;
  v_target_name text;
begin
  if v_caller is null then
    raise exception 'adding a collaborator needs an account';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id and owner_id = v_caller) then
    raise exception 'only a project''s owner may add a collaborator';
  end if;

  select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then
    raise exception 'no PLACER account is registered to that email address';
  end if;

  if v_target = v_caller then
    raise exception 'the owner is already on the project';
  end if;

  select display_name into v_target_name from public.profiles where id = v_target;

  insert into public.project_collaborators (project_id, user_id, email, display_name)
  values (p_project_id, v_target, lower(trim(p_email)), v_target_name)
  on conflict (project_id, user_id) do nothing;

  return true;
end;
$$;

revoke all on function public.project_add_collaborator(uuid, text) from public;
grant execute on function public.project_add_collaborator(uuid, text) to authenticated;

create or replace function public.project_remove_collaborator(p_project_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'removing a collaborator needs an account';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id and owner_id = auth.uid()) then
    raise exception 'only a project''s owner may remove a collaborator';
  end if;

  delete from public.project_collaborators
   where project_id = p_project_id and user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.project_remove_collaborator(uuid, uuid) from public;
grant execute on function public.project_remove_collaborator(uuid, uuid) to authenticated;


-- 6. Documentation: external links, no uploads.
create table if not exists public.project_links (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null    references public.projects (id) on delete cascade,
  title      text        not null,
  url        text        not null,
  added_by   uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null    default now()
);

alter table public.project_links enable row level security;

drop policy if exists "anyone can read a project's links" on public.project_links;
create policy "anyone can read a project's links"
  on public.project_links
  for select
  to anon, authenticated
  using (true);

drop policy if exists "an owner or collaborator can add a link" on public.project_links;
create policy "an owner or collaborator can add a link"
  on public.project_links
  for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and (
      exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
      or exists (
        select 1 from public.project_collaborators c
        where c.project_id = project_links.project_id and c.user_id = auth.uid()
      )
    )
  );

drop policy if exists "an owner or collaborator can remove a link" on public.project_links;
create policy "an owner or collaborator can remove a link"
  on public.project_links
  for delete
  to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or exists (
      select 1 from public.project_collaborators c
      where c.project_id = project_links.project_id and c.user_id = auth.uid()
    )
  );

revoke all on public.project_links from anon, authenticated;
grant select on public.project_links to anon, authenticated;
grant insert (id, project_id, title, url, added_by) on public.project_links to authenticated;
grant delete on public.project_links to authenticated;

alter table public.project_links drop constraint if exists project_links_title_shape;
alter table public.project_links add constraint project_links_title_shape
  check (length(trim(title)) between 1 and 200);

-- A link, not a payload smuggler: http(s) only, and a sane length.
alter table public.project_links drop constraint if exists project_links_url_shape;
alter table public.project_links add constraint project_links_url_shape
  check (length(url) <= 2000 and url ~* '^https?://');

comment on table public.project_links is
  'External news, articles and resources attached to a project. Public to read.';

create index if not exists project_links_project_id_idx on public.project_links (project_id);


-- 7. Linking imaginations to a project.
--
-- Nullable and additive: an imagination posted with no project attached behaves
-- exactly as it always has. Set at post time (the client passes it, the way
-- user_id already is), never changed afterwards by anyone but the imagination's
-- own owner through the existing update grant.
alter table public.imaginations
  add column if not exists project_id uuid references public.projects (id) on delete set null;

grant insert (project_id) on public.imaginations to authenticated;
grant update (project_id) on public.imaginations to authenticated;

create index if not exists imaginations_project_id_idx on public.imaginations (project_id);


-- 8. Linking a Toolkit room to a project.
--
-- Same shape as section 7, but toolkit_rooms has no grants to anon or authenticated
-- at all (see rooms.sql's header) — every access goes through a function, so the
-- column only ever needs to be set inside toolkit_room_create, not granted.
alter table public.toolkit_rooms
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists toolkit_rooms_project_id_idx on public.toolkit_rooms (project_id);

-- The return type is unchanged, but the parameter list is: a second, defaulted
-- argument is a different signature, so the one-argument version has to be dropped
-- explicitly rather than replaced in place, the same case rooms.sql's own header
-- note about toolkit_room_create describes.
drop function if exists public.toolkit_room_create(text);

create or replace function public.toolkit_room_create(p_tool text, p_project_id uuid default null)
returns table (room_id uuid, pin text, facilitator_token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_pin     text;
  v_token   uuid;
  v_expires timestamptz;
  v_attempt int := 0;
  v_owner   uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'opening a room needs an account';
  end if;

  -- Opening a project-scoped room is one more thing collaborators may do, on top
  -- of editing the project's setup and links — see the header. Passing no project
  -- id at all keeps opening a plain, unattached room exactly as unrestricted as it
  -- has always been.
  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.owner_id = v_owner
        or exists (
          select 1 from public.project_collaborators c
          where c.project_id = p.id and c.user_id = v_owner
        )
      )
  ) then
    raise exception 'only a project''s owner or collaborators may open a room for it';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_pin := lpad((floor(random() * 1000000))::bigint::text, 6, '0');

    begin
      insert into public.toolkit_rooms (pin, tool, created_by, project_id)
      values (v_pin, p_tool, v_owner, p_project_id)
      returning toolkit_rooms.id, toolkit_rooms.facilitator_token, toolkit_rooms.expires_at
        into v_id, v_token, v_expires;

      return query select v_id, v_pin, v_token, v_expires;
      return;
    exception when unique_violation then
      if v_attempt >= 20 then
        raise exception 'could not find a free PIN after % attempts', v_attempt;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.toolkit_room_create(text, uuid) from public;
grant execute on function public.toolkit_room_create(text, uuid) to authenticated;


-- 9. The dashboard's numbers.
--
-- Owner-or-collaborator only, and a function rather than a view: toolkit_rooms has
-- no select grant at all (section 8's header), so nothing else could read the room
-- count. Running as the definer is what lets this see past that lockdown for the
-- one project its caller is allowed to manage.
create or replace function public.project_stats(p_project_id uuid)
returns table (
  imaginations_count  integer,
  imaginations_upvotes integer,
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
    select
      (select count(*)::int from public.imaginations i where i.project_id = p_project_id),
      (select coalesce(sum(i.upvotes), 0)::int from public.imaginations i where i.project_id = p_project_id),
      (select count(*)::int from public.toolkit_rooms r where r.project_id = p_project_id);
end;
$$;

revoke all on function public.project_stats(uuid) from public;
grant execute on function public.project_stats(uuid) to authenticated;


-- 10. The public page's one number from the locked-down table.
--
-- A project's public page shows Toolkit activity too, and imagination counts and
-- votes are already reachable directly — the imaginations table is open to read
-- (section 7). The room count is not: toolkit_rooms has no grant to anon or
-- authenticated at all. This is the same shape as toolkit_room_is_open in
-- rooms.sql — a narrow, public, security definer helper — rather than reusing
-- project_stats, because a count of sessions run is not sensitive the way a PIN or a
-- facilitator token is, and does not need the ownership check the dashboard's
-- numbers do.
create or replace function public.project_toolkit_activity(p_project_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.toolkit_rooms where project_id = p_project_id;
$$;

revoke all on function public.project_toolkit_activity(uuid) from public;
grant execute on function public.project_toolkit_activity(uuid) to anon, authenticated;


-- Verify, after running the above:
--
--   select relrowsecurity from pg_class where relname in ('projects', 'project_collaborators', 'project_links');
--   select policyname, cmd, roles from pg_policies where tablename in ('projects', 'project_collaborators', 'project_links');
--
--   -- project_id reached both existing tables:
--   select column_name from information_schema.columns
--    where table_name in ('imaginations', 'toolkit_rooms') and column_name = 'project_id';
--
-- Expect rls true on all three new tables; a public SELECT policy on projects and
-- project_links; an owner-or-self SELECT on project_collaborators; and project_id
-- present on both imaginations and toolkit_rooms.
--
-- Then, that reading a project really is public — with nothing but the anon key:
--
--   curl -s "https://<project-ref>.supabase.co/rest/v1/projects?select=name,owner_name" \
--     -H "apikey: <anon key>"
