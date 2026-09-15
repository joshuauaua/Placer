-- PLACER — posted imaginations.
--
-- The shape: one row per imagination somebody has posted, owned by the account that
-- posted it. Everything about it that is worth reading is public — this is a community
-- map, and an imagination nobody else can see is not posted, it is saved. Only the
-- account that made it can change or remove it.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- after auth.sql. It is written to be safe to re-run.
--
-- The composited image does not live here. A preview is a few hundred KB of JPEG and
-- putting that in a column would mean every read of the map dragging every picture
-- with it, so previews go to a Storage bucket and the row keeps the path. Section 4
-- sets that up.
--
-- The author's name is copied onto the row rather than joined from public.profiles,
-- and that is deliberate twice over. Settings already promises that renaming yourself
-- "does not rename what you have already posted", so the name belongs to the posting
-- rather than to the person. And it is what lets profiles stay unreadable by anyone
-- but their owner: nothing here needs to look a stranger up.
--
-- Two warnings the editor will raise, both expected. It says a table is created
-- "without enabling Row Level Security" — that check cannot see the alter table below
-- it. And it flags the drops as "destructive operations": they remove policies and
-- constraints so the file can be re-run, never any data.

create extension if not exists pgcrypto;


-- 1. The imagination.
create table if not exists public.imaginations (
  id            uuid             primary key default gen_random_uuid(),
  user_id       uuid             not null    references auth.users (id) on delete cascade,
  -- The display name as it stood when this was posted. See the header.
  author_name   text             not null,
  title         text             not null,
  -- One of the six categories in src/theme.js. Null is allowed: an imagination with no
  -- category still belongs on the map, it just draws with the fallback pin colour.
  category      text,
  blurb         text             not null    default '',
  -- The human-readable location string the app shows. Coordinates are the two columns
  -- below; this is what somebody reads.
  loc           text,
  lat           double precision,
  lng           double precision,
  -- 'streetview' or 'staticmap', so it is possible to tell a photographed spot from a
  -- top-down one after the fact.
  source        text,
  -- Where the camera was pointing, so the imagination can be reopened on the canvas.
  pov           jsonb,
  fov           double precision,
  canvas_assets jsonb            not null    default '[]'::jsonb,
  -- Path within the imagination-previews bucket, '<user_id>/<id>.jpg' or '.png'. Null
  -- means the upload failed or was never attempted; the imagination is still readable,
  -- it simply has no picture.
  preview_path  text,
  upvotes       integer          not null    default 0,
  created_at    timestamptz      not null    default now(),
  updated_at    timestamptz      not null    default now()
);

-- Row-level security is what protects this table. The browser ships the anon key, so
-- the key itself is not a secret; the policies below are the boundary.
-- Enabled immediately after the table so no window exists without it.
alter table public.imaginations enable row level security;


-- 2. Who may do what.
--
-- Reading is open to everybody, signed in or not. That is the point of the feature and
-- it is what the Post button has always said it does.
drop policy if exists "anyone can read an imagination" on public.imaginations;
create policy "anyone can read an imagination"
  on public.imaginations
  for select
  to anon, authenticated
  using (true);

-- Writing is the owner's alone. user_id = auth.uid() in the check is what stops an
-- account posting something in somebody else's name — the column is supplied by the
-- client, so without this it would be a free-text claim.
drop policy if exists "an owner can post an imagination" on public.imaginations;
create policy "an owner can post an imagination"
  on public.imaginations
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "an owner can change their imagination" on public.imaginations;
create policy "an owner can change their imagination"
  on public.imaginations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "an owner can remove their imagination" on public.imaginations;
create policy "an owner can remove their imagination"
  on public.imaginations
  for delete
  to authenticated
  using (user_id = auth.uid());

-- No policy for anon beyond the read, on purpose: a signed-out visitor can look at the
-- map and nothing else.

-- Grants. Every column is readable, because every column is public — there is nothing
-- here to withhold from somebody who can already see the imagination. Writing is
-- narrower: the timestamps and the upvote count are not the client's to set, and a
-- forged created_at would quietly corrupt the order of the map.
--
-- id IS granted on insert, unusually. The preview is uploaded to a path derived from
-- the imagination's id, which means the id has to be known before the row exists. So
-- the client chooses it and gen_random_uuid() stays as the default for anything
-- inserted from this side. Choosing an id that is already taken is a primary key
-- violation, and choosing a guessable one buys nothing the read policy has not already
-- given away.
revoke all on public.imaginations from anon, authenticated;
grant select on public.imaginations to anon, authenticated;
grant insert (id, user_id, author_name, title, category, blurb, loc, lat, lng,
              source, pov, fov, canvas_assets, preview_path)
  on public.imaginations to authenticated;
grant update (title, category, blurb, canvas_assets, preview_path)
  on public.imaginations to authenticated;
grant delete on public.imaginations to authenticated;


-- 3. What a row may contain.
--
-- The publishable key is in every visitor's bundle, so anyone with an account can POST
-- here directly. These bound what any single insert can do.
alter table public.imaginations drop constraint if exists imaginations_title_size;
alter table public.imaginations add constraint imaginations_title_size
  check (length(trim(title)) between 1 and 120);

alter table public.imaginations drop constraint if exists imaginations_author_name_size;
alter table public.imaginations add constraint imaginations_author_name_size
  check (length(trim(author_name)) between 1 and 50);

alter table public.imaginations drop constraint if exists imaginations_blurb_size;
alter table public.imaginations add constraint imaginations_blurb_size
  check (length(blurb) <= 2000);

