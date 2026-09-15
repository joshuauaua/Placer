-- Generated from supabase/auth.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — accounts and profiles.
--
-- The shape: Supabase Auth owns the login — the email address, the password hash,
-- the Google identity, the confirmation state — and none of that is ours to store.
-- What is ours is the part of a person the app actually shows: the name on their
-- imaginations and the couple of lines about themselves. That is one row per
-- account in public.profiles, keyed to auth.users, created by a trigger the moment
-- an account exists.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after schema.sql. It is written to be safe to re-run.
--
-- This file is the first in the project to mention auth.uid() or the authenticated
-- role; every policy in schema.sql and rooms.sql is `to anon`. The reason is not
-- that the other tables were written badly, it is that until now nobody signed in,
-- so the only boundary available was "what may an anonymous browser do". Rooms in
-- particular are capability-based for exactly that reason: a room's uuid is the
-- ticket, because there was no account to check against. Accounts give a second
-- kind of boundary, and a profile is the first thing that genuinely belongs to a
-- person rather than to a browser.
--
-- Two warnings the editor will raise on this file, both expected. It says a table
-- is created "without enabling Row Level Security" — that check only looks at the
-- create table statement and cannot see the alter table below it. And it flags the
-- drops as "destructive operations" — they remove policies, triggers and
-- constraints so the file can be re-run, never any data.


-- 1. The profile.
--
-- The primary key is the auth.users id rather than an id of its own: there is
-- exactly one profile per account and no reason to be able to say otherwise. The
-- cascade is what makes deleting an account delete the profile with it, without a
-- second statement that could be forgotten.
create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  -- Never null. What an imagination is credited to, so the app always has a name
  -- to show; the trigger in section 3 guarantees one exists from the first moment.
  display_name text        not null,
  bio          text        not null    default '',
  created_at   timestamptz not null    default now(),
  updated_at   timestamptz not null    default now()
);

-- Row-level security is what protects this table. The browser ships the anon key,
-- so the key itself is not a secret; the policies below are the boundary.
-- Enabled immediately after the table so no window exists without it.
alter table public.profiles enable row level security;


-- 2. Who may do what.
--
-- Only the two things an account needs on its own profile. Both are scoped by
-- auth.uid(), which is the account id carried in the request's JWT and cannot be
-- set by the client.
drop policy if exists "an owner can read their profile" on public.profiles;
create policy "an owner can read their profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "an owner can rename themselves" on public.profiles;
create policy "an owner can rename themselves"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No policy for anon at all, on purpose: a signed-out visitor has no profile to
-- read and no business reading anyone else's. Note that this also means a signed-in
-- account cannot read a *stranger's* profile — there is no policy that would let it.
-- That is deliberate, and it is why the author's name is copied onto each
-- imagination when it is posted rather than joined from here: the public half of a
-- person is published with the thing they published, and the profile row itself
-- stays private. Public profile pages, if they are ever wanted, are a new policy
-- exposing display_name and should be a decision taken on purpose.
--
-- No insert policy either: rows are created by profile_create_for_new_user() in
-- section 3, which is security definer and so is not subject to these policies. A
-- client that could insert here could give itself a profile for an account that
-- does not exist.
--
-- And no delete policy: deleting the auth.users row cascades, and a profile with no
-- account is not a state worth being able to reach.

-- Column grants as well as the policies: the client never sets its own timestamps,
-- and updated_at in particular would be worth nothing if a client could forge it.
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name, bio, created_at, updated_at) on public.profiles to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;

-- What a profile may contain. These bound what any single update can do; the key in
-- the browser is public, so anyone with an account can PATCH here.
alter table public.profiles drop constraint if exists profiles_display_name_shape;
alter table public.profiles add constraint profiles_display_name_shape
  check (length(trim(display_name)) between 1 and 50);

alter table public.profiles drop constraint if exists profiles_bio_size;
alter table public.profiles add constraint profiles_bio_size
  check (length(bio) <= 500);

comment on table public.profiles is
  'One row per account. Created by profile_create_for_new_user(); renamed by its owner.';


-- 3. A profile for every new account.
--
-- A trigger rather than an insert from the browser, because the browser is not
-- reliably there. A Google sign-in returns straight from the provider and an
-- email signup does not come back at all until the confirmation link is clicked,
-- possibly on another device — a client-side insert would be skipped in both cases
-- and leave an account with no name to show.
--
-- display_name is whatever we can find, in descending order of how much the person
-- chose it: the name typed into the signup form, the name Google gives us, then the
-- local part of the email address as a last resort. It is truncated to 50 to satisfy
-- profiles_display_name_shape — a check violation here would abort the insert into
-- auth.users, which is to say it would break signing up altogether.
create or replace function public.profile_create_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Someone'
      ),
      50
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Owned by the postgres role, so it is not something a client can call to mint
-- profiles: it runs only as the trigger below.
revoke all on function public.profile_create_for_new_user() from public;

drop trigger if exists profile_on_new_user on auth.users;
create trigger profile_on_new_user
  after insert on auth.users
  for each row execute function public.profile_create_for_new_user();


-- 4. Keeping updated_at honest.
--
-- The client has no grant on updated_at, so this is the only thing that moves it.
create or replace function public.profile_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.profile_touch_updated_at() from public;

drop trigger if exists profile_on_update on public.profiles;
create trigger profile_on_update
  before update on public.profiles
  for each row execute function public.profile_touch_updated_at();


-- Verify, after running the above:
--
--   -- RLS on, and the two owner-scoped policies:
--   select relname, relrowsecurity from pg_class where relname = 'profiles';
--   select policyname, cmd, roles from pg_policies where tablename = 'profiles';
--
--   -- Both triggers present:
--   select tgname from pg_trigger
--    where tgrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
--      and not tgisinternal;
--
--   -- One profile per account, and nobody without a name:
--   select u.email, p.display_name
--     from auth.users u left join public.profiles p on p.id = u.id
--    order by u.created_at desc;
--
-- Expect rls true, one SELECT and one UPDATE policy both for {authenticated},
-- profile_on_new_user and profile_on_update, and no null display_name.
