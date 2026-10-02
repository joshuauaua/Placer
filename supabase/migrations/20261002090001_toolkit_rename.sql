-- Hand-written: renames the Sandbox's database objects to the Toolkit's.
--
-- The app's Sandbox is now the Toolkit, and an experiment is now a tool. The master
-- files (rooms.sql, rooms-lifetime.sql, rooms-delete.sql, rooms-cleanup.sql,
-- projects.sql, notifications.sql) were renamed to match, and the migrations
-- generated from them regenerated -- but a database that already ran those under
-- their old names never replays them. This catches it up, in place:
--
--   sandbox_rooms                 -> toolkit_rooms        (column experiment -> tool)
--   sandbox_contributions         -> toolkit_contributions
--   sandbox_room_* / sandbox_contribution_save -> toolkit_room_* / toolkit_contribution_save
--   project_sandbox_activity      -> project_toolkit_activity
--   project_stats.sandbox_rooms_count, project_rooms.experiment -> toolkit_rooms_count, tool
--   cron job placer-sweep-sandbox-rooms -> placer-sweep-toolkit-rooms
--   survey_responses source 'sandbox_contribution' -> 'toolkit_contribution'
--
-- Renaming rather than recreating keeps every room and contribution, along with the
-- grants, row-level security, the Realtime publication and the foreign keys, which
-- all follow a table through a rename. What does not follow is a function body,
-- which names tables as text -- so every function that touches a room is dropped
-- and created again under its new name, from the renamed master files.
--
-- On a database built fresh from the regenerated migrations everything is already
-- called toolkit_*, the renames find nothing to do, and the functions are simply
-- replaced with themselves.


-- 1. The tables, the column, and every constraint and index named after them.

do $$
begin
  if to_regclass('public.sandbox_rooms') is not null then
    alter table public.sandbox_rooms rename to toolkit_rooms;
  end if;
  if to_regclass('public.sandbox_contributions') is not null then
    alter table public.sandbox_contributions rename to toolkit_contributions;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'toolkit_rooms' and column_name = 'experiment'
  ) then
    alter table public.toolkit_rooms rename column experiment to tool;
  end if;
end;
$$;

do $$
declare
  v record;
begin
  -- Constraints first (a unique or primary key constraint renames its index with it),
  -- then whatever indexes are left.
  for v in
    select c.conrelid::regclass as tbl, c.conname as old_name
      from pg_constraint c
     where c.conrelid in ('public.toolkit_rooms'::regclass, 'public.toolkit_contributions'::regclass)
       and c.conname like 'sandbox\_%'
  loop
    execute format('alter table %s rename constraint %I to %I', v.tbl, v.old_name,
      replace(replace(v.old_name, 'sandbox_', 'toolkit_'), '_experiment_', '_tool_'));
  end loop;

  for v in
    select i.relname as old_name
      from pg_index x
      join pg_class i on i.oid = x.indexrelid
     where x.indrelid in ('public.toolkit_rooms'::regclass, 'public.toolkit_contributions'::regclass)
       and i.relname like 'sandbox\_%'
  loop
    execute format('alter index public.%I rename to %I', v.old_name,
      replace(v.old_name, 'sandbox_', 'toolkit_'));
  end loop;
end;
$$;

-- The check that names the tools a room may be opened on, now on the renamed column.
alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_tool_known;
alter table public.toolkit_rooms add constraint toolkit_rooms_tool_known
  check (tool in ('budget-ballot', 'open-vote'));

comment on table public.toolkit_rooms is
  'One row per toolkit room. Reachable only through the toolkit_room_* functions.';
comment on table public.toolkit_contributions is
  'One row per participant per toolkit room. Written only through toolkit_contribution_save.';


-- 2. The old functions, and the policy that calls one of them. Dropped by their old
--    names; the ones whose result columns were renamed are dropped too, because a
--    return type cannot be replaced in place.

drop policy if exists "anon can read an open room's contributions" on public.toolkit_contributions;
drop trigger if exists sandbox_rooms_notify_followers on public.toolkit_rooms;

drop function if exists public.sandbox_room_is_open(uuid);
drop function if exists public.sandbox_room_create(text);
drop function if exists public.sandbox_room_create(text, uuid);
drop function if exists public.sandbox_room_create(text, uuid, text);
drop function if exists public.sandbox_room_join(text);
drop function if exists public.sandbox_room_join_code(text);
drop function if exists public.sandbox_room_state(uuid);
drop function if exists public.sandbox_contribution_save(uuid, uuid, text, jsonb);
drop function if exists public.sandbox_room_close(uuid, uuid);
drop function if exists public.sandbox_room_delete(uuid, uuid);
drop function if exists public.project_sandbox_activity(uuid);
drop function if exists public.project_rooms(uuid);
drop function if exists public.project_stats(uuid);
drop function if exists public.toolkit_room_join(text);
drop function if exists public.toolkit_room_join_code(text);
drop function if exists public.toolkit_room_state(uuid);


