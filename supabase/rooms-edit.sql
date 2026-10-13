-- PLACER — changing a project's room after it has been set up.
--
-- rooms-config.sql fixes a room's setup when the room opens, because everybody's
-- contribution is made against it. A room scheduled to start later (rooms-schedule.sql)
-- has not opened: nobody can have joined it or answered it yet. So until it starts,
-- its organisers can change all of it — the setup, the day it starts and how long it
-- stays open — with toolkit_room_reschedule.
--
-- Once it is open, the setup stays fixed, as before. What can still move is when it
-- closes: a poll on a poster that is going well can run on, or one that has said
-- enough can end sooner, with toolkit_room_set_closes. Only for a long room
-- (rooms-lifetime.sql), and it stays one: a room joined by its PIN keeps its two hours,
-- since the PIN is only an accepted risk for that long, and a long room cannot be
-- shortened to two hours or less, which would turn its join code into a PIN room.
-- The ninety-day cap still counts from when it opened.
--
-- Both are for the project's owner and collaborators, like opening the room, and only
-- for a project's room. project_rooms also returns each room's setup now, which the
-- dashboard needs to edit one and to tell a tool's rooms apart.
--
-- Run this once in the Supabase SQL editor after rooms-schedule.sql. It is written to
-- be safe to re-run.


-- 1. May the caller change this room? Its project's owner or a collaborator.

create or replace function public.toolkit_room_can_edit(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.toolkit_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = p_room_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_collaborators c
          where c.project_id = p.id and c.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.toolkit_room_can_edit(uuid) from public;


-- 2. A scheduled room, changed before it starts. The same choices as opening it
--    (toolkit_room_create in rooms-schedule.sql), checked the same way. A day of today
--    or none starts it now; opens_at is then set to now rather than left null, so the
--    room's length still counts from when it opened.

create or replace function public.toolkit_room_reschedule(
  p_room_id   uuid,
  p_lifetime  text,
  p_config    jsonb,
  p_opens_on  date default null,
  p_time_zone text default null
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
    v_opens := p_opens_on::timestamp at time zone coalesce(p_time_zone, 'UTC');
    if p_opens_on < (now() at time zone coalesce(p_time_zone, 'UTC'))::date then
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

revoke all on function public.toolkit_room_reschedule(uuid, text, jsonb, date, text) from public;
grant execute on function public.toolkit_room_reschedule(uuid, text, jsonb, date, text) to authenticated;


-- 3. An open long room's closing day, moved. It closes at the end of that day in the
--    organiser's time zone.

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
  if v_room.expires_at - v_started <= interval '2 hours' then
    raise exception 'a room joined by its PIN keeps its two hours';
  end if;

  -- An unknown time zone raises here, which is the right answer to it.
  v_closes := (p_closes_on + 1)::timestamp at time zone coalesce(p_time_zone, 'UTC');
  if v_closes <= now() then
    raise exception 'a room cannot close in the past';
  end if;
  if v_closes - v_started <= interval '2 hours' then
    raise exception 'a room joined by its code stays open longer than two hours';
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


-- 4. A project's rooms, now with each one's setup. The return type changes, so it is
--    dropped and created again (rooms-schedule.sql has the previous version).

drop function if exists public.project_rooms(uuid);

create or replace function public.project_rooms(p_project_id uuid)
returns table (
  room_id           uuid,
  tool              text,
  pin               text,
  join_code         text,
  facilitator_token uuid,
  created_at        timestamptz,
  expires_at        timestamptz,
  status            text,
  contributions     integer,
  opens_at          timestamptz,
  config            jsonb
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
        when r.opens_at > now()     then 'scheduled'
        else 'open'
      end,
      (select count(*)::int from public.toolkit_contributions c where c.room_id = r.id),
      r.opens_at,
      r.config
    from public.toolkit_rooms r
    where r.project_id = p_project_id
    order by r.created_at desc;
end;
$$;

revoke all on function public.project_rooms(uuid) from public;
grant execute on function public.project_rooms(uuid) to authenticated;


-- Verify, after running the above:
--
--   select pg_get_function_identity_arguments('public.toolkit_room_reschedule'::regproc);
--   -- p_room_id uuid, p_lifetime text, p_config jsonb, p_opens_on date, p_time_zone text
--   select pg_get_function_identity_arguments('public.toolkit_room_set_closes'::regproc);
--   -- p_room_id uuid, p_closes_on date, p_time_zone text
