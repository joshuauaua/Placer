-- PLACER — a screenshot with a bug report
--
-- Requires bug-reports.sql. Re-runnable. See supabase/README.md section 23.
--
-- Somebody signed in may attach a screenshot to a report. It is re-encoded in the
-- browser (src/lib/imageEncode.js, the `screenshot` preset) and uploaded through the
-- media function to `bug-reports/<user id>/`, the same way a case study's picture
-- goes to `case-studies/<user id>/`; the row keeps only its key.
--
-- The key has to be under the sender's own folder, and so needs a sender: a signed-out
-- visitor has no folder to upload to, and could otherwise point a report at any
-- picture in the bucket.

alter table public.bug_reports add column if not exists screenshot_path text;

alter table public.bug_reports drop constraint if exists bug_reports_screenshot_own;
alter table public.bug_reports add constraint bug_reports_screenshot_own
  check (screenshot_path is null
         or (user_id is not null and screenshot_path like 'bug-reports/' || user_id::text || '/%'));

alter table public.bug_reports drop constraint if exists bug_reports_screenshot_path_size;
alter table public.bug_reports add constraint bug_reports_screenshot_path_size
  check (length(screenshot_path) <= 300);

-- The client sets only what it has to: still not the id, the timestamp or the account.
revoke insert on public.bug_reports from anon, authenticated;
grant insert (message, page, user_agent, screenshot_path) on public.bug_reports to anon, authenticated;

-- Read the latest, with where to see each screenshot (<VITE_MEDIA_URL>/<screenshot_path>):
--   select created_at, page, message, screenshot_path
--   from public.bug_reports order by created_at desc limit 20;
