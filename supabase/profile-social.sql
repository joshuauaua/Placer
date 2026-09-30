-- PLACER — followers, following and organisations on a public profile.
--
-- A public profile (/people/<id>) now shows how many people follow the account and
-- how many things it follows, each opening a list, and the organisations it is an
-- admin of.
--
-- This is the decision follows.sql's header said would have to be taken on purpose:
-- until now a follow was private to the follower and nothing could answer "who
-- follows this". It is taken here, narrowly. The follows table keeps exactly the
-- policies it had — still readable only by the follower — and these functions answer
-- for one profile at a time, the way profile_public() does rather than a select policy
-- on the table. Only people, organisations and projects are shown as followed;
-- imaginations and cities stay private. The same goes for organisations: the admin
-- roster stays readable only by admins, and this answers only which organisations
-- one account runs, never who else runs them.
--
-- Names and pictures are read live from their own tables rather than from the label
-- snapshotted on the follow, so a renamed person or organisation shows its new name.
-- Anything followed that has since gone (a deleted account, say) is left out.
--
-- Run this once in the Supabase SQL editor, after follows-organisations.sql and
-- organisation-covers.sql. It is safe to re-run.


-- 1. The two numbers.
create or replace function public.profile_follow_counts(p_user_id uuid)
returns table (followers integer, following integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int
       from public.follows f
       join public.profiles p on p.id = f.follower_id
      where f.followed_type = 'user' and f.followed_id = p_user_id::text),
    (select count(*)::int
       from public.follows f
      where f.follower_id = p_user_id
        and (
          (f.followed_type = 'user'
            and exists (select 1 from public.profiles p where p.id::text = f.followed_id))
          or (f.followed_type = 'organisation'
            and exists (select 1 from public.organisations o where o.id::text = f.followed_id))
          or (f.followed_type = 'project'
            and exists (select 1 from public.projects pr where pr.id::text = f.followed_id))
        ));
$$;

revoke all on function public.profile_follow_counts(uuid) from public;
grant execute on function public.profile_follow_counts(uuid) to anon, authenticated;


-- 2. Who follows this account, newest first.
create or replace function public.profile_followers(p_user_id uuid)
returns table (id uuid, name text, image_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_path
    from public.follows f
    join public.profiles p on p.id = f.follower_id
   where f.followed_type = 'user' and f.followed_id = p_user_id::text
   order by f.created_at desc
   limit 500;
$$;

revoke all on function public.profile_followers(uuid) from public;
grant execute on function public.profile_followers(uuid) to anon, authenticated;


-- 3. What this account follows — people, organisations and projects — newest first.
create or replace function public.profile_following(p_user_id uuid)
returns table (kind text, id uuid, name text, image_path text)
language sql
stable
security definer
set search_path = public
as $$
  select kind, id, name, image_path from (
    select 'user'::text as kind, p.id, p.display_name as name, p.avatar_path as image_path, f.created_at
      from public.follows f join public.profiles p on p.id::text = f.followed_id
     where f.follower_id = p_user_id and f.followed_type = 'user'
    union all
    select 'organisation', o.id, o.name, o.cover_path, f.created_at
      from public.follows f join public.organisations o on o.id::text = f.followed_id
     where f.follower_id = p_user_id and f.followed_type = 'organisation'
    union all
    select 'project', pr.id, pr.name, pr.image_path, f.created_at
      from public.follows f join public.projects pr on pr.id::text = f.followed_id
     where f.follower_id = p_user_id and f.followed_type = 'project'
  ) followed
  order by created_at desc
  limit 500;
$$;

revoke all on function public.profile_following(uuid) from public;
grant execute on function public.profile_following(uuid) to anon, authenticated;


-- 4. The organisations this account is an admin of, by name.
create or replace function public.profile_organisations(p_user_id uuid)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name
    from public.organisation_admins a
    join public.organisations o on o.id = a.organisation_id
   where a.user_id = p_user_id
   order by o.name;
$$;

revoke all on function public.profile_organisations(uuid) from public;
grant execute on function public.profile_organisations(uuid) to anon, authenticated;


-- Verify:
--   select * from public.profile_follow_counts((select id from public.profiles limit 1));
--   select * from public.profile_following((select id from public.profiles limit 1));
