-- PLACER — toolkit rooms.
--
-- A facilitator opens a room on a toolkit tool. People join it with a
-- six-digit PIN or by scanning its QR code, and each person's contribution is a
-- row of its own, so the facilitator's screen can add them up live.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query), after schema.sql. It is written to be safe to re-run.
--
-- The editor will warn that this "creates a table without enabling Row Level
-- Security". That check only looks at the create table statement and cannot see
-- the alter table below it, which does enable RLS. Running it as written is safe.
--
-- ROOMS EXPIRE. Two hours after it is opened a room stops working, whether or not
-- anybody closed it: the clock runs from creation and is never extended, so a room
-- somebody walked away from cannot stay joinable. A facilitator can also close one
-- early, which is immediate.
--
-- Expiry is enforced here, in the predicate every function and policy shares, so a
-- room is unusable the moment its deadline passes even if nothing has deleted it
-- yet. Actually removing the rows is a separate job — rooms-cleanup.sql — and the
-- GDPR page's retention wording depends on that being scheduled.
--
-- The two hours live in exactly one place: the default on expires_at below.
--
-- The shape of the access rules, and why they are unusual for this project:
-- everything else here is insert-only, because the browser ships the publishable
-- key and the anon role is given the narrowest possible grant. Joining a room
-- needs a *read*, which nothing else in this schema has. Rather than open a
-- select policy on the rooms table — which would make every PIN in the system
-- enumerable — all four operations go through security definer functions, and the
-- anon role is granted nothing at all on toolkit_rooms.

create extension if not exists pgcrypto;


-- 1. The rooms.

create table if not exists public.toolkit_rooms (
  id                uuid        primary key default gen_random_uuid(),
  pin               text        not null    unique,
  tool        text        not null,
  facilitator_token uuid        not null    default gen_random_uuid(),
  created_at        timestamptz not null    default now(),
  -- When the room stops working on its own. Set once, from the default below, and
  -- never moved: a fixed lifetime is predictable to display and impossible to
  -- extend by accident.
  expires_at        timestamptz not null    default now() + interval '2 hours',
  -- Null means it was never closed by hand. A closed room refuses joins and
  -- contributions immediately, without waiting for its deadline.
  closed_at         timestamptz,
  -- The account that opened the room. Opening one takes an account; joining does not,
  -- which is why this is on the room and not on a contribution.
  --
  -- Nulled rather than cascaded if that account is ever deleted. A room holds other
  -- people's contributions, and those are not the facilitator's to take with them —
  -- so what goes is the link to who opened it, not the workshop.
  created_by        uuid        references auth.users (id) on delete set null
);

-- For a table created before rooms had a deadline. Setting the default as well as
-- adding the column means the lifetime can be changed by editing the line above and
-- re-running this file.
alter table public.toolkit_rooms
  add column if not exists expires_at timestamptz not null default now() + interval '2 hours';
alter table public.toolkit_rooms
  alter column expires_at set default now() + interval '2 hours';

-- For a table created before opening a room needed an account.
alter table public.toolkit_rooms
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- Enabled immediately after the table so no window exists without it. There are
-- deliberately NO policies on this table: with RLS on and no policy, the anon
-- role can do nothing here directly, and the functions below are the only way in.
alter table public.toolkit_rooms enable row level security;

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_pin_shape;
alter table public.toolkit_rooms add constraint toolkit_rooms_pin_shape
  check (pin ~ '^[0-9]{6}$');

-- The tools that may host a room. Extend this list when a second
-- tool opts in (src/toolkit/tools.js is the other half of the pair).
alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_tool_known;
alter table public.toolkit_rooms add constraint toolkit_rooms_tool_known
  check (tool in ('budget-ballot', 'open-vote'));

revoke all on public.toolkit_rooms from anon;

comment on table public.toolkit_rooms is
  'One row per toolkit room. Reachable only through the toolkit_room_* functions.';


-- 2. The contributions.

create table if not exists public.toolkit_contributions (
  id           uuid        primary key default gen_random_uuid(),
  room_id      uuid        not null    references public.toolkit_rooms (id) on delete cascade,
  -- Not the participant's token: sha256(room_id || ':' || token), computed inside
  -- toolkit_contribution_save. The token is what proves a participant owns this
  -- row, so it must never be readable — and this table is published to Realtime,
  -- which does not apply column grants to the rows it broadcasts. Storing only
  -- the hash means there is no secret in the table to leak.
  participant  text        not null,
  display_name text,
  state        jsonb       not null    default '{}'::jsonb,
  created_at   timestamptz not null    default now(),
  updated_at   timestamptz not null    default now(),
  constraint toolkit_contributions_one_per_participant unique (room_id, participant)
);

alter table public.toolkit_contributions enable row level security;

-- Bound the payloads. A ballot is a few hundred bytes; without a cap a single
-- request could store megabytes, as many times as it likes.
alter table public.toolkit_contributions drop constraint if exists toolkit_contributions_state_size;
alter table public.toolkit_contributions add constraint toolkit_contributions_state_size
  check (length(state::text) <= 4000);

