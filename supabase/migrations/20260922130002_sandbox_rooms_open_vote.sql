-- Backfill for 20260913090003_toolkit_rooms.sql.
--
-- Same drift as 20260922110001's profiles fix: that migration's file was edited
-- (open-vote added alongside budget-ballot) after 20260913090003 had already been
-- pushed and recorded as applied, so `db push` never saw the edit. Live still had
-- `check (tool = 'budget-ballot')`, so opening an open-vote room failed the
-- constraint with a 400 from PostgREST. This re-issues just the part that never ran.

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_tool_known;
alter table public.toolkit_rooms add constraint toolkit_rooms_tool_known
  check (tool in ('budget-ballot', 'open-vote'));
