/* PLACER — posted imaginations, wherever they are kept.
 *
 * One module, two stores, and the choice made in one place so that no component has to
 * think about it. With a Supabase project configured, a posted imagination is a row in
 * public.imaginations that anybody can read and only its owner can change — a community
 * map, which is what the Post button has always claimed to be. With no project, it is a
 * record in localStorage, which is how the app worked before accounts existed: yours,
 * on this device, and nowhere else.
 *
 * Both stores hand back the same camelCase shape, so MapContainer, DashboardPage and
 * AdminImaginations cannot tell which they are looking at. The one visible difference is
 * `preview`: a data URL from localStorage, an R2 URL (services/media.js) otherwise. Both go straight
 * into an <img src> and neither cares.
 *
 * Deliberately not folded into services/api.js. That module is the localStorage layer and
 * every component test mocks it wholesale; a network path living inside it would make
 * those mocks ambiguous about what they are standing in for. The local functions are
 * imported from there rather than reimplemented.
 *
 * Previews go to the R2 bucket, never into a column: a composited JPEG is a few hundred KB and
 * a column would mean every read of the map dragging every picture with it.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { mediaUrl, removeMedia, uploadMedia } from './media';
import { encodeImage, IMAGE_PRESETS } from '../lib/imageEncode';
import {
  addComment as addCommentLocal,
  deleteImagination as deleteLocal,
  fetchImaginations as fetchLocal,
  readComments as readCommentsLocal,
  readMyVote as readMyVoteLocal,
  saveImagination as saveLocal,
  voteImagination as voteLocal,
} from './api';

export const IMAGINATIONS_TABLE = 'imaginations';
// The folder previews go under in the R2 bucket (supabase/functions/media).
export const PREVIEWS_FOLDER = 'previews';
export const COMMENTS_TABLE = 'imagination_comments';
export const VOTES_TABLE = 'imagination_votes';

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
  + ' pov, fov, canvas_assets, preview_path, upvotes, project_id, created_at, updated_at';

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
    preview: mediaUrl(row.preview_path),
    upvotes: row.upvotes ?? 0,
    // Null for the ordinary case — an imagination posted without a project open.
    projectId: row.project_id ?? null,
    // Comments live in their own table (see readComments) rather than here, so listing
    // every imagination for the map or a profile never drags every thread behind it.
    // Empty rather than undefined, so the shape matches what saveImagination writes
    // locally and nothing downstream has to special-case it.
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
    canvasAssets = [], preview, projectId = null } = imagination;

  if (!userId) throw new Error('Posting an imagination needs an account.');

  const id = crypto.randomUUID();

  let previewPath = null;
  const kind = previewKind(preview);
  if (kind) {
    let blob = dataUrlToBlob(preview, kind.contentType);
    let { ext } = kind;
    // Re-encoded as WebP to save space, keeping any transparency. The stage export has
    // no metadata to strip, so if the browser cannot do this the original goes as it is.
    try {
      ({ blob, ext } = await encodeImage(blob, IMAGE_PRESETS.preview));
    } catch (encodeError) {
      console.warn('Uploading the preview as exported; it could not be re-encoded:', encodeError);
    }
    previewPath = `${PREVIEWS_FOLDER}/${userId}/${id}.${ext}`;
    try {
      await uploadMedia(supabase, previewPath, blob);
    } catch (error) {
      throw new Error(`Could not upload the preview: ${error.message}`);
    }
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
      preview_path: previewPath,
      project_id: projectId,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // Nothing points at the picture now, so it would only sit in the bucket using space.
    if (previewPath) {
      await removeMedia(supabase, previewPath)
        .catch((storageError) => console.error('Could not remove the unused preview:', storageError));
    }
    throw new Error(`Could not post your imagination: ${error.message}`);
  }
  return fromRow(supabase, data);
}

/**
 * Every imagination posted to a project, newest first. Public — the same read
 * policy as readImaginations, just filtered — so this needs no account. Empty
 * without a Supabase project, the same as a project itself not existing there.
 */
export async function readImaginationsByProject(projectId) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await client();
  const { data, error } = await supabase
    .from(IMAGINATIONS_TABLE)
    .select(COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load this project's imaginations: ${error.message}`);
  return (data ?? []).map((row) => fromRow(supabase, row));
}

/**
 * Every imagination one account has posted, newest first — for its public profile.
 * Public for the same reason readImaginationsByProject is, and empty without a
 * Supabase project, where there are no accounts to have posted anything.
 */
