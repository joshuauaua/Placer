-- Generated from supabase/schema.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — survey responses
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- The shape: one row per finished survey. `answers` holds the per-section answers
-- as jsonb, so rewording, reordering or replacing questions needs no migration,
-- while the fields worth filtering on directly get real columns.
--
-- The editor will warn that this "creates a table without enabling Row Level
-- Security". That check only looks at the create table statement and cannot see
-- the alter table below it, which does enable RLS. Running it as written is safe.

create extension if not exists pgcrypto;

create table if not exists public.survey_responses (
  id           uuid        primary key default gen_random_uuid(),
  submitted_at timestamptz not null    default now(),
  -- Which form it came from: `community_survey` is the /survey route,
  -- `landing_survey` the dialog on the landing page, and -- both served by the
  -- landingpage branch -- `placemaking_trends_survey` the municipal survey and
  -- `user_labs_application` the User Labs sign-up form.
  source       text        not null,
  -- Optional: only present when the visitor asked to be contacted.
  email        text,
  -- { module1: {...}, module2: {...}, module3: {...}, module4: {...} } plus the
  -- closing step: `optIns` (the keys ticked) and `contact` (name, city,
  -- department, email) or null when nothing was opted into.
  answers      jsonb       not null,
  -- Free text typed against an `other` option, keyed by module then question.
  other_text   jsonb       not null    default '{}'::jsonb
);

-- Row-level security is what protects this table. The browser ships the anon
-- key, so the key itself is not a secret; the policy below is the boundary.
-- Enabled immediately after the table so no window exists without it.
alter table public.survey_responses enable row level security;

-- Exactly one thing the anon role may do: add a response.
--
-- The drop is what makes this file re-runnable, and it is why the editor also
-- warns about "destructive operations" — it removes a policy, never any data.
-- Leave it out on a first run if you would rather not see that warning.
drop policy if exists "anon can submit a survey response" on public.survey_responses;
create policy "anon can submit a survey response"
  on public.survey_responses
  for insert
  to anon
  with check (true);

-- No select, update or delete policy for anon, on purpose. Responses cannot be
-- read back, edited or removed with the key in the browser. Read them from the
-- SQL editor or with a service_role key, which must never reach the client.

-- What a row may contain. The publishable key is public, so anyone can POST
-- here; these bound what any single insert can do. See hardening.sql to apply
-- them to a table that already exists.
alter table public.survey_responses drop constraint if exists survey_responses_source_known;
alter table public.survey_responses add constraint survey_responses_source_known
  check (source in ('community_survey', 'landing_survey', 'placemaking_trends_survey', 'user_labs_application'));

alter table public.survey_responses drop constraint if exists survey_responses_answers_size;
alter table public.survey_responses add constraint survey_responses_answers_size
  check (length(answers::text) <= 8000);

alter table public.survey_responses drop constraint if exists survey_responses_other_text_size;
alter table public.survey_responses add constraint survey_responses_other_text_size
  check (length(other_text::text) <= 4000);

alter table public.survey_responses drop constraint if exists survey_responses_email_shape;
alter table public.survey_responses add constraint survey_responses_email_shape
  check (
    email is null
    or (length(email) between 3 and 254
        and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  );

-- The client sets neither the id nor the timestamp: both have defaults, and a
-- forged submitted_at would quietly corrupt any analysis of the results.
revoke insert on public.survey_responses from anon;
grant insert (source, email, answers, other_text) on public.survey_responses to anon;

comment on table public.survey_responses is
  'One row per completed PLACER survey. Append-only from the browser.';

create index if not exists survey_responses_submitted_at_idx
  on public.survey_responses (submitted_at desc);

create index if not exists survey_responses_source_idx
  on public.survey_responses (source);

-- Check it landed the way you expect:
--   select relrowsecurity from pg_class where relname = 'survey_responses';
--   select policyname, cmd, roles from pg_policies where tablename = 'survey_responses';
-- Expect rls true, and one INSERT policy for {anon}.
