// PLACER — the gate in front of Cloudflare R2, where every uploaded picture lives.
//
// Supabase keeps the tables and the accounts; R2 keeps the files. The browser never
// holds an R2 key — those can write anywhere in the bucket — so every write comes
// through here, with the caller's Supabase session:
//
//   POST, header x-media-path: <key>, body: the file   ->  { path }
//       The bytes pass through this function on purpose. It reads them and accepts
//       only what actually is a JPEG, PNG or WebP — what the browser *says* the file
//       is counts for nothing, since that is the file name talking — and stores it
//       with the type it found, so R2 can only ever serve an image as an image.
//       Uploading a cover also clears out the account's older covers (see sweep).
//   POST, JSON { action: 'delete', path }              ->  { ok: true }
//
// This is what the storage.objects policies used to do. A key is always
// '<folder>/<user id>/<file>', and a caller can only touch keys under their own id —
// the same rule as `(storage.foldername(name))[1] = auth.uid()`, one level down.
//
// Secrets, set with `supabase secrets set` (see supabase/README.md section 14):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_JURISDICTION  optional; 'eu' for a bucket created with the EU jurisdiction,
//                    which answers on <account>.eu.r2.cloudflarestorage.com instead
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by the platform.

import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient } from 'npm:@supabase/supabase-js@2';

// What each folder accepts. Previews are a composited JPEG or PNG of the whole stage,
// so they get more room than a cover.
const FOLDERS: Record<string, { types: string[]; maxBytes: number }> = {
  previews: { types: ['image/jpeg', 'image/png'], maxBytes: 10 * 1024 * 1024 },
  covers: { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024 },
};

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-media-path',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const KEY = /^([a-z]+)\/([0-9a-f-]{36})\/([A-Za-z0-9_-]+)\.(jpg|png|webp)$/;

/** The folder a key belongs to, or null when it is not one this caller may touch. */
function parseKey(path: unknown, userId: string) {
  if (typeof path !== 'string') return null;
  const match = KEY.exec(path);
  if (!match || match[2] !== userId || !FOLDERS[match[1]]) return null;
  return { name: match[1], folder: FOLDERS[match[1]], ext: match[4] };
}

/**
 * The image type the bytes themselves say they are, or null for anything else. Only
 * the three formats the app accepts; SVG in particular is never an image here, since
 * it is a document that can carry script.
 */
function sniff(bytes: Uint8Array): string | null {
  const at = (offset: number, ...values: number[]) => values.every((v, i) => bytes[offset + i] === v);
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  // RIFF <size> WEBP
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
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

/**
 * Delete every cover in this account's folder except the one just uploaded and the one
 * the profile points at right now. The profile is only switched to the new cover after
 * this returns, so keeping the current one means a failed save never leaves the
 * profile pointing at nothing — and whatever that failure leaves behind is swept up by
 * the next upload. So an account holds at most two covers, and usually one.
 */
async function sweepCovers(
  { r2, bucketUrl }: ReturnType<typeof r2Client>,
  userId: string,
  keep: Set<string>,
) {
  const res = await r2.fetch(`${bucketUrl}?list-type=2&prefix=${encodeURIComponent(`covers/${userId}/`)}`);
  if (!res.ok) throw new Error(`R2 refused the listing (${res.status})`);
  const xml = await res.text();

  const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
  for (const key of keys) {
    // Only ever a key this account owns, whatever the listing says.
    if (keep.has(key) || !parseKey(key, userId)) continue;
    await r2.fetch(`${bucketUrl}/${key}`, { method: 'DELETE' });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Only POST is accepted.' });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  // As the caller, not as an admin: anything read below goes through their own RLS.
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return reply(401, { error: 'Sign in to upload pictures.' });

  const store = r2Client();
  const uploadPath = req.headers.get('x-media-path');

  if (uploadPath) {
    const key = parseKey(uploadPath, user.id);
    if (!key) return reply(403, { error: 'That file is not yours to change.' });

    // Refuse an oversized body before reading it, when the size is declared...
    const declared = Number(req.headers.get('Content-Length'));
    const limitMb = key.folder.maxBytes / 1024 / 1024;
    if (declared > key.folder.maxBytes) return reply(413, { error: `A picture can be at most ${limitMb} MB.` });
    // ...and check what actually arrived either way.
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0) return reply(400, { error: 'The file was empty.' });
    if (bytes.length > key.folder.maxBytes) return reply(413, { error: `A picture can be at most ${limitMb} MB.` });

    const type = sniff(bytes);
    if (!type || !key.folder.types.includes(type)) {
      const allowed = key.folder.types.map((t) => EXTENSIONS[t].toUpperCase()).join(', ');
      return reply(415, { error: `That file is not a picture this can take (${allowed}).` });
    }
    // The extension is part of the public address, so it has to agree with the content.
    if (EXTENSIONS[type] !== key.ext) {
      return reply(415, { error: `That file is a ${EXTENSIONS[type].toUpperCase()}, not a ${key.ext.toUpperCase()}.` });
    }

    const put = await store.r2.fetch(`${store.bucketUrl}/${uploadPath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': type,
        // Every key is new (an id, or a timestamp), so a cached copy is never stale.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: bytes,
    });
    if (!put.ok) return reply(502, { error: `The picture store refused the upload (${put.status}).` });

    if (key.name === 'covers') {
      try {
        const { data: profile } = await supabase.from('profiles').select('cover_path').eq('id', user.id).maybeSingle();
        await sweepCovers(store, user.id, new Set([uploadPath, profile?.cover_path].filter(Boolean)));
      } catch (error) {
        // Tidiness, not correctness: the upload stands, and the next one sweeps again.
        console.error('Could not clear out older covers:', error);
      }
    }

    return reply(200, { path: uploadPath });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'The request was not JSON.' });
  }

  const { action, path } = body ?? {};
  if (!parseKey(path, user.id)) return reply(403, { error: 'That file is not yours to change.' });

  if (action === 'delete') {
    const res = await store.r2.fetch(`${store.bucketUrl}/${path}`, { method: 'DELETE' });
    // 404 is fine: the file being gone already is what was asked for.
    if (!res.ok && res.status !== 404) return reply(502, { error: `R2 refused the delete (${res.status}).` });
    return reply(200, { ok: true });
  }

  return reply(400, { error: 'Unknown action.' });
});
