-- PLACER — profile details and cover images.
--
-- The public profile page (/people/<id>) grew a cover image across the top and a
-- Details card: name, account type, a contact email and a website. This adds the
-- four columns behind that to public.profiles, a Storage bucket for the cover
-- images, and a new profile_public() that returns them.
--
-- The contact email is deliberately its own column, empty until somebody fills it
-- in. The login email lives in auth.users and is never shown to anyone; a person
-- who wants to be reachable from their profile chooses an address to publish, which
-- may or may not be the same one.
--
-- Run this once in the Supabase SQL editor, after auth.sql and profiles-public.sql.
-- It is safe to re-run. It replaces the profile_public() that profiles-public.sql
-- creates, so run it after that file, never before.


-- 1. The columns.
--
-- All four default to "not filled in", so existing profiles need no backfill.
alter table public.profiles add column if not exists account_type text not null default 'individual';
alter table public.profiles add column if not exists contact_email text not null default '';
alter table public.profiles add column if not exists website text not null default '';
-- Path within the profile-covers bucket, '<user id>/cover-<time>.<ext>'. Null for
-- no cover, which the page shows as a plain grey band instead.
alter table public.profiles add column if not exists cover_path text;

alter table public.profiles drop constraint if exists profiles_account_type_known;
alter table public.profiles add constraint profiles_account_type_known
  check (account_type in ('individual', 'organisation'));

-- A loose shape check, not validation: enough to stop the field holding something
-- that is plainly not an address or a link, the way profiles_bio_size stops a novel.
alter table public.profiles drop constraint if exists profiles_contact_email_shape;
alter table public.profiles add constraint profiles_contact_email_shape
  check (contact_email = '' or (length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

-- Only http(s), so a profile link can never be a javascript: URL.
alter table public.profiles drop constraint if exists profiles_website_shape;
alter table public.profiles add constraint profiles_website_shape
  check (website = '' or (length(website) <= 200 and website ~* '^https?://[^\s]+$'));

-- A cover can only ever point into its own owner's folder, so nobody can set their
-- cover to somebody else's picture.
alter table public.profiles drop constraint if exists profiles_cover_path_own_folder;
alter table public.profiles add constraint profiles_cover_path_own_folder
  check (cover_path is null or cover_path like id::text || '/%');

-- The same pattern as auth.sql: the owner reads and edits their own row, column by
-- column. Nothing here is readable by anyone else except through profile_public().
grant select (account_type, contact_email, website, cover_path) on public.profiles to authenticated;
grant update (account_type, contact_email, website, cover_path) on public.profiles to authenticated;


-- 2. The public read, now with the details.
--
-- Dropped rather than replaced, because the columns it returns have changed and
-- Postgres will not change a function's return type in place.
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
  cover_path    text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.bio, p.location, p.avatar,
         p.account_type, p.contact_email, p.website, p.cover_path
    from public.profiles p
   where p.id = p_id;
$$;

revoke all on function public.profile_public(uuid) from public;
grant execute on function public.profile_public(uuid) to anon, authenticated;


-- 3. Where cover images live.
--
-- Public, like imagination-previews: a cover is shown on a page anyone can open.
-- Each account writes only inside a folder named after its own id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-covers', 'profile-covers', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone can read a profile cover" on storage.objects;
create policy "anyone can read a profile cover"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'profile-covers');

drop policy if exists "an owner can upload their own cover" on storage.objects;
create policy "an owner can upload their own cover"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "an owner can delete their own cover" on storage.objects;
create policy "an owner can delete their own cover"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- Verify, after running the above:
--
--   select column_name from information_schema.columns
--    where table_name = 'profiles' order by ordinal_position;
--   select * from public.profile_public((select id from public.profiles limit 1));
--   select id, public, file_size_limit from storage.buckets where id = 'profile-covers';
--   select policyname, cmd from pg_policies
--    where tablename = 'objects' and policyname like '%cover%';
--
-- Expect the four new columns, profile_public returning nine columns, a public
-- bucket with a 5 MB limit, and one SELECT, one INSERT and one DELETE policy.
