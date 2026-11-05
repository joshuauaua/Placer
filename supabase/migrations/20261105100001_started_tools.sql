-- Generated from supabase/started-tools.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — the tools somebody has started, from the configuration page (My Tools).
--
-- Until now these were kept only in the browser's localStorage, so a tool started on
-- one device never showed on another, and clearing site data lost it. With this table
-- an account's started tools follow it: services/startedTools.js reads and writes
-- here whenever a Supabase project is configured and somebody is signed in, and
-- carries over whatever that browser had kept for the account the first time it
-- lists them.
--
-- One row per started tool:
--
--   id          the id the app gave it (`tool-<uuid>`), which is in the page's address
--               (?draft=<id>) from the moment it is first kept. Text, and chosen by
--               the browser, so the address can carry it before the row is written.
--   tool        the tool's id in the app's register (toolkit/tools.js).
--   slides      its slides, each { id, setup }: a JSON array.
--   name        what its owner has called it, or null for the tool's own name.
--   project_id  the project it was added to, or null. Set to null if that project is
--               deleted; the tool itself stays.
--   live        run live with a group (true), self-paced at its link (false), or not
--               chosen (null).
--
-- Private to its owner: nobody else can read, write or delete it, not even the
-- project's collaborators. A started tool is a draft; what is published from it is a
-- room (rooms.sql), which has its own rules. Sharing drafts with a project's
-- collaborators would be a policy using public.project_can_edit(project_id), left for
-- when the configuration page can show who else is editing.
--
-- Deleted with the account (on delete cascade), like everything else an account owns.
--
-- Run this once in the Supabase SQL editor after projects.sql. It is written to be
-- safe to re-run.


create table if not exists public.started_tools (
  id          text        primary key,
  owner_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tool        text        not null,
  slides      jsonb       not null default '[]'::jsonb,
  name        text,
  project_id  uuid        references public.projects (id) on delete set null,
  live        boolean,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Shapes, so a row is only ever what the app writes. The slides' size is the room
-- config's limit (room-size-limits.sql) for a few slides' worth.
alter table public.started_tools drop constraint if exists started_tools_shape;
alter table public.started_tools add constraint started_tools_shape check (
  length(id) between 1 and 100
  and length(tool) between 1 and 100
  and (name is null or length(name) between 1 and 200)
  and jsonb_typeof(slides) = 'array'
  and pg_column_size(slides) <= 524288
);

-- My Tools lists an account's tools, the most recently changed first.
create index if not exists started_tools_owner_updated
  on public.started_tools (owner_id, updated_at desc);

-- The dates are the database's, not the browser's, except that a tool carried over
-- from a browser's localStorage keeps the dates it had there, so My Tools keeps its
-- order. Never later than now.
create or replace function public.started_tools_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := least(coalesce(new.created_at, now()), now());
    new.updated_at := least(coalesce(new.updated_at, now()), now());
    return new;
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.started_tools_touch() from public;

drop trigger if exists started_tools_touch on public.started_tools;
create trigger started_tools_touch
  before insert or update on public.started_tools
  for each row execute function public.started_tools_touch();


-- Who can see and change a row: its owner, and nobody else.
alter table public.started_tools enable row level security;

drop policy if exists "an owner can read their started tools" on public.started_tools;
create policy "an owner can read their started tools"
  on public.started_tools
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "an owner can start a tool" on public.started_tools;
create policy "an owner can start a tool"
  on public.started_tools
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "an owner can change their started tools" on public.started_tools;
create policy "an owner can change their started tools"
  on public.started_tools
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "an owner can delete their started tools" on public.started_tools;
create policy "an owner can delete their started tools"
  on public.started_tools
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- Nothing for anon. owner_id is never the browser's to set: it comes from its default.
-- The dates can be given on insert, for a tool carried over, and the trigger keeps
-- them honest. The app saves with an
-- upsert, which updates every column it sends, the id among them, so id is in the
-- update grant too; it is always the id the row already has.
revoke all on public.started_tools from anon, authenticated;
grant select, delete on public.started_tools to authenticated;
grant insert (id, tool, slides, name, project_id, live, created_at, updated_at) on public.started_tools to authenticated;
grant update (id, tool, slides, name, project_id, live) on public.started_tools to authenticated;


-- Verify, after running the above:
--
--   select relrowsecurity from pg_class where relname = 'started_tools';         -- true
--   select policyname, cmd from pg_policies where tablename = 'started_tools';   -- four
