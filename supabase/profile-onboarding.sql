-- PLACER — whether an account has been through the welcome tour.
--
-- The first time somebody signs in, the dashboard opens a five-step tour of the app
-- (OnboardingDialog). Finishing it or closing it sets onboarded_at, so it is shown
-- once per account rather than once per browser. Null means not yet.
--
-- Everyone with an account before this ran has been signing in for a while already,
-- so their rows are marked as onboarded when the column is added: the tour is for
-- people new to the app. That happens only when the column is created, so re-running
-- this file never marks somebody who signed up since and has not seen it.
--
-- Run this once in the Supabase SQL editor, after auth.sql. It is safe to re-run.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarded_at'
  ) then
    alter table public.profiles add column onboarded_at timestamptz;
    update public.profiles set onboarded_at = created_at;
  end if;
end;
$$;

-- The owner-only pattern auth.sql uses for every other column: the policies there
-- already confine reads and writes to the account's own row. profile_public() does
-- not return it, so nobody else can tell.
grant select (onboarded_at) on public.profiles to authenticated;
grant update (onboarded_at) on public.profiles to authenticated;

-- Verify:
--   select count(*) filter (where onboarded_at is null) as not_yet, count(*) from public.profiles;
