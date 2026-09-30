-- Generated from supabase/organisations.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — organisations.
--
-- An organisation is a profile page that belongs to a group rather than to one
-- account: a municipality, a studio, an association. It has a name, a contact email,
-- a website, a location and a description, a dashboard its admins run it from, and a
-- public page anyone can open. A project can be run in its name — started by one of
-- its admins, and credited to the organisation on the project's page.
--
-- It replaces the "account type: organisation" switch profiles had (profiles-details.sql),
-- which could only ever say that one login *was* an organisation. The column is left
-- in place so nothing already saved is lost; nothing reads it any more.
--
-- The rules, all enforced here rather than in the app:
--
--   - Whoever creates an organisation is its first admin (section 3's trigger).
--   - Any admin may add another admin, by email, the same way projects.sql adds a
--     collaborator — there is no directory of accounts to search.
--   - Any admin may remove another admin, or leave. But an organisation always keeps
--     at least one: the last admin cannot leave or be removed. They add somebody else
--     first, or close the organisation (delete it) instead.
--   - The one way to end up with no admin is the last admin's account being deleted,
--     since that cascades past every rule above. The organisation is then
--     "unadministered" (unadministered_since is set), and any account that used to be
--     one of its admins may claim it back. Until then nobody can edit it, close it, or
--     start a project in its name; its public page stays up and says so. If nobody is
--     left who can claim it, closing it takes the SQL editor.
--
-- Run this once in the Supabase SQL editor, after auth.sql and projects.sql. It is
-- safe to re-run.

create extension if not exists pgcrypto;


-- 1. The organisation.
create table if not exists public.organisations (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  -- All optional, and '' rather than null when empty, the same as the profile
  -- details they replace (profiles-details.sql).
  contact_email text       not null default '',
  website      text        not null default '',
  location     text        not null default '',
  description  text        not null default '',
  -- Who started it. Nulled rather than cascaded if that account goes: the
  -- organisation belongs to its admins, not to whoever happened to create it.
  created_by   uuid        references auth.users (id) on delete set null,
  -- Null while it has at least one admin. Set by section 4's trigger the moment the
  -- last admin row goes, and cleared again when somebody claims it.
  unadministered_since timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.organisations enable row level security;

alter table public.organisations drop constraint if exists organisations_name_shape;
alter table public.organisations add constraint organisations_name_shape
  check (length(trim(name)) between 1 and 120);

-- The same loose shape checks as a profile's contact email and website.
alter table public.organisations drop constraint if exists organisations_contact_email_shape;
alter table public.organisations add constraint organisations_contact_email_shape
  check (contact_email = '' or (length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

alter table public.organisations drop constraint if exists organisations_website_shape;
alter table public.organisations add constraint organisations_website_shape
  check (website = '' or (length(website) <= 200 and website ~* '^https?://[^\s]+$'));

alter table public.organisations drop constraint if exists organisations_location_size;
alter table public.organisations add constraint organisations_location_size
  check (length(location) <= 120);

alter table public.organisations drop constraint if exists organisations_description_size;
alter table public.organisations add constraint organisations_description_size
  check (length(description) <= 4000);

comment on table public.organisations is
  'One row per organisation. Public to read, admins-only to edit or close.';


-- 2. Admins, and who used to be one.
--
-- Both tables are written only by the functions in section 5 and the trigger in
-- section 3, never by a client directly: one that could insert here could make
-- itself an admin of any organisation.
create table if not exists public.organisation_admins (
  organisation_id uuid        not null references public.organisations (id) on delete cascade,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  -- Snapshotted when they were added, for the roster, the same reason
  -- project_collaborators snapshots them: nothing here joins out to a stranger's
  -- profile. email is null for an account that signed up with a phone number.
  email           text,
  display_name    text,
  created_at      timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

alter table public.organisation_admins enable row level security;

create index if not exists organisation_admins_user_id_idx on public.organisation_admins (user_id);

-- Everyone who has left or been removed, so that an organisation whose last admin's
-- account is deleted can be claimed back by one of them (see the header). No policy
-- and no grant at all: only organisation_claim and organisation_can_claim read it.
create table if not exists public.organisation_former_admins (
  organisation_id uuid        not null references public.organisations (id) on delete cascade,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  left_at         timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

alter table public.organisation_former_admins enable row level security;
revoke all on public.organisation_former_admins from anon, authenticated;


-- Whether an account is one of an organisation's admins. Security definer for the
-- same reason project_collaborator_exists is (projects.sql section 4): the roster's
-- own read policy asks this question, and asking it with a subquery on the roster
-- would re-enter that policy and recurse.
create or replace function public.organisation_is_admin(p_organisation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organisation_admins
     where organisation_id = p_organisation_id and user_id = p_user_id
  );
$$;

revoke all on function public.organisation_is_admin(uuid, uuid) from public;
grant execute on function public.organisation_is_admin(uuid, uuid) to authenticated;


-- 3. Who may do what with an organisation.
--
-- Reading is open to everybody, signed in or not, like a project: the public page
-- is the point, and every column on the row is one its admins chose to publish.
-- Creating one takes an account; editing and closing it take being an admin.
drop policy if exists "anyone can read an organisation" on public.organisations;
create policy "anyone can read an organisation"
  on public.organisations
  for select
  to anon, authenticated
  using (true);

drop policy if exists "an account can create an organisation" on public.organisations;
create policy "an account can create an organisation"
  on public.organisations
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "an admin can edit an organisation" on public.organisations;
create policy "an admin can edit an organisation"
  on public.organisations
  for update
  to authenticated
  using (public.organisation_is_admin(id, auth.uid()))
  with check (public.organisation_is_admin(id, auth.uid()));

drop policy if exists "an admin can close an organisation" on public.organisations;
create policy "an admin can close an organisation"
  on public.organisations
  for delete
  to authenticated
  using (public.organisation_is_admin(id, auth.uid()));

-- unadministered_since is never the client's to set, and created_by only on insert,
-- where the policy above pins it to the caller.
revoke all on public.organisations from anon, authenticated;
grant select on public.organisations to anon, authenticated;
grant insert (id, created_by, name, contact_email, website, location, description)
  on public.organisations to authenticated;
grant update (name, contact_email, website, location, description)
  on public.organisations to authenticated;
grant delete on public.organisations to authenticated;

-- The creator becomes the first admin in the same statement that creates the row,
-- so there is never a moment where an organisation exists with nobody to run it.
create or replace function public.organisation_add_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organisation_admins (organisation_id, user_id, email, display_name)
  select new.id, u.id, lower(u.email), p.display_name
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = new.created_by;

  -- Created from the SQL editor, with nobody signed in: there is no creator to make
  -- an admin, so it starts out unadministered rather than pretending otherwise.
  if not found then
    update public.organisations set unadministered_since = now() where id = new.id;
  end if;

  return null;
end;
$$;

drop trigger if exists organisations_add_creator on public.organisations;
create trigger organisations_add_creator
  after insert on public.organisations
  for each row execute function public.organisation_add_creator();

-- An admin reads the whole roster; anybody else sees only their own row, which is
-- what lets an account list the organisations it runs.
drop policy if exists "an admin can read the roster" on public.organisation_admins;
create policy "an admin can read the roster"
  on public.organisation_admins
  for select
  to authenticated
  using (user_id = auth.uid() or public.organisation_is_admin(organisation_id, auth.uid()));

revoke all on public.organisation_admins from anon, authenticated;
grant select on public.organisation_admins to authenticated;

comment on table public.organisation_admins is
  'Who runs an organisation. Written only by the organisation_* functions and the creator trigger.';


-- 4. Keeping unadministered_since true.
--
-- The functions in section 5 never let the last admin go, so in practice this fires
-- when an account is deleted and its admin rows cascade away with it.
create or replace function public.organisation_admins_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.organisations
       set unadministered_since = null
     where id = new.organisation_id and unadministered_since is not null;
    return null;
  end if;

  if not exists (select 1 from public.organisation_admins where organisation_id = old.organisation_id) then
    update public.organisations
       set unadministered_since = now()
     where id = old.organisation_id and unadministered_since is null;
  end if;
  return null;
end;
$$;

drop trigger if exists organisation_admins_changed on public.organisation_admins;
create trigger organisation_admins_changed
  after insert or delete on public.organisation_admins
  for each row execute function public.organisation_admins_changed();


-- 5. Adding, removing, leaving and claiming.
--
-- Each one locks the organisation's row first, so two admins leaving at the same
-- moment cannot both see the other one still there and leave it with nobody.
create or replace function public.organisation_add_admin(p_organisation_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target uuid;
  v_target_email text;
  v_target_name text;
begin
  if v_caller is null then
    raise exception 'adding an admin needs an account';
  end if;

  perform 1 from public.organisations where id = p_organisation_id for update;

  if not public.organisation_is_admin(p_organisation_id, v_caller) then
    raise exception 'only an organisation''s admins may add an admin';
  end if;

  select id, lower(email) into v_target, v_target_email
    from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then
    raise exception 'no PLACER account is registered to that email address';
  end if;

  select display_name into v_target_name from public.profiles where id = v_target;

  insert into public.organisation_admins (organisation_id, user_id, email, display_name)
  values (p_organisation_id, v_target, v_target_email, v_target_name)
  on conflict (organisation_id, user_id) do nothing;

  -- An admin again, so no longer a former one.
  delete from public.organisation_former_admins
   where organisation_id = p_organisation_id and user_id = v_target;

  return true;
end;
$$;

revoke all on function public.organisation_add_admin(uuid, text) from public;
grant execute on function public.organisation_add_admin(uuid, text) to authenticated;

-- Removing yourself is leaving: the same function, and the same rule about the last admin.
create or replace function public.organisation_remove_admin(p_organisation_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'removing an admin needs an account';
  end if;

  perform 1 from public.organisations where id = p_organisation_id for update;

  if not public.organisation_is_admin(p_organisation_id, v_caller) then
    raise exception 'only an organisation''s admins may remove an admin';
  end if;

  if not public.organisation_is_admin(p_organisation_id, p_user_id) then
    return true;
  end if;

  if (select count(*) from public.organisation_admins where organisation_id = p_organisation_id) <= 1 then
    raise exception 'an organisation needs at least one admin: add another admin first, or close the organisation';
  end if;

  delete from public.organisation_admins
   where organisation_id = p_organisation_id and user_id = p_user_id;

  insert into public.organisation_former_admins (organisation_id, user_id)
  values (p_organisation_id, p_user_id)
  on conflict (organisation_id, user_id) do update set left_at = now();

  return true;
end;
$$;

revoke all on function public.organisation_remove_admin(uuid, uuid) from public;
grant execute on function public.organisation_remove_admin(uuid, uuid) to authenticated;

-- Whether the caller may claim an unadministered organisation, for the public page's
-- button. Answers only about the caller, never about anyone else.
create or replace function public.organisation_can_claim(p_organisation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.organisations o
      join public.organisation_former_admins f on f.organisation_id = o.id
     where o.id = p_organisation_id
       and o.unadministered_since is not null
       and f.user_id = auth.uid()
  );
$$;

revoke all on function public.organisation_can_claim(uuid) from public;
grant execute on function public.organisation_can_claim(uuid) to authenticated;

create or replace function public.organisation_claim(p_organisation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'claiming an organisation needs an account';
  end if;

  perform 1 from public.organisations where id = p_organisation_id for update;

  if not public.organisation_can_claim(p_organisation_id) then
    raise exception 'only a former admin may claim an organisation, and only once it has no admin';
  end if;

  insert into public.organisation_admins (organisation_id, user_id, email, display_name)
  select p_organisation_id, u.id, lower(u.email), p.display_name
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = v_caller;

  delete from public.organisation_former_admins
   where organisation_id = p_organisation_id and user_id = v_caller;

  return true;
end;
$$;

revoke all on function public.organisation_claim(uuid) from public;
grant execute on function public.organisation_claim(uuid) to authenticated;


-- 6. Running a project in an organisation's name.
--
-- Nullable and additive, like imaginations.project_id: a project with no
-- organisation is exactly what every project was before this file. Closing the
-- organisation leaves its projects in place, credited to their owners again.
alter table public.projects
  add column if not exists organisation_id uuid references public.organisations (id) on delete set null;

create index if not exists projects_organisation_id_idx on public.projects (organisation_id);

-- Reading is already the whole table (projects.sql). Insert and update are granted
-- column by column, so the new column has to be named in both.
grant insert (organisation_id) on public.projects to authenticated;
grant update (organisation_id) on public.projects to authenticated;

-- The project policies already decide who may write a project at all; this adds that
-- only an organisation's admins may put its name on one. Checked only when the value
-- changes, so a collaborator editing an organisation's project is not refused for
-- the organisation it already had.
create or replace function public.projects_check_organisation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organisation_id is not null
     and (tg_op = 'INSERT' or new.organisation_id is distinct from old.organisation_id)
     -- No auth.uid() is the SQL editor, which is trusted with everything anyway.
     and auth.uid() is not null
     and not public.organisation_is_admin(new.organisation_id, auth.uid()) then
    raise exception 'only an organisation''s admins may run a project in its name';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_check_organisation on public.projects;
create trigger projects_check_organisation
  before insert or update of organisation_id on public.projects
  for each row execute function public.projects_check_organisation();


-- Verify, after running the above:
--
--   select relrowsecurity from pg_class
--    where relname in ('organisations', 'organisation_admins', 'organisation_former_admins');
--   select policyname, cmd, roles from pg_policies
--    where tablename in ('organisations', 'organisation_admins');
--   select column_name from information_schema.columns
--    where table_name = 'projects' and column_name = 'organisation_id';
--
-- Expect rls true on all three tables; SELECT, INSERT, UPDATE and DELETE policies on
-- organisations and one SELECT on organisation_admins; none at all on
-- organisation_former_admins; and organisation_id present on projects.
--
-- Then, that an organisation really is public — with nothing but the anon key:
--
--   curl -s "https://<project-ref>.supabase.co/rest/v1/organisations?select=name" \
--     -H "apikey: <anon key>"
