-- PLACER — hardening an existing survey_responses table.
--
-- The publishable key is in every visitor's bundle, so anyone can POST to this
-- table. That is by design and cannot be undone without putting a server in
-- front. What can be done is bound the damage a single insert can do: this file
-- constrains what a row may contain, and stops the client setting the columns it
-- has no business setting.
--
-- RUN THE CLEANUP FIRST. Adding a CHECK validates every existing row, so the
-- connectivity-test row will make the source constraint fail:
--
--   delete from public.survey_responses where source = 'setup_check';
--
-- Re-runnable. Already applied to a fresh table by schema.sql.

-- 1. Only the app's own two surveys. Anything else is junk or someone poking.
alter table public.survey_responses drop constraint if exists survey_responses_source_known;
alter table public.survey_responses add constraint survey_responses_source_known
  check (source in ('community_survey', 'landing_survey'));

-- 2. Bound the payloads. The real survey sends well under 2 kB; without a cap a
--    single request could store megabytes, as many times as it likes.
alter table public.survey_responses drop constraint if exists survey_responses_answers_size;
alter table public.survey_responses add constraint survey_responses_answers_size
  check (length(answers::text) <= 8000);

alter table public.survey_responses drop constraint if exists survey_responses_other_text_size;
alter table public.survey_responses add constraint survey_responses_other_text_size
  check (length(other_text::text) <= 4000);

-- 3. An address has to look like one, and cannot be used as a payload smuggler.
alter table public.survey_responses drop constraint if exists survey_responses_email_shape;
alter table public.survey_responses add constraint survey_responses_email_shape
  check (
    email is null
    or (length(email) between 3 and 254
        and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  );

-- 4. The client has no business setting the id or the timestamp: both have
--    defaults, and a forged submitted_at would quietly corrupt any analysis.
--    Column-level grants let the insert through while refusing those two.
revoke insert on public.survey_responses from anon;
grant insert (source, email, answers, other_text) on public.survey_responses to anon;

-- Verify afterwards:
--   select conname from pg_constraint
--    where conrelid = 'public.survey_responses'::regclass and contype = 'c';
--   -- expect the four constraints above
--
-- Then re-submit the survey once. It must still save; if it does not, the column
-- grant in step 4 is the thing to look at first.
