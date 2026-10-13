-- Lets the Word Cloud host a room, and names it in the alerts' text.
--
-- supabase/rooms.sql and supabase/notifications-projects.sql have both changes, but
-- their own migrations (20260913090003 and 20261005110001) were pushed and recorded
-- as applied long before, and `db push` never replays an edited one. This re-issues
-- just the two parts that changed: the list of tools a room may be opened for
-- (src/toolkit/tools.js is the other half of the pair), and toolkit_tool_name.

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_tool_known;
alter table public.toolkit_rooms add constraint toolkit_rooms_tool_known
  check (tool in ('budget-ballot', 'open-vote', 'word-cloud'));

create or replace function public.toolkit_tool_name(p_tool text)
returns text
language sql
immutable
as $$
  select case p_tool
    when 'budget-ballot' then 'Co-Budget'
    when 'open-vote'     then 'Poll'
    when 'word-cloud'    then 'Word Cloud'
    else 'a Toolkit tool'
  end;
$$;
