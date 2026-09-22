-- Backfill for 20260913090002_profiles_and_accounts.sql.
--
-- That file was edited (location/avatar columns, their grants and constraints
-- added) after 20260913090002 had already been pushed and recorded as applied.
-- Supabase tracks migrations by version, not content, so `db push` never saw the
-- edit and live profiles never got the new columns. This re-issues just the part
-- that never ran; everything here is the same idempotent shape as the original.

alter table public.profiles add column if not exists location text not null default '';
alter table public.profiles add column if not exists avatar text;

grant select (id, display_name, bio, location, avatar, created_at, updated_at) on public.profiles to authenticated;
grant update (display_name, bio, location, avatar) on public.profiles to authenticated;

alter table public.profiles drop constraint if exists profiles_location_size;
alter table public.profiles add constraint profiles_location_size
  check (length(location) <= 120);

-- Keep in step with AVATAR_ICONS in src/components/UI.jsx.
alter table public.profiles drop constraint if exists profiles_avatar_known;
alter table public.profiles add constraint profiles_avatar_known
  check (avatar is null or avatar in (
    'user', 'tree', 'bench', 'art', 'play', 'light', 'cart', 'sparkle', 'pin', 'walk', 'bike', 'planter'
  ));
