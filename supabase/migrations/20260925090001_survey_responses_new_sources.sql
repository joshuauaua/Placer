-- Backfill for 20260913090001_survey_responses.sql.
--
-- Same drift as 20260922130002's open-vote fix: schema.sql's source list was
-- widened after 20260913090001 had already been pushed and recorded as applied, so
-- `db push` never saw the edit. Live still allowed only the two community sources,
-- so the landingpage branch's placemaking trends survey and User Labs sign-up form
-- failed the constraint with a 400 from PostgREST. This re-issues just the part
-- that never ran.

alter table public.survey_responses drop constraint if exists survey_responses_source_known;
alter table public.survey_responses add constraint survey_responses_source_known
  check (source in ('community_survey', 'landing_survey', 'placemaking_trends_survey', 'user_labs_application'));
