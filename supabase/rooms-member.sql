-- PLACER — may the signed-in person take part in this room as one of its project's team?
--
-- The Gehl Institute's field tools (Site-Specific Spatial Mapping, Stationary Activity
-- Mapping, People Moving Count) are observations made by the project's own people, not
-- by the public: whoever opens one of their rooms has to be signed in and be the
-- project's owner or one of its collaborators. toolkit_room_can_edit (rooms-edit.sql)
-- already answers exactly that, but it is not callable from the browser. This is: it
-- answers only for the caller (auth.uid()), and only yes or no — never who else is on
-- the project.
--
-- A room opened without a project has no team, so the answer is no.
--
-- Run this once in the Supabase SQL editor after rooms-edit.sql. It is written to be
-- safe to re-run.

create or replace function public.toolkit_room_is_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null and public.toolkit_room_can_edit(p_room_id);
$$;

revoke all on function public.toolkit_room_is_member(uuid) from public;
grant execute on function public.toolkit_room_is_member(uuid) to authenticated;


-- Verify, signed in, after running the above:
--
--   select public.toolkit_room_is_member((select id from public.toolkit_rooms limit 1));
