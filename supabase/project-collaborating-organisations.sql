-- PLACER — organisations as a project's collaborators.
--
-- Until now a project's collaborators were accounts, invited one email at a time
-- (projects.sql, section 5). A project run with a municipality or a studio wants that
-- organisation on it as a whole: credited on its page, and with whoever runs the
-- organisation able to work on it, including admins added after it joined.
--
-- So a project's owner can now add an organisation as a collaborator. Every admin of
-- that organisation (organisation_admins) then counts as one of the project's
-- collaborators — edits its setup and links, opens and changes its rooms, reads its
-- dashboard, sees it while it is private, hears about its responses — for as long as
-- they are an admin and the organisation is on the project. Nothing is copied into
-- project_collaborators: membership is worked out each time, so adding or removing an
-- admin takes effect straight away and leaves no rows to tidy up.
--
-- The rules:
--
--   - Only the project's owner adds an organisation, the same boundary as adding an
--     account. There is a directory this time — organisations are public — so it is
--     by id, not by email.
--   - The owner or any admin of the organisation removes it. An organisation is named
--     on the project's public page, and its admins were not asked, so they can take
--     its name off again rather than having to ask the owner.
--   - An organisation's admins get exactly what a collaborator gets, never more: they
--     cannot add or remove collaborators or delete the project.
--
-- How: project_collaborator_exists (projects.sql, section 4) is the one question
-- everything asks — directly, or through project_can_edit and project_can_view. It now
-- also answers yes for an admin of a collaborating organisation. A handful of
-- functions and policies asked the roster inline instead; each is re-issued below,
-- exactly as its latest version left it, with that check replaced by the function.
-- Those versions are named beside each one, and this file supersedes them.
--
-- Run after every other file in this directory (it re-issues imaginations-retire.sql's
-- project_stats and project_public_summary). Safe to re-run.


-- 1. Which organisations collaborate on which projects.
create table if not exists public.project_collaborating_organisations (
  project_id      uuid        not null references public.projects (id) on delete cascade,
  organisation_id uuid        not null references public.organisations (id) on delete cascade,
  added_by        uuid        references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (project_id, organisation_id)
);

alter table public.project_collaborating_organisations enable row level security;

create index if not exists project_collaborating_organisations_organisation_id_idx
  on public.project_collaborating_organisations (organisation_id);

-- Readable by whoever can see the project, which is everybody for a public one: the
-- organisation is credited on its page, and is shown on the organisation's own page
-- too. A private project's stays among the people who can see it.
drop policy if exists "anyone who can see a project can read its organisations"
  on public.project_collaborating_organisations;
create policy "anyone who can see a project can read its organisations"
  on public.project_collaborating_organisations
  for select
  to anon, authenticated
  using (public.project_can_view(project_id));

-- Written only by the functions in section 3, the same as project_collaborators: a
-- client that could insert here could make any organisation it runs a collaborator
-- on any project.
revoke all on public.project_collaborating_organisations from anon, authenticated;
grant select on public.project_collaborating_organisations to anon, authenticated;

comment on table public.project_collaborating_organisations is
  'Organisations collaborating on a project; their admins count as its collaborators. '
  'Written only by project_add_organisation / project_remove_organisation.';


-- 2. Who counts as a collaborator: an account on the roster, or an admin of an
--    organisation that is. Still security definer, for the reason projects.sql gives.
create or replace function public.project_collaborator_exists(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_collaborators
    where project_id = p_project_id and user_id = p_user_id
  ) or exists (
    select 1 from public.project_collaborating_organisations o
      join public.organisation_admins a on a.organisation_id = o.organisation_id
     where o.project_id = p_project_id and a.user_id = p_user_id
  );
$$;

revoke all on function public.project_collaborator_exists(uuid, uuid) from public;
grant execute on function public.project_collaborator_exists(uuid, uuid) to authenticated;


-- 3. Adding and removing one.
create or replace function public.project_add_organisation(p_project_id uuid, p_organisation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'adding a collaborator needs an account';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id and owner_id = auth.uid()) then
    raise exception 'only a project''s owner may add a collaborator';
  end if;

  if not exists (select 1 from public.organisations where id = p_organisation_id) then
    raise exception 'there is no such organisation';
  end if;

  insert into public.project_collaborating_organisations (project_id, organisation_id, added_by)
  values (p_project_id, p_organisation_id, auth.uid())
  on conflict (project_id, organisation_id) do nothing;

  return true;
end;
$$;

revoke all on function public.project_add_organisation(uuid, uuid) from public;
grant execute on function public.project_add_organisation(uuid, uuid) to authenticated;

create or replace function public.project_remove_organisation(p_project_id uuid, p_organisation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'removing a collaborator needs an account';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id and owner_id = auth.uid())
     and not public.organisation_is_admin(p_organisation_id, auth.uid()) then
    raise exception 'only a project''s owner or the organisation''s admins may remove it';
  end if;

  delete from public.project_collaborating_organisations
   where project_id = p_project_id and organisation_id = p_organisation_id;

  return true;
end;
$$;

revoke all on function public.project_remove_organisation(uuid, uuid) from public;
grant execute on function public.project_remove_organisation(uuid, uuid) to authenticated;


-- 4. The checks that asked the roster inline, now asking project_collaborator_exists.

