-- PLACER — the Toolkit tools that may host a room.
--
-- Run this in the SQL editor after rooms.sql and notifications-projects.sql (or
-- `supabase db push`), then every file in supabase/room-tools/. It is re-runnable.
--
-- One row per tool that can run in a room: the ones with a `room` in their register
-- entry, src/toolkit/tools/<id>.js, which is the other half of the pair.
-- toolkit_rooms.tool references it, so the database will not host a room for a tool it
-- has not been told about, and toolkit_tool_name reads the tool's name from it for the
-- alerts' text.
--
-- It replaces a check constraint on toolkit_rooms that listed the tools, and a case in
-- toolkit_tool_name that named them. Every new tool edited both lists, so two branches
-- each adding one conflicted there, and each branch's catch-up migration rebuilt the
-- constraint without the other's tool. A new tool now adds a file of its own instead:
-- supabase/room-tools/<id>.sql, inserting its row (see the README there), and the
-- migration that `node scripts/check-migrations.mjs --write` generates from it.
--
-- Its migration also stands in for the Word Cloud's and the Pop Quiz's catch-up
-- migrations (20261012090001 and 20261012100001), which were never pushed: they were
-- dated before 20261013090001, which was, and `db push` refuses one older than the
-- newest applied. Until this ran, the database would not open a room on either tool.

create table if not exists public.toolkit_room_tools (
  id   text primary key,
  name text not null
);

-- Read only by the functions below and the notification triggers, which run as the
-- table's owner. Nobody else has any business with it.
alter table public.toolkit_room_tools enable row level security;
revoke all on public.toolkit_room_tools from anon, authenticated;

comment on table public.toolkit_room_tools is
  'The Toolkit tools that may host a room, and their names as the app shows them.';

-- The tools that could host a room before this table existed. Later ones are in
-- supabase/room-tools/.
insert into public.toolkit_room_tools (id, name) values
  ('budget-ballot', 'Co-Budget'),
  ('open-vote',     'Poll'),
  ('pop-quiz',      'Pop Quiz'),
  ('word-cloud',    'Word Cloud')
on conflict (id) do update set name = excluded.name;

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_tool_known;
alter table public.toolkit_rooms add constraint toolkit_rooms_tool_known
  foreign key (tool) references public.toolkit_room_tools (id);

-- A tool's name as the app shows it, for the alert's text. Stable rather than
-- immutable now that it reads a table.
create or replace function public.toolkit_tool_name(p_tool text)
returns text
language sql
stable
as $$
  select coalesce(
    (select t.name from public.toolkit_room_tools t where t.id = p_tool),
    'a Toolkit tool'
  );
$$;