alter table public.toolkit_contributions drop constraint if exists toolkit_contributions_name_size;
alter table public.toolkit_contributions add constraint toolkit_contributions_name_size
  check (display_name is null or length(display_name) <= 60);

create index if not exists toolkit_contributions_room_idx
  on public.toolkit_contributions (room_id);

comment on table public.toolkit_contributions is
  'One row per participant per toolkit room. Written only through toolkit_contribution_save.';


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


-- 5. Creating a room. The PIN is generated here rather than in the browser, so
--    uniqueness is guaranteed and a client cannot choose its own.

-- The return type changes when a deadline is added to it, and a return type cannot
-- be replaced in place.
drop function if exists public.toolkit_room_create(text);

create or replace function public.toolkit_room_create(p_tool text)
returns table (room_id uuid, pin text, facilitator_token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_pin     text;
  v_token   uuid;
  v_expires timestamptz;
  v_attempt int := 0;
  v_owner   uuid := auth.uid();
begin
  -- Belt and braces. The grant at the end of this section is the real boundary — the
  -- anon role cannot execute this function at all — but a security definer function
  -- should not depend on its own grant list being right, and this states the rule in
  -- the one place somebody reading the function will look.
  if v_owner is null then
    raise exception 'opening a room needs an account';
  end if;

  loop
    v_attempt := v_attempt + 1;
    -- Six digits with the leading zeros kept, so 000-123 is a legal PIN and the
    -- keyspace is the full million rather than nine hundred thousand.
    v_pin := lpad((floor(random() * 1000000))::bigint::text, 6, '0');

    begin
      insert into public.toolkit_rooms (pin, tool, created_by)
      values (v_pin, p_tool, v_owner)
      returning toolkit_rooms.id, toolkit_rooms.facilitator_token, toolkit_rooms.expires_at
        into v_id, v_token, v_expires;

      return query select v_id, v_pin, v_token, v_expires;
      return;
    exception when unique_violation then
      -- A PIN collision. Try another, but do not spin forever if the space is
      -- somehow full — twenty attempts is already a vanishingly unlikely run.
      if v_attempt >= 20 then
        raise exception 'could not find a free PIN after % attempts', v_attempt;
      end if;
    end;
  end loop;
end;
$$;

-- Opening a room takes an account; joining one does not. This is where that is
-- enforced, and it is the only function in this file the anon role may not call.
-- Everything else here stays open on purpose: a workshop participant scans a QR code
-- or types a PIN, and stopping to make an account at that moment would cost the room
-- the people it was opened for.
revoke all on function public.toolkit_room_create(text) from public;
grant execute on function public.toolkit_room_create(text) to authenticated;


-- 6. Joining a room. Returns the room's id and tool and nothing else —
--    never the facilitator token, which is what makes closing it privileged.
--    An unknown, malformed or closed PIN returns no rows rather than an error.

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
    and r.expires_at > now();
$$;

revoke all on function public.toolkit_room_join(text) from public;
grant execute on function public.toolkit_room_join(text) to anon;


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


-- 9. Realtime. The client uses a change on this table only as a signal to re-read
--    the room through the policy above, so what Realtime broadcasts never has to
--    be trusted as the source of truth.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'toolkit_contributions'
  ) then
    alter publication supabase_realtime add table public.toolkit_contributions;
  end if;
exception
  when undefined_object then
    raise notice 'no supabase_realtime publication here — skipping, live updates will not work';
end;
$$;


-- Verify, after running the above:
--
--   -- RLS on, and no policy at all on the rooms table:
--   select relname, relrowsecurity from pg_class
--    where relname in ('toolkit_rooms', 'toolkit_contributions');
--   select tablename, policyname, cmd, roles from pg_policies
--    where tablename in ('toolkit_rooms', 'toolkit_contributions');
--
--   -- Exactly one select grant, and no insert or update, for anon:
--   select table_name, column_name, privilege_type
--     from information_schema.column_privileges
--    where grantee = 'anon' and table_name = 'toolkit_contributions'
--    order by privilege_type, column_name;
--
--   -- Who may open a room, and who may join one. Expect create to list only
--   -- {authenticated}, and join, state, close and contribution_save to list anon:
--   select p.proname, r.rolname
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     cross join unnest(array['anon', 'authenticated']) as r(rolname)
--    where n.nspname = 'public' and p.proname like 'toolkit%'
--      and has_function_privilege(r.rolname, p.oid, 'execute')
--    order by p.proname, r.rolname;
--
--   -- End to end. Note the first only works as a signed-in user now; run as the anon
--   -- role it should fail with "permission denied for function":
--   select * from public.toolkit_room_create('budget-ballot');
--   select * from public.toolkit_room_join('000000');   -- expect no rows
--
--   -- What is still live, and what is only waiting to be swept:
--   select count(*) filter (where closed_at is null and expires_at > now()) as live,
--          count(*) filter (where closed_at is not null or expires_at <= now()) as finished
--     from public.toolkit_rooms;
