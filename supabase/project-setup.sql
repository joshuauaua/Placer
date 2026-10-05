-- PLACER — where a project is, as an address, and the tools it will use.
--
-- 1. The address. A project used to be placed by an outline drawn on a map, plus
--    free-text place names. Setting one up now asks for an address instead, picked
--    from Google Places suggestions the same way an organisation's is
--    (organisation-address.sql): the address and its coordinates are kept here, and
--    the town and country worked out from it go into `locations`, which the public
--    page and "related projects" already read. The maps place a project at this point
--    when it has no outline. Outlines already drawn stay where they are.
--
--      projects.address        the address as chosen, '' when none
--      projects.location_lat   where it is, both null when no suggestion was chosen
--      projects.location_lng
--
-- 2. The tools. Starting a project now ends with choosing which Toolkit tools it will
--    use. Choosing is all this records: each one is set up later, when its room is
--    opened (rooms-config.sql). Public to read, like a project's links, because the
--    project page will show them; added and removed by the project's owner and
--    collaborators, the same people project_can_edit (media-photos.sql) recognises.
--    `tool` is a registry id from src/toolkit/tools.js and is not checked here: the
--    registry is code, and a tool that is later removed from it is skipped by the app.
--
-- Run this once in the Supabase SQL editor after projects.sql and media-photos.sql. It
-- is written to be safe to re-run.


-- 1. The address.

alter table public.projects add column if not exists address text not null default '';
alter table public.projects add column if not exists location_lat double precision;
alter table public.projects add column if not exists location_lng double precision;

alter table public.projects drop constraint if exists projects_address_size;
alter table public.projects add constraint projects_address_size
  check (length(address) <= 200);

-- Both or neither, and on the globe — the same shape as an organisation's point.
alter table public.projects drop constraint if exists projects_location_point_shape;
alter table public.projects add constraint projects_location_point_shape
  check (
    (location_lat is null and location_lng is null)
    or (location_lat is not null and location_lng is not null
        and location_lat between -90 and 90 and location_lng between -180 and 180)
  );

-- Reading is already the whole table (projects.sql). Insert and update are granted
-- column by column, so the new columns have to be named.
grant insert (address, location_lat, location_lng) on public.projects to authenticated;
grant update (address, location_lat, location_lng) on public.projects to authenticated;


-- 2. The tools.

create table if not exists public.project_tools (
  project_id uuid        not null references public.projects (id) on delete cascade,
  tool       text        not null,
  added_by   uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, tool)
);

alter table public.project_tools drop constraint if exists project_tools_tool_shape;
alter table public.project_tools add constraint project_tools_tool_shape
  check (tool ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(tool) <= 64);

alter table public.project_tools enable row level security;

drop policy if exists "anyone can read a project's tools" on public.project_tools;
create policy "anyone can read a project's tools"
  on public.project_tools
  for select
  to anon, authenticated
  using (true);

drop policy if exists "an owner or collaborator can add a tool" on public.project_tools;
create policy "an owner or collaborator can add a tool"
  on public.project_tools
  for insert
  to authenticated
  with check (added_by = auth.uid() and public.project_can_edit(project_id));

drop policy if exists "an owner or collaborator can remove a tool" on public.project_tools;
create policy "an owner or collaborator can remove a tool"
  on public.project_tools
  for delete
  to authenticated
  using (public.project_can_edit(project_id));

revoke all on public.project_tools from anon, authenticated;
grant select on public.project_tools to anon, authenticated;
grant insert (project_id, tool, added_by) on public.project_tools to authenticated;
grant delete on public.project_tools to authenticated;

comment on table public.project_tools is
  'The Toolkit tools a project has chosen to use. Public to read.';


-- Verify, after running the above:
--
--   select column_name from information_schema.columns
--    where table_name = 'projects' and column_name in ('address', 'location_lat', 'location_lng');
--   select policyname, cmd from pg_policies where tablename = 'project_tools';
