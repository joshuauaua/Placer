-- PLACER — post each new survey response to Slack
--
-- Requires schema.sql, and the survey-to-slack Edge Function deployed with its two
-- secrets (see supabase/README.md section 15). Re-runnable.
--
-- An AFTER INSERT trigger hands the new row to the function through pg_net. pg_net
-- queues the request and sends it after the transaction commits, so a slow or failing
-- Slack never holds up or fails a survey submission.
--
-- The shared secret is not in this file. Store it in Vault once, with the same value
-- as the function's SURVEY_WEBHOOK_SECRET:
--
--   select vault.create_secret('<the secret>', 'survey_webhook_secret');
--
-- To change it later:
--
--   select vault.update_secret(id, '<new secret>')
--     from vault.secrets where name = 'survey_webhook_secret';

create extension if not exists pg_net;

create or replace function public.survey_response_to_slack()
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
    body    := jsonb_build_object('type', 'INSERT', 'schema', 'public',
                                  'table', 'survey_responses', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

-- Only the trigger calls this; nobody should be able to invoke it through the API.
revoke execute on function public.survey_response_to_slack() from public, anon, authenticated;

drop trigger if exists survey_response_to_slack on public.survey_responses;
create trigger survey_response_to_slack
  after insert on public.survey_responses
  for each row execute function public.survey_response_to_slack();

-- Check it landed:
--   select tgname from pg_trigger where tgrelid = 'public.survey_responses'::regclass and not tgisinternal;
-- Expect survey_response_to_slack.
