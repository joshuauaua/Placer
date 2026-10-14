-- Generated from supabase/project-public-page.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — what a project's public page shows beyond the project itself.
--
-- The public page has a header of numbers (views, interactions, followers), tabs for
-- the project's updates and comments, and sections for its organiser and its
-- collaborators. None of that was readable before: views and the collaborator roster
-- were owner-and-collaborators only, profiles are private, and there were no updates
-- or comments to read. So:
--
--   1. project_updates: news posted by a project's organisers — its owner, and the
--      admins of the organisation it is run for — not by its collaborators.
--   2. project_comments: anybody signed in who can see the project may comment;
--      the author, the owner or a collaborator may remove one.
--   3. project_public_summary(): one call returning the page's numbers, its owner's
--      public details and its collaborators' names and photos — the parts of each
--      that are fine to publish, and nothing at all for a project the caller may
--      not see (project_can_view, project-privacy.sql).
--
-- Who wrote an update or a comment is taken from the author's profile by a trigger,
-- not from what the client sends, so nobody can post under somebody else's name.
--
-- Run this once in the Supabase SQL editor, after project-privacy.sql and
-- media-photos.sql. It is safe to re-run.


-- 1. Updates.
create table if not exists public.project_updates (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects (id) on delete cascade,
  author_id   uuid        references auth.users (id) on delete set null,
  author_name text        not null default '',
  body        text        not null,
  created_at  timestamptz not null default now()
);

alter table public.project_updates enable row level security;

alter table public.project_updates drop constraint if exists project_updates_body_size;
alter table public.project_updates add constraint project_updates_body_size
  check (length(trim(body)) between 1 and 4000);

create index if not exists project_updates_project_idx
  on public.project_updates (project_id, created_at desc);


-- 2. Comments.
create table if not exists public.project_comments (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects (id) on delete cascade,
  author_id   uuid        not null references auth.users (id) on delete cascade,
  author_name text        not null default '',
  body        text        not null,
  created_at  timestamptz not null default now()
);

alter table public.project_comments enable row level security;

alter table public.project_comments drop constraint if exists project_comments_body_size;
alter table public.project_comments add constraint project_comments_body_size
  check (length(trim(body)) between 1 and 2000);

create index if not exists project_comments_project_idx
  on public.project_comments (project_id, created_at desc);


-- The author is whoever is signed in, under their profile's name at the time.
create or replace function public.project_post_set_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_id := auth.uid();
  new.author_name := coalesce(
    (select p.display_name from public.profiles p where p.id = auth.uid()), '');
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.project_post_set_author() from public;

drop trigger if exists project_updates_set_author on public.project_updates;
create trigger project_updates_set_author
  before insert on public.project_updates
  for each row execute function public.project_post_set_author();

drop trigger if exists project_comments_set_author on public.project_comments;
create trigger project_comments_set_author
  before insert on public.project_comments
  for each row execute function public.project_post_set_author();


-- Who organises a project, and so may post and remove its updates: its owner, and the
-- admins of the organisation it is run for. Collaborators help run its tools, but its
-- news is the organisers' to give.
create or replace function public.project_is_organiser(p_project_id uuid)
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
            or (p.organisation_id is not null
                and public.organisation_is_admin(p.organisation_id, auth.uid())))
  );
$$;

revoke all on function public.project_is_organiser(uuid) from public;
grant execute on function public.project_is_organiser(uuid) to anon, authenticated;


-- Who may do what. Reading follows the project: anybody for a public one, its people
-- for a private one. No update policy on either: a post is written once.
drop policy if exists "anyone who can see the project can read its updates" on public.project_updates;
create policy "anyone who can see the project can read its updates"
  on public.project_updates for select to anon, authenticated
  using (public.project_can_view(project_id));

