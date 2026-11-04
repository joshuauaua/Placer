-- PLACER — a live session: a room run with a group, open until its host ends it
--
-- Requires project-collaborating-organisations.sql (toolkit_room_create),
-- rooms-schedule.sql (toolkit_room_join) and rooms-edit.sql (toolkit_room_set_closes),
-- and replaces those three functions. Re-runnable.
--
-- A tool published Live, from its setup page, runs as a room its host ends with Close
-- room. A workshop room's two hours could end a session still under way, so:
--
--   1. toolkit_room_create takes a fifth lifetime, '12h': twelve hours, the most a
--      live session is left open for if its host never closes it. Past two hours a
--      room still has to belong to a project.
--   2. toolkit_room_join lets a room be joined by its PIN for up to twelve hours from
--      when it opens, where it was two. Six digits are fine for a day's session; a
--      room open for a week or more is still joined only by its code.
--   3. toolkit_room_set_closes, which moves a long room's closing day, draws its line
--      between rooms joined by PIN and by code at the same twelve hours.
--
-- The client keeps the same line: isLongRoom in src/toolkit/rooms.js.

-- 1. Opening a room for a live session.

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
    when '12h' then interval '12 hours'
    when '1w'  then interval '7 days'
    when '30d' then interval '30 days'
    when '90d' then interval '90 days'
  end;

  if v_lifetime is null then
    raise exception 'a room is opened for 2h, 12h, 1w, 30d or 90d';
  end if;

  if v_lifetime > interval '2 hours' and p_project_id is null then
    raise exception 'a room that stays open longer than two hours has to belong to a project';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (p.owner_id = v_owner or public.project_collaborator_exists(p.id, v_owner))
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

-- 2. Joining by PIN, for up to twelve hours.

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
    and (r.opens_at is null or r.opens_at <= now())
    and r.expires_at > now()
    and r.expires_at - coalesce(r.opens_at, r.created_at) <= interval '12 hours'
    and (r.project_id is null or public.project_can_view(r.project_id));
$$;

revoke all on function public.toolkit_room_join(text) from public;
grant execute on function public.toolkit_room_join(text) to anon, authenticated;

-- 3. Moving a long room's closing day, past twelve hours.

create or replace function public.toolkit_room_set_closes(
  p_room_id   uuid,
  p_closes_on date,
  p_time_zone text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room    public.toolkit_rooms;
  v_started timestamptz;
  v_closes  timestamptz;
begin
  if auth.uid() is null then
    raise exception 'changing a room needs an account';
  end if;
  if not public.toolkit_room_can_edit(p_room_id) then
    raise exception 'only a project''s owner or collaborators may change its rooms';
  end if;

  select * into v_room from public.toolkit_rooms r where r.id = p_room_id for update;
  v_started := coalesce(v_room.opens_at, v_room.created_at);
  if v_room.closed_at is not null or v_room.expires_at <= now() or v_started > now() then
    raise exception 'only an open room''s closing day can be changed';
  end if;
  if v_room.expires_at - v_started <= interval '12 hours' then
    raise exception 'a room joined by its PIN keeps the time it was opened for';
  end if;

  -- An unknown time zone raises here, which is the right answer to it.
  v_closes := (p_closes_on + 1)::timestamp at time zone coalesce(p_time_zone, 'UTC');
  if v_closes <= now() then
    raise exception 'a room cannot close in the past';
  end if;
  if v_closes - v_started <= interval '12 hours' then
    raise exception 'a room joined by its code stays open longer than twelve hours';
  end if;
  if v_closes > v_started + interval '90 days' then
    raise exception 'a room stays open for at most 90 days from when it opened';
  end if;

  update public.toolkit_rooms r set expires_at = v_closes where r.id = p_room_id;
  return v_closes;
end;
$$;

revoke all on function public.toolkit_room_set_closes(uuid, date, text) from public;
grant execute on function public.toolkit_room_set_closes(uuid, date, text) to authenticated;
