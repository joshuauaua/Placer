-- Generated from supabase/rooms-start-time.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — a project's room that starts at a time of day, not only on a day.
--
-- rooms-schedule.sql let a project's room be set up to start on a day within the
-- project's dates, opening at the start of that day in the organiser's time zone.
-- Now it can also be given the time it starts — a poll that opens at 18:00, when a
-- meeting begins. p_opens_time is that time on p_opens_on, in p_time_zone; without
-- one it is the start of the day, as before, so a caller that does not send it is
-- unchanged. A time that has already gone by, today, is refused rather than opened
-- now: somebody who chose one meant it.
--
-- The parameter lists change, so the previous versions (rooms-schedule.sql,
-- rooms-edit.sql) are dropped rather than replaced in place, the same as each did.
--
-- Run this once in the Supabase SQL editor after rooms-edit.sql. It is written to be
-- safe to re-run.


-- 1. Creating a room.

drop function if exists public.toolkit_room_create(text, uuid, text, jsonb, date, text);

create or replace function public.toolkit_room_create(
  p_tool       text,
  p_project_id uuid default null,
  p_lifetime   text default '2h',
  p_config     jsonb default '{}'::jsonb,
  p_opens_on   date default null,
  p_time_zone  text default null,
  p_opens_time time default null
)
returns table (
  room_id uuid, pin text, join_code text, facilitator_token uuid, expires_at timestamptz, opens_at timestamptz
)
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
  v_opens    timestamptz;
  v_lifetime interval;
  v_attempt  int := 0;
  v_owner    uuid := auth.uid();
  v_start    date;
  v_end      date;
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

  if p_opens_on is not null then
    if p_project_id is null then
      raise exception 'only a project''s room can be scheduled to start later';
    end if;

    select p.start_date, p.end_date into v_start, v_end from public.projects p where p.id = p_project_id;
    if v_start is null or v_end is null then
      raise exception 'give the project its dates before scheduling a room for it';
    end if;
    if p_opens_on < v_start or p_opens_on > v_end then
      raise exception 'a room can only be scheduled to start within the project''s dates';
    end if;

    -- An unknown time zone raises here, which is the right answer to it.
    v_opens := (p_opens_on + coalesce(p_opens_time, time '00:00')) at time zone coalesce(p_time_zone, 'UTC');
    if p_opens_on < (now() at time zone coalesce(p_time_zone, 'UTC'))::date
       or (p_opens_time is not null and v_opens <= now()) then
      raise exception 'a room cannot be scheduled to start in the past';
    end if;
    -- Today, with no time, is not later: it opens now.
    if v_opens <= now() then
      v_opens := null;
    end if;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_pin := lpad((floor(random() * 1000000))::bigint::text, 6, '0');

    begin
      insert into public.toolkit_rooms (pin, tool, created_by, project_id, opens_at, expires_at, config)
      values (v_pin, p_tool, v_owner, p_project_id, v_opens, coalesce(v_opens, now()) + v_lifetime,
              coalesce(p_config, '{}'::jsonb))
      returning toolkit_rooms.id, toolkit_rooms.join_code, toolkit_rooms.facilitator_token,
                toolkit_rooms.expires_at
        into v_id, v_code, v_token, v_expires;

      return query select v_id, v_pin, v_code, v_token, v_expires, v_opens;
      return;
    exception when unique_violation then
      if v_attempt >= 20 then
        raise exception 'could not find a free PIN after % attempts', v_attempt;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.toolkit_room_create(text, uuid, text, jsonb, date, text, time) from public;
grant execute on function public.toolkit_room_create(text, uuid, text, jsonb, date, text, time) to authenticated;


-- 2. A scheduled room, changed before it starts.

drop function if exists public.toolkit_room_reschedule(uuid, text, jsonb, date, text);

create or replace function public.toolkit_room_reschedule(
  p_room_id   uuid,
  p_lifetime  text,
  p_config    jsonb,
  p_opens_on  date default null,
  p_time_zone text default null,
  p_opens_time time default null
)
returns table (opens_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room     public.toolkit_rooms;
  v_lifetime interval;
  v_opens    timestamptz;
  v_start    date;
  v_end      date;
begin
  if auth.uid() is null then
    raise exception 'changing a room needs an account';
  end if;
  if not public.toolkit_room_can_edit(p_room_id) then
    raise exception 'only a project''s owner or collaborators may change its rooms';
  end if;

  select * into v_room from public.toolkit_rooms r where r.id = p_room_id for update;
  if v_room.closed_at is not null or v_room.opens_at is null or v_room.opens_at <= now() then
    raise exception 'only a room that has not started yet can be changed';
  end if;

  v_lifetime := case p_lifetime
    when '2h'  then interval '2 hours'
    when '1w'  then interval '7 days'
    when '30d' then interval '30 days'
    when '90d' then interval '90 days'
  end;
  if v_lifetime is null then
    raise exception 'a room is opened for 2h, 1w, 30d or 90d';
  end if;

  if p_opens_on is not null then
    select p.start_date, p.end_date into v_start, v_end from public.projects p where p.id = v_room.project_id;
    if v_start is null or v_end is null then
      raise exception 'give the project its dates before scheduling a room for it';
    end if;
    if p_opens_on < v_start or p_opens_on > v_end then
      raise exception 'a room can only be scheduled to start within the project''s dates';
    end if;
    -- An unknown time zone raises here, which is the right answer to it.
    v_opens := (p_opens_on + coalesce(p_opens_time, time '00:00')) at time zone coalesce(p_time_zone, 'UTC');
    if p_opens_on < (now() at time zone coalesce(p_time_zone, 'UTC'))::date
       or (p_opens_time is not null and v_opens <= now()) then
      raise exception 'a room cannot be scheduled to start in the past';
    end if;
  end if;
  if v_opens is null or v_opens <= now() then
    v_opens := now();
  end if;

  update public.toolkit_rooms r
     set config = coalesce(p_config, '{}'::jsonb),
         opens_at = v_opens,
         expires_at = v_opens + v_lifetime
   where r.id = p_room_id;

  return query select v_opens, v_opens + v_lifetime;
end;
$$;

revoke all on function public.toolkit_room_reschedule(uuid, text, jsonb, date, text, time) from public;
grant execute on function public.toolkit_room_reschedule(uuid, text, jsonb, date, text, time) to authenticated;


-- Verify:
--   select pg_get_function_identity_arguments(oid) from pg_proc
--    where proname in ('toolkit_room_create', 'toolkit_room_reschedule');
--   -- p_tool text, p_project_id uuid, p_lifetime text, p_config jsonb, p_opens_on date, p_time_zone text, p_opens_time time without time zone
--   -- p_room_id uuid, p_lifetime text, p_config jsonb, p_opens_on date, p_time_zone text, p_opens_time time without time zone
