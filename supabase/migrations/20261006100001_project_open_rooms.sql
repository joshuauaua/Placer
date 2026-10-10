-- Generated from supabase/project-open-rooms.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — the rooms a project has open, for its public page.
--
-- A project's public page presents the tools its organisers have set up, and a tool is
-- set up for a project by opening a room for it (rooms-config.sql keeps the setup on
-- the room). A Poll opened for a project is a poll on its page: the question,
-- the three buttons straight under it, then the tally once you have voted. So the page
-- has to find the project's open rooms, which nothing public could do — toolkit_rooms
-- has no grants at all (rooms.sql), and project_rooms is for the project's own people.
--
-- This answers for open rooms only, and only with what the page needs: the room's id,
-- its tool, when it closes and its setup. The id is what a contribution is saved
-- against, and handing it out is the point: the page is public, and so is taking part
-- in what its organisers have opened on it. A short workshop room joined by PIN is
-- not left out — if it was opened for the project, it belongs on the project's page
-- while it runs. Never the PIN, the join code or the facilitator token.
--
-- Run this once in the Supabase SQL editor after rooms-config.sql. It is written to be
-- safe to re-run.

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
  order by r.created_at desc;
$$;

revoke all on function public.project_open_rooms(uuid) from public;
grant execute on function public.project_open_rooms(uuid) to anon, authenticated;


-- Verify, after running the above:
--
--   select * from public.project_open_rooms((select id from public.projects limit 1));
