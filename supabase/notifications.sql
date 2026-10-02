-- PLACER — notifications: engagement, activity, follower and system alerts.
--
-- The shape: one row per alert, owned by the account it is for. Four kinds —
-- Engagement (a comment or a vote on your own imagination), Activity (a followed
-- user, project or city posts something), Follower (somebody follows your profile)
-- and System (a platform announcement) — one table rather than four, because a
-- notification list reads them back in one feed regardless of kind, the same
-- reasoning follows.sql gives for one followed-thing table instead of several.
--
-- Nothing here is written by the client. Every row is inserted by a trigger
-- function running security definer, the moment the thing it is about happens —
-- a comment lands, a vote comes in, a follow is made, an imagination is posted, a
-- Toolkit room closes. That is why this table, like toolkit_rooms (see rooms.sql's
-- header), has row-level security on and no INSERT policy at all: the only door in
-- is the trigger functions below, not a client library call.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after auth.sql, imaginations.sql, follows.sql and projects.sql — it references
-- all four. It is written to be safe to re-run.
--
-- Email is out of scope here on purpose. notification_preferences below has an
-- `_email` column next to every `_inapp` one, so the choice has somewhere to live
-- and Settings has something to show, but nothing in this file sends mail — that is
-- Resend's job, wired up later against these same preferences. Until then the
-- `_email` columns are stored and otherwise inert.
--
-- Two warnings the editor will raise, both expected — see auth.sql's header for why.

create extension if not exists pgcrypto;


-- 1. The notification.
create table if not exists public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  -- Who it is for. Never the account that caused it — see each trigger below.
  user_id    uuid        not null    references auth.users (id) on delete cascade,
  category   text        not null,
  title      text        not null,
  body       text        not null    default '',
  -- What clicking this notification should open. 'imagination' or 'project' with
  -- an id, or both null when there is nowhere to send somebody — a follower alert,
  -- or a system announcement with no page of its own.
  link_type  text,
  link_id    text,
  -- Null until read. A read receipt rather than a boolean, so "unread" is always
  -- `read_at is null` and a list can sort or filter on when, not just whether.
  read_at    timestamptz,
  created_at timestamptz not null    default now()
);

alter table public.notifications enable row level security;

drop policy if exists "an owner can read their notifications" on public.notifications;
create policy "an owner can read their notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

-- Marking read (or unread) is the only edit a client makes, and the grant below
-- restricts it to the read_at column — title, body and the rest are the trigger
-- functions' to set, once, at insert.
drop policy if exists "an owner can mark their notification read" on public.notifications;
create policy "an owner can mark their notification read"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "an owner can dismiss their notification" on public.notifications;
create policy "an owner can dismiss their notification"
  on public.notifications
  for delete
  to authenticated
  using (user_id = auth.uid());

-- No insert policy — see the header. Grants below cover reading, marking read and
-- dismissing only; every row still gets written, by the security definer trigger
-- functions in section 4, which run as the table owner and so are not stopped by
-- RLS having nothing that admits the authenticated role.
revoke all on public.notifications from anon, authenticated;
grant select (id, category, title, body, link_type, link_id, read_at, created_at)
  on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

alter table public.notifications drop constraint if exists notifications_category_known;
alter table public.notifications add constraint notifications_category_known
  check (category in ('engagement', 'activity', 'follower', 'system'));

alter table public.notifications drop constraint if exists notifications_link_type_known;
alter table public.notifications add constraint notifications_link_type_known
  check (link_type is null or link_type in ('imagination', 'project'));

alter table public.notifications drop constraint if exists notifications_title_shape;
alter table public.notifications add constraint notifications_title_shape
  check (length(trim(title)) between 1 and 200);

alter table public.notifications drop constraint if exists notifications_body_shape;
alter table public.notifications add constraint notifications_body_shape
  check (length(body) <= 500);

comment on table public.notifications is
  'One row per alert. Private to the account it is for. Written only by trigger functions.';

create index if not exists notifications_user_id_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;


