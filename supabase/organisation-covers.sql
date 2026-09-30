-- PLACER — an organisation's cover image, on Cloudflare R2.
--
-- The wide picture across the top of an organisation's public page, stored exactly
-- like a profile's cover or a project's image (media-r2.sql, media-photos.sql): the
-- file lives in the R2 bucket, written through the `media` Edge Function, and the row
-- keeps only its key.
--
--   organisations.cover_path   'organisations/<organisation id>/cover-<time>.webp'
--
-- The folder is the organisation's id, not the uploader's, because any of its admins
-- may replace it; the media function asks organisation_is_admin() (organisations.sql)
-- who may write there. The limits are the media function's: at most 3 MB once the
-- browser has re-encoded it, and at most two in the folder (the current one and the
-- one replacing it).
--
-- Run this once in the Supabase SQL editor, after organisations.sql. It is safe to
-- re-run.

alter table public.organisations add column if not exists cover_path text;

-- A cover can only point into its own organisation's folder, so no organisation can
-- show somebody else's picture.
alter table public.organisations drop constraint if exists organisations_cover_path_own;
alter table public.organisations add constraint organisations_cover_path_own
  check (cover_path is null or cover_path like 'organisations/' || id::text || '/%');

-- Reading is already the whole table (organisations.sql). The update grant is column
-- by column, so the new column has to be named; the update policy keeps it to admins.
grant update (cover_path) on public.organisations to authenticated;

-- Verify:
--   select column_name from information_schema.columns
--    where table_name = 'organisations' and column_name = 'cover_path';
