-- Adds voting and comments to 20260913090005_imaginations.sql.
--
-- That migration was already pushed and recorded as applied before this file's
-- source, supabase/imaginations.sql, grew a votes table and a comments table.
-- Supabase tracks migrations by version, not content, so `db push` would never see
-- an edit to the original file — the same reason 20260922110001 exists. This
-- re-issues just the part that never ran.

-- Votes: one row per (imagination, account) that voted on it, replacing the old
-- upvotes-only RPC that anybody could call any number of times, signed in or not.
create table if not exists public.imagination_votes (
  imagination_id uuid      not null references public.imaginations (id) on delete cascade,
  user_id        uuid      not null references auth.users (id) on delete cascade,
  -- 1 for up, -1 for down. No 0: a withdrawn vote is a deleted row, not a zero one,
  -- so summing this column is always the whole answer.
  value          smallint  not null check (value in (-1, 1)),
  created_at     timestamptz not null default now(),
  primary key (imagination_id, user_id)
);

alter table public.imagination_votes enable row level security;

drop policy if exists "a voter can read their own vote" on public.imagination_votes;
create policy "a voter can read their own vote"
  on public.imagination_votes
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.imagination_votes from anon, authenticated;
grant select on public.imagination_votes to authenticated;

create index if not exists imagination_votes_imagination_id_idx
  on public.imagination_votes (imagination_id);

create or replace function public.imagination_vote(p_id uuid, p_direction text)
returns table(upvotes integer, my_vote smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_value smallint;
  v_existing smallint;
begin
  if v_uid is null then
    raise exception 'Voting needs an account';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'p_direction must be ''up'' or ''down''';
  end if;

  v_value := case p_direction when 'up' then 1 else -1 end;

  select v.value into v_existing
    from public.imagination_votes v
   where v.imagination_id = p_id and v.user_id = v_uid;

  if v_existing is not distinct from v_value then
    delete from public.imagination_votes
     where imagination_id = p_id and user_id = v_uid;
  else
    insert into public.imagination_votes (imagination_id, user_id, value)
    values (p_id, v_uid, v_value)
    on conflict (imagination_id, user_id) do update set value = excluded.value;
  end if;

  update public.imaginations i
     set upvotes = coalesce(
       (select sum(v.value) from public.imagination_votes v where v.imagination_id = p_id), 0)
   where i.id = p_id;

  return query
    select i.upvotes,
           (select v.value from public.imagination_votes v
             where v.imagination_id = p_id and v.user_id = v_uid)
      from public.imaginations i
     where i.id = p_id;
end;
$$;

revoke all on function public.imagination_vote(uuid, text) from public;
grant execute on function public.imagination_vote(uuid, text) to authenticated;

drop function if exists public.imagination_upvote(uuid);

-- Comments: one row per comment, public to read, owner-only to post or remove.
create table if not exists public.imagination_comments (
  id             uuid        primary key default gen_random_uuid(),
  imagination_id uuid        not null    references public.imaginations (id) on delete cascade,
  user_id        uuid        not null    references auth.users (id) on delete cascade,
  author_name    text        not null,
  body           text        not null,
  created_at     timestamptz not null    default now()
);

alter table public.imagination_comments enable row level security;

drop policy if exists "anyone can read a comment" on public.imagination_comments;
create policy "anyone can read a comment"
  on public.imagination_comments
  for select
  to anon, authenticated
  using (true);

drop policy if exists "an owner can post a comment" on public.imagination_comments;
create policy "an owner can post a comment"
  on public.imagination_comments
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "an owner can remove their comment" on public.imagination_comments;
create policy "an owner can remove their comment"
  on public.imagination_comments
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.imagination_comments from anon, authenticated;
grant select on public.imagination_comments to anon, authenticated;
grant insert (id, imagination_id, user_id, author_name, body) on public.imagination_comments to authenticated;
grant delete on public.imagination_comments to authenticated;

alter table public.imagination_comments drop constraint if exists imagination_comments_body_size;
alter table public.imagination_comments add constraint imagination_comments_body_size
  check (length(trim(body)) between 1 and 2000);

alter table public.imagination_comments drop constraint if exists imagination_comments_author_name_size;
alter table public.imagination_comments add constraint imagination_comments_author_name_size
  check (length(trim(author_name)) between 1 and 50);

create index if not exists imagination_comments_imagination_id_idx
  on public.imagination_comments (imagination_id, created_at);

comment on table public.imagination_comments is
  'One row per comment on an imagination. Public to read, owner-only to post or remove.';
