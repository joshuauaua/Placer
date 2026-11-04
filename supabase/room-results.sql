-- PLACER — keeping what a project's rooms were told, for their results
--
-- Requires rooms.sql, rooms-cleanup.sql, projects.sql and project-privacy.sql (for
-- project_can_view). Re-runnable.
--
-- A room's contributions can only be read while it is open, and the hourly sweep
-- (rooms-cleanup.sql) deletes the room and them a day after it ends. A project's tool
-- needs its results after that: live while the room runs, and complete once it has
-- ended. So, for a room opened for a project:
--
--   1. toolkit_room_results keeps what it was told, as each participant's `state` and
--      nothing else — no display name, no participant hash — with the room's tool,
--      setup and dates, once the room ends and before the sweep deletes it.
--   2. toolkit_rooms_sweep() does the sweep: it keeps those results, then deletes, and
--      the hourly job is moved over to it (this file replaces rooms-cleanup.sql's
--      step 4, which only deleted).
--   3. project_tool_results(project) gives every room of the project that has opened —
--      open, ended, or ended and swept away — with its states: read from the room
--      itself while it still exists, and from what was kept after. Anybody who can
--      see the project (project_can_view), as for its open rooms.
--
-- The client folds the states with the tool's own combine() (src/toolkit/tools/*.js),
-- so a tool counts its results the same way live and after.

-- 1. The results kept.

create table if not exists public.toolkit_room_results (
  -- The room's own id. Not a reference: the room is deleted, the results stay.
  room_id     uuid        primary key,
  project_id  uuid        not null    references public.projects (id) on delete cascade,
  tool        text        not null,
  config      jsonb       not null    default '{}'::jsonb,
  opened_at   timestamptz not null,
  ended_at    timestamptz not null,
  -- Each participant's state, in no particular order, without who gave it.
  states      jsonb       not null    default '[]'::jsonb,
  kept_at     timestamptz not null    default now()
);

create index if not exists toolkit_room_results_project_idx
  on public.toolkit_room_results (project_id, ended_at desc);

-- Read only through project_tool_results, which decides who may see them; written
-- only by the sweep. No policy, so nobody reaches the table itself.
alter table public.toolkit_room_results enable row level security;
revoke all on public.toolkit_room_results from anon, authenticated;

-- 2. The sweep: keep, then delete.

create or replace function public.toolkit_rooms_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.toolkit_room_results (room_id, project_id, tool, config, opened_at, ended_at, states)
  select r.id, r.project_id, r.tool, coalesce(r.config, '{}'::jsonb),
         coalesce(r.opens_at, r.created_at),
         least(coalesce(r.closed_at, r.expires_at), r.expires_at),
         coalesce((select jsonb_agg(c.state) from public.toolkit_contributions c where c.room_id = r.id),
                  '[]'::jsonb)
    from public.toolkit_rooms r
   where r.project_id is not null
     and ((r.closed_at is not null and r.closed_at  < now() - interval '24 hours')
       or (r.closed_at is null     and r.expires_at < now() - interval '24 hours'))
  on conflict (room_id) do nothing;

  delete from public.toolkit_rooms
   where (closed_at is not null and closed_at  < now() - interval '24 hours')
      or (closed_at is null     and expires_at < now() - interval '24 hours');
end;
$$;

revoke execute on function public.toolkit_rooms_sweep() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule('placer-sweep-toolkit-rooms')
 where exists (select 1 from cron.job where jobname = 'placer-sweep-toolkit-rooms');

select cron.schedule(
  'placer-sweep-toolkit-rooms',
  '17 * * * *',                    -- hourly at :17, as before
  $$ select public.toolkit_rooms_sweep(); $$
);

-- 3. A project's results.

create or replace function public.project_tool_results(p_project_id uuid)
returns table (
  room_id    uuid,
  tool       text,
  config     jsonb,
  status     text,          -- 'open' | 'ended'
  opened_at  timestamptz,
  ends_at    timestamptz,   -- when it closes, or closed
  states     jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  -- Rooms that still exist and have opened: their states straight from the room.
  select r.id, r.tool, coalesce(r.config, '{}'::jsonb),
         case when r.closed_at is null and r.expires_at > now() then 'open' else 'ended' end,
         coalesce(r.opens_at, r.created_at),
         least(coalesce(r.closed_at, r.expires_at), r.expires_at),
         coalesce((select jsonb_agg(c.state) from public.toolkit_contributions c where c.room_id = r.id),
                  '[]'::jsonb)
    from public.toolkit_rooms r
   where r.project_id = p_project_id
     and coalesce(r.opens_at, r.created_at) <= now()
     and public.project_can_view(p_project_id)
  union all
  -- Rooms the sweep has deleted: what was kept of them.
  select k.room_id, k.tool, k.config, 'ended', k.opened_at, k.ended_at, k.states
    from public.toolkit_room_results k
   where k.project_id = p_project_id
     and not exists (select 1 from public.toolkit_rooms r where r.id = k.room_id)
     and public.project_can_view(p_project_id)
  order by 5 desc;
$$;

revoke all on function public.project_tool_results(uuid) from public;
grant execute on function public.project_tool_results(uuid) to anon, authenticated;

-- Check it landed:
--   select jobname, command from cron.job where jobname = 'placer-sweep-toolkit-rooms';
-- Expect: select public.toolkit_rooms_sweep();
