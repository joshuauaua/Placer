-- PLACER — replies to a project's updates and comments.
--
-- Anybody signed in who can see a project may reply to one of its updates or one of
-- its comments, and the replies are shown under it, oldest first. One level only: a
-- reply is to a post, not to another reply.
--
-- A reply names its post by `update_id` or `comment_id`, exactly one of the two, and
-- goes when the post does. `project_id` is not sent: it is taken from the post, so a
-- reply can never be filed under a project other than its post's, and reading follows
-- the project as for its posts (project_can_view, project-privacy.sql).
--
-- Who wrote it is set as for posts, by project_post_set_author
-- (project-posts-as-organisation.sql): the signed-in account, or, for one of the
-- project's organisers who chooses to, its organisation. A reply can be removed by its
-- author, by the project's owner or a collaborator, or by one of its organisers.
--
-- Run after project-public-page.sql and project-posts-as-organisation.sql. Safe to
-- re-run.

create table if not exists public.project_replies (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references public.projects (id) on delete cascade,
  update_id       uuid        references public.project_updates (id) on delete cascade,
  comment_id      uuid        references public.project_comments (id) on delete cascade,
  author_id       uuid        not null references auth.users (id) on delete cascade,
  author_name     text        not null default '',
  organisation_id uuid        references public.organisations (id) on delete set null,
  body            text        not null,
  created_at      timestamptz not null default now()
);

alter table public.project_replies enable row level security;

alter table public.project_replies drop constraint if exists project_replies_one_post;
alter table public.project_replies add constraint project_replies_one_post
  check (num_nonnulls(update_id, comment_id) = 1);

alter table public.project_replies drop constraint if exists project_replies_body_size;
alter table public.project_replies add constraint project_replies_body_size
  check (length(trim(body)) between 1 and 2000);

create index if not exists project_replies_project_idx
  on public.project_replies (project_id, created_at);
create index if not exists project_replies_update_idx
  on public.project_replies (update_id) where update_id is not null;
create index if not exists project_replies_comment_idx
  on public.project_replies (comment_id) where comment_id is not null;


-- The project is the post's. Fires before project_replies_set_author (triggers on one
-- event run in name order), which needs it to check posting as an organisation.
create or replace function public.project_reply_set_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.project_id := coalesce(
    (select u.project_id from public.project_updates u where u.id = new.update_id),
    (select c.project_id from public.project_comments c where c.id = new.comment_id));
  if new.project_id is null then
    raise exception 'there is no such update or comment to reply to';
  end if;
  return new;
end;
$$;

revoke all on function public.project_reply_set_project() from public;

drop trigger if exists project_replies_set_project on public.project_replies;
create trigger project_replies_set_project
  before insert on public.project_replies
  for each row execute function public.project_reply_set_project();

drop trigger if exists project_replies_set_author on public.project_replies;
create trigger project_replies_set_author
  before insert on public.project_replies
  for each row execute function public.project_post_set_author();


-- Who may do what. No update policy: a reply is written once.
drop policy if exists "anyone who can see the project can read its replies" on public.project_replies;
create policy "anyone who can see the project can read its replies"
  on public.project_replies for select to anon, authenticated
  using (public.project_can_view(project_id));

drop policy if exists "anyone who can see the project can reply" on public.project_replies;
create policy "anyone who can see the project can reply"
  on public.project_replies for insert to authenticated
  with check (public.project_can_view(project_id));

drop policy if exists "the author or the project's people can remove a reply" on public.project_replies;
create policy "the author or the project's people can remove a reply"
  on public.project_replies for delete to authenticated
  using (author_id = auth.uid() or public.project_can_edit(project_id)
         or public.project_is_organiser(project_id));

revoke all on public.project_replies from anon, authenticated;
grant select on public.project_replies to anon, authenticated;
grant insert (update_id, comment_id, body, organisation_id) on public.project_replies to authenticated;
grant delete on public.project_replies to authenticated;


-- Verify:
--   select count(*) filter (where update_id is not null) as to_updates,
--          count(*) filter (where comment_id is not null) as to_comments
--     from public.project_replies;
