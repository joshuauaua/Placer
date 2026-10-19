-- PLACER — a caption for each of the photos on a project's page.
--
-- `gallery_captions` is keyed by the photo's path in `gallery_paths`
-- (project-gallery.sql), so a caption stays with its photo when the photos are put in
-- another order:
--
--   { "gallery/<project id>/<file>.webp": "The underpass before the mural, 2019" }
--
-- A photo with no entry has no caption, and an entry for a photo since taken out is
-- ignored (and dropped the next time the project is saved). Shown under the photo in
-- the page's gallery. Set from Edit project, so only update is granted on it.
--
-- Run after project-gallery.sql. Safe to re-run.

alter table public.projects add column if not exists gallery_captions jsonb not null default '{}'::jsonb;

-- An object, and a bounded one: twelve captions of a couple of hundred characters each
-- is far inside it.
alter table public.projects drop constraint if exists projects_gallery_captions_shape;
alter table public.projects add constraint projects_gallery_captions_shape
  check (jsonb_typeof(gallery_captions) = 'object'
         and octet_length(gallery_captions::text) <= 20000);

-- Reading is already the whole table (projects.sql). Update is granted column by
-- column, so the new column has to be named.
grant update (gallery_captions) on public.projects to authenticated;

-- Verify:
--   select count(*) filter (where gallery_captions <> '{}'::jsonb) as captioned, count(*)
--     from public.projects;