-- 2. Preferences — what a person wants to hear about, and on which channel.
--
-- One row per account, created the first time Settings is saved rather than by a
-- trigger at signup: until somebody changes a default, there is nothing to record
-- that reading the defaults in code does not already say. See notification_wants
-- below for what a missing row means.
create table if not exists public.notification_preferences (
  user_id          uuid        primary key references auth.users (id) on delete cascade,
  engagement_inapp boolean     not null default true,
  engagement_email boolean     not null default true,
  activity_inapp   boolean     not null default true,
  activity_email   boolean     not null default true,
  follower_inapp   boolean     not null default true,
  follower_email   boolean     not null default true,
  system_inapp     boolean     not null default true,
  system_email     boolean     not null default true,
  updated_at       timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "an owner can read their notification preferences" on public.notification_preferences;
create policy "an owner can read their notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "an owner can set their notification preferences" on public.notification_preferences;
create policy "an owner can set their notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "an owner can change their notification preferences" on public.notification_preferences;
create policy "an owner can change their notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (
  user_id, engagement_inapp, engagement_email, activity_inapp, activity_email,
  follower_inapp, follower_email, system_inapp, system_email
) on public.notification_preferences to authenticated;
-- user_id is included even though it never actually changes: an upsert's ON
-- CONFLICT DO UPDATE sets every column it was given, this one included, and the
-- WITH CHECK above is what actually stops it being reassigned to someone else's id.
grant update (
  user_id, engagement_inapp, engagement_email, activity_inapp, activity_email,
  follower_inapp, follower_email, system_inapp, system_email, updated_at
) on public.notification_preferences to authenticated;

comment on table public.notification_preferences is
  'One row per account. Absent means every default above — see notification_wants.';


-- 3. Whether an in-app alert of a given category is wanted.
--
-- security definer and reached only from the trigger functions below, never
-- granted to a client role directly — the same shape as project_collaborator_exists
-- in projects.sql. A missing preferences row defaults every category to wanted,
-- matching the column defaults above, so an account that never opened Settings
-- gets every alert exactly as if it had saved the defaults.
create or replace function public.notification_wants(p_user_id uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case p_category
      when 'engagement' then (select np.engagement_inapp from public.notification_preferences np where np.user_id = p_user_id)
      when 'activity'   then (select np.activity_inapp   from public.notification_preferences np where np.user_id = p_user_id)
      when 'follower'   then (select np.follower_inapp   from public.notification_preferences np where np.user_id = p_user_id)
      when 'system'     then (select np.system_inapp     from public.notification_preferences np where np.user_id = p_user_id)
    end,
    true
  );
$$;

revoke all on function public.notification_wants(uuid, text) from public;


-- 4. The triggers that write a notification. Each is security definer so it can
-- insert into notifications and read profiles regardless of whose row-level
-- security would otherwise apply — the same trust boundary imagination_vote and
-- project_add_collaborator already cross.

-- 4a. Engagement — a comment on your own imagination. Not your own comment on it.
create or replace function public.notifications_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  select i.user_id, i.title into v_owner, v_title
    from public.imaginations i where i.id = new.imagination_id;

  if v_owner is not null and v_owner <> new.user_id and public.notification_wants(v_owner, 'engagement') then
    insert into public.notifications (user_id, category, title, body, link_type, link_id)
    values (v_owner, 'engagement', 'New comment',
      new.author_name || ' commented on "' || coalesce(v_title, 'your imagination') || '"',
      'imagination', new.imagination_id::text);
  end if;

  return new;
end;
$$;

drop trigger if exists imagination_comments_notify on public.imagination_comments;
create trigger imagination_comments_notify
  after insert on public.imagination_comments
  for each row execute function public.notifications_on_comment();

-- 4b. Engagement — an upvote on your own imagination. Downvotes, and a vote taken
-- back, stay silent: "receive updates when users ... vote for your Imaginations"
-- is a vote in your favour, not every change to the tally.
create or replace function public.notifications_on_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_title  text;
  v_voter  text;