-- 3. The functions again, under their new names. Copied from the master files.

-- From rooms.sql.

-- 3. Is a room open? A security definer helper, so the select policy below can
--    ask about a room without the anon role needing any grant on that table.

create or replace function public.toolkit_room_is_open(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.toolkit_rooms r
    where r.id = p_room_id
      and r.closed_at is null
      and r.expires_at > now()
  );
$$;

revoke all on function public.toolkit_room_is_open(uuid) from public;
grant execute on function public.toolkit_room_is_open(uuid) to anon;


-- 4. Reading the room. The only direct table access the anon role has: the rows
--    of a room that is still open. Knowing the room's uuid is the capability, and
--    a uuid is only obtainable by calling toolkit_room_join with a valid PIN.

drop policy if exists "anon can read an open room's contributions" on public.toolkit_contributions;
create policy "anon can read an open room's contributions"
  on public.toolkit_contributions
  for select
  to anon
  using (public.toolkit_room_is_open(room_id));

-- Column grants as well as the policy: the anon role never needs the participant
-- hash or the row's own id, so it is not given them.
revoke all on public.toolkit_contributions from anon;
grant select (room_id, display_name, state, updated_at)
  on public.toolkit_contributions to anon;


-- 6b. What a room is, given its id: open, closed or expired, and when it goes.
--     Needed because an empty open room and a finished one both read as no
--     contributions, a page reloaded on a room link has the id but not the PIN, and
--     the countdown has to come from the database rather than the browser's clock.
--     Reveals nothing a participant does not already hold: the id is the capability,
--     and the facilitator token is not in the result.

drop function if exists public.toolkit_room_state(uuid);

