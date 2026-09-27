-- PLACER — how many times each project's public page has been viewed.
--
-- One row per project per day, holding a count and nothing else: no IP address, no
-- account, no cookie id. A number that cannot be traced back to anybody is not
-- personal data, so unlike PostHog it needs no consent, and every visit counts —
-- not only the visitors who accepted the cookie banner.
--
-- Two things keep the number honest. The page records a view once per browser
-- session (sessionStorage, in PublicProjectPage.jsx), so a refresh does not count
-- again. And project_view_record() ignores the project's own owner and
-- collaborators, so the people checking their own page do not inflate it.
--
-- What it cannot stop is somebody calling the function in a loop. The anon key is
-- public and nothing here identifies a caller to rate-limit by, which is the price
-- of storing nothing about them. For a beta that is an acceptable trade; the day
-- rows make any spike easy to spot, and to correct in the SQL editor.
--
-- Run this once in the Supabase SQL editor, after projects.sql. Safe to re-run.


-- 1. The counts.
create table if not exists public.project_view_days (
  project_id uuid    not null references public.projects (id) on delete cascade,
  -- The day in Swedish time, which is where PLACER's projects are.
  day        date    not null,
  views      integer not null default 0 check (views >= 0),
  primary key (project_id, day)
);

-- No policies and no grants: nobody reads or writes this table directly. The three
-- functions below are the only way in, and each decides who it answers.
alter table public.project_view_days enable row level security;
revoke all on public.project_view_days from anon, authenticated;

comment on table public.project_view_days is
  'Page views of each project''s public page, one row per day. Written by project_view_record().';


-- 2. Whether the caller runs this project. The same test project_stats() makes.
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
       and (
         p.owner_id = auth.uid()
         or exists (
           select 1 from public.project_collaborators c
            where c.project_id = p.id and c.user_id = auth.uid()
         )
       )
  );
$$;

revoke all on function public.project_is_member(uuid) from public;


-- 3. Counting a view. Anyone may call it, signed in or not; it can only ever add one.
create or replace function public.project_view_record(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A project's own people looking at its page is not an audience.
  if auth.uid() is not null and public.project_is_member(p_project_id) then
    return;
  end if;

  -- An id that is not a project is quietly nothing, rather than an error a visitor
  -- would see for a link that was wrong anyway.
  if not exists (select 1 from public.projects where id = p_project_id) then
    return;
  end if;

  insert into public.project_view_days (project_id, day, views)
  values (p_project_id, (now() at time zone 'Europe/Stockholm')::date, 1)
  on conflict (project_id, day)
    do update set views = public.project_view_days.views + 1;
end;
$$;

revoke all on function public.project_view_record(uuid) from public;
grant execute on function public.project_view_record(uuid) to anon, authenticated;


-- 4. Reading them back, for the project's dashboard. Owner or collaborator only.
create or replace function public.project_views_total(p_project_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.project_is_member(p_project_id) then
    raise exception 'only a project''s owner or collaborators may read its dashboard';
  end if;

  return (select coalesce(sum(views), 0)::int
            from public.project_view_days where project_id = p_project_id);
end;
$$;

revoke all on function public.project_views_total(uuid) from public;
grant execute on function public.project_views_total(uuid) to authenticated;

-- The last p_days days, oldest first, ending today, with a row for every day —
-- a day nobody visited is a 0, not a gap, so a chart can be drawn straight from it.
create or replace function public.project_views_daily(p_project_id uuid, p_days integer default 30)
returns table (day date, views integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
  span  integer := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.project_is_member(p_project_id) then
    raise exception 'only a project''s owner or collaborators may read its dashboard';
  end if;

  return query
    select d::date, coalesce(v.views, 0)::int
      from generate_series(today - (span - 1), today, interval '1 day') as d
      left join public.project_view_days v
        on v.project_id = p_project_id and v.day = d::date
     order by d;
end;
$$;

revoke all on function public.project_views_daily(uuid, integer) from public;
grant execute on function public.project_views_daily(uuid, integer) to authenticated;


-- Verify, after running the above:
--
--   select relrowsecurity from pg_class where relname = 'project_view_days';
--   select policyname from pg_policies where tablename = 'project_view_days';
--   select * from public.project_view_days order by day desc limit 20;
--
-- Expect rls true and no policies. To correct a spike by hand:
--
--   update public.project_view_days set views = <n>
--    where project_id = '<id>' and day = '<yyyy-mm-dd>';