drop policy if exists "the project's people can post an update" on public.project_updates;
drop policy if exists "the project's organisers can post an update" on public.project_updates;
create policy "the project's organisers can post an update"
  on public.project_updates for insert to authenticated
  with check (public.project_is_organiser(project_id));

drop policy if exists "the project's people can remove an update" on public.project_updates;
drop policy if exists "the project's organisers can remove an update" on public.project_updates;
create policy "the project's organisers can remove an update"
  on public.project_updates for delete to authenticated
  using (public.project_is_organiser(project_id));

drop policy if exists "anyone who can see the project can read its comments" on public.project_comments;
create policy "anyone who can see the project can read its comments"
  on public.project_comments for select to anon, authenticated
  using (public.project_can_view(project_id));

drop policy if exists "anyone who can see the project can comment" on public.project_comments;
create policy "anyone who can see the project can comment"
  on public.project_comments for insert to authenticated
  with check (public.project_can_view(project_id));

drop policy if exists "the author or the project's people can remove a comment" on public.project_comments;
create policy "the author or the project's people can remove a comment"
  on public.project_comments for delete to authenticated
  using (author_id = auth.uid() or public.project_can_edit(project_id));

revoke all on public.project_updates from anon, authenticated;
revoke all on public.project_comments from anon, authenticated;
grant select on public.project_updates to anon, authenticated;
grant select on public.project_comments to anon, authenticated;
grant insert (project_id, body) on public.project_updates to authenticated;
grant insert (project_id, body) on public.project_comments to authenticated;
grant delete on public.project_updates to authenticated;
grant delete on public.project_comments to authenticated;


-- 3. The page's numbers, its owner and its collaborators, in one call.
--
-- Null for a project the caller may not see. Interactions are everything people have
-- put into the project: contributions to its Toolkit rooms, imaginations and comments.
-- The owner's details are what profile_public() already publishes, plus the day the
-- account was made and how many public projects it runs; collaborators are name and
-- photo only — never the email they were invited by. `can_post_update` is whether the
-- caller organises the project, so the page knows whether to offer to post one.
create or replace function public.project_public_summary(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.project_can_view(p_project_id) then
    return null;
  end if;

  select p.owner_id into v_owner from public.projects p where p.id = p_project_id;

  return jsonb_build_object(
    'views', (select coalesce(sum(d.views), 0)::int
                from public.project_view_days d where d.project_id = p_project_id),
    'followers', (select count(*)::int from public.follows f
                   where f.followed_type = 'project' and f.followed_id = p_project_id::text),
    'interactions',
      (select count(*)::int from public.toolkit_contributions c
         join public.toolkit_rooms r on r.id = c.room_id
        where r.project_id = p_project_id)
      + (select count(*)::int from public.imaginations i where i.project_id = p_project_id)
      + (select count(*)::int from public.project_comments m where m.project_id = p_project_id),
    'owner', (
      select jsonb_build_object(
        'id', pr.id,
        'name', pr.display_name,
        'bio', pr.bio,
        'location', pr.location,
        'avatar_path', pr.avatar_path,
        'joined_at', pr.created_at,
        'projects', (select count(*)::int from public.projects o
                      where o.owner_id = pr.id and o.visibility = 'public'))
        from public.profiles pr where pr.id = v_owner),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.user_id,
               'name', coalesce(pr.display_name, c.display_name, 'Collaborator'),
               'avatar_path', pr.avatar_path)
             order by c.created_at)
        from public.project_collaborators c
        left join public.profiles pr on pr.id = c.user_id
       where c.project_id = p_project_id), '[]'::jsonb),
    'can_post_update', public.project_is_organiser(p_project_id)
  );
end;
$$;

revoke all on function public.project_public_summary(uuid) from public;
grant execute on function public.project_public_summary(uuid) to anon, authenticated;


-- Verify:
--   select public.project_public_summary((select id from public.projects limit 1));
--   select policyname, cmd, roles from pg_policies
--    where tablename in ('project_updates', 'project_comments');