create or replace function public.toolkit_room_state(p_room_id uuid)
returns table (tool text, status text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.tool,
    -- Closed beats expired: somebody ended it, and that is the truer thing to say.
    case
      when r.closed_at is not null then 'closed'
      when r.expires_at <= now()  then 'expired'
      else 'open'
    end,
    r.expires_at
  from public.toolkit_rooms r
  where r.id = p_room_id;
$$;

revoke all on function public.toolkit_room_state(uuid) from public;
grant execute on function public.toolkit_room_state(uuid) to anon;


-- 7. Saving a contribution. Insert-or-update keyed on the participant hash, so a
--    participant can revise their own answer and cannot touch anybody else's.
--    Returns false when the room is closed or gone, rather than raising.

create or replace function public.toolkit_contribution_save(
  p_room_id uuid,
  p_token   uuid,
  p_name    text,
  p_state   jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_participant text;
begin
  if not public.toolkit_room_is_open(p_room_id) then
    return false;
  end if;

  v_participant := encode(
    digest(p_room_id::text || ':' || p_token::text, 'sha256'), 'hex'
  );

  -- The name is trimmed to fit rather than rejected. Nothing limits the length of a
  -- display name in the app, and somebody's ballot must not be thrown away because
  -- what they chose to call themselves is long. The size cap on `state` below is a
  -- different matter: a real ballot is a couple of hundred bytes, so anything near
  -- the limit is abuse and should fail.
  insert into public.toolkit_contributions (room_id, participant, display_name, state)
  values (p_room_id, v_participant, left(nullif(btrim(coalesce(p_name, '')), ''), 60), p_state)
  on conflict (room_id, participant) do update
    set state        = excluded.state,
        display_name = excluded.display_name,
        updated_at   = now();

  return true;
end;
$$;

revoke all on function public.toolkit_contribution_save(uuid, uuid, text, jsonb) from public;
grant execute on function public.toolkit_contribution_save(uuid, uuid, text, jsonb) to anon;


-- 8. Closing a room. The token is checked in here, so a client that knows a
--    room's id — which every participant does — still cannot close it.

create or replace function public.toolkit_room_close(p_room_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed int;
begin
  -- The same liveness test the other three functions use. Closing a room that has
  -- already expired changes nothing, so it reports false rather than claiming to
  -- have done something — and closed_at stays null on a room that ran out of time,
  -- which keeps the two endings distinguishable afterwards.
  update public.toolkit_rooms
     set closed_at = now()
   where id = p_room_id
     and facilitator_token = p_token
     and closed_at is null
     and expires_at > now();

  get diagnostics v_closed = row_count;
  return v_closed > 0;
end;
$$;

revoke all on function public.toolkit_room_close(uuid, uuid) from public;
grant execute on function public.toolkit_room_close(uuid, uuid) to anon;


-- From rooms-lifetime.sql.

-- 3. Creating a room, now for a chosen lifetime.
--
-- The parameter list and the return type both change (join_code is returned), so
-- the previous version is dropped rather than replaced in place.

drop function if exists public.toolkit_room_create(text, uuid);

create or replace function public.toolkit_room_create(
  p_tool text,
  p_project_id uuid default null,
  p_lifetime   text default '2h'
)
returns table (room_id uuid, pin text, join_code text, facilitator_token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_pin      text;
  v_code     text;
  v_token    uuid;
  v_expires  timestamptz;
  v_lifetime interval;
  v_attempt  int := 0;
  v_owner    uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'opening a room needs an account';
  end if;

  v_lifetime := case coalesce(p_lifetime, '2h')
    when '2h'  then interval '2 hours'
    when '1w'  then interval '7 days'
    when '30d' then interval '30 days'
    when '90d' then interval '90 days'
  end;

  if v_lifetime is null then
    raise exception 'a room is opened for 2h, 1w, 30d or 90d';
  end if;

  if v_lifetime > interval '2 hours' and p_project_id is null then
    raise exception 'a room that stays open longer than two hours has to belong to a project';
  end if;

  -- Unchanged from projects.sql: attaching a room to a project is for its owner and
  -- collaborators only.
  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.owner_id = v_owner
        or exists (
          select 1 from public.project_collaborators c
          where c.project_id = p.id and c.user_id = v_owner
        )
      )
  ) then
    raise exception 'only a project''s owner or collaborators may open a room for it';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_pin := lpad((floor(random() * 1000000))::bigint::text, 6, '0');

    begin
      insert into public.toolkit_rooms (pin, tool, created_by, project_id, expires_at)
      values (v_pin, p_tool, v_owner, p_project_id, now() + v_lifetime)
      returning toolkit_rooms.id, toolkit_rooms.join_code, toolkit_rooms.facilitator_token,
                toolkit_rooms.expires_at
        into v_id, v_code, v_token, v_expires;

      return query select v_id, v_pin, v_code, v_token, v_expires;
      return;
    exception when unique_violation then
      if v_attempt >= 20 then
        raise exception 'could not find a free PIN after % attempts', v_attempt;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.toolkit_room_create(text, uuid, text) from public;
grant execute on function public.toolkit_room_create(text, uuid, text) to authenticated;


-- 4. Joining by PIN: short rooms only. A long room's PIN still exists (the column is
--    not null, and it keeps PIN uniqueness simple) but no longer opens anything.

create or replace function public.toolkit_room_join(p_pin text)
returns table (room_id uuid, tool text)
language sql
security definer
set search_path = public
as $$
  select r.id, r.tool
  from public.toolkit_rooms r
  where r.pin = p_pin
    and r.closed_at is null
    and r.expires_at > now()
    and r.expires_at - r.created_at <= interval '2 hours';
$$;

revoke all on function public.toolkit_room_join(text) from public;
grant execute on function public.toolkit_room_join(text) to anon;


-- 5. Joining by code. Unlike the PIN lookup this answers for a finished room too, with
--    its status: a QR code on a poster outlives its poll, and somebody scanning it a
--    week later should be told the poll closed rather than that the code is wrong.
--    That reveals nothing: a finished room's contributions are unreadable (rooms.sql,
--    section 4), and the code itself is not guessable.