begin
  if new.value <> 1 or (tg_op = 'UPDATE' and old.value = 1) then
    return new;
  end if;

  select i.user_id, i.title into v_owner, v_title
    from public.imaginations i where i.id = new.imagination_id;

  if v_owner is null or v_owner = new.user_id or not public.notification_wants(v_owner, 'engagement') then
    return new;
  end if;

  select p.display_name into v_voter from public.profiles p where p.id = new.user_id;

  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  values (v_owner, 'engagement', 'New vote',
    coalesce(v_voter, 'Someone') || ' voted for "' || coalesce(v_title, 'your imagination') || '"',
    'imagination', new.imagination_id::text);

  return new;
end;
$$;

drop trigger if exists imagination_votes_notify on public.imagination_votes;
create trigger imagination_votes_notify
  after insert or update on public.imagination_votes
  for each row execute function public.notifications_on_vote();

-- 4c. Follower — somebody follows your profile.
create or replace function public.notifications_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower_name text;
  v_followed_id   uuid;
begin
  if new.followed_type <> 'user' then
    return new;
  end if;

  v_followed_id := new.followed_id::uuid;
  if not public.notification_wants(v_followed_id, 'follower') then
    return new;
  end if;

  select p.display_name into v_follower_name from public.profiles p where p.id = new.follower_id;

  insert into public.notifications (user_id, category, title, body)
  values (v_followed_id, 'follower', 'New follower',
    coalesce(v_follower_name, 'Someone') || ' started following you');

  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notifications_on_follow();

-- 4d. Activity — a followed user or a followed project posts a new imagination.
-- Set-based rather than per-row: any number of followers can match, and there is
-- no row to loop over one at a time the way the single-recipient triggers above do.
create or replace function public.notifications_on_imagination_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select f.follower_id, 'activity', 'New imagination from someone you follow',
    new.author_name || ' posted "' || new.title || '"', 'imagination', new.id::text
    from public.follows f
   where f.followed_type = 'user'
     and f.followed_id = new.user_id::text
     and f.follower_id <> new.user_id
     and public.notification_wants(f.follower_id, 'activity');

  if new.project_id is not null then
    insert into public.notifications (user_id, category, title, body, link_type, link_id)
    select f.follower_id, 'activity', 'New imagination in a project you follow',
      new.author_name || ' posted "' || new.title || '"', 'imagination', new.id::text
      from public.follows f
     where f.followed_type = 'project'
       and f.followed_id = new.project_id::text
       and f.follower_id <> new.user_id
       and public.notification_wants(f.follower_id, 'activity');
  end if;

  return new;
end;
$$;

drop trigger if exists imaginations_notify_followers on public.imaginations;
create trigger imaginations_notify_followers
  after insert on public.imaginations
  for each row execute function public.notifications_on_imagination_posted();

-- 4e. Activity — new Toolkit results for a project you follow: a room attached to
-- that project closes, whether by the facilitator or by running out of time (both
-- set closed_at — see rooms.sql).
create or replace function public.notifications_on_room_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
begin
  if new.project_id is null or new.closed_at is null or old.closed_at is not null then
    return new;
  end if;

  select p.name into v_project_name from public.projects p where p.id = new.project_id;

  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select f.follower_id, 'activity', 'New Toolkit results',
    'A Toolkit session in ' || coalesce(v_project_name, 'a project you follow') || ' has closed',
    'project', new.project_id::text
    from public.follows f
   where f.followed_type = 'project'
     and f.followed_id = new.project_id::text
     and public.notification_wants(f.follower_id, 'activity');

  return new;
end;
$$;

drop trigger if exists toolkit_rooms_notify_followers on public.toolkit_rooms;
create trigger toolkit_rooms_notify_followers
  after update on public.toolkit_rooms
  for each row execute function public.notifications_on_room_closed();


-- Verify, after running the above:
--
--   select relrowsecurity from pg_class where relname in ('notifications', 'notification_preferences');
--   select policyname, cmd, roles from pg_policies where tablename in ('notifications', 'notification_preferences');
--   select tgname from pg_trigger where tgrelid = 'public.notifications'::regclass and not tgisinternal;
--
-- Expect rls true on both; notifications with one SELECT, one UPDATE and one DELETE
-- policy and no INSERT; notification_preferences with SELECT, INSERT and UPDATE;
-- and five trigger functions installed on the other tables (comments, votes,
-- follows, imaginations, toolkit_rooms), none directly on notifications itself.
