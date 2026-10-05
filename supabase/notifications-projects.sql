-- PLACER — notifications about projects and organisations.
--
-- notifications.sql covers comments and votes on an imagination, a follow of a
-- person, an imagination from someone or some project you follow, and a Toolkit
-- session closing in a project you follow; follows-organisations.sql adds a project
-- from an organisation you follow. This adds the rest:
--
--   Activity   someone you follow starts a project
--   Follower   somebody follows a project you run, or an organisation you are an
--              admin of (notifications.sql only told a person about their profile)
--   Engagement somebody answers a Toolkit tool in a project you run
--
-- "A project you run" means its owner and collaborators, the same members
-- project_can_edit() (media-photos.sql) and the project dashboard recognise.
--
-- Answers can be many, so how loud they are is a choice of its own rather than the
-- Engagement switch: 'every' answer as it comes in (the default), one summary per
-- 'session' when it is closed, or 'off'. It is set once for every project in
-- Settings (notification_preferences.project_responses) and can be overridden for
-- one project from its dashboard (project_notification_settings). Only a new answer
-- counts: a participant changing theirs updates the same row, and a ballot being
-- adjusted live must not become a stream of alerts.
--
-- Two of the functions from notifications.sql are replaced here, in place:
-- notifications_on_follow, which now reaches projects and organisations too, and
-- notifications_on_room_closed, which now also sends the session summary and no
-- longer tells a project's own members what they already hear about as members.
--
-- Run this once in the Supabase SQL editor, after notifications.sql,
-- organisations.sql, media-photos.sql and follows-organisations.sql. It is safe to
-- re-run.


-- 1. How loud answers on your projects are, for every project at once.
alter table public.notification_preferences
  add column if not exists project_responses text not null default 'every';

alter table public.notification_preferences drop constraint if exists notification_preferences_project_responses_known;
alter table public.notification_preferences add constraint notification_preferences_project_responses_known
  check (project_responses in ('every', 'session', 'off'));

grant insert (project_responses) on public.notification_preferences to authenticated;
grant update (project_responses) on public.notification_preferences to authenticated;


-- 2. ...and for one project, over the top of that. A missing row means the
--    account's own default above.
create table if not exists public.project_notification_settings (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  project_id uuid        not null references public.projects (id) on delete cascade,
  responses  text        not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

alter table public.project_notification_settings enable row level security;

alter table public.project_notification_settings drop constraint if exists project_notification_settings_responses_known;
alter table public.project_notification_settings add constraint project_notification_settings_responses_known
  check (responses in ('every', 'session', 'off'));

-- Your own rows only, and only for a project you run: nobody else's answers are
-- yours to be told about.
drop policy if exists "a member can read their project notification settings" on public.project_notification_settings;
create policy "a member can read their project notification settings"
  on public.project_notification_settings
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "a member can set their project notification settings" on public.project_notification_settings;
create policy "a member can set their project notification settings"
  on public.project_notification_settings
  for insert
  to authenticated
  with check (user_id = auth.uid() and public.project_can_edit(project_id));

drop policy if exists "a member can change their project notification settings" on public.project_notification_settings;
create policy "a member can change their project notification settings"
  on public.project_notification_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.project_can_edit(project_id));

drop policy if exists "a member can clear their project notification settings" on public.project_notification_settings;
create policy "a member can clear their project notification settings"
  on public.project_notification_settings
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.project_notification_settings from anon, authenticated;
grant select on public.project_notification_settings to authenticated;
-- user_id and project_id are in the update grant for the same reason
-- notification_preferences' user_id is: an upsert sets every column it is given,
-- and the policies above are what stop either being changed to someone else's.
grant insert (user_id, project_id, responses) on public.project_notification_settings to authenticated;
grant update (user_id, project_id, responses, updated_at) on public.project_notification_settings to authenticated;
grant delete on public.project_notification_settings to authenticated;

comment on table public.project_notification_settings is
  'One row per account per project whose answers it hears about differently from its own default.';


-- 3. Organisations can be linked to now, for a follow of one.
alter table public.notifications drop constraint if exists notifications_link_type_known;
alter table public.notifications add constraint notifications_link_type_known
  check (link_type is null or link_type in ('imagination', 'project', 'organisation'));


-- 4. Helpers. Security definer, because a collaborator cannot read the whole roster
--    through RLS and nobody can read anyone else's preferences; neither is callable
--    from the browser.

-- The accounts that run a project: its owner and its collaborators.
create or replace function public.project_member_ids(p_project_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.owner_id from public.projects p where p.id = p_project_id
  union
  select c.user_id from public.project_collaborators c where c.project_id = p_project_id;
$$;

revoke all on function public.project_member_ids(uuid) from public;

-- 'every', 'session' or 'off' for one member and one project: the project's own
-- setting, else the account's default, else 'every'.
create or replace function public.project_responses_level(p_user_id uuid, p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.responses from public.project_notification_settings s
      where s.user_id = p_user_id and s.project_id = p_project_id),
    (select np.project_responses from public.notification_preferences np
      where np.user_id = p_user_id),
    'every'
  );
$$;

revoke all on function public.project_responses_level(uuid, uuid) from public;

-- A tool's name as the app shows it (src/toolkit/tools.js), for the alert's text.
create or replace function public.toolkit_tool_name(p_tool text)
returns text
language sql
immutable
as $$
  select case p_tool
    when 'budget-ballot' then 'Budget Ballot'
    when 'open-vote'     then 'Open Vote'
    else 'a Toolkit tool'
  end;
