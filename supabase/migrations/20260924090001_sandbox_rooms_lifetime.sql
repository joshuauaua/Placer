-- Generated from supabase/rooms-lifetime.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — toolkit rooms that stay open for weeks.
--
-- rooms.sql gives every room two hours, which is right for a workshop: somebody is
-- standing at a screen, and a room nobody closed should not stay joinable. It is
-- wrong for a poll printed on a poster in a park, which wants to be scannable for a
-- month. This file lets a room be opened for longer, and puts the limits on that in
-- the database rather than in the app:
--
--   - A room is opened for one of four fixed lifetimes: 2h, 1w, 30d or 90d. Nothing
--     else is accepted, and a check constraint caps every room at ninety days, so a
--     client cannot ask for a year by calling the function directly.
--   - Anything longer than two hours has to belong to a project. A room that runs for
--     months needs somebody who can find it again, see how it is going and close it,
--     and a project's owner and collaborators are that somebody — from any device,
--     through project_rooms below, rather than only from the one browser whose
--     localStorage happens to hold the facilitator token.
--   - A long room is joined by its join code, not its PIN. Six digits is a million
--     combinations with nowhere to rate limit (supabase/README.md, section 8): an
--     accepted trade for two hours, not for three months. So toolkit_room_join stops
--     answering for long rooms, and the QR code on the poster carries a 32-character
--     code instead. Short rooms keep their PIN exactly as before.
--
-- Run this once in the Supabase SQL editor after rooms.sql and projects.sql. It is
-- written to be safe to re-run. rooms-cleanup.sql needs no change: its sweep already
-- goes by expires_at, so a long room is deleted a day after it ends like any other.

-- 1. The join code: an unguessable way into a room, for links and QR codes.
--    gen_random_uuid() is core Postgres, so this needs no extension schema on the
--    search path; with the dashes stripped it is 32 hex characters and 122 random bits.

alter table public.toolkit_rooms
  add column if not exists join_code text;

update public.toolkit_rooms
   set join_code = replace(gen_random_uuid()::text, '-', '')
 where join_code is null;

alter table public.toolkit_rooms
  alter column join_code set default replace(gen_random_uuid()::text, '-', '');
alter table public.toolkit_rooms
  alter column join_code set not null;

create unique index if not exists toolkit_rooms_join_code_key
  on public.toolkit_rooms (join_code);


-- 2. The cap. Ninety days is the longest lifetime section 3 offers, and this is what
--    makes it a limit rather than a convention.

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_lifetime_cap;
alter table public.toolkit_rooms add constraint toolkit_rooms_lifetime_cap
  check (expires_at <= created_at + interval '90 days');


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


-- Verify, after running the above:
--
--   -- Every room has a code, and the cap is in place:
--   select count(*) filter (where join_code is null) as missing_codes from public.toolkit_rooms;
--   select conname from pg_constraint where conname = 'toolkit_rooms_lifetime_cap';
--
--   -- As a signed-in user: a long room without a project is refused.
--   select * from public.toolkit_room_create('open-vote', null, '30d');   -- expect an error
--
--   -- An unknown code is an empty result, not an error:
--   select * from public.toolkit_room_join_code('0000');
