-- Fixes "infinite recursion detected in policy for relation project_collaborators"
-- from 20260922100001_projects.sql.
--
-- That migration's read policy on project_collaborators checked a caller's own
-- membership with an exists-subquery against project_collaborators itself.
-- Evaluating the policy re-triggers the same policy on the subquery, and so on —
-- Postgres reports that as infinite recursion. Routing the check through a
-- security definer function reads the table with RLS bypassed, breaking the loop.

create or replace function public.project_collaborator_exists(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_collaborators
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

revoke all on function public.project_collaborator_exists(uuid, uuid) from public;
grant execute on function public.project_collaborator_exists(uuid, uuid) to authenticated;

drop policy if exists "the owner or a collaborator can read the roster" on public.project_collaborators;
create policy "the owner or a collaborator can read the roster"
  on public.project_collaborators
  for select
  to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or public.project_collaborator_exists(project_id, auth.uid())
  );
