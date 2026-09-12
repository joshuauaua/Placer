/* PLACER — posted imaginations, wherever they are kept.
 *
 * One module, two stores, and the choice made in one place so that no component has to
 * think about it. With a Supabase project configured, a posted imagination is a row in
 * public.imaginations that anybody can read and only its owner can change — a community
 * map, which is what the Post button has always claimed to be. With no project, it is a
 * record in localStorage, which is how the app worked before accounts existed: yours,
 * on this device, and nowhere else.
 *
 * Both stores hand back the same camelCase shape, so MapContainer, ProfilePage and
 * AdminImaginations cannot tell which they are looking at. The one visible difference is
 * `preview`: a data URL from localStorage, a bucket URL from Supabase. Both go straight
 * into an <img src> and neither cares.
 *
 * Deliberately not folded into services/api.js. That module is the localStorage layer and
 * every component test mocks it wholesale; a network path living inside it would make
 * those mocks ambiguous about what they are standing in for. The local functions are
 * imported from there rather than reimplemented.
 *
 * Previews go to Storage, never into a column: a composited JPEG is a few hundred KB and
 * a column would mean every read of the map dragging every picture with it.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  deleteImagination as deleteLocal,
  fetchImaginations as fetchLocal,
  saveImagination as saveLocal,
  upvoteImagination as upvoteLocal,
} from './api';

export const IMAGINATIONS_TABLE = 'imaginations';
export const PREVIEWS_BUCKET = 'imagination-previews';

export { isSupabaseConfigured };

/**
 * Whether posting puts an imagination somewhere other people can see it.
 *
 * The screens say different things depending on the answer — "posted to the community"
 * against "saved in this browser" — and this is what they ask, rather than each of them
 * reaching for isSupabaseConfigured and drawing its own conclusion.
 */
export function postsAreShared() {
  return isSupabaseConfigured();
}

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      'Sharing imaginations needs a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

// Every column, named rather than '*', so that adding one to the table does not silently
// change what the app downloads on every read of the map.
const COLUMNS = 'id, user_id, author_name, title, category, blurb, loc, lat, lng, source,'
  + ' pov, fov, canvas_assets, lines, preview_path, upvotes, created_at, updated_at';

/**
 * The mime type and file extension of a preview, or null for anything that is not one.
 *
 * StreetScreen exports JPEG when there was a background photo to composite onto and PNG
 * when there was not — JPEG has no alpha and would flatten a transparent stage to solid
 * black. So neither the type nor the extension can be assumed; both are read off the
 * data URL that actually arrived.
 */
function previewKind(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:(image\/(jpeg|png));base64,/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], ext: match[2] === 'jpeg' ? 'jpg' : 'png' };
}

// Decoded by hand rather than with fetch(dataUrl): a data URL is not something every
// environment will fetch, and this is a handful of lines with no request in it.
function dataUrlToBlob(dataUrl, contentType) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

