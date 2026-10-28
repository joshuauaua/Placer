-- Generated from supabase/survey-followups-landing.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — survey_followups covers the landing page's waitlist survey
--
-- Requires survey-followup.sql. Re-runnable. See supabase/README.md section 20.
--
-- The landing page's "Join the Waitlist" survey stores its answers differently from
-- the community survey form: no optIns, an address in `email`, and how somebody
-- would help in answers.section3.coCreation. survey_followups only read optIns, so
-- those responses never showed up. This re-creates the view (survey-followup.sql
-- carries the same definition) with a row for each.

-- The to-do list: one row per request, so a response that asked for the report and
-- a demo shows twice. `contacted` belongs to the response, so ticking it clears both.
create or replace view public.survey_followups
with (security_invoker = true) as
select r.id, r.submitted_at, r.source, a.action,
       coalesce(r.answers->'contact'->>'name', r.answers->>'name') as name,
       coalesce(r.answers->'contact'->>'email', r.email)          as email,
       r.contacted, r.contacted_at, r.notes
from public.survey_responses r
cross join lateral (
  select case o.key
           when 'report' then 'Send the Trends report when it is out'
           when 'beta'   then 'Register the municipality for the beta'
           when 'demo'   then 'Book a 1-on-1 demo'
           else 'Opted into ' || o.key
         end as action
    from jsonb_array_elements_text(
           case when jsonb_typeof(r.answers->'optIns') = 'array' then r.answers->'optIns' else '[]' end
         ) as o(key)
  union all
  -- The landing page's waitlist survey (waitlistSurvey/) has no optIns: leaving an
  -- address is joining the waitlist, and section3.coCreation holds how they would
  -- help, apart from 'survey-only', which asks for nothing.
  select case c.key
           when 'prototype-testing' then 'Invite them to test early prototypes'
           when 'interview'         then 'Book a 15-minute workflow interview'
           when 'case-study'        then 'Take their project on as a test case study'
           else 'Offered to help: ' || c.key
         end
    from jsonb_array_elements_text(
           case jsonb_typeof(r.answers->'section3'->'coCreation')
             when 'array'  then r.answers->'section3'->'coCreation'
             when 'string' then jsonb_build_array(r.answers->'section3'->'coCreation')
             else '[]'
           end
         ) as c(key)
   where c.key <> 'survey-only'
  union all
  select 'Add to the waitlist' where r.source = 'landing_survey' and r.email is not null
  union all
  select 'Confirm the User Labs place' where r.source = 'user_labs_application'
  union all
  select 'Add to the newsletter list' where r.source = 'newsletter_signup'
) a;

revoke all on public.survey_followups from anon, authenticated;

-- Check it landed:
--   select action, count(*) from survey_followups where source = 'landing_survey' group by 1;
