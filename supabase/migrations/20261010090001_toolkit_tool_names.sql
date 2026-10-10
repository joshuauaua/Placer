-- Renames Open Vote to Poll and Budget Ballot to Co-Budget in the alerts' text, to
-- match the names the app shows (src/toolkit/tools.js). The tool ids are unchanged.
--
-- supabase/notifications-projects.sql has the new names; this re-issues just
-- toolkit_tool_name from it.

create or replace function public.toolkit_tool_name(p_tool text)
returns text
language sql
immutable
as $$
  select case p_tool
    when 'budget-ballot' then 'Co-Budget'
    when 'open-vote'     then 'Poll'
    else 'a Toolkit tool'
  end;
$$;