export async function readImaginationsByUser(userId) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await client();
  const { data, error } = await supabase
    .from(IMAGINATIONS_TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load these imaginations: ${error.message}`);
  return (data ?? []).map((row) => fromRow(supabase, row));
}

/**
 * Remove an imagination, and its picture with it.
 *
 * The row goes first. If the picture will not delete, the imagination is still gone from
 * the map, which is what somebody asking for this actually wants — an orphaned object in
 * a bucket is a tidiness problem, not a privacy one, since nothing links to it any more.
 *
 * `local` is for one still only in this browser (readLocalImaginations) while a project
 * is configured: it was never posted, so it is removed from localStorage, not the table.
 */
export async function removeImagination(id, { local = false } = {}) {
  if (!isSupabaseConfigured() || local) return deleteLocal(id);

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
    try {
      await removeMedia(supabase, existing.preview_path);
    } catch (storageError) {
      console.error('Could not remove the preview image:', storageError);
    }
  }

  return { success: true };
}

/**
 * Cast, change, or withdraw a vote on an imagination. `direction` is the button that
 * was pressed — 'up' or 'down' — and pressing the one that is already standing
 * withdraws it, which is decided below rather than by the caller.
 *
 * An RPC rather than an update, because voting is by definition done to somebody
 * else's imagination and the update policy on public.imaginations is owner-only. It
 * also needs an account, unlike the single-vote-per-browser scheme this replaced:
 * with nowhere to record who voted, the old imagination_upvote could be pressed
 * twice by the same visitor — see supabase/imaginations.sql section 5. The account
 * is what lets a vote be changed instead of only ever added, and it is also what
 * stops it being repeated.
 *
 * Locally there is always an account of a kind — the browser itself — so no account
 * is asked for there, and every visitor keeps their own vote on their own device the
 * same way they always could switch or withdraw it.
 *
 * Returns { upvotes, myVote }, or null for an imagination that is no longer there.
 */
export async function voteImagination(id, direction, { accountId = null } = {}) {
  if (!isSupabaseConfigured()) return voteLocal(id, direction);

  if (!accountId) throw new Error('Voting needs an account.');

  const supabase = await client();
  const { data, error } = await supabase.rpc('imagination_vote', { p_id: id, p_direction: direction });

  if (error) throw new Error(`Could not register your vote: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { upvotes: row.upvotes, myVote: row.my_vote === 1 ? 'up' : row.my_vote === -1 ? 'down' : null };
}

/**
 * This account's — or, with no project configured, this browser's — standing vote on
 * an imagination: 'up', 'down', or null. Read separately from the imagination itself
 * so that loading the map or a profile, which only ever shows the shared count, never
 * has to fetch a per-viewer answer nobody there asked for.
 */
export async function readMyVote(id, { accountId = null } = {}) {
  if (!isSupabaseConfigured()) return readMyVoteLocal(id);
  if (!accountId) return null;

  const supabase = await client();
  const { data, error } = await supabase
    .from(VOTES_TABLE)
    .select('value')
    .match({ imagination_id: id, user_id: accountId })
    .maybeSingle();

  if (error) throw new Error(`Could not read your vote: ${error.message}`);
  return data?.value === 1 ? 'up' : data?.value === -1 ? 'down' : null;
}

/**
 * Every comment on an imagination, oldest first — a thread reads top to bottom, not
 * newest-first the way the map's pins do.
 */
export async function readComments(imaginationId) {
  if (!isSupabaseConfigured()) return readCommentsLocal(imaginationId);

  const supabase = await client();
  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .select('id, author_name, body, created_at')
    .eq('imagination_id', imaginationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load the comments: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    author: row.author_name,
    text: row.body,
    createdAt: row.created_at,
  }));
}

/**
 * Post a comment. Needs an account when a project is configured, the same as posting
 * an imagination itself does — a comment is credited to whoever wrote it, and there
 * is nowhere to attribute one without a signed-in author.
 */
export async function postComment(imaginationId, { authorName, accountId = null, text }) {
  const body = (text ?? '').trim();
  if (!body) throw new Error('A comment needs some words in it.');

  if (!isSupabaseConfigured()) {
    return addCommentLocal(imaginationId, { text: body, author: authorName });
  }

  if (!accountId) throw new Error('Commenting needs an account.');

  const supabase = await client();
  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .insert({
      id: crypto.randomUUID(),
      imagination_id: imaginationId,
      user_id: accountId,
      author_name: authorName,
      body,
    })
    .select('id, author_name, body, created_at')
    .single();

  if (error) throw new Error(`Could not post your comment: ${error.message}`);
  return { id: data.id, author: data.author_name, text: data.body, createdAt: data.created_at };
}
