-- Backfill for 20260913090003_sandbox_rooms.sql.
--
-- Same drift as 20260922110001's profiles fix: that migration's file was edited
-- (open-vote added alongside budget-ballot) after 20260913090003 had already been
-- pushed and recorded as applied, so `db push` never saw the edit. Live still had
-- `check (experiment = 'budget-ballot')`, so opening an open-vote room failed the
-- constraint with a 400 from PostgREST. This re-issues just the part that never ran.

alter table public.sandbox_rooms drop constraint if exists sandbox_rooms_experiment_known;
alter table public.sandbox_rooms add constraint sandbox_rooms_experiment_known
  check (experiment in ('budget-ballot', 'open-vote'));
