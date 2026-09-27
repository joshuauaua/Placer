-- PLACER — public profiles.
--
-- auth.sql keeps public.profiles private to its owner and says that public profile
-- pages, if they were ever wanted, should be a decision taken on purpose. This is
-- that decision: every account has a page at /people/<id> showing its display
-- name, avatar icon, bio and location, next to what it has posted.
--
-- It is a function rather than a select policy on the table. A policy `using
-- (true)` would let anybody with the public anon key list every profile in one
-- request; this answers for one account at a time, by an id nobody can guess, and
-- only with the four columns a profile page shows. The table itself stays exactly
-- as private as auth.sql left it.
--
-- Run this once in the Supabase SQL editor, after auth.sql. It is safe to re-run.

create or replace function public.profile_public(p_id uuid)
returns table (
  id           uuid,
  display_name text,
  bio          text,
  location     text,
  avatar       text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.bio, p.location, p.avatar
    from public.profiles p
   where p.id = p_id;
$$;

revoke all on function public.profile_public(uuid) from public;
grant execute on function public.profile_public(uuid) to anon, authenticated;


-- Verify, after running the above:
--
--   -- One row for an account that exists, none for one that does not:
--   select * from public.profile_public((select id from public.profiles limit 1));
--   select * from public.profile_public(gen_random_uuid());
--
--   -- And the table itself is still closed to anon (expect []):
--   curl -s "https://<project-ref>.supabase.co/rest/v1/profiles?select=display_name" \
--     -H "apikey: <anon key>"
