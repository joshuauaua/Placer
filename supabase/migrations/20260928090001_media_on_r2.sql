-- Generated from supabase/media-r2.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — pictures move from Supabase Storage to Cloudflare R2.
--
-- Supabase keeps the tables and the accounts; every uploaded picture now lives in an
-- R2 bucket, written through the `media` Edge Function (supabase/functions/media) and
-- read from a public domain (VITE_MEDIA_URL). The rows still hold only a key, but the
-- key now starts with the folder it belongs to:
--
--   imaginations.preview_path  'previews/<user id>/<imagination id>.jpg'
--   profiles.cover_path        'covers/<user id>/cover-<time>.png'
--
-- This file retires the Supabase side. The pictures stored there were not carried
-- over, so the keys pointing at them are cleared and the imaginations and profiles
-- simply show no picture until a new one is uploaded.
--
-- Run this once in the Supabase SQL editor, after imaginations.sql and
-- profiles-details.sql. It is safe to re-run.
--
-- Supabase does not allow the buckets themselves to be deleted from SQL. Once this
-- has run, delete `imagination-previews` and `profile-covers` by hand in
-- Dashboard -> Storage (see supabase/README.md section 14).


-- 1. Nobody writes to the old buckets any more.
--
-- The read policies go too: the buckets are about to be emptied and deleted, and a
-- policy on a bucket that is gone is just noise in pg_policies.
drop policy if exists "anyone can read an imagination preview" on storage.objects;
drop policy if exists "an owner can upload their own preview" on storage.objects;
drop policy if exists "an owner can replace their own preview" on storage.objects;
drop policy if exists "an owner can remove their own preview" on storage.objects;

drop policy if exists "anyone can read a profile cover" on storage.objects;
drop policy if exists "an owner can upload their own cover" on storage.objects;
drop policy if exists "an owner can delete their own cover" on storage.objects;


-- 2. Forget the pictures that stayed behind in Supabase Storage.
--
-- Anything not already an R2 key is an old Storage path. Re-running finds nothing.
update public.imaginations set preview_path = null
 where preview_path is not null and preview_path not like 'previews/%';

update public.profiles set cover_path = null
 where cover_path is not null and cover_path not like 'covers/%';


-- 3. A row may only point at its owner's own folder.
--
-- The media function already refuses to sign a key under somebody else's id, so
-- nobody can put a file there. This stops the other half: an account setting its own
-- row to show a picture that belongs to someone else.
alter table public.imaginations drop constraint if exists imaginations_preview_path_own;
alter table public.imaginations add constraint imaginations_preview_path_own
  check (preview_path is null or preview_path like 'previews/' || user_id::text || '/%');

-- profiles-details.sql's own-folder check assumed the key started with the user id;
-- it now starts with 'covers/', so the old check would refuse every new cover.
alter table public.profiles drop constraint if exists profiles_cover_path_own_folder;
alter table public.profiles drop constraint if exists profiles_cover_path_own;
alter table public.profiles add constraint profiles_cover_path_own
  check (cover_path is null or cover_path like 'covers/' || id::text || '/%');


-- Verify, after running the above:
--
--   select count(*) from public.imaginations where preview_path not like 'previews/%';  -- 0
--   select count(*) from public.profiles where cover_path not like 'covers/%';          -- 0
--   select policyname from pg_policies
--    where tablename = 'objects' and (policyname like '%preview%' or policyname like '%cover%');  -- none
