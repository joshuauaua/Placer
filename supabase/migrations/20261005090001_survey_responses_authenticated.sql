-- Backfill for 20260913090001_survey_responses.sql: let signed-in people submit a
-- survey response too.
--
-- schema.sql now gives `authenticated` the same insert policy and column grant as
-- `anon`, but 20260913090001 has long been pushed and recorded as applied, so
-- `db push` would never see the edit. This re-issues just that part.
--
-- 20260913090001 gave the insert to `anon` alone, which was all the landingpage
-- branch needed: nobody signs in there. On Development they do, and a signed-in
-- browser talks to PostgREST as `authenticated`, so its inserts were refused by
-- row-level security. That never showed while the client only ever wrote survey
-- answers to localStorage; services/api.js now sends them here, from /survey, the
-- landing page's Join the Waitlist dialog and the User Labs application, all of
-- which a signed-in person can reach.
--
-- The same one thing the anon role may do, and the same columns: the id and the
-- timestamp stay the table's own. No select, update or delete, as for anon.

drop policy if exists "signed-in people can submit a survey response" on public.survey_responses;
create policy "signed-in people can submit a survey response"
  on public.survey_responses
  for insert
  to authenticated
  with check (true);

revoke insert on public.survey_responses from authenticated;
grant insert (source, email, answers, other_text) on public.survey_responses to authenticated;

-- Check it landed the way you expect:
--   select policyname, cmd, roles from pg_policies where tablename = 'survey_responses';
-- Expect two INSERT policies, one for {anon} and one for {authenticated}.
