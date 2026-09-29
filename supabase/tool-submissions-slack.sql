-- PLACER — post each new tool submission to Slack
--
-- Requires tool-submissions.sql and survey-slack.sql's setup: the survey-to-slack Edge
-- Function deployed with its secrets, and survey_webhook_secret in Vault (see
-- supabase/README.md sections 15 and 17). Re-runnable.
--
-- Same shape as bug-reports-slack.sql: an AFTER INSERT trigger hands the new row to the
-- function through pg_net, which sends it after the transaction commits, so a slow or
-- failing Slack never holds up or fails a submission.

create extension if not exists pg_net;

create or replace function public.tool_submission_to_slack()
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
                                  'table', 'tool_submissions',
                                  'record', jsonb_build_object(
                                    'id', new.id, 'created_at', new.created_at,
                                    'title', new.title, 'description', new.description,
                                    'email', new.email))
  );
  return new;
end;
$$;

-- Only the trigger calls this; nobody should be able to invoke it through the API.
revoke execute on function public.tool_submission_to_slack() from public, anon, authenticated;

drop trigger if exists tool_submission_to_slack on public.tool_submissions;
create trigger tool_submission_to_slack
  after insert on public.tool_submissions
  for each row execute function public.tool_submission_to_slack();

-- Check it landed:
--   select tgname from pg_trigger where tgrelid = 'public.tool_submissions'::regclass and not tgisinternal;
-- Expect tool_submission_to_slack.
