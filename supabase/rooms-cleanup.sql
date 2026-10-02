-- PLACER — clearing out toolkit rooms.
--
-- A room stops working when its time runs out — two hours after it is opened, or up
-- to 90 days for a project's long-running room (rooms-lifetime.sql) — or the moment
-- its facilitator closes it. That is enforced in the predicates in rooms.sql, so an expired room is
-- already unusable — unjoinable, unwritable, and its contributions invisible — with
-- or without anything here.
--
-- What this file does is delete the rows. Expiry makes a room dead; the sweep makes
-- it gone. The GDPR page says room data "is deleted within a day of the room
-- ending", and step 4 is what makes that sentence true, so it should be scheduled
-- rather than left to somebody remembering.
--
-- Re-runnable. Deleting a room takes its contributions with it, via the
-- on delete cascade in rooms.sql.

-- 1. What is out there. Run this first; it changes nothing.
select
  count(*)                                                     as rooms,
  count(*) filter (where closed_at is null and expires_at > now())  as live,
  count(*) filter (where closed_at is not null)                 as closed_by_hand,
  count(*) filter (where closed_at is null and expires_at <= now()) as expired,
  min(expires_at) filter (where closed_at is null and expires_at > now()) as next_to_go
from public.toolkit_rooms;


-- 2. Everything that has finished, one way or the other. The day's grace is so that
--    closing a room by accident, or a workshop overrunning its deadline, is
--    recoverable from the database for a little while afterwards.
delete from public.toolkit_rooms
 where (closed_at is not null and closed_at  < now() - interval '24 hours')
    or (closed_at is null     and expires_at < now() - interval '24 hours');


-- 3. Everything that has finished, right now, grace included. For an erasure
--    request, or for clearing out a test.
--
-- delete from public.toolkit_rooms
--  where closed_at is not null or expires_at <= now();


-- 4. Running it on a schedule.
--
--    This is the "scheduled database job" that stands in for a Redis key TTL: there
--    is no server in front of this database, so expiry cannot be a key lifetime and
--    the deletion has to be somebody's job. Enable this — the retention promise on
--    the GDPR page assumes it is running.
--
--    Requires the pg_cron extension (Supabase: Database -> Extensions -> pg_cron).

create extension if not exists pg_cron;

-- Unschedule first so this file stays re-runnable: cron.schedule on an existing
-- name updates it, but only on newer pg_cron, and failing here is not worth it.
select cron.unschedule('placer-sweep-toolkit-rooms')
 where exists (select 1 from cron.job where jobname = 'placer-sweep-toolkit-rooms');

select cron.schedule(
  'placer-sweep-toolkit-rooms',
  '17 * * * *',                    -- hourly at :17; off the hour on purpose
  $$
    delete from public.toolkit_rooms
     where (closed_at is not null and closed_at  < now() - interval '24 hours')
        or (closed_at is null     and expires_at < now() - interval '24 hours');
  $$
);

-- To see it, or stop it again:
--
-- select jobid, schedule, jobname from cron.job;
-- select cron.unschedule('placer-sweep-toolkit-rooms');
--
-- And to check it has been running:
--
-- select status, return_message, start_time
--   from cron.job_run_details
--  where jobname = 'placer-sweep-toolkit-rooms'
--  order by start_time desc limit 10;
