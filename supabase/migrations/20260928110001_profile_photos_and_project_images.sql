-- Generated from supabase/media-photos.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — profile photos and project images, both on Cloudflare R2.
--
-- Two more kinds of picture, stored exactly like covers and previews (media-r2.sql):
-- the file lives in the R2 bucket, written through the `media` Edge Function, and
-- the row keeps only its key.
--
--   profiles.avatar_path   'avatars/<user id>/avatar-<time>.jpg'
--   projects.image_path    'projects/<project id>/image-<time>.jpg'
--
-- A profile photo is shown instead of the avatar icon, and the icon instead of the
-- initials, which stay the default. A project image is shown instead of the map of
-- the project's area, which stays the default.
--
-- A photo belongs to one account, so it goes in that account's folder like a cover.
-- A project image belongs to the project, not to whoever uploaded it — an owner and
-- their collaborators can all replace it — so its folder is the project's id, and
-- project_can_edit() below is how the media function asks who may write there.
--
-- Run this once in the Supabase SQL editor, after profiles-details.sql, projects.sql
-- and media-r2.sql. It is safe to re-run.


-- 1. Profile photos.
alter table public.profiles add column if not exists avatar_path text;

alter table public.profiles drop constraint if exists profiles_avatar_path_own;
alter table public.profiles add constraint profiles_avatar_path_own
  check (avatar_path is null or avatar_path like 'avatars/' || id::text || '/%');

grant select (avatar_path) on public.profiles to authenticated;
grant update (avatar_path) on public.profiles to authenticated;

-- profile_public() gains the photo, so a public profile can show it. Dropped rather
-- than replaced: its return type changes, and Postgres will not do that in place.
drop function if exists public.profile_public(uuid);

create function public.profile_public(p_id uuid)
returns table (
  id            uuid,
  display_name  text,
  bio           text,
  location      text,
  avatar        text,
  account_type  text,
  contact_email text,
  website       text,
  cover_path    text,
  avatar_path   text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.bio, p.location, p.avatar,
         p.account_type, p.contact_email, p.website, p.cover_path, p.avatar_path
    from public.profiles p
   where p.id = p_id;
$$;

revoke all on function public.profile_public(uuid) from public;
grant execute on function public.profile_public(uuid) to anon, authenticated;


-- 2. Project images.
alter table public.projects add column if not exists image_path text;

alter table public.projects drop constraint if exists projects_image_path_own;
alter table public.projects add constraint projects_image_path_own
  check (image_path is null or image_path like 'projects/' || id::text || '/%');

-- Reading is already the whole table to anon and authenticated (projects.sql). The
-- update grant is column by column, so the new column has to be named.
grant update (image_path) on public.projects to authenticated;


-- 3. Who may write a project's pictures.
--
-- The same rule as the "an owner or collaborator can edit a project" policy, asked
-- as a question. Security definer because a collaborator cannot read the whole
-- roster through RLS; it only ever answers about the caller, never anyone else.
create or replace function public.project_can_edit(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project_id
       and (p.owner_id = auth.uid()
            or public.project_collaborator_exists(p.id, auth.uid()))
  );
$$;

revoke all on function public.project_can_edit(uuid) from public;
grant execute on function public.project_can_edit(uuid) to authenticated;


-- Verify, after running the above:
--
--   select column_name from information_schema.columns
--    where table_name in ('profiles', 'projects') and column_name in ('avatar_path', 'image_path');
--   select * from public.profile_public((select id from public.profiles limit 1));
--   select public.project_can_edit((select id from public.projects limit 1));
