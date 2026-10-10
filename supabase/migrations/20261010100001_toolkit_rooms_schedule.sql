-- Generated from supabase/rooms-schedule.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — a project's room that starts later.
--
-- A room used to open the moment it was created. A project's organiser can now set
-- one up ahead of time to start on a given day — a poll announced for the first day of
-- a consultation — as long as that day is within the project's own dates.
--
--   toolkit_rooms.opens_at   when it starts; null for a room that opened when made
--
-- Until then the room is 'scheduled': it is listed for the project's own people (so
-- its QR code can go on a poster in advance), but it is not on the project's page,
-- cannot be joined, read or contributed to, and its time only starts running when it
-- opens — a 30-day room scheduled for next week closes 30 days after next week.
--
-- The day is chosen in the organiser's calendar, so it comes with their time zone and
-- the room opens at the start of that day there.
--
-- Run this once in the Supabase SQL editor after project-privacy.sql. It is written to
-- be safe to re-run.

-- 1. The column, and the 90-day cap counted from when the room opens rather than when
--    it was made (rooms-lifetime.sql).

alter table public.toolkit_rooms add column if not exists opens_at timestamptz;

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_lifetime_cap;
alter table public.toolkit_rooms add constraint toolkit_rooms_lifetime_cap
  check (expires_at <= coalesce(opens_at, created_at) + interval '90 days');


-- 2. Creating a room, now with the day it starts. The parameter list changes, so the
--    previous version (rooms-config.sql) is dropped rather than replaced in place.

drop function if exists public.toolkit_room_create(text, uuid, text, jsonb);

create or replace function public.toolkit_room_create(
  p_tool       text,
  p_project_id uuid default null,
  p_lifetime   text default '2h',
  p_config     jsonb default '{}'::jsonb,
  p_opens_on   date default null,
  p_time_zone  text default null
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
    v_opens := p_opens_on::timestamp at time zone coalesce(p_time_zone, 'UTC');
    if p_opens_on < (now() at time zone coalesce(p_time_zone, 'UTC'))::date then
      raise exception 'a room cannot be scheduled to start in the past';
    end if;
    -- Today is not later: it opens now.
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

revoke all on function public.toolkit_room_create(text, uuid, text, jsonb, date, text) from public;
grant execute on function public.toolkit_room_create(text, uuid, text, jsonb, date, text) to authenticated;


-- 3. A scheduled room is not open: nothing can be read from or added to it yet
--    (rooms.sql; contributions and their read policy both go through this).

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
      and (r.opens_at is null or r.opens_at <= now())
      and r.expires_at > now()
  );
$$;


-- 4. What a room is, given its id (project-privacy.sql), now saying 'scheduled' and
--    when it opens. The return type changes, so it is dropped and created again.

drop function if exists public.toolkit_room_state(uuid);

create or replace function public.toolkit_room_state(p_room_id uuid)
returns table (tool text, status text, expires_at timestamptz, config jsonb, opens_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.tool,
    case
      when r.closed_at is not null then 'closed'
      when r.expires_at <= now()  then 'expired'
      when r.opens_at > now()     then 'scheduled'
      else 'open'
    end,
    r.expires_at,
    r.config,
    r.opens_at
  from public.toolkit_rooms r
  where r.id = p_room_id
    and (r.project_id is null or public.project_can_view(r.project_id));
$$;

revoke all on function public.toolkit_room_state(uuid) from public;
grant execute on function public.toolkit_room_state(uuid) to anon, authenticated;


-- 5. A PIN does not open a room that has not started (project-privacy.sql).

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
    and r.expires_at - coalesce(r.opens_at, r.created_at) <= interval '2 hours'
    and (r.project_id is null or public.project_can_view(r.project_id));
$$;

revoke all on function public.toolkit_room_join(text) from public;
grant execute on function public.toolkit_room_join(text) to anon, authenticated;


-- 6. A QR code scanned before its room starts says so, and when (project-privacy.sql).
--    The return type changes, so it is dropped and created again.

drop function if exists public.toolkit_room_join_code(text);

create or replace function public.toolkit_room_join_code(p_code text)
returns table (room_id uuid, tool text, status text, expires_at timestamptz, opens_at timestamptz)
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
      when r.opens_at > now()     then 'scheduled'
      else 'open'
    end,
    coalesce(r.closed_at, r.expires_at),
    r.opens_at
  from public.toolkit_rooms r
  where r.join_code = p_code
    and (r.project_id is null or public.project_can_view(r.project_id));
$$;

revoke all on function public.toolkit_room_join_code(text) from public;
grant execute on function public.toolkit_room_join_code(text) to anon, authenticated;


-- 7. A project's page shows only the rooms that have started (project-privacy.sql).

create or replace function public.project_open_rooms(p_project_id uuid)
returns table (room_id uuid, tool text, expires_at timestamptz, config jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.tool, r.expires_at, r.config
  from public.toolkit_rooms r
  where r.project_id = p_project_id
    and r.closed_at is null
    and (r.opens_at is null or r.opens_at <= now())
    and r.expires_at > now()
    and public.project_can_view(p_project_id)
  order by r.created_at desc;
$$;


-- 8. A project's own people see its scheduled rooms, and when each opens
--    (rooms-lifetime.sql). The return type changes, so it is dropped and created again.

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
  opens_at          timestamptz
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
      r.opens_at
    from public.toolkit_rooms r
    where r.project_id = p_project_id
    order by r.created_at desc;
end;
$$;

revoke all on function public.project_rooms(uuid) from public;
grant execute on function public.project_rooms(uuid) to authenticated;


-- Verify, after running the above:
--
--   select conname from pg_constraint where conname = 'toolkit_rooms_lifetime_cap';
--   select pg_get_function_identity_arguments('public.toolkit_room_create'::regproc);
--   -- p_tool text, p_project_id uuid, p_lifetime text, p_config jsonb, p_opens_on date, p_time_zone text
