// PLACER — posts each new survey response, bug report, tool submission and case study
// submission to a Slack channel.
//
// Called by insert triggers on public.survey_responses, public.bug_reports,
// public.tool_submissions and public.case_study_submissions (see supabase/README.md
// sections 15 to 17), never by the browser:
//
//   POST, header x-webhook-secret: <SURVEY_WEBHOOK_SECRET>,
//         body: { type: 'INSERT', table: 'survey_responses' | 'bug_reports' | 'tool_submissions'
//                 | 'case_study_submissions',
//                 record: {...} }
//         ->  { ok: true }
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
//   SLACK_BUG_WEBHOOK_URL  optional; bug reports go here instead when set
//   SLACK_TOOL_WEBHOOK_URL optional; tool submissions go here instead when set
//   SLACK_CASE_STUDY_WEBHOOK_URL optional; case study submissions go here instead when set
//   SURVEY_WEBHOOK_SECRET  any long random string; the triggers send the same
//   MEDIA_URL              optional; the bucket's public address (the app's VITE_MEDIA_URL).
//                          When set, a bug report's screenshot is linked and shown inline.

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

// The form stores the lab as a slug (src/components/UserLabsPage.jsx, UPCOMING_LAB).
const USER_LABS_CITIES: Record<string, string> = { malmo: 'Malmö', ankara: 'Ankara' };

// A User Labs application keeps its fields flat in `answers`, not under `contact`.
function userLabsLines(answers: Record<string, any>): string[] {
  const lines: string[] = [];
  if (answers.lab) {
    const city = USER_LABS_CITIES[answers.lab] ?? answers.lab;
    lines.push(`*City:* ${esc(city)}${answers.labDate ? `  ·  ${esc(answers.labDate)}` : ''}`);
  }
  if (answers.name) lines.push(`*Name:* ${esc(answers.name)}`);
  if (answers.phone) lines.push(`*Phone:* ${esc(answers.phone)}`);
  if (answers.role) lines.push(`*Role:* ${esc(answers.role)}`);
  if (answers.motivation) {
    // Quoted so a multi-line answer stays visibly one block.
    lines.push('*Hopes to get out of it:*', esc(answers.motivation).split('\n').map((l) => `> ${l}`).join('\n'));
  }
  if (answers.dietary) lines.push(`*Dietary:* ${esc(answers.dietary)}`);
  lines.push(`*Newsletter:* ${answers.newsletter ? 'yes' : 'no'}`);
  return lines;
}

function surveyMessage(record: Record<string, any>): string {
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
  if (record.source === 'user_labs_application') lines.push(...userLabsLines(record.answers ?? {}));
  lines.push(`*Submitted:* ${esc(record.submitted_at)}  ·  id \`${esc(record.id)}\``);
  return lines.join('\n');
}

// Where a bug report's screenshot can be seen, or null. The key is checked against the
// shape the bug_reports constraint allows, so nothing else can be made into a link.
const SCREENSHOT_KEY = /^bug-reports\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/;
function screenshotUrl(record: Record<string, any>): string | null {
  const base = Deno.env.get('MEDIA_URL');
  const key = record.screenshot_path;
  if (!base || typeof key !== 'string' || !SCREENSHOT_KEY.test(key)) return null;
  return `${base.replace(/\/+$/, '')}/${key}`;
}

function bugMessage(record: Record<string, any>): string {
  const screenshot = screenshotUrl(record);
  return [
    ':beetle: *New bug report*',
    // Quoted so a multi-line report stays visibly one block.
    esc(record.message).split('\n').map((line) => `> ${line}`).join('\n'),
    `*Page:* ${record.page ? `\`${esc(record.page)}\`` : '_not given_'}`,
    `*Browser:* ${record.user_agent ? esc(record.user_agent) : '_not given_'}`,
    ...(screenshot ? [`*Screenshot:* <${screenshot}|open>`]
      : record.screenshot_path ? ['*Screenshot:* attached (screenshot_path on the row)'] : []),
    `*Submitted:* ${esc(record.created_at)}  ·  id \`${esc(record.id)}\``,
  ].join('\n');
}

function toolMessage(record: Record<string, any>): string {
  return [
    `:toolbox: *New Toolkit submission — ${esc(record.title)}*`,
    // Quoted so a multi-line description stays visibly one block.
    esc(record.description).split('\n').map((line) => `> ${line}`).join('\n'),
    `*Email:* ${record.email ? esc(record.email) : '_not given_'}`,
    `*Submitted:* ${esc(record.created_at)}  ·  id \`${esc(record.id)}\``,
  ].join('\n');
}

function caseStudyMessage(record: Record<string, any>): string {
  const attached = [record.has_logo && 'logo', record.has_image && 'picture'].filter(Boolean);
  return [
    `:bookmark_tabs: *New case study submission — ${esc(record.company)}*`,
    `*Industry:* ${esc(record.industry)}`,
    '*Results:*',
    // Quoted so a multi-line answer stays visibly one block.
    esc(record.results).split('\n').map((line) => `> ${line}`).join('\n'),
    `*Contact:* ${esc(record.contact_name)} <${esc(record.contact_email)}>`,
    `*Attached:* ${attached.length ? attached.join(', ') : '_nothing_'}`,
    `*Submitted:* ${esc(record.created_at)}  ·  id \`${esc(record.id)}\``,
  ].join('\n');
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('SURVEY_WEBHOOK_SECRET');
  const slackUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  const bugSlackUrl = Deno.env.get('SLACK_BUG_WEBHOOK_URL') || slackUrl;
  const toolSlackUrl = Deno.env.get('SLACK_TOOL_WEBHOOK_URL') || slackUrl;
  const caseStudySlackUrl = Deno.env.get('SLACK_CASE_STUDY_WEBHOOK_URL') || slackUrl;
  if (!secret || !slackUrl) {
    return Response.json({ error: 'not configured' }, { status: 500 });
  }
  if (req.method !== 'POST' || !sameSecret(req.headers.get('x-webhook-secret') ?? '', secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (payload?.type !== 'INSERT' || !payload.record) {
    return Response.json({ ok: true, skipped: true });
  }
  let url: string, text: string;
  // Block Kit, only when there is a picture to show: the text in sections (3,000
  // characters each at most) and the screenshot under it. `text` stays the fallback.
  let blocks: unknown[] | undefined;
  if (payload.table === 'survey_responses') {
    [url, text] = [slackUrl, surveyMessage(payload.record)];
  } else if (payload.table === 'bug_reports') {
    [url, text] = [bugSlackUrl!, bugMessage(payload.record)];
    const screenshot = screenshotUrl(payload.record);
    if (screenshot) {
      blocks = [];
      for (let i = 0; i < text.length; i += 3000) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: text.slice(i, i + 3000) } });
      }
      blocks.push({ type: 'image', image_url: screenshot, alt_text: 'Screenshot sent with the bug report' });
    }
  } else if (payload.table === 'tool_submissions') {
    [url, text] = [toolSlackUrl!, toolMessage(payload.record)];
  } else if (payload.table === 'case_study_submissions') {
    [url, text] = [caseStudySlackUrl!, caseStudyMessage(payload.record)];
  } else {
    return Response.json({ ok: true, skipped: true });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(blocks ? { text, blocks } : { text }),
  });
  if (!res.ok) {
    // Shows in the webhook's response log (net._http_response); the row itself is saved regardless.
    return Response.json({ error: `slack answered ${res.status}` }, { status: 502 });
  }
  return Response.json({ ok: true });
});