function publicPreviewUrl(supabase, path) {
  if (!path) return null;
  return supabase.storage.from(PREVIEWS_BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
}

/** A database row, in the shape the rest of the app already speaks. */
function fromRow(supabase, row) {
  const hasCoords = Number.isFinite(row.lat) && Number.isFinite(row.lng);
  return {
    id: row.id,
    // The account that owns it. This is what ownership is now, rather than comparing
    // display names — which used to mean renaming yourself orphaned everything.
    userId: row.user_id,
    author: row.author_name,
    title: row.title,
    cat: row.category ?? '',
    blurb: row.blurb ?? '',
    loc: row.loc ?? '',
    position: hasCoords ? { lat: row.lat, lng: row.lng } : null,
    source: row.source ?? null,
    pov: row.pov ?? null,
    fov: row.fov ?? null,
    canvasAssets: row.canvas_assets ?? [],
    lines: row.lines ?? [],
    preview: publicPreviewUrl(supabase, row.preview_path),
    upvotes: row.upvotes ?? 0,
    // No comments table yet. An empty array rather than undefined, so the shape matches
    // what saveImagination writes locally and nothing downstream has to special-case it.
    comments: [],
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    // Where this came from, so a screen can say so honestly. See readLocalImaginations.
    shared: true,
  };
}

// A localStorage record, marked as what it is.
const fromLocal = (record) => ({ ...record, shared: false });

/**
 * Everything posted, newest first.
 *
 * With a project configured this is the community: every account's imaginations, not
 * just this browser's. Records still sitting in localStorage from before are NOT mixed
 * in — they were never posted anywhere, and putting them on a shared map would be
 * claiming otherwise. readLocalImaginations is how a screen offers them separately.
 */
export async function readImaginations() {
  if (!isSupabaseConfigured()) return (await fetchLocal()).map(fromLocal);

  const supabase = await client();
  const { data, error } = await supabase
    .from(IMAGINATIONS_TABLE)
    .select(COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load the imaginations: ${error.message}`);
  return (data ?? []).map((row) => fromRow(supabase, row));
}

/**
 * What is still only in this browser.
 *
 * Always the localStorage store, whether a project is configured or not. These are
 * imaginations made before there were accounts, and they are deliberately left where
 * they are: they were made under a privacy policy that said they would never leave the
 * device, so uploading them to a public map without being asked would break that
 * promise. Empty once a project is configured and nothing old remains.
 */
export async function readLocalImaginations() {
  return (await fetchLocal()).map(fromLocal);
}

/** One imagination by id, or null. */
export async function readImaginationById(id) {
  if (!isSupabaseConfigured()) {
    const all = await fetchLocal();
    const found = all.find((imagination) => imagination.id === id);
    return found ? fromLocal(found) : null;
  }

  const supabase = await client();
  const { data, error } = await supabase
    .from(IMAGINATIONS_TABLE)
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Could not load that imagination: ${error.message}`);
  if (!data) return null;
  return fromRow(supabase, data);
}

/**
 * Post an imagination.
 *
 * `userId` is required when a project is configured and ignored when it is not: the
 * insert policy checks it against auth.uid(), so a missing one is a refused write rather
 * than an anonymous post, and failing here with a sentence is kinder than failing there
 * with a policy violation.
 *
 * The picture is uploaded before the row is written, because the row carries the path.
 * If the upload fails, nothing is inserted and the whole post fails — better than a
 * half-posted imagination with a picture that never arrives. The id is chosen here for
 * the same reason: the path contains it, so it has to exist before either does.
 */
export async function postImagination(imagination) {
  if (!isSupabaseConfigured()) return fromLocal(await saveLocal(imagination));

  const supabase = await client();
  const { userId, author, title, cat, blurb, loc, position, source, pov, fov,
    canvasAssets = [], lines = [], preview } = imagination;

  if (!userId) throw new Error('Posting an imagination needs an account.');

  const id = crypto.randomUUID();

  let previewPath = null;
  const kind = previewKind(preview);
  if (kind) {
    previewPath = `${userId}/${id}.${kind.ext}`;
    const { error } = await supabase.storage
      .from(PREVIEWS_BUCKET)
      .upload(previewPath, dataUrlToBlob(preview, kind.contentType), {
        contentType: kind.contentType,
        upsert: true,
      });

    if (error) throw new Error(`Could not upload the preview: ${error.message}`);
  }

  const { data, error } = await supabase
    .from(IMAGINATIONS_TABLE)
    .insert({
      id,
      user_id: userId,
      author_name: author,
      title,
      // '' is what the form hands over for "no category chosen", and the column takes
      // null for that — '' would fail imaginations_category_known.
      category: cat || null,
      blurb: blurb ?? '',
      loc: loc || null,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
      source: source ?? null,
      pov: pov ?? null,
      fov: fov ?? null,
      canvas_assets: canvasAssets,
      lines,
      preview_path: previewPath,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`Could not post your imagination: ${error.message}`);
  return fromRow(supabase, data);
}

/**
 * Remove an imagination, and its picture with it.
 *
 * The row goes first. If the picture will not delete, the imagination is still gone from
 * the map, which is what somebody asking for this actually wants — an orphaned object in
 * a bucket is a tidiness problem, not a privacy one, since nothing links to it any more.
 */
export async function removeImagination(id) {
  if (!isSupabaseConfigured()) return deleteLocal(id);

  const supabase = await client();

  // Read the path before the row that holds it is gone.
  const { data: existing } = await supabase
    .from(IMAGINATIONS_TABLE)
    .select('preview_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from(IMAGINATIONS_TABLE).delete().eq('id', id);
  if (error) throw new Error(`Could not remove that imagination: ${error.message}`);

  if (existing?.preview_path) {
    const { error: storageError } = await supabase.storage
      .from(PREVIEWS_BUCKET)
      .remove([existing.preview_path]);

    if (storageError) console.error('Could not remove the preview image:', storageError);
  }

  return { success: true };
}

/**
 * Add a vote. Returns the new count, or null for an imagination that is no longer there.
 *
 * An RPC rather than an update, because voting is by definition done to somebody else's
 * imagination and the update policy is owner-only. Note that nothing records who voted,
 * so this can be pressed twice — see the comment in supabase/imaginations.sql section 5.
 */
export async function upvoteImagination(id) {
  if (!isSupabaseConfigured()) {
    const updated = await upvoteLocal(id);
    return updated?.upvotes ?? null;
  }

  const supabase = await client();
  const { data, error } = await supabase.rpc('imagination_upvote', { p_id: id });

  if (error) throw new Error(`Could not register your vote: ${error.message}`);
  return typeof data === 'number' ? data : null;
}
