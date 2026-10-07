-- PLACER — whether a project has a budget, and how much.
--
-- Starting a project now asks "Do you have a budget for this project?", and for the
-- amount when the answer is yes. Unlike the rest of a project this is not public: the
-- projects table is readable by anyone (projects.sql), and a budget is the organisers'
-- business until they choose to say it. So it lives in a table of its own that only
-- the project's owner and collaborators can read or write — the people
-- project_can_edit (media-photos.sql) recognises.
--
--   has_budget   the answer: true or false. No row at all means it was not answered.
--   amount       how much, when there is one and they said; null otherwise
--   currency     an ISO 4217 code for the amount, from the few the form offers
--
-- Run this once in the Supabase SQL editor after projects.sql and media-photos.sql. It
-- is written to be safe to re-run.

create table if not exists public.project_budgets (
  project_id uuid        primary key references public.projects (id) on delete cascade,
  has_budget boolean     not null,
  amount     numeric(14, 2),
  currency   text        not null default 'EUR',
  updated_at timestamptz not null default now()
);

alter table public.project_budgets drop constraint if exists project_budgets_amount_shape;
alter table public.project_budgets add constraint project_budgets_amount_shape
  check (amount is null or (has_budget and amount >= 0));

alter table public.project_budgets drop constraint if exists project_budgets_currency_known;
alter table public.project_budgets add constraint project_budgets_currency_known
  check (currency in ('EUR', 'SEK', 'DKK', 'NOK', 'GBP', 'USD'));

alter table public.project_budgets enable row level security;

drop policy if exists "an owner or collaborator can read the budget" on public.project_budgets;
create policy "an owner or collaborator can read the budget"
  on public.project_budgets for select to authenticated
  using (public.project_can_edit(project_id));

drop policy if exists "an owner or collaborator can set the budget" on public.project_budgets;
create policy "an owner or collaborator can set the budget"
  on public.project_budgets for insert to authenticated
  with check (public.project_can_edit(project_id));

drop policy if exists "an owner or collaborator can change the budget" on public.project_budgets;
create policy "an owner or collaborator can change the budget"
  on public.project_budgets for update to authenticated
  using (public.project_can_edit(project_id))
  with check (public.project_can_edit(project_id));

-- Nothing for anon at all: a visitor has no business with a project's budget.
revoke all on public.project_budgets from anon, authenticated;
grant select on public.project_budgets to authenticated;
-- project_id is in the update grant for the same reason project_notification_settings'
-- is: saving is an upsert, ON CONFLICT DO UPDATE sets every column it is given, and
-- without it every save is refused. The update policy is what stops it being changed
-- to a project the caller cannot edit.
grant insert (project_id, has_budget, amount, currency, updated_at) on public.project_budgets to authenticated;
grant update (project_id, has_budget, amount, currency, updated_at) on public.project_budgets to authenticated;

comment on table public.project_budgets is
  'Whether a project has a budget, and how much. Private to its owner and collaborators.';


-- Verify, after running the above:
--
--   select policyname, cmd, roles from pg_policies where tablename = 'project_budgets';
--   -- three policies, all for {authenticated}
