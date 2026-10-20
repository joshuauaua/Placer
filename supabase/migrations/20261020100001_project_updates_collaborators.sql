-- PLACER — catch-up for 20261014120001_project_public_page.sql and
-- 20261014130001_project_updates_organisers.sql.
--
-- Those let only a project's organisers — its owner, and the admins of the
-- organisation it is run for — post and remove its updates. supabase/project-public-page.sql
-- now lets its collaborators do so too, the same as they edit the rest of it, while
-- posting one under the organisation's name stays the organisers' alone
-- (project-posts-as-organisation.sql, unchanged). `db push` never replays an applied
-- migration, so this re-issues just what changed: the two update policies, and
-- project_public_summary(), which now also says whether the caller may post as the
-- organisation. Re-runnable.

drop policy if exists "the project's organisers can post an update" on public.project_updates;
drop policy if exists "the project's organisers and collaborators can post an update" on public.project_updates;
create policy "the project's organisers and collaborators can post an update"
  on public.project_updates for insert to authenticated
  with check (public.project_can_edit(project_id) or public.project_is_organiser(project_id));

drop policy if exists "the project's organisers can remove an update" on public.project_updates;
drop policy if exists "the project's organisers and collaborators can remove an update" on public.project_updates;
create policy "the project's organisers and collaborators can remove an update"
  on public.project_updates for delete to authenticated
  using (public.project_can_edit(project_id) or public.project_is_organiser(project_id));


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
    'can_post_update', public.project_can_edit(p_project_id) or public.project_is_organiser(p_project_id),
    'can_post_as_organisation', public.project_is_organiser(p_project_id)
  );
end;
$$;

revoke all on function public.project_public_summary(uuid) from public;
grant execute on function public.project_public_summary(uuid) to anon, authenticated;