$$;


-- 5. Engagement — a new answer in a Toolkit session of a project you run.
create or replace function public.notifications_on_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id   uuid;
  v_tool         text;
  v_project_name text;
begin
  select r.project_id, r.tool into v_project_id, v_tool
    from public.toolkit_rooms r where r.id = new.room_id;
  if v_project_id is null then
    return new;
  end if;

  select p.name into v_project_name from public.projects p where p.id = v_project_id;

  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select m.id, 'engagement', 'New response',
    left(coalesce(new.display_name, 'Someone') || ' answered the '
      || public.toolkit_tool_name(v_tool) || ' in ' || coalesce(v_project_name, 'your project'), 500),
    'project', v_project_id::text
    from public.project_member_ids(v_project_id) as m(id)
   where public.project_responses_level(m.id, v_project_id) = 'every';

  return new;
end;
$$;

revoke all on function public.notifications_on_contribution() from public;

-- After insert only: an update is a participant changing an answer already counted.
drop trigger if exists toolkit_contributions_notify_members on public.toolkit_contributions;
create trigger toolkit_contributions_notify_members
  after insert on public.toolkit_contributions
  for each row execute function public.notifications_on_contribution();


-- 6. Activity and Engagement — a Toolkit session in a project closes. Replaces
--    notifications.sql's version: followers hear about it as before, except the
--    project's own members, who instead get a summary if they chose 'session'.
create or replace function public.notifications_on_room_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
  v_answers      integer;
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
     and f.follower_id not in (select id from public.project_member_ids(new.project_id) as m(id))
     and public.notification_wants(f.follower_id, 'activity');

  select count(*) into v_answers from public.toolkit_contributions c where c.room_id = new.id;

  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select m.id, 'engagement', 'Toolkit session closed',
    left(v_answers || case when v_answers = 1 then ' response' else ' responses' end
      || ' to the ' || public.toolkit_tool_name(new.tool) || ' in '
      || coalesce(v_project_name, 'your project'), 500),
    'project', new.project_id::text
    from public.project_member_ids(new.project_id) as m(id)
   where public.project_responses_level(m.id, new.project_id) = 'session';

  return new;
end;
$$;


-- 7. Follower — somebody follows you, a project you run, or an organisation you are
--    an admin of. Replaces notifications.sql's version, which stopped at people.
create or replace function public.notifications_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower_name text;
  v_name          text;
begin
  select p.display_name into v_follower_name from public.profiles p where p.id = new.follower_id;
  v_follower_name := coalesce(v_follower_name, 'Someone');

  if new.followed_type = 'user' then
    if public.notification_wants(new.followed_id::uuid, 'follower') then
      insert into public.notifications (user_id, category, title, body)
      values (new.followed_id::uuid, 'follower', 'New follower', v_follower_name || ' started following you');
    end if;

  elsif new.followed_type = 'project' then
    select p.name into v_name from public.projects p where p.id::text = new.followed_id;
    insert into public.notifications (user_id, category, title, body, link_type, link_id)
    select m.id, 'follower', 'New follower',
      left(v_follower_name || ' started following ' || coalesce(v_name, 'your project'), 500),
      'project', new.followed_id
      from public.project_member_ids(new.followed_id::uuid) as m(id)
     where m.id <> new.follower_id
       and public.notification_wants(m.id, 'follower');

  elsif new.followed_type = 'organisation' then
    select o.name into v_name from public.organisations o where o.id::text = new.followed_id;
    insert into public.notifications (user_id, category, title, body, link_type, link_id)
    select a.user_id, 'follower', 'New follower',
      left(v_follower_name || ' started following ' || coalesce(v_name, 'your organisation'), 500),
      'organisation', new.followed_id
      from public.organisation_admins a
     where a.organisation_id::text = new.followed_id
       and a.user_id <> new.follower_id
       and public.notification_wants(a.user_id, 'follower');
  end if;

  return new;
end;
$$;


-- 8. Activity — somebody you follow starts a project. Somebody who also follows the
--    organisation it is started in hears about it from that instead
--    (follows-organisations.sql), so not twice.
create or replace function public.notifications_on_project_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, category, title, body, link_type, link_id)
  select f.follower_id, 'activity', 'New project from someone you follow',
    left(new.owner_name || ' started "' || new.name || '"', 500),
    'project', new.id::text
    from public.follows f
   where f.followed_type = 'user'
     and f.followed_id = new.owner_id::text
     and f.follower_id <> new.owner_id
     and public.notification_wants(f.follower_id, 'activity')
     and not (
       new.organisation_id is not null
       and exists (
         select 1 from public.follows o
          where o.follower_id = f.follower_id
            and o.followed_type = 'organisation'
            and o.followed_id = new.organisation_id::text
       )
     );

  return new;
end;
$$;

revoke all on function public.notifications_on_project_created() from public;

drop trigger if exists projects_notify_owner_followers on public.projects;
create trigger projects_notify_owner_followers
  after insert on public.projects
  for each row execute function public.notifications_on_project_created();


-- Verify:
--   select column_name from information_schema.columns
--    where table_name = 'notification_preferences' and column_name = 'project_responses';
--   select tgname from pg_trigger
--    where tgname in ('toolkit_contributions_notify_members', 'projects_notify_owner_followers');
