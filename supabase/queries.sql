-- PLACER — reading the survey responses.
-- Run these in the Supabase SQL editor, which uses a privileged role and is not
-- bound by the anon insert-only policy.

-- How many, and from where.
select source, count(*) as responses, max(submitted_at) as latest
from public.survey_responses
group by source
order by responses desc;

-- Question 1, who is answering.
select answers -> 'section1' ->> 'persona' as persona, count(*)
from public.survey_responses
group by persona
order by count(*) desc;

-- A multiple-choice question: one row per answer picked.
select tool, count(*)
from public.survey_responses,
     jsonb_array_elements_text(answers -> 'section2' -> 'toolStack') as tool
group by tool
order by count(*) desc;

-- The ranked question, scored by position: first choice scores highest.
select feature,
       count(*)                       as times_picked,
       round(avg(position), 2)        as mean_rank
from public.survey_responses,
     jsonb_array_elements_text(answers -> 'section3' -> 'featurePriorities')
       with ordinality as ranked(feature, position)
group by feature
order by mean_rank;

-- Anyone who asked to be involved further and left an address.
select submitted_at,
       email,
       answers -> 'section3' -> 'coCreation' as wants,
       other_text
from public.survey_responses
where email is not null
order by submitted_at desc;
