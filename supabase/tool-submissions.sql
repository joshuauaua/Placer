-- PLACER — tool submissions, from the Sandbox's "Contribute" form.
--
-- The shape: one row per submission. Somebody has a placemaking or participatory
-- design tool they would like in the PLACER Toolkit, and tells us its name, what it
-- does, and an email address to reach them at — plus the account that sent it, when
-- they were signed in.
--
-- Same boundary as bug_reports: anyone may add a submission, nobody may read one back
-- with the key in the browser. Read them from the SQL editor or with a service_role
-- key, which must never reach the client.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after auth.sql. It is written to be safe to re-run.
--
-- Two warnings the editor will raise, both expected — see auth.sql's header for why.

create extension if not exists pgcrypto;

create table if not exists public.tool_submissions (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null    default now(),
  title       text        not null,
  description text        not null,
  email       text        not null,
  -- Filled from the session, never from the request body: the column grant below
  -- leaves it out, so a client cannot submit under somebody else's account.
  -- Null for a signed-out visitor.
  user_id     uuid                    default auth.uid()
                                      references auth.users (id) on delete set null
);

alter table public.tool_submissions enable row level security;

drop policy if exists "anyone can submit a tool" on public.tool_submissions;
create policy "anyone can submit a tool"
  on public.tool_submissions
  for insert
  to anon, authenticated
  with check (true);

-- No select, update or delete policy, on purpose.

-- What a row may contain. The publishable key is public, so anyone can POST here;
-- these bound what any single insert can do.
alter table public.tool_submissions drop constraint if exists tool_submissions_title_size;
alter table public.tool_submissions add constraint tool_submissions_title_size
  check (length(btrim(title)) between 1 and 200);

alter table public.tool_submissions drop constraint if exists tool_submissions_description_size;
alter table public.tool_submissions add constraint tool_submissions_description_size
  check (length(btrim(description)) between 1 and 4000);

-- Loose on purpose, the same test the form makes: something@something.something.
alter table public.tool_submissions drop constraint if exists tool_submissions_email_shape;
alter table public.tool_submissions add constraint tool_submissions_email_shape
  check (length(email) <= 320 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- The client sets only what it has to: not the id, not the timestamp, not the account.
revoke insert on public.tool_submissions from anon, authenticated;
grant insert (title, description, email) on public.tool_submissions to anon, authenticated;

comment on table public.tool_submissions is
  'One row per Sandbox "Contribute" submission. Append-only from the browser.';

create index if not exists tool_submissions_created_at_idx
  on public.tool_submissions (created_at desc);

-- Read the latest:
--   select created_at, title, email, description, user_id
--   from public.tool_submissions order by created_at desc limit 20;
