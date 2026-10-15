-- PLACER — inquiries kept on somebody's profile.
--
-- A tool used on its own (Desire Lines, say) starts as a question about a place: which
-- site, why it matters, what has been drawn on it so far. Somebody signed in can keep
-- that as an inquiry on their profile, and later start a project's tool from it or fold
-- it into one. An inquiry is the tool's id, a title, the note on why they are interested,
-- and `config`, which is whatever the tool needs to pick it up again — for Desire Lines
-- the site and its marks, and the walks drawn so far.
--
-- Private to the account: only the owner can read, change or delete them.
--
-- Run this once in the Supabase SQL editor, after auth.sql. It is safe to re-run.

create table if not exists public.profile_inquiries (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  tool        text        not null check (char_length(tool) between 1 and 64),
  title       text        not null check (char_length(title) between 1 and 120),
  note        text        not null default '' check (char_length(note) <= 1000),
  config      jsonb       not null default '{}'::jsonb check (pg_column_size(config) <= 1000000),
  created_at  timestamptz not null default now()
);

create index if not exists profile_inquiries_owner_idx on public.profile_inquiries (owner_id, created_at desc);

alter table public.profile_inquiries enable row level security;

drop policy if exists profile_inquiries_select_own on public.profile_inquiries;
create policy profile_inquiries_select_own on public.profile_inquiries
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists profile_inquiries_insert_own on public.profile_inquiries;
create policy profile_inquiries_insert_own on public.profile_inquiries
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists profile_inquiries_delete_own on public.profile_inquiries;
create policy profile_inquiries_delete_own on public.profile_inquiries
  for delete to authenticated using (owner_id = auth.uid());

grant select, delete on public.profile_inquiries to authenticated;
grant insert (owner_id, tool, title, note, config) on public.profile_inquiries to authenticated;

-- Verify:
--   select owner_id, tool, title from public.profile_inquiries limit 5;
