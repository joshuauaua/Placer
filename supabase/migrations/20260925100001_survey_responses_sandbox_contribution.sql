-- Backfill for 20260913090001_survey_responses.sql.
--
-- Same drift as 20260925090001: schema.sql's source list was widened again, this
-- time for `sandbox_contribution` (the Sandbox's Contribute dialog), after
-- 20260913090001 had already been pushed and recorded as applied, so `db push`
-- would never see the edit. Without this the dialog's inserts fail the constraint
-- with a 400 from PostgREST. This re-issues just the constraint.

alter table public.survey_responses drop constraint if exists survey_responses_source_known;
alter table public.survey_responses add constraint survey_responses_source_known
  check (source in ('community_survey', 'landing_survey', 'placemaking_trends_survey', 'user_labs_application', 'sandbox_contribution'));
