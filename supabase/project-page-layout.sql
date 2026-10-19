-- PLACER — the order and the titles of the sections on a project's page.
--
-- A project's page draws its sections — About the project, Goals, Photos, and one per
-- live tool — in a fixed order, under fixed titles: a Poll is always "We want your
-- opinion". `page_layout` lets its organisers change both, from Edit project. It is
-- an ordered list:
--
--   [{ "key": "room:<room id>", "title": "Should the park get a bench?" },
--    { "key": "about" }, ...]
--
-- `key` names a section (src/lib/projectSections.js says which); `title`, if there,
-- replaces its default title. A section missing from the list — a tool added since,
-- a room opened since — goes after the ones in it, in the usual order, and an entry
-- for a section that has gone (a room that closed) is ignored. So the list can never
-- break the page, and an empty one, which is every project's until somebody changes
-- it, is the page as it always was.
--
-- Run after projects.sql. Safe to re-run.

alter table public.projects add column if not exists page_layout jsonb not null default '[]'::jsonb;

-- A list, and a bounded one: a few dozen sections with a title each is far inside it.
alter table public.projects drop constraint if exists projects_page_layout_shape;
alter table public.projects add constraint projects_page_layout_shape
  check (jsonb_typeof(page_layout) = 'array'
         and jsonb_array_length(page_layout) <= 100
         and octet_length(page_layout::text) <= 20000);

-- Reading is already the whole table (projects.sql). Update is granted column by
-- column, so the new column has to be named. Not insert: it is set once a project
-- exists and has sections to order.
grant update (page_layout) on public.projects to authenticated;

-- Verify:
--   select count(*) filter (where jsonb_array_length(page_layout) > 0) as arranged, count(*)
--     from public.projects;
