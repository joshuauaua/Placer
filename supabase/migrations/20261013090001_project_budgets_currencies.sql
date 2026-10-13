-- Gives a project's budget the same currencies as Co-Budget: adds the Swiss franc,
-- the Polish złoty and the Turkish lira (src/lib/currency.js's CURRENCIES).
--
-- supabase/project-budget.sql has the new list, and 20261006090001_project_budgets
-- is regenerated from it, but that one is already applied and never replays; this
-- re-issues just project_budgets_currency_known from it.

alter table public.project_budgets drop constraint if exists project_budgets_currency_known;
alter table public.project_budgets add constraint project_budgets_currency_known
  check (currency in ('EUR', 'SEK', 'NOK', 'DKK', 'GBP', 'USD', 'CHF', 'PLN', 'TRY'));
