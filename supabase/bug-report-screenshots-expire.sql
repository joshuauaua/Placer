-- PLACER — delete bug report screenshots once they are 30 days old
--
-- Requires bug-report-screenshots.sql, the media-expire Edge Function deployed with
-- its secrets, and pg_cron and pg_net enabled under Database -> Extensions (see
-- supabase/README.md section 23). Re-runnable.
--
-- A daily pg_cron job calls the function, which deletes every file under bug-reports/
-- in the bucket older than 30 days and clears screenshot_path on the reports that
-- pointed at them. The reports themselves are kept. The 30 days is EXPIRE_DAYS in
-- supabase/functions/media-expire/index.ts.
--
-- Not a migration, for the same reason bug-reports-slack.sql is not: it names this
-- project's URL, and reads a secret from Vault that has to be stored first.
--
-- The shared secret is not in this file. Store it in Vault once, with the same value
-- as the function's MEDIA_EXPIRE_SECRET:
--
--   select vault.create_secret('<the secret>', 'media_expire_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Unschedule first so this file stays re-runnable: cron.schedule on an existing
-- name updates it, but only on newer pg_cron, and failing here is not worth it.
select cron.unschedule('placer-expire-bug-screenshots')
 where exists (select 1 from cron.job where jobname = 'placer-expire-bug-screenshots');

select cron.schedule(
  'placer-expire-bug-screenshots',
  '41 3 * * *',                    -- daily at 03:41 UTC; off the hour on purpose
  $$
    select net.http_post(
      url     := 'https://kxtzxcdxjjuhtezqeacq.supabase.co/functions/v1/media-expire',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                          where name = 'media_expire_secret')),
      body    := '{}'::jsonb
    );
  $$
);

-- Check it is scheduled:
--   select jobname, schedule from cron.job where jobname = 'placer-expire-bug-screenshots';
-- And how its runs went (the function's answer, e.g. {"ok":true,"deleted":3}):
--   select status_code, content from net._http_response order by created desc limit 5;
