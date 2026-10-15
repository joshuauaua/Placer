-- PLACER — room limits big enough for a map.
--
-- rooms.sql capped a participant's answer at 4000 characters and rooms-config.sql a
-- room's setup at 16 KB, sized for ballots and word lists. Desire Lines stores walks
-- as [lng, lat] points on real sites: a visitor drawing four or five walks across
-- two or three sites is already past 4000 characters, and an organiser marking up
-- six sites passes 16 KB. Both caps go up to 64 KB, which still stops a request
-- storing megabytes.
--
-- Run this once in the Supabase SQL editor after rooms.sql and rooms-config.sql. It
-- is safe to re-run.

alter table public.toolkit_contributions drop constraint if exists toolkit_contributions_state_size;
alter table public.toolkit_contributions add constraint toolkit_contributions_state_size
  check (length(state::text) <= 65536);

alter table public.toolkit_rooms drop constraint if exists toolkit_rooms_config_shape;
alter table public.toolkit_rooms add constraint toolkit_rooms_config_shape
  check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 65536);

-- Verify:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname in ('toolkit_contributions_state_size', 'toolkit_rooms_config_shape');
