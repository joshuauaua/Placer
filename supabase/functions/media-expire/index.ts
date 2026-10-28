// PLACER — deletes bug report screenshots once they are 30 days old.
//
// Called once a day by a pg_cron job (supabase/bug-report-screenshots-expire.sql),
// never by the browser:
//
//   POST, header x-cron-secret: <MEDIA_EXPIRE_SECRET>   ->  { ok: true, deleted: <n> }
//
// A screenshot can show somebody's account or what they were working on, and once
// the bug is looked into there is no reason to keep it. So everything under
// bug-reports/ in the bucket older than EXPIRE_DAYS is deleted, going by the file's
// own age rather than the report's, which also catches a screenshot whose report was
// refused after it was uploaded. Then screenshot_path is cleared on the reports that
// pointed at them, so no row is left naming a file that is gone. The report itself —
// the message, the page, the browser — is kept.
//
// The platform's JWT check is off for this function (config.toml), because the cron
// job carries no user session. The shared secret takes its place.
//
// Secrets, set with `supabase secrets set` (see supabase/README.md section 23):
//   MEDIA_EXPIRE_SECRET  any long random string; the cron job sends the same, from Vault
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_JURISDICTION
//                        the media function's own (section 14)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform. The service
// role is needed because bug_reports has no update policy at all; it never leaves here.

import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPIRE_DAYS = 30;
const PREFIX = 'bug-reports/';
const DAY_MS = 24 * 60 * 60 * 1000;

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Constant-time, so the secret cannot be guessed a character at a time.
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function r2Client() {
  const r2 = new AwsClient({
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  });
  const jurisdiction = Deno.env.get('R2_JURISDICTION');
  const host = `${env('R2_ACCOUNT_ID')}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  return { r2, bucketUrl: `https://${host}/${env('R2_BUCKET')}` };
}

type Store = ReturnType<typeof r2Client>;

/** Every object under PREFIX, with when it was written, following the listing across pages. */
async function listScreenshots({ r2, bucketUrl }: Store) {
  const objects: { key: string; modified: number }[] = [];
  let token: string | null = null;
  do {
    const page = token ? `&continuation-token=${encodeURIComponent(token)}` : '';
    const res = await r2.fetch(`${bucketUrl}?list-type=2&prefix=${encodeURIComponent(PREFIX)}${page}`);
    if (!res.ok) throw new Error(`R2 refused the listing (${res.status})`);
    const xml = await res.text();

    for (const [, entry] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = /<Key>([^<]+)<\/Key>/.exec(entry)?.[1];
      const modified = Date.parse(/<LastModified>([^<]+)<\/LastModified>/.exec(entry)?.[1] ?? '');
      // Only ever a key under this prefix, whatever the listing says; and one whose age
      // cannot be read is left alone rather than guessed at.
      if (key?.startsWith(PREFIX) && !Number.isNaN(modified)) objects.push({ key, modified });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null
      : null;
  } while (token);
  return objects;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('MEDIA_EXPIRE_SECRET');
  if (!secret) return Response.json({ error: 'not configured' }, { status: 500 });
  if (req.method !== 'POST' || !sameSecret(req.headers.get('x-cron-secret') ?? '', secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const store = r2Client();
    const cutoff = Date.now() - EXPIRE_DAYS * DAY_MS;
    const expired = (await listScreenshots(store)).filter((object) => object.modified < cutoff);

    const deleted: string[] = [];
    for (const { key } of expired) {
      const res = await store.r2.fetch(`${store.bucketUrl}/${key}`, { method: 'DELETE' });
      // 404 is fine: the file being gone already is what was wanted.
      if (res.ok || res.status === 404) deleted.push(key);
      else console.error(`R2 refused to delete ${key} (${res.status}); the next run tries again.`);
    }

    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false },
    });
    // In batches, to keep each request's filter a sensible length.
    for (let i = 0; i < deleted.length; i += 100) {
      const { error } = await supabase.from('bug_reports')
        .update({ screenshot_path: null })
        .in('screenshot_path', deleted.slice(i, i + 100));
      if (error) throw new Error(`Could not clear the reports' screenshot_path: ${error.message}`);
    }

    return Response.json({ ok: true, deleted: deleted.length });
  } catch (error) {
    console.error('Could not expire bug report screenshots:', error);
    return Response.json({ error: String((error as Error)?.message ?? error) }, { status: 500 });
  }
});
