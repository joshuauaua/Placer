-- Backfill for 20260913090001_survey_responses.sql: accept the case study form.
--
-- The "Add a case study" form (src/components/CaseStudyPage.jsx, at /add-a-case-study)
-- saves into survey_responses under the source `case_study_submission`, with its
-- pictures as data URLs in `answers`. Production and Development share this database,
-- and neither check allowed it: the source was not in the list, and 8000 characters of
-- answers is less than the form's own text limits, before any picture. schema.sql's
-- checks are widened, but 20260913090001 has long been pushed and recorded as applied,
-- so `db push` would never see the edit. This re-issues just the two constraints.

alter table public.survey_responses drop constraint if exists survey_responses_source_known;
alter table public.survey_responses add constraint survey_responses_source_known
  check (source in ('community_survey', 'landing_survey', 'placemaking_trends_survey', 'user_labs_application',
                    'toolkit_contribution', 'newsletter_signup', 'case_study_submission'));

alter table public.survey_responses drop constraint if exists survey_responses_answers_size;
alter table public.survey_responses add constraint survey_responses_answers_size
  -- 8000 for every form but the case study, which carries up to seven pictures,
  -- each at most 1600px and re-encoded on the device (src/lib/pictureEncode.js).
  check (length(answers::text) <= 8000
         or (source = 'case_study_submission' and length(answers::text) <= 6000000));
