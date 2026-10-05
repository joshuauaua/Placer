-- Backfill for 20260913090001_survey_responses.sql: accept newsletter sign-ups.
--
-- The site footer on the landingpage branch has a newsletter field, which saves an
-- email to survey_responses under the source `newsletter_signup`. Production and
-- Development share this database, and the source check did not allow it, so every
-- sign-up was refused with a 400 from PostgREST. schema.sql's list is widened, but
-- 20260913090001 has long been pushed and recorded as applied, so `db push` would
-- never see the edit. This re-issues just the constraint, with every source in use:
-- `toolkit_contribution` is carried over from 20261002090001_toolkit_rename.sql.

alter table public.survey_responses drop constraint if exists survey_responses_source_known;
alter table public.survey_responses add constraint survey_responses_source_known
  check (source in ('community_survey', 'landing_survey', 'placemaking_trends_survey', 'user_labs_application',
                    'toolkit_contribution', 'newsletter_signup'));
