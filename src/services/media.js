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
 * a picture before it reaches the bucket, and that the account stays within its
 * 50 MB. Every picture is re-encoded here first (preparePhoto, lib/imageEncode.js) to
 * strip its metadata and shrink it; the checks here explain a refusal early, but
 * enforce nothing.
 */

import { encodeImage, IMAGE_PRESETS } from '../lib/imageEncode';

// How big a picked photo may be *before* it is re-encoded. Generous on purpose — it is
// a phone photo straight off the camera — since what gets uploaded is the far smaller
// re-encoded copy (lib/imageEncode.js), and the media function's limits apply to that.
export const PICKED_MAX_BYTES = 30 * 1024 * 1024;

/**
 * Throw a readable sentence if `file` is not a picture this app will take. `what`
 * names it ("A cover", "A profile photo"). SVG is refused outright: it is a document
 * that can carry script, not a photo.
 */
export function checkPickedImage(file, what) {
  const type = file?.type ?? '';
  if (!type.startsWith('image/') || type === 'image/svg+xml') {
    throw new Error(`${what} has to be a photo — a JPEG, PNG or WebP, for example.`);
  }
  if (file.size > PICKED_MAX_BYTES) throw new Error(`${what} can be at most 30 MB.`);
}

/**
 * Check a picked photo, then re-encode it for `preset` (a key of IMAGE_PRESETS):
 * scaled, stripped of its metadata, WebP where the browser can. Resolves to
 * `{ blob, ext }`, ready for uploadMedia.
 */
export async function preparePhoto(file, preset, what) {
  checkPickedImage(file, what);
  const { blob, ext } = await encodeImage(file, IMAGE_PRESETS[preset]);
  return { blob, ext };
}

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
