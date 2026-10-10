-- PLACER — setting a tool up before its room opens.
--
-- A room used to be a tool exactly as the Toolkit ships it: a Co-Budget room was
-- always €250,000 and the same nine things. Opened for a project, it should be about
-- that project's place, so the organiser now sets the tool up first — for the Budget
-- Ballot, how much money there is and what is on the ballot — and the room keeps it.
--
--   toolkit_rooms.config   the setup, as the tool defines it; '{}' when there is none
--
-- What a setup means is the tool's business, and is checked in the browser by the
-- tool's own `setup.problems` (src/toolkit/tools.js), the same split as a
-- contribution's `state`. The database checks only what protects it: that it is an
-- object and that it is small.
--
-- It is fixed when the room opens. There is no way to change it afterwards, on
-- purpose: everybody's contribution was made against it, and moving the budget under
-- a ballot that has already been cast would change what that ballot meant.
--
-- Anybody who can reach the room can read its setup, through toolkit_room_state —
-- they need it to show the tool. That reveals nothing: it is what the tool on their
-- screen is already showing them.
--
-- Run this once in the Supabase SQL editor after rooms-lifetime.sql. It is written to
-- be safe to re-run.

-- 1. The column.

alter table public.toolkit_rooms
  add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_config_shape;
alter table public.toolkit_rooms add constraint toolkit_rooms_config_shape
  check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 16384);


-- 2. Creating a room, now with its setup. As in rooms-lifetime.sql, the parameter
--    list changes, so the previous version is dropped rather than replaced in place.
--    The setup is optional: a tool without one opens its room exactly as before.

drop function if exists public.toolkit_room_create(text, uuid, text);

create or replace function public.toolkit_room_create(
  p_tool text,
  p_project_id uuid default null,
  p_lifetime   text default '2h',
  p_config     jsonb default '{}'::jsonb
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
      insert into public.toolkit_rooms (pin, tool, created_by, project_id, expires_at, config)
      values (v_pin, p_tool, v_owner, p_project_id, now() + v_lifetime,
              coalesce(p_config, '{}'::jsonb))
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

revoke all on function public.toolkit_room_create(text, uuid, text, jsonb) from public;
grant execute on function public.toolkit_room_create(text, uuid, text, jsonb) to authenticated;


-- 3. What a room is, given its id — now with its setup, which every participant's
--    browser needs to show the tool the way the organiser set it up. The return type
--    changes, so this is dropped and created again too.

drop function if exists public.toolkit_room_state(uuid);

create or replace function public.toolkit_room_state(p_room_id uuid)
returns table (tool text, status text, expires_at timestamptz, config jsonb)
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
    r.expires_at,
    r.config
  from public.toolkit_rooms r
  where r.id = p_room_id;
$$;

revoke all on function public.toolkit_room_state(uuid) from public;
grant execute on function public.toolkit_room_state(uuid) to anon;


-- Verify, after running the above:
--
--   select conname from pg_constraint where conname = 'toolkit_rooms_config_shape';
--   select pg_get_function_identity_arguments('public.toolkit_room_create'::regproc);
--   -- p_tool text, p_project_id uuid, p_lifetime text, p_config jsonb
