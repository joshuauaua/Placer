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
//       Each account may keep 50 MB in all (see usage). Replacing a cover, a profile
//       photo or a project image also clears out the older ones (see sweep).
//   POST, JSON { action: 'delete', path }              ->  { ok: true }
//
// This is what the storage.objects policies used to do. A key is always
// '<folder>/<owner id>/<file>'. For previews, covers and profile photos the owner is
// an account, and a caller can only touch keys under their own id — the same rule
// as `(storage.foldername(name))[1] = auth.uid()`, one level down. For project
// images the owner is a project, and the caller has to be able to edit it
// (project_can_edit() in supabase/media-photos.sql). For organisation covers the
// owner is an organisation, and the caller has to be one of its admins
// (organisation_is_admin() in supabase/organisations.sql).
//
// Secrets, set with `supabase secrets set` (see supabase/README.md section 14):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_JURISDICTION  optional; 'eu' for a bucket created with the EU jurisdiction,
//                    which answers on <account>.eu.r2.cloudflarestorage.com instead
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by the platform.

import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MB = 1024 * 1024;

// Everything one account may keep in the bucket: its previews, cover and profile photo,
// and the images (covers and scenes) of the projects it owns. What keeps the bucket
// inside R2's free tier.
const QUOTA_BYTES = 50 * MB;

// What each folder accepts, whose id names it, and — for the ones that hold a single
// current picture — which column says which picture that is, so sweep can keep it.
//
// The limits are for pictures already re-encoded in the browser (src/lib/imageEncode.js):
// a 512px avatar is ~40 KB, a 1920px cover a few hundred. They are ceilings for anyone
// who skips that step, not sizes anyone honest comes near. Previews may still arrive as
// the PNG the stage exported, when a browser cannot write WebP, so they get the most.
type Folder = {
  types: string[];
  maxBytes: number;
  owner: 'account' | 'project' | 'organisation';
  current?: { table: string; column: string };
};
const FOLDERS: Record<string, Folder> = {
  previews: { types: PHOTO_TYPES, maxBytes: 5 * MB, owner: 'account' },
  covers: { types: PHOTO_TYPES, maxBytes: 3 * MB, owner: 'account',
    current: { table: 'profiles', column: 'cover_path' } },
  avatars: { types: PHOTO_TYPES, maxBytes: 1 * MB, owner: 'account',
    current: { table: 'profiles', column: 'avatar_path' } },
  projects: { types: PHOTO_TYPES, maxBytes: 3 * MB, owner: 'project',
    current: { table: 'projects', column: 'image_path' } },
  // Idea Visualizer's base image for a project (supabase/project-tool-config.sql).
  // Its own folder, since `projects` is swept down to the cover. No `current`: the key
  // is inside project_tools.config, and the page deletes the one it replaces.
  scenes: { types: PHOTO_TYPES, maxBytes: 3 * MB, owner: 'project' },
  organisations: { types: PHOTO_TYPES, maxBytes: 3 * MB, owner: 'organisation',
    current: { table: 'organisations', column: 'cover_path' } },
};
const ACCOUNT_FOLDERS = Object.keys(FOLDERS).filter((name) => FOLDERS[name].owner === 'account');
const PROJECT_FOLDERS = Object.keys(FOLDERS).filter((name) => FOLDERS[name].owner === 'project');

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

/** A key taken apart, or null for anything that is not one of ours. */
function parseKey(path: unknown) {
  if (typeof path !== 'string') return null;
  const match = KEY.exec(path);
  if (!match || !FOLDERS[match[1]]) return null;
  return { name: match[1], folder: FOLDERS[match[1]], ownerId: match[2], ext: match[4] };
}

type Key = NonNullable<ReturnType<typeof parseKey>>;
type Caller = { id: string; supabase: SupabaseClient };

/**
 * Whether this caller may write this key. An account folder has to be their own; a
 * project folder has to be a project they can edit, and an organisation folder an
 * organisation they are an admin of. For a delete only, a project or organisation
 * that no longer exists also passes: its files belong to nobody now, and removing
 * them is what deleting it wants — it is what lets deleteProject and
 * closeOrganisation clear the picture after the row is already gone.
 */
async function mayWrite(key: Key, caller: Caller, forDelete: boolean) {
  if (key.folder.owner === 'account') return key.ownerId === caller.id;

  const { data: canEdit } = key.folder.owner === 'project'
    ? await caller.supabase.rpc('project_can_edit', { p_project_id: key.ownerId })
    : await caller.supabase.rpc('organisation_is_admin', { p_organisation_id: key.ownerId, p_user_id: caller.id });
  if (canEdit === true) return true;
  if (!forDelete) return false;
  const table = key.folder.owner === 'project' ? 'projects' : 'organisations';
  const { data: row } = await caller.supabase.from(table).select('id').eq('id', key.ownerId).maybeSingle();
  return !row;
}

