-- Generated from supabase/follows.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — following: users, imaginations, projects, and cities.
--
-- The shape: one row per (follower, followed thing). A single generic table rather
-- than four, because two of the four things this app lets somebody follow — a
-- project, a city — have no table of their own yet, and a third (another user's
-- account) has a profile that is deliberately unreadable by anyone but its owner
-- (see the note in section 2 of auth.sql). So every follow carries its own label,
-- captured at the moment of following, rather than being joined from elsewhere.
-- That is also why nothing here can answer "who follows this" — only "what does
-- this follower follow".
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after auth.sql. It is written to be safe to re-run.
--
-- Follows are private to the follower: nobody's list of what they follow is
-- readable by anyone but them, the same choice auth.sql makes about a profile
-- rather than the "public to read" choice imaginations.sql makes. A follower count,
-- or a "people who follow this" list, if either is ever wanted, is a new policy and
-- a decision taken on purpose — the same note auth.sql leaves about reading a
-- stranger's profile.
--
-- There is nowhere in the app yet that lets somebody follow a project or a city —
-- neither has a page to follow one from — so in practice this table only ever
-- fills up with 'user' and 'imagination' rows today. It is written for all four
-- from the start so that wiring up a "Follow" control anywhere in the app later is
-- a call to an already-tested function (services/follows.js), not a new table.
--
-- Two warnings the editor will raise, both expected — see auth.sql's header for why.

create extension if not exists pgcrypto;


-- 1. The follow.
create table if not exists public.follows (
  id             uuid        primary key default gen_random_uuid(),
  follower_id    uuid        not null    references auth.users (id) on delete cascade,
  -- 'user', 'imagination', 'project', or 'city'. A plain column rather than four
  -- tables, because the two with no table yet (project, city) need somewhere to
  -- live too, and the shape should not have to change when they get one.
  followed_type  text        not null,
  -- The followed thing's id: an account's uuid for 'user', an imagination's uuid
  -- for 'imagination'. For 'project' and 'city', which have no table to reference,
  -- this is whatever stable identifier the feature that lists them settles on (a
  -- slug), and is treated as an opaque string here either way.
  followed_id    text        not null,
  -- The name to show in a followed list, snapshotted at follow time rather than
  -- joined from elsewhere — see the header for why.
  followed_label text        not null,
  created_at     timestamptz not null    default now()
);

alter table public.follows enable row level security;

-- One follow per thing per person. Pressing "Follow" twice is a no-op, not two rows.
alter table public.follows drop constraint if exists follows_one_per_thing;
alter table public.follows add constraint follows_one_per_thing
  unique (follower_id, followed_type, followed_id);


-- 2. Who may do what.
--
-- A follow list is nobody's business but the follower's — see the header. All three
-- policies are scoped to follower_id = auth.uid() and there is no anon policy at all.
drop policy if exists "a follower can read their own follows" on public.follows;
create policy "a follower can read their own follows"
  on public.follows
  for select
  to authenticated
  using (follower_id = auth.uid());

drop policy if exists "a follower can add a follow" on public.follows;
create policy "a follower can add a follow"
  on public.follows
  for insert
  to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "a follower can remove a follow" on public.follows;
create policy "a follower can remove a follow"
  on public.follows
  for delete
  to authenticated
  using (follower_id = auth.uid());

-- No update policy: a follow is either there or it is not. Changing what a row
-- points at is not something this feature does — unfollow, then follow again.

-- Grants. follower_id is supplied by the client and checked against auth.uid() by
-- the insert policy above, the same shape imaginations.sql uses for user_id.
revoke all on public.follows from anon, authenticated;
grant select (id, follower_id, followed_type, followed_id, followed_label, created_at)
  on public.follows to authenticated;
grant insert (follower_id, followed_type, followed_id, followed_label) on public.follows to authenticated;
grant delete on public.follows to authenticated;

-- What a row may contain.
alter table public.follows drop constraint if exists follows_type_known;
alter table public.follows add constraint follows_type_known
  check (followed_type in ('user', 'imagination', 'project', 'city'));

alter table public.follows drop constraint if exists follows_id_shape;
alter table public.follows add constraint follows_id_shape
  check (length(followed_id) between 1 and 200);

alter table public.follows drop constraint if exists follows_label_shape;
alter table public.follows add constraint follows_label_shape
  check (length(followed_label) between 1 and 200);

-- Following your own account is not a state worth reaching.
alter table public.follows drop constraint if exists follows_not_self;
alter table public.follows add constraint follows_not_self
  check (not (followed_type = 'user' and followed_id = follower_id::text));

comment on table public.follows is
  'One row per (follower, followed thing). Private to the follower.';

create index if not exists follows_follower_idx on public.follows (follower_id, followed_type);


-- Verify, after running the above:
--
--   select relrowsecurity from pg_class where relname = 'follows';
--   select policyname, cmd, roles from pg_policies where tablename = 'follows';
--
-- Expect rls true, one SELECT, one INSERT and one DELETE policy, all for {authenticated}.
