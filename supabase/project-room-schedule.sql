-- PLACER — a project's room schedule: when each of its rooms runs, for anybody.
--
-- A project's page has only known about the rooms open right now
-- (project_open_rooms, rooms-schedule.sql). Its Workshop Room shows a schedule
-- beside the tool being run — what ran earlier, what is on now and what comes
-- next — so the times of the rooms not yet started are now public too, for a
-- project the reader can see. Times only: a room that has not started gives away
-- no PIN, no join code and not its setup (a Poll's question stays unseen until it
-- opens), and only project_rooms, for the project's own people, has those.
--
--   project_room_schedule(project)   every room of it, earliest first, with
--                                    status 'scheduled' | 'open' | 'closed' | 'expired'
--
-- `opens_at` is when it started or starts: opens_at, or for a room opened straight
-- away, when it was made. `closes_at` is when it closed or closes: closed_at for one
-- closed early, else expires_at.
--
-- Run this once in the Supabase SQL editor after rooms-schedule.sql. It is written
-- to be safe to re-run.

create or replace function public.project_room_schedule(p_project_id uuid)
returns table (
  room_id    uuid,
  tool       text,
  status     text,
  opens_at   timestamptz,
  closes_at  timestamptz,
  config     jsonb
)
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
      when r.opens_at > now()     then 'scheduled'
      else 'open'
    end,
    coalesce(r.opens_at, r.created_at),
    coalesce(r.closed_at, r.expires_at),
    case when r.opens_at > now() then null else r.config end
  from public.toolkit_rooms r
  where r.project_id = p_project_id
    and public.project_can_view(p_project_id)
  order by coalesce(r.opens_at, r.created_at), r.created_at;
$$;

revoke all on function public.project_room_schedule(uuid) from public;
grant execute on function public.project_room_schedule(uuid) to anon, authenticated;


-- Verify:
--   select * from public.project_room_schedule((select id from public.projects limit 1));
