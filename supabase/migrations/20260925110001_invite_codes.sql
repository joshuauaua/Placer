-- Generated from supabase/invites.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — invite codes, for the closed beta.
--
-- While the app is in beta, creating an account needs a code. Signing in to an
-- account that already exists does not: the gate is on the insert into auth.users,
-- so it only ever sees new accounts, and nobody who already has one is locked out.
--
-- The check lives in the database rather than the signup form because the form is
-- in the browser, and anything in the browser can be skipped. The anon key is
-- public, so anybody can call Supabase's /auth/v1/signup directly; a trigger on
-- auth.users is the one place every route to a new account passes through — email,
-- Google, Apple, phone, and the dashboard's own "Add user".
--
-- That last one is a consequence worth knowing: an account made by hand in the
-- dashboard needs a code too, and the dashboard has no field to give one. Make a
-- code and sign up through the app instead, or pass the code as user metadata
-- (`invite_code`) through the admin API.
--
-- So do new Google and Apple accounts. A provider sign-in has no way to carry the
-- code through to the insert, so for a brand new account it is refused; somebody who
-- already has an account can still use either to sign in. The signup form therefore
-- offers only email and password.
--
-- Run this once in the Supabase SQL editor, after auth.sql. It is written to be safe
-- to re-run. To open signups to everyone when the beta ends, drop the trigger:
--
--   drop trigger if exists invite_code_on_new_user on auth.users;


-- 1. The codes.
--
-- The code itself is the key, stored upper case so that what somebody types does
-- not have to match the case it was handed out in. max_uses is how many accounts a
-- code can make — 1 for a code sent to one person, more for one read out to a room.
-- uses is only ever moved by the trigger in section 3.
create table if not exists public.invite_codes (
  code       text        primary key,
  max_uses   integer     not null default 1,
  uses       integer     not null default 0,
  -- Who it was for, or where it was handed out. For whoever reads this table later.
  note       text        not null default '',
  -- Null for a code that never expires.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

-- No policies and no grants: neither anon nor authenticated may read or write this
-- table at all. Listing the codes would be handing them out. The only way a client
-- touches it is the two security definer functions below, one of which answers a
-- single yes or no and the other of which runs only as a trigger.
revoke all on public.invite_codes from anon, authenticated;

alter table public.invite_codes drop constraint if exists invite_codes_code_shape;
alter table public.invite_codes add constraint invite_codes_code_shape
  check (code = upper(code) and length(code) between 4 and 64);

alter table public.invite_codes drop constraint if exists invite_codes_uses_in_range;
alter table public.invite_codes add constraint invite_codes_uses_in_range
  check (max_uses >= 1 and uses >= 0 and uses <= max_uses);

comment on table public.invite_codes is
  'Beta invite codes. A new account needs one; see invite_code_redeem().';


-- 2. Is this code any good?
--
-- For the signup form, so a mistyped code gets a sentence rather than the generic
-- "Database error saving new user" Supabase returns when the trigger refuses. It is
-- a courtesy only: the trigger checks again, and that check is the one that counts.
-- It answers true or false and nothing else — not how many uses are left, not what
-- the note says.
create or replace function public.invite_code_check(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invite_codes
     where code = upper(trim(p_code))
       and uses < max_uses
       and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function public.invite_code_check(text) from public;
grant execute on function public.invite_code_check(text) to anon, authenticated;


-- 3. Spending one.
--
-- Before insert, so a refusal stops the account from ever existing. The update is
-- conditional on there being a use left, which makes two people racing for the last
-- use of a code safe: the second update matches no row and is refused.
--
-- The code arrives as user metadata, which signUpWithPassword in
-- src/services/auth.js passes alongside the display name. It stays on the account
-- afterwards, which is how to see who came in on which code (query in the verify
-- block at the end).
create or replace function public.invite_code_redeem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  given text := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
begin
  if given = '' then
    raise exception 'An invite code is needed to create an account during the beta.'
      using errcode = 'check_violation';
  end if;

  update public.invite_codes
     set uses = uses + 1
   where code = given
     and uses < max_uses
     and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'That invite code is not valid, or has been used up.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.invite_code_redeem() from public;

drop trigger if exists invite_code_on_new_user on auth.users;
create trigger invite_code_on_new_user
  before insert on auth.users
  for each row execute function public.invite_code_redeem();


-- Handing codes out. There is no screen for this; it is the SQL editor.
--
--   -- One code for one person:
--   insert into public.invite_codes (code, note) values ('PLACER-MARA', 'Mara, by email');
--
--   -- One code for a workshop of thirty, good until the end of the month:
--   insert into public.invite_codes (code, max_uses, note, expires_at)
--   values ('MALMO-WORKSHOP', 30, 'Malmö workshop', '2026-10-31');
--
--   -- Ten random single-use codes at once:
--   insert into public.invite_codes (code, note)
--   select upper(substr(md5(gen_random_uuid()::text), 1, 8)), 'batch 1'
--     from generate_series(1, 10)
--   returning code;
--
--   -- Withdraw one, used or not (the accounts it made are untouched):
--   update public.invite_codes set expires_at = now() where code = 'PLACER-MARA';


-- Verify, after running the above:
--
--   -- RLS on, and no policies (so no client can read the codes):
--   select relrowsecurity from pg_class where relname = 'invite_codes';
--   select policyname from pg_policies where tablename = 'invite_codes';
--
--   -- The trigger is there, and runs before the profile trigger:
--   select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
--   -- What each code is doing, and who came in on it:
--   select c.code, c.uses, c.max_uses, c.note, c.expires_at from public.invite_codes c;
--   select u.email, u.raw_user_meta_data ->> 'invite_code' as code, u.created_at
--     from auth.users u order by u.created_at desc;
--
-- Expect rls true, no policy rows, and invite_code_on_new_user alongside
-- profile_on_new_user.
