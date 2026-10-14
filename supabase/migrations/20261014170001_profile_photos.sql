-- Generated from supabase/profile-photos.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — the profile photos beside people's posts.
--
-- A project's updates and comments show who wrote them, and that should be their
-- photo where they have set one. A photo is already public — profile_public() returns
-- it for one account — but a list of posts has many authors, so this answers for all
-- of them in one call: each account's id and avatar_path, for those that exist, and
-- nothing else of the profile.
--
-- Run this once in the Supabase SQL editor, after media-photos.sql. It is safe to re-run.

create or replace function public.profile_photos(p_ids uuid[])
returns table (id uuid, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.avatar_path
    from public.profiles p
   where p.id = any (p_ids[1:200]);
$$;

revoke all on function public.profile_photos(uuid[]) from public;
grant execute on function public.profile_photos(uuid[]) to anon, authenticated;


-- Verify:
--   select * from public.profile_photos(array(select id from public.profiles limit 3));