create or replace function public.toolkit_room_join_code(p_code text)
returns table (room_id uuid, tool text, status text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.tool,
    case
      when r.closed_at is not null then 'closed'
      when r.expires_at <= now()  then 'expired'
      else 'open'
    end,
    coalesce(r.closed_at, r.expires_at)
  from public.toolkit_rooms r
  where r.join_code = p_code;
$$;

revoke all on function public.toolkit_room_join_code(text) from public;
grant execute on function public.toolkit_room_join_code(text) to anon;


-- 6. A project's rooms, for its dashboard. Owner-or-collaborator only, the same test
--    as project_stats. It returns the facilitator token on purpose: those people may
--    already open and close rooms for the project, and handing them the token is what
--    lets them do it from a browser other than the one the room was opened in.

create or replace function public.project_rooms(p_project_id uuid)
returns table (
  room_id           uuid,
  tool        text,
  pin               text,
  join_code         text,
  facilitator_token uuid,
  created_at        timestamptz,
  expires_at        timestamptz,
  status            text,
  contributions     integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_collaborators c
          where c.project_id = p.id and c.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'only a project''s owner or collaborators may see its rooms';
  end if;

  return query
    select
      r.id,
      r.tool,
      r.pin,
      r.join_code,
      r.facilitator_token,
      r.created_at,
      r.expires_at,
      case
        when r.closed_at is not null then 'closed'
        when r.expires_at <= now()  then 'expired'
        else 'open'
      end,
      (select count(*)::int from public.toolkit_contributions c where c.room_id = r.id)
    from public.toolkit_rooms r
    where r.project_id = p_project_id
    order by r.created_at desc;
end;
$$;

revoke all on function public.project_rooms(uuid) from public;
grant execute on function public.project_rooms(uuid) to authenticated;


-- From rooms-delete.sql.

create or replace function public.toolkit_room_delete(p_room_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.toolkit_rooms
   where id = p_room_id
     and facilitator_token = p_token;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.toolkit_room_delete(uuid, uuid) from public;
grant execute on function public.toolkit_room_delete(uuid, uuid) to anon, authenticated;


-- From projects.sql.

-- 9. The dashboard's numbers.
--
-- Owner-or-collaborator only, and a function rather than a view: toolkit_rooms has
-- no select grant at all (section 8's header), so nothing else could read the room
-- count. Running as the definer is what lets this see past that lockdown for the
-- one project its caller is allowed to manage.
create or replace function public.project_stats(p_project_id uuid)
returns table (
  imaginations_count  integer,
  imaginations_upvotes integer,
  toolkit_rooms_count integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_collaborators c
          where c.project_id = p.id and c.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'only a project''s owner or collaborators may read its dashboard';
  end if;

  return query
    select
      (select count(*)::int from public.imaginations i where i.project_id = p_project_id),
      (select coalesce(sum(i.upvotes), 0)::int from public.imaginations i where i.project_id = p_project_id),
      (select count(*)::int from public.toolkit_rooms r where r.project_id = p_project_id);
end;
$$;

revoke all on function public.project_stats(uuid) from public;
grant execute on function public.project_stats(uuid) to authenticated;


-- 10. The public page's one number from the locked-down table.
--
-- A project's public page shows Toolkit activity too, and imagination counts and
-- votes are already reachable directly — the imaginations table is open to read
-- (section 7). The room count is not: toolkit_rooms has no grant to anon or
-- authenticated at all. This is the same shape as toolkit_room_is_open in
-- rooms.sql — a narrow, public, security definer helper — rather than reusing
-- project_stats, because a count of sessions run is not sensitive the way a PIN or a
-- facilitator token is, and does not need the ownership check the dashboard's
-- numbers do.
create or replace function public.project_toolkit_activity(p_project_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.toolkit_rooms where project_id = p_project_id;
$$;

revoke all on function public.project_toolkit_activity(uuid) from public;
grant execute on function public.project_toolkit_activity(uuid) to anon, authenticated;


-- From notifications.sql.

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


-- 4. The hourly sweep, under its new name.

select cron.unschedule('placer-sweep-sandbox-rooms')
 where exists (select 1 from cron.job where jobname = 'placer-sweep-sandbox-rooms');

create extension if not exists pg_cron;

-- Unschedule first so this file stays re-runnable: cron.schedule on an existing
-- name updates it, but only on newer pg_cron, and failing here is not worth it.
select cron.unschedule('placer-sweep-toolkit-rooms')
 where exists (select 1 from cron.job where jobname = 'placer-sweep-toolkit-rooms');

select cron.schedule(
  'placer-sweep-toolkit-rooms',
  '17 * * * *',                    -- hourly at :17; off the hour on purpose
  $$
    delete from public.toolkit_rooms
     where (closed_at is not null and closed_at  < now() - interval '24 hours')
        or (closed_at is null     and expires_at < now() - interval '24 hours');
  $$
);


-- 5. The survey source that tool submissions used to arrive under.

alter table public.survey_responses drop constraint if exists survey_responses_source_known;
update public.survey_responses set source = 'toolkit_contribution' where source = 'sandbox_contribution';
alter table public.survey_responses add constraint survey_responses_source_known
  check (source in ('community_survey', 'landing_survey', 'placemaking_trends_survey', 'user_labs_application', 'toolkit_contribution'));
