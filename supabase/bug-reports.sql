-- PLACER — bug reports, from the floating "Report a bug" button.
--
-- The shape: one row per report. What somebody typed, the page they were on and the
-- browser they were using — the two things anyone fixing a bug asks first — plus the
-- account that sent it, when they were signed in.
--
-- Same boundary as survey_responses in schema.sql: anyone may add a report, nobody
-- may read one back with the key in the browser. Read them from the SQL editor or
-- with a service_role key, which must never reach the client.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after auth.sql. It is written to be safe to re-run.
--
-- Two warnings the editor will raise, both expected — see auth.sql's header for why.

create extension if not exists pgcrypto;

create table if not exists public.bug_reports (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null    default now(),
  message    text        not null,
  -- The path the report was sent from, e.g. /toolkit/desire-lines.
  page       text        not null    default '',
  user_agent text        not null    default '',
  -- Filled from the session, never from the request body: the column grant below
  -- leaves it out, so a client cannot file a report under somebody else's account.
  -- Null for a signed-out visitor.
  user_id    uuid                    default auth.uid()
                                     references auth.users (id) on delete set null
);

alter table public.bug_reports enable row level security;

drop policy if exists "anyone can file a bug report" on public.bug_reports;
create policy "anyone can file a bug report"
  on public.bug_reports
  for insert
  to anon, authenticated
  with check (true);

-- No select, update or delete policy, on purpose.

-- What a row may contain. The publishable key is public, so anyone can POST here;
-- these bound what any single insert can do.
alter table public.bug_reports drop constraint if exists bug_reports_message_size;
alter table public.bug_reports add constraint bug_reports_message_size
  check (length(btrim(message)) between 1 and 4000);

alter table public.bug_reports drop constraint if exists bug_reports_page_size;
alter table public.bug_reports add constraint bug_reports_page_size
  check (length(page) <= 500);

alter table public.bug_reports drop constraint if exists bug_reports_user_agent_size;
alter table public.bug_reports add constraint bug_reports_user_agent_size
  check (length(user_agent) <= 500);

-- The client sets only what it has to: not the id, not the timestamp, not the account.
revoke insert on public.bug_reports from anon, authenticated;
grant insert (message, page, user_agent) on public.bug_reports to anon, authenticated;

comment on table public.bug_reports is
  'One row per "Report a bug" submission. Append-only from the browser.';

create index if not exists bug_reports_created_at_idx
  on public.bug_reports (created_at desc);

-- Read the latest:
--   select created_at, page, message, user_agent, user_id
--   from public.bug_reports order by created_at desc limit 20;
