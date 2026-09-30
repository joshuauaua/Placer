-- Generated from supabase/follows-organisations.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — following organisations.
--
-- follows.sql made one table for everything a profile can follow, so that adding a
-- kind is a matter of letting it in rather than a new table. This lets organisations
-- in, next to people ('user') and projects, which the app now has Follow buttons for
-- on their public pages. followed_id is the organisation's uuid, as text, the same as
-- a project's.
--
-- Two more things come with it, each the organisation twin of one a project has:
--
--   - Closing an organisation takes it off everyone's followed list, the way
--     project-delete.sql does for a deleted project — follows.followed_id is a string,
--     so nothing cascades there on its own.
--   - Starting a project in an organisation's name tells its followers, as an
--     Activity notification, the same category a followed project's new imagination
--     uses (notifications.sql, 4d), and only for followers who want those.
--
-- Run this once in the Supabase SQL editor, after follows.sql, notifications.sql and
-- organisations.sql. It is safe to re-run.


-- 1. Let organisations be followed.
alter table public.follows drop constraint if exists follows_type_known;
alter table public.follows add constraint follows_type_known
  check (followed_type in ('user', 'imagination', 'project', 'city', 'organisation'));


-- 2. Closing an organisation removes everybody's follows of it.
create or replace function public.organisation_delete_follows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
   where followed_type = 'organisation'
     and followed_id = old.id::text;
  return old;
end;
$$;

revoke all on function public.organisation_delete_follows() from public;

drop trigger if exists organisations_delete_follows on public.organisations;
create trigger organisations_delete_follows
  after delete on public.organisations
  for each row
  execute function public.organisation_delete_follows();


-- 3. A new project in a followed organisation's name.
--
-- On insert, and on an update that puts an organisation's name on a project that did
-- not have it — both are the moment the project first appears on the organisation's
-- page. Whoever did it is not told about their own project.
create or replace function public.notifications_on_organisation_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_name text;
begin
  if new.organisation_id is null
     or (tg_op = 'UPDATE' and new.organisation_id is not distinct from old.organisation_id) then
    return new;
  end if;

  select o.name into v_organisation_name from public.organisations o where o.id = new.organisation_id;

  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select f.follower_id, 'activity', 'New project from an organisation you follow',
    left(coalesce(v_organisation_name, 'An organisation') || ' started "' || new.name || '"', 500),
    'project', new.id::text
    from public.follows f
   where f.followed_type = 'organisation'
     and f.followed_id = new.organisation_id::text
     and f.follower_id is distinct from auth.uid()
     and public.notification_wants(f.follower_id, 'activity');

  return new;
end;
$$;

revoke all on function public.notifications_on_organisation_project() from public;

drop trigger if exists projects_notify_organisation_followers on public.projects;
create trigger projects_notify_organisation_followers
  after insert or update of organisation_id on public.projects
  for each row execute function public.notifications_on_organisation_project();


-- Verify:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'follows_type_known';
--   select tgname from pg_trigger
--    where tgname in ('organisations_delete_follows', 'projects_notify_organisation_followers');