-- The six in src/theme.js. Constrained rather than left open so a typo shows up as a
-- refused insert instead of a pin that silently draws in the fallback colour. Adding a
-- category means editing this and re-running the file.
alter table public.imaginations drop constraint if exists imaginations_category_known;
alter table public.imaginations add constraint imaginations_category_known
  check (category is null or category in
    ('green', 'seating', 'art', 'play', 'safety', 'food'));

alter table public.imaginations drop constraint if exists imaginations_coords_shape;
alter table public.imaginations add constraint imaginations_coords_shape
  check (
    (lat is null and lng is null)
    or (lat between -90 and 90 and lng between -180 and 180)
  );

alter table public.imaginations drop constraint if exists imaginations_source_known;
alter table public.imaginations add constraint imaginations_source_known
  check (source is null or source in ('streetview', 'staticmap'));

-- The drawing itself. Generous, because a busy canvas is a good thing, but not
-- unbounded — these are the two columns a client could put anything in.
alter table public.imaginations drop constraint if exists imaginations_canvas_assets_size;
alter table public.imaginations add constraint imaginations_canvas_assets_size
  check (length(canvas_assets::text) <= 200000);

alter table public.imaginations drop constraint if exists imaginations_preview_path_size;
alter table public.imaginations add constraint imaginations_preview_path_size
  check (preview_path is null or length(preview_path) <= 300);

comment on table public.imaginations is
  'One row per posted imagination. Public to read, owner-only to write.';

create index if not exists imaginations_created_at_idx
  on public.imaginations (created_at desc);

create index if not exists imaginations_user_id_idx
  on public.imaginations (user_id);


-- 4. Where the pictures go.
--
-- Equivalent to pressing "New bucket" in Dashboard -> Storage, done here so the whole
-- setup is one paste. Public, because the previews are shown on a map anybody can look
-- at; a signed URL per pin would be a request per pin for no benefit.
insert into storage.buckets (id, name, public)
values ('imagination-previews', 'imagination-previews', true)
on conflict (id) do nothing;

-- A public bucket serves reads without consulting these policies at all, so the select
-- policy below is belt and braces — it is what keeps reads working if the bucket is
-- ever flipped to private, and it documents the intent either way.
drop policy if exists "anyone can read an imagination preview" on storage.objects;
create policy "anyone can read an imagination preview"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'imagination-previews');

-- Writes are confined to a folder named after the account doing the writing, which is
-- what stops one account overwriting another's picture. The client builds the path as
-- '<user_id>/<imagination_id>.jpg'; this is what makes the first segment true rather
-- than merely conventional.
drop policy if exists "an owner can upload their own preview" on storage.objects;
create policy "an owner can upload their own preview"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'imagination-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "an owner can replace their own preview" on storage.objects;
create policy "an owner can replace their own preview"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'imagination-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "an owner can remove their own preview" on storage.objects;
create policy "an owner can remove their own preview"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'imagination-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- 5. Voting.
--
-- Not an update policy, because the whole point is voting on somebody else's
-- imagination and the update policy above is owner-only. A security definer function
-- can raise the count without handing out write access to the row.
--
-- IT DOES NOT STOP REPEAT VOTING. There is no record of who voted, so pressing the
-- button twice counts twice, and the anon key is in every bundle. That is an accepted
-- limitation of this stage, not an oversight: doing it properly needs a votes table
-- with one row per account per imagination, which also means signed-out visitors stop
-- being able to vote at all. Until then, treat the count as a rough signal of
-- interest rather than a tally of people.
create or replace function public.imagination_upvote(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upvotes integer;
begin
  update public.imaginations
     set upvotes = upvotes + 1
   where id = p_id
  returning upvotes into v_upvotes;

  -- Null for an imagination that is not there, rather than raising: it has most likely
  -- just been deleted by its owner, and that is not an error worth showing anybody.
  return v_upvotes;
end;
$$;

revoke all on function public.imagination_upvote(uuid) from public;
grant execute on function public.imagination_upvote(uuid) to anon, authenticated;


-- 6. Keeping updated_at honest.
--
-- The client has no grant on updated_at, so this is the only thing that moves it.
create or replace function public.imagination_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.imagination_touch_updated_at() from public;

drop trigger if exists imagination_on_update on public.imaginations;
create trigger imagination_on_update
  before update on public.imaginations
  for each row execute function public.imagination_touch_updated_at();


-- Verify, after running the above:
--
--   -- RLS on, one public select and three owner-scoped write policies:
--   select relname, relrowsecurity from pg_class where relname = 'imaginations';
--   select policyname, cmd, roles from pg_policies where tablename = 'imaginations';
--
--   -- The bucket exists and is public:
--   select id, public from storage.buckets where id = 'imagination-previews';
--
--   -- The four storage policies:
--   select policyname, cmd from pg_policies
--    where tablename = 'objects' and policyname like '%imagination preview%';
--
-- Then, that reading really is public — with nothing but the anon key this returns the
-- rows rather than an empty array, which is the opposite of what profiles does:
--
--   curl -s "https://<project-ref>.supabase.co/rest/v1/imaginations?select=title,author_name" \
--     -H "apikey: <anon key>"
--
-- And that writing is not. This should be refused, because there is no session and so
-- no auth.uid() for the check to match:
--
--   curl -s -X POST "https://<project-ref>.supabase.co/rest/v1/imaginations" \
--     -H "apikey: <anon key>" -H "Content-Type: application/json" \
--     -d '{"user_id":"00000000-0000-0000-0000-000000000000","author_name":"x","title":"x"}'
