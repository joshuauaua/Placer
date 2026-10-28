-- PLACER — following up on survey responses
--
-- Requires schema.sql. Re-runnable. See supabase/README.md section 20.
--
-- Everything here is for the team in the Supabase dashboard, not for the browser.
-- survey_responses keeps every form's answers in one jsonb column, which reads
-- badly in the Table Editor, so this adds:
--
--   * `contacted`, `contacted_at` and `notes` on the table itself: tick the box in
--     Table Editor -> survey_responses once somebody has been followed up, and
--     `contacted_at` stamps itself.
--   * a view per kind of form, with the answers pulled out into columns.
--   * survey_followups: one row per thing somebody asked for, worded as what to do.
--   * survey_response_counts: responses per form per week, for the SQL editor's chart.
--
-- None of it reaches the browser. The insert grants in schema.sql name their
-- columns, so a visitor cannot set `contacted` or `notes`, and there is still no
-- select or update policy. Each view runs with the caller's rights
-- (security_invoker), so for anon and authenticated it would see nothing even if
-- the revokes below were missing.

alter table public.survey_responses add column if not exists contacted    boolean     not null default false;
alter table public.survey_responses add column if not exists contacted_at timestamptz;
alter table public.survey_responses add column if not exists notes        text;

-- Ticking the box records when; unticking clears it.
create or replace function public.survey_response_contacted_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contacted is distinct from old.contacted then
    new.contacted_at := case when new.contacted then now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists survey_responses_contacted_at on public.survey_responses;
create trigger survey_responses_contacted_at
  before update of contacted on public.survey_responses
  for each row execute function public.survey_response_contacted_at();

create index if not exists survey_responses_contacted_idx
  on public.survey_responses (contacted, submitted_at desc);

-- The community, landing and trends surveys share one form (SurveyForm.jsx):
-- module answers, the opt-ins ticked on the closing step, and contact details only
-- when something was opted into.
create or replace view public.survey_form_responses
with (security_invoker = true) as
select
  id,
  submitted_at,
  source,
  contacted,
  contacted_at,
  notes,
  coalesce(answers->'contact'->>'email', email) as email,
  answers->'contact'->>'name'                   as name,
  answers->'contact'->>'city'                   as city,
  answers->'contact'->>'department'             as department,
  answers->'optIns' ? 'report'                  as wants_report,
  answers->'optIns' ? 'beta'                    as wants_beta,
  answers->'optIns' ? 'demo'                    as wants_demo,
  answers->'module1'                            as module1,
  answers->'module2'                            as module2,
  answers->'module3'                            as module3,
  answers->'module4'                            as module4,
  other_text
from public.survey_responses
where source in ('community_survey', 'landing_survey', 'placemaking_trends_survey');

-- User Labs keeps its fields flat in `answers` (UserLabsPage.jsx).
create or replace view public.survey_user_labs
with (security_invoker = true) as
select
  id,
  submitted_at,
  contacted,
  contacted_at,
  notes,
  answers->>'lab'                      as lab,
  answers->>'labDate'                  as lab_date,
  answers->>'name'                     as name,
  email,
  answers->>'phone'                    as phone,
  answers->>'role'                     as role,
  answers->>'motivation'               as motivation,
  answers->>'dietary'                  as dietary,
  coalesce((answers->>'newsletter')::boolean, false) as newsletter
from public.survey_responses
where source = 'user_labs_application';

-- Everyone who wants the newsletter: the footer field, and User Labs applicants
-- who ticked it.
create or replace view public.survey_newsletter
with (security_invoker = true) as
select id, submitted_at, source, email, contacted, contacted_at, notes
from public.survey_responses
where email is not null
  and (source = 'newsletter_signup'
       or (source = 'user_labs_application' and (answers->>'newsletter')::boolean));

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

-- For a chart: run `select * from survey_response_counts` in the SQL editor and
-- switch the result to Chart, week on the x axis.
create or replace view public.survey_response_counts
with (security_invoker = true) as
select date_trunc('week', submitted_at)::date as week,
       source,
       count(*)                               as responses,
       count(*) filter (where contacted)      as contacted
from public.survey_responses
group by 1, 2;

revoke all on public.survey_form_responses,
              public.survey_user_labs,
              public.survey_newsletter,
              public.survey_followups,
              public.survey_response_counts
  from anon, authenticated;

-- Check it landed:
--   select column_name from information_schema.columns
--    where table_name = 'survey_responses' and column_name in ('contacted', 'contacted_at', 'notes');
--   select table_name, privilege_type, grantee from information_schema.role_table_grants
--    where table_name like 'survey\_%' and grantee in ('anon', 'authenticated');
-- Expect three columns, and only INSERT on survey_responses itself for the two roles.
