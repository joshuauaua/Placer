// PLACER — posts each new survey response to a Slack channel.
//
// Called by a Database Webhook on INSERT into public.survey_responses (see
// supabase/README.md section 15), never by the browser:
//
//   POST, header x-webhook-secret: <SURVEY_WEBHOOK_SECRET>,
//         body: { type: 'INSERT', table: 'survey_responses', record: {...} }  ->  { ok: true }
//
// The platform's JWT check is off for this function (config.toml), because the
// webhook carries no user session. The shared secret takes its place: without it
// anyone could call this URL and post whatever they liked into the channel.
//
// Everything in a row came from an anonymous visitor, so every value is escaped
// before it reaches Slack — otherwise an email field of `<!channel>` would ping
// the whole channel.
//
// Secrets, set with `supabase secrets set`:
//   SLACK_WEBHOOK_URL      the channel's Incoming Webhook URL
//   SURVEY_WEBHOOK_SECRET  any long random string; the Database Webhook sends the same

const SOURCES: Record<string, string> = {
  community_survey: 'Community survey (/survey)',
  landing_survey: 'Landing page survey',
  placemaking_trends_survey: 'Placemaking trends survey',
  user_labs_application: 'User Labs application',
};

// Slack's mrkdwn treats these three as control characters; escaping them is all
// it takes to stop mentions, links and channel pings.
function esc(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function message(record: Record<string, any>): string {
  const contact = record.answers?.contact ?? {};
  const optIns: string[] = Array.isArray(record.answers?.optIns) ? record.answers.optIns : [];
  const lines = [
    `:memo: *New response — ${esc(SOURCES[record.source] ?? record.source)}*`,
    `*Email:* ${record.email ? esc(record.email) : '_not given_'}`,
  ];
  if (contact.name) lines.push(`*Name:* ${esc(contact.name)}`);
  if (contact.city) lines.push(`*City:* ${esc(contact.city)}`);
  if (contact.department) lines.push(`*Department:* ${esc(contact.department)}`);
  if (optIns.length) lines.push(`*Opted into:* ${optIns.map(esc).join(', ')}`);
  lines.push(`*Submitted:* ${esc(record.submitted_at)}  ·  id \`${esc(record.id)}\``);
  return lines.join('\n');
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('SURVEY_WEBHOOK_SECRET');
  const slackUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  if (!secret || !slackUrl) {
    return Response.json({ error: 'not configured' }, { status: 500 });
  }
  if (req.method !== 'POST' || !sameSecret(req.headers.get('x-webhook-secret') ?? '', secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (payload?.type !== 'INSERT' || payload?.table !== 'survey_responses' || !payload.record) {
    return Response.json({ ok: true, skipped: true });
  }

  const res = await fetch(slackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message(payload.record) }),
  });
  if (!res.ok) {
    // Shows in the webhook's response log (net._http_response); the row itself is saved regardless.
    return Response.json({ error: `slack answered ${res.status}` }, { status: 502 });
  }
  return Response.json({ ok: true });
});
