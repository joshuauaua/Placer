-- Fixes "permission denied for table project_budgets" on saving a project's budget,
-- from 20261006090001_project_budgets.sql.
--
-- saveProjectBudget is an upsert, and PostgREST's ON CONFLICT DO UPDATE sets every
-- column in the row, project_id included. That migration granted update on every
-- column but project_id, so every save was refused, first one or not.
-- supabase/project-budget.sql now grants it; this re-issues just that grant. The
-- update policy (project_can_edit on both sides) still stops it pointing anywhere
-- the caller cannot edit.

grant update (project_id) on public.project_budgets to authenticated;
