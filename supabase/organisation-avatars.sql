-- PLACER — an organisation's profile picture, on Cloudflare R2.
--
-- The round picture beside an organisation's name — on its public page, in the
-- list of organisations — stored like its cover (organisation-covers.sql): the file
-- lives in the R2 bucket, written through the `media` Edge Function, and the row
-- keeps only its key.
--
--   organisations.avatar_path   'organisation-avatars/<organisation id>/avatar-<time>.webp'
--
-- Its own folder rather than the cover's, because the media function sweeps a folder
-- down to the one picture its column points at: sharing `organisations/` with the
-- cover would delete each picture whenever the other was replaced. As with the cover,
-- the folder is the organisation's id and any of its admins may write there
-- (organisation_is_admin() in organisations.sql). At most 1 MB once the browser has
-- re-encoded it to a 512px square.
--
-- Run this once in the Supabase SQL editor, after organisation-covers.sql. It is safe
-- to re-run.

alter table public.organisations add column if not exists avatar_path text;

-- A picture can only point into its own organisation's folder, so no organisation
-- can show somebody else's.
alter table public.organisations drop constraint if exists organisations_avatar_path_own;
alter table public.organisations add constraint organisations_avatar_path_own
  check (avatar_path is null or avatar_path like 'organisation-avatars/' || id::text || '/%');

-- Reading is already the whole table (organisations.sql). The update grant is column
-- by column, so the new column has to be named; the update policy keeps it to admins.
grant update (avatar_path) on public.organisations to authenticated;

-- Verify:
--   select column_name from information_schema.columns
--    where table_name = 'organisations' and column_name = 'avatar_path';