-- projects.sql, section 3.
drop policy if exists "an owner or collaborator can edit a project" on public.projects;
create policy "an owner or collaborator can edit a project"
  on public.projects
  for update
  to authenticated
  using (owner_id = auth.uid() or public.project_collaborator_exists(id, auth.uid()))
  with check (owner_id = auth.uid() or public.project_collaborator_exists(id, auth.uid()));

-- projects.sql, section 6.
drop policy if exists "an owner or collaborator can add a link" on public.project_links;
create policy "an owner or collaborator can add a link"
  on public.project_links
  for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and (
      exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
      or public.project_collaborator_exists(project_id, auth.uid())
    )
  );

drop policy if exists "an owner or collaborator can remove a link" on public.project_links;
create policy "an owner or collaborator can remove a link"
  on public.project_links
  for delete
  to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or public.project_collaborator_exists(project_id, auth.uid())
  );

-- project-views.sql: their visits are not counted either.
create or replace function public.project_is_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project_id
       and (p.owner_id = auth.uid() or public.project_collaborator_exists(p.id, auth.uid()))
  );
$$;

revoke all on function public.project_is_member(uuid) from public;

-- notifications-projects.sql: they hear about its responses too.
create or replace function public.project_member_ids(p_project_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.owner_id from public.projects p where p.id = p_project_id
  union
  select c.user_id from public.project_collaborators c where c.project_id = p_project_id
  union
  select a.user_id from public.project_collaborating_organisations o
    join public.organisation_admins a on a.organisation_id = o.organisation_id
   where o.project_id = p_project_id;
$$;

revoke all on function public.project_member_ids(uuid) from public;

-- rooms-edit.sql, section 1.
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
      and (p.owner_id = auth.uid() or public.project_collaborator_exists(p.id, auth.uid()))
  );
$$;

revoke all on function public.toolkit_room_can_edit(uuid) from public;

-- rooms-edit.sql, section 4.
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
      and (p.owner_id = auth.uid() or public.project_collaborator_exists(p.id, auth.uid()))
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

-- rooms-start-time.sql, section 1.
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

-- imaginations-retire.sql, section 3.
create or replace function public.project_stats(p_project_id uuid)
returns table (
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
      and (p.owner_id = auth.uid() or public.project_collaborator_exists(p.id, auth.uid()))
  ) then
    raise exception 'only a project''s owner or collaborators may read its dashboard';
  end if;

  return query
    select (select count(*)::int from public.toolkit_rooms r where r.project_id = p_project_id);
end;
$$;

revoke all on function public.project_stats(uuid) from public;
grant execute on function public.project_stats(uuid) to authenticated;


-- 5. The public page: imaginations-retire.sql's project_public_summary, plus the
--    collaborating organisations to credit, and `can_edit` — whether the caller is
--    the owner or a collaborator, which the page can no longer work out from the
--    list of people alone, since an organisation's admins are not on it.
create or replace function public.project_public_summary(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.project_can_view(p_project_id) then
    return null;
  end if;

  select p.owner_id into v_owner from public.projects p where p.id = p_project_id;

  return jsonb_build_object(
    'views', (select coalesce(sum(d.views), 0)::int
                from public.project_view_days d where d.project_id = p_project_id),
    'followers', (select count(*)::int from public.follows f
                   where f.followed_type = 'project' and f.followed_id = p_project_id::text),
    'interactions',
      (select count(*)::int from public.toolkit_contributions c
         join public.toolkit_rooms r on r.id = c.room_id
        where r.project_id = p_project_id)
      + (select count(*)::int from public.project_comments m where m.project_id = p_project_id),
    'owner', (
      select jsonb_build_object(
        'id', pr.id,
        'name', pr.display_name,
        'bio', pr.bio,
        'location', pr.location,
        'avatar_path', pr.avatar_path,
        'joined_at', pr.created_at,
        'projects', (select count(*)::int from public.projects o
                      where o.owner_id = pr.id and o.visibility = 'public'))
        from public.profiles pr where pr.id = v_owner),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.user_id,
               'name', coalesce(pr.display_name, c.display_name, 'Collaborator'),
               'avatar_path', pr.avatar_path)
             order by c.created_at)
        from public.project_collaborators c
        left join public.profiles pr on pr.id = c.user_id
       where c.project_id = p_project_id), '[]'::jsonb),
    'organisations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', org.id,
               'name', org.name,
               'avatar_path', org.avatar_path)
             order by o.created_at)
        from public.project_collaborating_organisations o
        join public.organisations org on org.id = o.organisation_id
       where o.project_id = p_project_id), '[]'::jsonb),
    'can_edit', public.project_can_edit(p_project_id),
    'can_post_update', public.project_can_edit(p_project_id) or public.project_is_organiser(p_project_id),
    'can_post_as_organisation', public.project_is_organiser(p_project_id)
  );
end;
$$;

revoke all on function public.project_public_summary(uuid) from public;
grant execute on function public.project_public_summary(uuid) to anon, authenticated;


-- Verify, after running the above:
--
--   select policyname, cmd, roles from pg_policies
--    where tablename = 'project_collaborating_organisations';
--   -- one SELECT, to {anon,authenticated}
--
--   select prosrc like '%project_collaborating_organisations%'
--     from pg_proc where proname = 'project_collaborator_exists';
--   -- true
--
-- And that nothing still asks the roster inline (expect only project_collaborator_exists,
-- project_member_ids, project_public_summary and profile_public_activity, which lists
-- the projects a person collaborates on themselves):
--
--   select proname from pg_proc where prosrc like '%from public.project_collaborators%';
