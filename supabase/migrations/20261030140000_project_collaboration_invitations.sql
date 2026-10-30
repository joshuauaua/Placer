-- Generated from supabase/project-collaboration-invitations.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- PLACER — explicit consent for account-to-account project collaboration.
--
-- An invitation is not a membership. Only accepting one writes the existing
-- project_collaborators row that the rest of the project permissions rely on.

create table if not exists public.project_collaboration_invitations (
  project_id   uuid        not null references public.projects (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  email        text        not null,
  display_name text,
  invited_by   uuid        references auth.users (id) on delete set null,
  status       text        not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (project_id, user_id)
);

alter table public.project_collaboration_invitations enable row level security;

drop policy if exists "invitees and project owners can read collaboration invitations"
  on public.project_collaboration_invitations;
create policy "invitees and project owners can read collaboration invitations"
  on public.project_collaboration_invitations
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

revoke all on public.project_collaboration_invitations from anon, authenticated;
grant select on public.project_collaboration_invitations to authenticated;

comment on table public.project_collaboration_invitations is
  'Account-to-account project invitations; only accepted invitations grant collaborator access.';

create or replace function public.project_add_collaborator(p_project_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target uuid;
  v_target_name text;
  v_email text := lower(trim(p_email));
begin
  if v_caller is null then
    raise exception 'adding a collaborator needs an account';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id and owner_id = v_caller) then
    raise exception 'only a project''s owner may add a collaborator';
  end if;

  select id into v_target from auth.users where lower(email) = v_email;
  if v_target is null then
    raise exception 'no PLACER account is registered to that email address';
  end if;

  if v_target = v_caller then
    raise exception 'the owner is already on the project';
  end if;

  if exists (
    select 1 from public.project_collaborators
    where project_id = p_project_id and user_id = v_target
  ) then
    return true;
  end if;

  select display_name into v_target_name from public.profiles where id = v_target;

  insert into public.project_collaboration_invitations
    (project_id, user_id, email, display_name, invited_by, status, created_at, responded_at)
  values
    (p_project_id, v_target, v_email, v_target_name, v_caller, 'pending', now(), null)
  on conflict (project_id, user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        invited_by = excluded.invited_by,
        status = 'pending',
        created_at = now(),
        responded_at = null;

  return true;
end;
$$;

revoke all on function public.project_add_collaborator(uuid, text) from public;
grant execute on function public.project_add_collaborator(uuid, text) to authenticated;

create or replace function public.project_collaboration_invitations()
returns table (project_id uuid, project_name text, inviter_name text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select i.project_id, p.name,
         coalesce(pr.display_name, 'A project owner'),
         i.created_at
    from public.project_collaboration_invitations i
    join public.projects p on p.id = i.project_id
    left join public.profiles pr on pr.id = i.invited_by
   where i.user_id = auth.uid() and i.status = 'pending'
   order by i.created_at desc;
$$;

revoke all on function public.project_collaboration_invitations() from public;
grant execute on function public.project_collaboration_invitations() to authenticated;

create or replace function public.project_respond_to_collaboration_invitation(
  p_project_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.project_collaboration_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'responding to a collaboration invitation needs an account';
  end if;

  if p_accept is null then
    raise exception 'a collaboration invitation must be accepted or declined';
  end if;

  select * into v_invitation
    from public.project_collaboration_invitations
   where project_id = p_project_id
     and user_id = auth.uid()
     and status = 'pending'
   for update;

  if not found then
    raise exception 'no pending invitation exists for this project';
  end if;

  if p_accept then
    insert into public.project_collaborators (project_id, user_id, email, display_name)
    values (v_invitation.project_id, v_invitation.user_id, v_invitation.email, v_invitation.display_name)
    on conflict (project_id, user_id) do nothing;
  end if;

  update public.project_collaboration_invitations
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where project_id = p_project_id and user_id = auth.uid();

  return true;
end;
$$;

revoke all on function public.project_respond_to_collaboration_invitation(uuid, boolean) from public;
grant execute on function public.project_respond_to_collaboration_invitation(uuid, boolean) to authenticated;

create or replace function public.project_remove_collaborator(p_project_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'removing a collaborator needs an account';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id and owner_id = auth.uid()) then
    raise exception 'only a project''s owner may remove a collaborator';
  end if;

  delete from public.project_collaborators
   where project_id = p_project_id and user_id = p_user_id;

  delete from public.project_collaboration_invitations
   where project_id = p_project_id and user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.project_remove_collaborator(uuid, uuid) from public;
grant execute on function public.project_remove_collaborator(uuid, uuid) to authenticated;
