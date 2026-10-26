/* PLACER — inquiries kept on somebody's profile.
 *
 * A tool used on its own can be kept by somebody signed in, to start or join a project's
 * from later (supabase/profile-inquiries.sql). Private to the account: the table's
 * policies let only its owner read it, so these only work signed in.
 *
 * An inquiry is { id, tool, title, note, config, createdAt }. A picture that goes with
 * one — an Idea Visualizer scene's — is uploaded to the media bucket rather than kept in
 * `config`, which holds its key as `config.preview`.
 */

import { getSupabase } from './supabase';
import { removeMedia, uploadPhoto } from './media';
import { dataUrlToBlob, encodeImage, IMAGE_PRESETS, previewKind } from '../lib/imageEncode';
import { track } from '../analytics';

// The account's folder in the media bucket, the same one posted imaginations used.
const PREVIEWS_FOLDER = 'previews';

const TABLE = 'profile_inquiries';

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Saved inquiries need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

const toInquiry = (row) => ({
  id: row.id,
  tool: row.tool,
  title: row.title,
  note: row.note ?? '',
  config: row.config ?? {},
  createdAt: row.created_at ?? null,
});

/** Keep an inquiry on the signed-in account's profile. Resolves to what was saved. */
/**
 * Keep an inquiry on the signed-in account's profile. Resolves to what was saved.
 *
 * `preview`, a data URL, is uploaded first and its key put in `config.preview`, for the
 * same reason a posted imagination's was: the row carries the key, so a row is never
 * written pointing at a picture that never arrived. If the row then fails, the picture
 * is removed again. The key has an id of its own, since the row's is the database's to
 * choose.
 */
export async function saveInquiry({ tool, title, note = '', config, preview = null }) {
  const supabase = await client();
  const { data: session } = await supabase.auth.getSession();
  const ownerId = session?.session?.user?.id;
  if (!ownerId) throw new Error('Sign in to keep this on your profile.');

  let previewPath = null;
  const kind = previewKind(preview);
  if (kind) {
    let photo = { blob: dataUrlToBlob(preview, kind.contentType), ext: kind.ext };
    try {
      photo = await encodeImage(photo.blob, IMAGE_PRESETS.preview);
    } catch (encodeError) {
      console.warn('Uploading the preview as exported; it could not be re-encoded:', encodeError);
    }
    try {
      previewPath = await uploadPhoto(supabase, `${PREVIEWS_FOLDER}/${ownerId}/${crypto.randomUUID()}`, photo);
    } catch (uploadError) {
      throw new Error(`Could not upload the picture: ${uploadError.message}`);
    }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      owner_id: ownerId, tool, title: title.trim().slice(0, 120), note: note.slice(0, 1000),
      config: previewPath ? { ...config, preview: previewPath } : config,
    })
    .select('id, tool, title, note, config, created_at')
    .single();

  if (error) {
    if (previewPath) {
      await removeMedia(supabase, previewPath)
        .catch((storageError) => console.error('Could not remove the unused picture:', storageError));
    }
    throw new Error(`Could not save this to your profile: ${error.message}`);
  }
  track('inquiry_saved', { tool });
  return toInquiry(data);
}

/** The signed-in account's inquiries, newest first — only those of `tool` when given. */
export async function readInquiries(tool = null) {
  const supabase = await client();
  let query = supabase.from(TABLE).select('id, tool, title, note, config, created_at')
    .order('created_at', { ascending: false });
  if (tool) query = query.eq('tool', tool);
  const { data, error } = await query;

  if (error) throw new Error(`Could not load your saved inquiries: ${error.message}`);
  return (data ?? []).map(toInquiry);
}

/** Delete one of the account's inquiries, and its picture when it has one. */
export async function deleteInquiry(id) {
  const supabase = await client();
  const { data, error } = await supabase.from(TABLE).delete().eq('id', id).select('config');
  if (error) throw new Error(`Could not delete this inquiry: ${error.message}`);
  const preview = data?.[0]?.config?.preview;
  // Tidiness, not correctness: the inquiry is gone either way.
  if (typeof preview === 'string') {
    await removeMedia(supabase, preview)
      .catch((storageError) => console.error('Could not remove the inquiry\'s picture:', storageError));
  }
}
