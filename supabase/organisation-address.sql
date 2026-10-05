-- PLACER — where an organisation is, exactly.
--
-- An organisation's location has been free text ("Malmö, Sweden"), shown on its
-- public page and geocoded by Explore every time the map loads. Its setup form now
-- asks for an exact address instead, with Google Places suggestions as it is typed;
-- when one is chosen, the address and its coordinates are kept here, and the town and
-- country are worked out from it into `location`, which the public page goes on
-- showing. Explore pins the organisation on the coordinates rather than guessing from
-- the text.
--
--   organisations.address        the address as chosen, '' when none
--   organisations.location_lat   where it is, both null when no suggestion was chosen
--   organisations.location_lng
--
-- An organisation is not a person: what is kept here is public, like the rest of the
-- row (organisations.sql), and the pin on Explore is at that address.
--
-- Run this once in the Supabase SQL editor, after organisations.sql. It is safe to
-- re-run.

alter table public.organisations add column if not exists address text not null default '';
alter table public.organisations add column if not exists location_lat double precision;
alter table public.organisations add column if not exists location_lng double precision;

alter table public.organisations drop constraint if exists organisations_address_size;
alter table public.organisations add constraint organisations_address_size
  check (length(address) <= 200);

-- Both or neither, and on the globe. The explicit `is not null`s matter: a CHECK
-- passes when it comes out null, so `lat between …` alone would let a latitude with
-- no longitude through. The same shape as a profile's (profile-home.sql).
alter table public.organisations drop constraint if exists organisations_location_point_shape;
alter table public.organisations add constraint organisations_location_point_shape
  check (
    (location_lat is null and location_lng is null)
    or (location_lat is not null and location_lng is not null
        and location_lat between -90 and 90 and location_lng between -180 and 180)
  );

-- Reading is already the whole table (organisations.sql). Insert and update are
-- granted column by column, so the new columns have to be named; the policies there
-- keep writing to an organisation's admins.
grant insert (address, location_lat, location_lng) on public.organisations to authenticated;
grant update (address, location_lat, location_lng) on public.organisations to authenticated;

-- Verify:
--   select column_name from information_schema.columns
--    where table_name = 'organisations'
--      and column_name in ('address', 'location_lat', 'location_lng');
