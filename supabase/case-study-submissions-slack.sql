-- PLACER — post each new case study submission to Slack
--
-- Requires case-study-submissions.sql and survey-slack.sql's setup: the survey-to-slack
-- Edge Function deployed with its secrets, and survey_webhook_secret in Vault (see
-- supabase/README.md sections 15 and 17). Re-runnable.
--
-- Same shape as tool-submissions-slack.sql: an AFTER INSERT trigger hands the new row to
-- the function through pg_net, which sends it after the transaction commits, so a slow
-- or failing Slack never holds up or fails a submission.

create extension if not exists pg_net;

create or replace function public.case_study_submission_to_slack()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url     := 'https://kxtzxcdxjjuhtezqeacq.supabase.co/functions/v1/survey-to-slack',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets
                           where name = 'survey_webhook_secret')),
    -- Only what the message shows; user_id stays out of Slack.
    body    := jsonb_build_object('type', 'INSERT', 'schema', 'public',
                                  'table', 'case_study_submissions',
                                  'record', jsonb_build_object(
                                    'id', new.id, 'created_at', new.created_at,
                                    'company', new.company, 'industry', new.industry,
                                    'results', new.results,
                                    'contact_name', new.contact_name,
                                    'contact_email', new.contact_email,
                                    'has_logo', new.logo_path is not null,
                                    'has_image', new.image_path is not null))
  );
  return new;
end;
$$;

-- Only the trigger calls this; nobody should be able to invoke it through the API.
revoke execute on function public.case_study_submission_to_slack() from public, anon, authenticated;

drop trigger if exists case_study_submission_to_slack on public.case_study_submissions;
create trigger case_study_submission_to_slack
  after insert on public.case_study_submissions
  for each row execute function public.case_study_submission_to_slack();

-- Check it landed:
--   select tgname from pg_trigger where tgrelid = 'public.case_study_submissions'::regclass and not tgisinternal;
-- Expect case_study_submission_to_slack.
