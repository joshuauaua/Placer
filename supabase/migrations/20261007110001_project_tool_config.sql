-- Generated from supabase/project-tool-config.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — a tool's setup for one project, starting with Idea Visualizer's scene.
--
-- 1. project_tools.config. A project's chosen tools (project-setup.sql) were only a
--    list. Idea Visualizer has to be set up before people can use it for a project:
--    the organiser gives it a location and a base image, and everyone imagining for
--    the project draws on that image instead of capturing a Street View of their own.
--    That setup is kept on the tool's row:
--
--      { "address": "Folkets Park, Malmö", "lat": 55.59, "lng": 13.01,
--        "imagePath": "scenes/<project id>/scene-<time>.webp" }
--
--    null for a tool with nothing to set up, or not set up yet. The image itself is
--    in the R2 bucket's `scenes` folder (supabase/functions/media), which only the
--    project's owner and collaborators can write to. Public to read, like the rest of
--    the row, since anybody taking part needs it. Changed by the same people who can
--    add and remove the tool.
--
-- 2. imaginations.source. An imagination drawn on a project's scene says so, as
--    'project'. 'map' is let in too: it is what the map sends for a capture taken
--    off the map rather than Street View, which the old check refused.
--
-- Run this once in the Supabase SQL editor after project-setup.sql and
-- imaginations.sql. It is written to be safe to re-run.


-- 1. The setup.

alter table public.project_tools add column if not exists config jsonb;

-- Small: a few fields and a key, never the picture itself.
alter table public.project_tools drop constraint if exists project_tools_config_shape;
alter table public.project_tools add constraint project_tools_config_shape
  check (config is null or (jsonb_typeof(config) = 'object' and length(config::text) <= 2000));

drop policy if exists "an owner or collaborator can set a tool up" on public.project_tools;
create policy "an owner or collaborator can set a tool up"
  on public.project_tools
  for update
  to authenticated
  using (public.project_can_edit(project_id))
  with check (public.project_can_edit(project_id));

grant insert (config) on public.project_tools to authenticated;
grant update (config) on public.project_tools to authenticated;


-- 2. Where an imagination's picture came from.

alter table public.imaginations drop constraint if exists imaginations_source_known;
alter table public.imaginations add constraint imaginations_source_known
  check (source is null or source in ('streetview', 'staticmap', 'map', 'project'));


-- Verify, after running the above:
--
--   select column_name from information_schema.columns
--    where table_name = 'project_tools' and column_name = 'config';
--   select policyname, cmd from pg_policies where tablename = 'project_tools';
