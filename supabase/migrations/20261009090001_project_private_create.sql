-- Fixes "new row violates row-level security policy for table projects" on starting
-- a private project, from 20261006110001_project_privacy.sql.
--
-- createProject inserts and reads the new row back in one statement (insert ...
-- returning), so the row has to pass the select policy as well as the insert one.
-- That policy let a private project through only by project_can_view(id), which looks
-- the project up again — and within the inserting statement the lookup cannot see
-- the row yet, so it said no and the insert was refused. A public project never
-- reached the function, which is why only private ones failed.
--
-- supabase/project-privacy.sql now checks the owner on the row itself too; this
-- re-issues just that policy. Collaborators and approved requests still go through
-- project_can_view, which sees the project once it exists.

drop policy if exists "anyone can read a public project, and its people a private one" on public.projects;
create policy "anyone can read a public project, and its people a private one"
  on public.projects for select to anon, authenticated
  using (visibility = 'public' or owner_id = auth.uid() or public.project_can_view(id));
