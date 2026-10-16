-- Generated from supabase/case-study-submissions.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — case study submissions, from the Resources page's "Submit a case study" form.
--
-- The shape: one row per submission. A customer or partner tells us about a project they
-- ran with PLACER — who they are, the problem, what was done, what came of it — and who
-- to contact about it, so the content team can turn it into a published case study.
-- When they were signed in, the row also keeps the account that sent it, and may point
-- at a logo and a picture they uploaded (R2 keys, through the `media` Edge Function,
-- under 'case-studies/<user id>/').
--
-- Same boundary as tool_submissions: anyone may add a submission, nobody may read one
-- back with the key in the browser. The content team reads them in the Table Editor or
-- the SQL editor, or with a service_role key, which must never reach the client.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after auth.sql. It is written to be safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.case_study_submissions (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null    default now(),
  company        text        not null,
  industry       text        not null,
  problem        text        not null,
  solution       text        not null,
  results        text        not null,
  testimonial    text,
  contact_name   text        not null,
  contact_email  text        not null,
  logo_path      text,
  image_path     text,
  -- Filled from the session, never from the request body: the column grant below
  -- leaves it out, so a client cannot submit under somebody else's account.
  -- Null for a signed-out visitor.
  user_id        uuid                    default auth.uid()
                                         references auth.users (id) on delete set null
);

alter table public.case_study_submissions enable row level security;

drop policy if exists "anyone can submit a case study" on public.case_study_submissions;
create policy "anyone can submit a case study"
  on public.case_study_submissions
  for insert
  to anon, authenticated
  with check (true);

-- No select, update or delete policy, on purpose.

-- What a row may contain. The publishable key is public, so anyone can POST here;
-- these bound what any single insert can do.
alter table public.case_study_submissions drop constraint if exists case_study_submissions_company_size;
alter table public.case_study_submissions add constraint case_study_submissions_company_size
  check (length(btrim(company)) between 1 and 200);

alter table public.case_study_submissions drop constraint if exists case_study_submissions_industry_size;
alter table public.case_study_submissions add constraint case_study_submissions_industry_size
  check (length(btrim(industry)) between 1 and 120);

alter table public.case_study_submissions drop constraint if exists case_study_submissions_story_size;
alter table public.case_study_submissions add constraint case_study_submissions_story_size
  check (length(btrim(problem)) between 1 and 4000
     and length(btrim(solution)) between 1 and 4000
     and length(btrim(results)) between 1 and 4000
     and (testimonial is null or length(testimonial) <= 2000));

alter table public.case_study_submissions drop constraint if exists case_study_submissions_contact_name_size;
alter table public.case_study_submissions add constraint case_study_submissions_contact_name_size
  check (length(btrim(contact_name)) between 1 and 200);

-- Loose on purpose, the same test the form makes: something@something.something.
alter table public.case_study_submissions drop constraint if exists case_study_submissions_email_shape;
alter table public.case_study_submissions add constraint case_study_submissions_email_shape
  check (length(contact_email) <= 320
     and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- A picture may only be one the sender uploaded to their own folder — and a signed-out
-- visitor has no folder, so cannot point at anybody's picture.
alter table public.case_study_submissions drop constraint if exists case_study_submissions_pictures_own;
alter table public.case_study_submissions add constraint case_study_submissions_pictures_own
  check ((logo_path is null or (user_id is not null and logo_path like 'case-studies/' || user_id::text || '/%'))
     and (image_path is null or (user_id is not null and image_path like 'case-studies/' || user_id::text || '/%')));

-- The client sets only what it has to: not the id, not the timestamp, not the account.
revoke insert on public.case_study_submissions from anon, authenticated;
grant insert (company, industry, problem, solution, results, testimonial,
              contact_name, contact_email, logo_path, image_path)
  on public.case_study_submissions to anon, authenticated;

comment on table public.case_study_submissions is
  'One row per Resources "Submit a case study" submission. Append-only from the browser.';

create index if not exists case_study_submissions_created_at_idx
  on public.case_study_submissions (created_at desc);

-- Read the latest:
--   select created_at, company, industry, contact_name, contact_email, logo_path, image_path
--   from public.case_study_submissions order by created_at desc limit 20;
