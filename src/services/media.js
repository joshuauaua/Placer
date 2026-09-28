/* PLACER — uploaded pictures, kept in Cloudflare R2.
 *
 * Supabase holds the tables and the accounts; the files live in an R2 bucket. A row
 * keeps only the key ('previews/<user id>/<id>.jpg', 'covers/<user id>/cover-….png'),
 * and this module is the one place that turns a key into an address, puts a file there,
 * or takes it away again.
 *
 * Reading is plain: the bucket is served publicly from VITE_MEDIA_URL, so a key becomes
 * an <img src> with no request. Writing cannot be done from here alone, because an R2
 * key can write anywhere in the bucket and would be in the bundle the moment it was in
 * a VITE_ variable. So every write goes through the `media` Edge Function
 * (supabase/functions/media), which checks the Supabase session, only touches keys
 * under the caller's own id, and reads each upload's bytes to make sure it really is
 * a picture before it reaches the bucket. The type checks in auth.js and
 * imaginations.js are there to explain a refusal early, not to enforce anything.
 */

/** Whether pictures have somewhere to be shown from. */
export function isMediaConfigured() {
  return Boolean(import.meta.env.VITE_MEDIA_URL);
}

/** The public address of a key, or null for no key (or no bucket configured). */
export function mediaUrl(path) {
  if (!path || !isMediaConfigured()) return null;
  return `${import.meta.env.VITE_MEDIA_URL.replace(/\/+$/, '')}/${path}`;
}

// supabase-js reports any non-2xx as one generic sentence; the function's own
// explanation is in the response body, and that is the one worth showing.
async function explain(error) {
  try {
    const body = await error.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // Not JSON — fall through to the generic message.
  }
  return error.message;
}

async function callMedia(supabase, options) {
  const { data, error } = await supabase.functions.invoke('media', options);
  if (error) throw new Error(await explain(error));
  return data;
}

/**
 * Put `blob` at `path` in the bucket. The key has to start with the folder and the
 * signed-in account's id, and the bytes have to be a JPEG, PNG or WebP the folder
 * accepts, or the function refuses it. Uploading a cover also has the function delete
 * the account's older covers, keeping only this one and the one in use.
 */
export async function uploadMedia(supabase, path, blob) {
  if (!isMediaConfigured()) {
    throw new Error('Picture uploads need an R2 bucket: set VITE_MEDIA_URL.');
  }

  // Sent as opaque bytes: the function decides what they are, not this header.
  await callMedia(supabase, {
    body: blob,
    headers: { 'x-media-path': path, 'Content-Type': 'application/octet-stream' },
  });
  return path;
}

/** Delete the file at `path`. Throws on failure; callers decide whether that matters. */
export async function removeMedia(supabase, path) {
  if (!path) return;
  await callMedia(supabase, { body: { action: 'delete', path } });
}
