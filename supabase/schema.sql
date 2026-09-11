-- PLACER — survey responses
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- It is written to be safe to re-run.
--
-- The shape: one row per finished survey. `answers` holds the per-section answers
-- as jsonb, so rewording, reordering or replacing questions needs no migration,
-- while the fields worth filtering on directly get real columns.

create extension if not exists pgcrypto;

create table if not exists public.survey_responses (
  id           uuid        primary key default gen_random_uuid(),
  submitted_at timestamptz not null    default now(),
  -- Which survey it came from: `community_survey` is the /survey route,
  -- `landing_survey` the dialog on the landing page.
  source       text        not null,
  -- Optional: only present when the visitor asked to be contacted.
  email        text,
  -- { section1: {...}, section2: {...}, section3: {...} }
  answers      jsonb       not null,
  -- Free text typed against an `other` option, keyed by question.
  other_text   jsonb       not null    default '{}'::jsonb
);

comment on table public.survey_responses is
  'One row per completed PLACER survey. Append-only from the browser.';

create index if not exists survey_responses_submitted_at_idx
  on public.survey_responses (submitted_at desc);

create index if not exists survey_responses_source_idx
  on public.survey_responses (source);

-- Row-level security is what protects this table. The browser ships the anon
-- key, so the key itself is not a secret; the policy below is the boundary.
alter table public.survey_responses enable row level security;

-- Exactly one thing the anon role may do: add a response.
drop policy if exists "anon can submit a survey response" on public.survey_responses;
create policy "anon can submit a survey response"
  on public.survey_responses
  for insert
  to anon
  with check (true);

-- No select, update or delete policy for anon, on purpose. Responses cannot be
-- read back, edited or removed with the key in the browser. Read them from the
-- SQL editor or with a service_role key, which must never reach the client.
