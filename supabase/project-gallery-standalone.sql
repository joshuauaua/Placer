-- PLACER — photos shown on their own on a project's page, not in its gallery.
--
-- A project's photos (`gallery_paths`, project-gallery.sql) are shown together in its
-- Photos section, one at a time. `gallery_standalone` names the ones its organisers
-- chose to show on their own instead: each is a section of the page by itself, which
-- Edit project's Page Layout puts in order with the rest (project-page-layout.sql,
-- under the key "photo:<path>"). A path here that is no longer one of the photos is
-- ignored, and taken out when the photo is.
--
-- Empty for every project until somebody chooses one. Set from Edit project, so only
-- update is granted on it.
--
-- Run after project-gallery.sql. Safe to re-run.

alter table public.projects add column if not exists gallery_standalone text[] not null default '{}';

alter table public.projects drop constraint if exists projects_gallery_standalone_size;
alter table public.projects add constraint projects_gallery_standalone_size
  check (cardinality(gallery_standalone) <= 12);

-- Reading is already the whole table (projects.sql). Update is granted column by
-- column, so the new column has to be named.
grant update (gallery_standalone) on public.projects to authenticated;

-- Verify:
--   select count(*) filter (where cardinality(gallery_standalone) > 0) as with_standalone, count(*)
--     from public.projects;
