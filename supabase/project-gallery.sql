-- PLACER — photos on a project's page, beside its header image.
--
-- `image_path` is the one picture at the top of the page and on the project's card.
-- `gallery_paths` is any number more (up to 12), in the order the organisers put
-- them, shown in a Photos section on the page. Each is a key in the R2 bucket under
-- gallery/<project id>/ (supabase/functions/media), a folder of its own because
-- `projects/<project id>/` is swept down to the header image whenever it is replaced.
--
-- Empty for every project until somebody adds a photo. Added after a project is
-- started, from its settings, so only update is granted on it, not insert.
--
-- Run after projects.sql. Safe to re-run.

alter table public.projects add column if not exists gallery_paths text[] not null default '{}';

alter table public.projects drop constraint if exists projects_gallery_paths_size;
alter table public.projects add constraint projects_gallery_paths_size
  check (cardinality(gallery_paths) <= 12);

-- Reading is already the whole table (projects.sql). Update is granted column by
-- column, so the new column has to be named.
grant update (gallery_paths) on public.projects to authenticated;

-- Verify:
--   select count(*) filter (where cardinality(gallery_paths) > 0) as with_photos, count(*)
--     from public.projects;
