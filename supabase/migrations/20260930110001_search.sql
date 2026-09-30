-- Generated from supabase/search.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — searching people, organisations and projects by name.
--
-- The search bar in the nav bar, for anyone signed in. One function answers for all
-- three kinds, so a keystroke is one request rather than three.
--
-- Projects and organisations are public tables already; people are not. profiles is
-- readable only by its owner, and profiles-public.sql chose a one-id-at-a-time
-- function over a public policy precisely so that nobody could list every account.
-- This is a deliberate, narrower opening of that: a signed-in account can find others
-- by display name. It still cannot list them — it needs at least two characters, gets
-- at most a handful back per kind, and only ever sees what a public profile page
-- already shows (name, location, photo). Anonymous visitors cannot call it at all.
--
-- Plain ILIKE with no index: at PLACER's size every table here is small enough to scan.
-- If that stops being true, a pg_trgm GIN index on each name column is the fix.
--
-- Run this once in the Supabase SQL editor, after profiles-details.sql,
-- media-photos.sql, organisation-covers.sql and projects.sql. It is safe to re-run.

create or replace function public.placer_search(p_query text, p_limit integer default 5)
returns table (
  kind       text,   -- 'person' | 'organisation' | 'project'
  id         uuid,
  name       text,
  detail     text,   -- a second line: where it is, or who runs it
  image_path text    -- an R2 key for a thumbnail, or null
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query   text := trim(coalesce(p_query, ''));
  v_limit   integer := least(greatest(coalesce(p_limit, 5), 1), 10);
  v_pattern text;
  v_prefix  text;
begin
  if auth.uid() is null then
    raise exception 'searching needs an account';
  end if;

  if length(v_query) < 2 then
    return;
  end if;

  -- What was typed is matched literally: % and _ are LIKE's wildcards, and a
  -- backslash is its escape, so all three are escaped rather than obeyed.
  v_query   := replace(replace(replace(left(v_query, 60), '\', '\\'), '%', '\%'), '_', '\_');
  v_pattern := '%' || v_query || '%';
  v_prefix  := v_query || '%';

  -- Names that start with what was typed first, then the rest, alphabetically.
  return query
    (select 'person'::text, p.id, p.display_name, nullif(p.location, ''), p.avatar_path
       from public.profiles p
      where p.display_name ilike v_pattern
      order by (p.display_name ilike v_prefix) desc, p.display_name
      limit v_limit)
    union all
    (select 'organisation'::text, o.id, o.name, nullif(o.location, ''), o.cover_path
       from public.organisations o
      where o.name ilike v_pattern
      order by (o.name ilike v_prefix) desc, o.name
      limit v_limit)
    union all
    (select 'project'::text, pr.id, pr.name, coalesce(org.name, pr.owner_name), pr.image_path
       from public.projects pr
       left join public.organisations org on org.id = pr.organisation_id
      where pr.name ilike v_pattern
      order by (pr.name ilike v_prefix) desc, pr.name
      limit v_limit);
end;
$$;

revoke all on function public.placer_search(text, integer) from public;
grant execute on function public.placer_search(text, integer) to authenticated;

-- Verify, signed in as any account (the SQL editor has no auth.uid(), so it raises):
--   select * from public.placer_search('ma');