/** The key the owning row points at right now, or null. */
async function currentKey(key: Key, caller: Caller) {
  if (!key.folder.current) return null;
  const { table, column } = key.folder.current;
  const { data } = await caller.supabase.from(table).select(column).eq('id', key.ownerId).maybeSingle();
  return (data as Record<string, string | null> | null)?.[column] ?? null;
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

type Store = ReturnType<typeof r2Client>;

/** Every object under `prefix`, with its size, following the listing across pages. */
async function listObjects({ r2, bucketUrl }: Store, prefix: string) {
  const objects: { key: string; size: number }[] = [];
  let token: string | null = null;
  do {
    const page = token ? `&continuation-token=${encodeURIComponent(token)}` : '';
    const res = await r2.fetch(`${bucketUrl}?list-type=2&prefix=${encodeURIComponent(prefix)}${page}`);
    if (!res.ok) throw new Error(`R2 refused the listing (${res.status})`);
    const xml = await res.text();

    for (const [, entry] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = /<Key>([^<]+)<\/Key>/.exec(entry)?.[1];
      const size = Number(/<Size>(\d+)<\/Size>/.exec(entry)?.[1] ?? 0);
      // Only ever a key under this prefix, whatever the listing says.
      if (key?.startsWith(prefix)) objects.push({ key, size });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null
      : null;
  } while (token);
  return objects;
}

/**
 * The account an upload counts against: the caller for their own folders, the owner
 * for a project's — so a collaborator adding a project image uses the owner's room,
 * the same as the owner adding it. An organisation has no single owner, so the admin
 * uploading its cover needs the room for it; the cover itself is not counted towards
 * anyone afterwards, and the folder is bounded instead — one 3 MB picture, two for
 * the moment one replaces the other (sweep).
 */
async function chargedAccount(key: Key, caller: Caller) {
  if (key.folder.owner === 'account') return key.ownerId;
  if (key.folder.owner === 'organisation') return caller.id;
  const { data } = await caller.supabase.from('projects').select('owner_id').eq('id', key.ownerId).maybeSingle();
  return (data as { owner_id: string } | null)?.owner_id ?? null;
}

/**
 * How many bytes this account keeps in the bucket, leaving out `replacing` — the folder
 * an upload is about to replace the picture in. Whatever is there is on its way out
 * (sweep, and the page deleting the previous one), so a full account can still swap
 * its cover or photo for another.
 */
async function usage(store: Store, caller: Caller, accountId: string, replacing: string | null) {
  const { data: owned } = await caller.supabase.from('projects').select('id').eq('owner_id', accountId);
  const prefixes = [
    ...ACCOUNT_FOLDERS.map((name) => `${name}/${accountId}/`),
    ...((owned ?? []) as { id: string }[]).flatMap((project) => PROJECT_FOLDERS.map((name) => `${name}/${project.id}/`)),
  ].filter((prefix) => prefix !== replacing);

  const listings = await Promise.all(prefixes.map((prefix) => listObjects(store, prefix)));
  return listings.flat().reduce((total, object) => total + object.size, 0);
}

/**
 * Delete every picture in this folder except the one just uploaded and the one its
 * row points at right now. The row is only switched to the new picture after this
 * returns, so keeping the current one means a failed save never leaves it pointing
 * at nothing — and whatever that failure leaves behind is swept up by the next
 * upload. So a profile or project holds at most two of each, and usually one.
 */
async function sweep(store: Store, key: Key, keep: Set<string>) {
  for (const { key: other } of await listObjects(store, `${key.name}/${key.ownerId}/`)) {
    if (keep.has(other) || !parseKey(other)) continue;
    await store.r2.fetch(`${store.bucketUrl}/${other}`, { method: 'DELETE' });
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
  const caller: Caller = { id: user.id, supabase };

  const store = r2Client();
  const uploadPath = req.headers.get('x-media-path');

  if (uploadPath) {
    const key = parseKey(uploadPath);
    if (!key || !(await mayWrite(key, caller, false))) {
      return reply(403, { error: 'That file is not yours to change.' });
    }

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

    const account = await chargedAccount(key, caller);
    if (!account) return reply(403, { error: 'That file is not yours to change.' });
    const replacing = key.folder.current ? `${key.name}/${key.ownerId}/` : null;
    if ((await usage(store, caller, account, replacing)) + bytes.length > QUOTA_BYTES) {
      const whose = account === caller.id ? 'your' : "this project's owner's";
      return reply(413, {
        error: `That would take ${whose} pictures past ${QUOTA_BYTES / MB} MB. `
          + 'Delete some imaginations or pictures to make room.',
      });
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

    if (key.folder.current) {
      try {
        const current = await currentKey(key, caller);
        await sweep(store, key, new Set([uploadPath, current].filter((k): k is string => Boolean(k))));
      } catch (error) {
        // Tidiness, not correctness: the upload stands, and the next one sweeps again.
        console.error('Could not clear out older pictures:', error);
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
  const key = parseKey(path);
  if (!key || !(await mayWrite(key, caller, true))) {
    return reply(403, { error: 'That file is not yours to change.' });
  }

  if (action === 'delete') {
    const res = await store.r2.fetch(`${store.bucketUrl}/${path}`, { method: 'DELETE' });
    // 404 is fine: the file being gone already is what was asked for.
    if (!res.ok && res.status !== 404) return reply(502, { error: `R2 refused the delete (${res.status}).` });
    return reply(200, { ok: true });
  }

  return reply(400, { error: 'Unknown action.' });
});
