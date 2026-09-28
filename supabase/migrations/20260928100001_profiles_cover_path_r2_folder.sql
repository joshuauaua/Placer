-- Catch-up for 20260928090001_media_on_r2.sql.
--
-- media-r2.sql moved cover keys to 'covers/<user id>/…' and added
-- profiles_cover_path_own to match, but left profiles-details.sql's
-- profiles_cover_path_own_folder in place, which still demands '<user id>/…'. No
-- key can satisfy both, so every new cover failed the constraint. The source now
-- drops the old check; 20260928090001 had already been pushed and recorded as
-- applied, so `db push` would never replay it. This re-issues just the drop.

alter table public.profiles drop constraint if exists profiles_cover_path_own_folder;
