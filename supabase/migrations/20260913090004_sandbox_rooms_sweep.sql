-- Generated from supabase/rooms-cleanup.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.
--
-- Only step 4 of that file. Steps 1-3 are an interactive count and a manual
-- DELETE -- operational commands, not schema, so they stay out of migrations.

create extension if not exists pg_cron;

-- Unschedule first so this file stays re-runnable: cron.schedule on an existing
-- name updates it, but only on newer pg_cron, and failing here is not worth it.
select cron.unschedule('placer-sweep-sandbox-rooms')
 where exists (select 1 from cron.job where jobname = 'placer-sweep-sandbox-rooms');

select cron.schedule(
  'placer-sweep-sandbox-rooms',
  '17 * * * *',                    -- hourly at :17; off the hour on purpose
  $$
    delete from public.sandbox_rooms
     where (closed_at is not null and closed_at  < now() - interval '24 hours')
        or (closed_at is null     and expires_at < now() - interval '24 hours');
  $$
);
