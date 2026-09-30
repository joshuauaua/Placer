-- PLACER — where the Explore map opens for an account.
--
-- A profile's location has been free text ("Malmö, Sweden"), shown under the name on
-- the public profile. Settings now suggests places as it is typed (Google Places, the
-- same service the map's own search uses), and when one is chosen its coordinates are
-- kept beside the text, so Explore can open over that place instead of the default.
--
-- The coordinates are private, like everything on profiles that profile_public() does
-- not return: only the account itself reads or writes them. The public profile goes
-- on showing the text alone. Settings only suggests cities and regions, not street
-- addresses, so what is kept is the centre of a town or area, never a front door.
--
-- Both null means no place was chosen — free text, or nothing — and Explore opens
-- where it always has.
--
-- Run this once in the Supabase SQL editor, after auth.sql. It is safe to re-run.

alter table public.profiles add column if not exists location_lat double precision;
alter table public.profiles add column if not exists location_lng double precision;

-- Both or neither, and on the globe. The explicit `is not null`s matter: a CHECK
-- passes when it comes out null, so `lat between …` alone would let a latitude with
-- no longitude through.
alter table public.profiles drop constraint if exists profiles_location_point_shape;
alter table public.profiles add constraint profiles_location_point_shape
  check (
    (location_lat is null and location_lng is null)
    or (location_lat is not null and location_lng is not null
        and location_lat between -90 and 90 and location_lng between -180 and 180)
  );

-- The owner-only pattern auth.sql uses for every other column: the policies there
-- already confine reads and writes to the account's own row.
grant select (location_lat, location_lng) on public.profiles to authenticated;
grant update (location_lat, location_lng) on public.profiles to authenticated;

-- Verify:
--   select column_name from information_schema.columns
--    where table_name = 'profiles' and column_name like 'location_%';
