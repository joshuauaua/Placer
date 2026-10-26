/* PLACER — pictures re-encoded in the browser before they are uploaded.
 *
 * Every picture is decoded, turned the right way up, scaled to the size it is shown
 * at, and encoded afresh as WebP. Two reasons:
 *
 *   Privacy. A phone photo carries metadata — GPS coordinates of where it was taken,
 *   the camera, the time. Drawing it onto a canvas and encoding the canvas keeps the
 *   pixels and nothing else, so none of that ever leaves the device.
 *
 *   Space. A 4 MB phone photo shown as a 72px avatar is almost all waste. At the sizes
 *   below a picture is typically 40–300 KB, which is what keeps the R2 bucket inside
 *   its free tier (supabase/README.md section 14).
 *
 * A preset with `responsive` set is also encoded at the narrower widths in
 * lib/responsiveImage.js, so a phone can be sent a copy its own size.
 *
 * This is not a security control — anything here can be skipped by someone calling the
 * media function directly. The function's own byte check and size limits are what
 * enforce; this is what makes honest uploads small and clean.
 */

import { copyWidths } from './responsiveImage';

/**
 * How each kind of picture is sized. `square` centre-crops, for the avatar circle;
 * `responsive` adds the smaller copies (lib/responsiveImage.js). A scene is only ever
 * drawn whole, on the Idea Visualizer's stage, and a case study submission's picture
 * is never shown on a page at all, so neither has them.
 */
export const IMAGE_PRESETS = {
  avatar: { maxSide: 512, square: true, quality: 0.85 },
  cover: { maxSide: 1920, quality: 0.82, responsive: true },
  project: { maxSide: 1600, quality: 0.82, responsive: true },
  scene: { maxSide: 1600, quality: 0.82 },
  submission: { maxSide: 1600, quality: 0.82 },
  preview: { maxSide: 1920, quality: 0.85, responsive: true },
};

// Past this many pixels a picture is refused before it is drawn: decoding a 100 MP
// panorama takes more memory than a phone browser will give a tab. Any camera photo
// is under it, a 48 MP phone sensor's included.
export const MAX_PIXELS = 50_000_000;

const EXTENSIONS = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be encoded.'))),
      type, quality);
  });
}

/** Source rectangle and output size for a picture of `width` x `height`. */
export function fitTo(width, height, { maxSide, square = false }) {
  if (square) {
    const side = Math.min(width, height);
    const out = Math.min(side, maxSide);
    return { sx: (width - side) / 2, sy: (height - side) / 2, sw: side, sh: side, width: out, height: out };
  }
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    sx: 0, sy: 0, sw: width, sh: height,
    width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Re-encode `source` (a File or Blob) for `preset`, one of IMAGE_PRESETS. Resolves to
 * `{ blob, type, ext, width, copies }`: WebP where the browser can write it, else JPEG,
 * `width` wide, and `copies` its smaller copies as [{ width, blob }] — none for a
 * preset that is not `responsive`.
 */
export async function encodeImage(source, preset) {
  let bitmap;
  try {
    // 'from-image' applies the photo's EXIF orientation, so a portrait phone photo is
    // not drawn on its side once the EXIF that said so is gone.
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That file could not be read as a picture. Try a JPEG, PNG or WebP.');
  }
  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close?.();
    throw new Error('That picture is too large to use. Try one under 50 megapixels.');
  }

  const box = fitTo(bitmap.width, bitmap.height, preset);
  const draw = (background, width = box.width) => {
    const height = Math.max(1, Math.round(box.height * (width / box.width)));
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, box.sx, box.sy, box.sw, box.sh, 0, 0, width, height);
    return canvas;
  };

  try {
    let blob = await canvasToBlob(draw(null), 'image/webp', preset.quality);
    // A browser that cannot write WebP hands back PNG instead, without saying so.
    // JPEG then — on white, since JPEG has no transparency and would turn it black.
    const background = blob.type === 'image/webp' ? null : '#FFFFFF';
    if (background) blob = await canvasToBlob(draw(background), 'image/jpeg', preset.quality);
    if (!EXTENSIONS[blob.type]) throw new Error('This browser could not prepare the picture for upload.');

    // Each copy in the picture's own format, so their names differ only in width.
    const copies = [];
    for (const width of preset.responsive ? copyWidths(box.width) : []) {
      const copy = await canvasToBlob(draw(background, width), blob.type, preset.quality);
      if (copy.type !== blob.type) throw new Error('This browser could not prepare the picture for upload.');
      copies.push({ width, blob: copy });
    }
    return { blob, type: blob.type, ext: EXTENSIONS[blob.type], width: box.width, copies };
  } finally {
    bitmap.close?.();
  }
}

/**
 * The mime type and file extension of a preview, or null for anything that is not one.
 *
 * StreetScreen exports JPEG when there was a background photo to composite onto and PNG
 * when there was not — JPEG has no alpha and would flatten a transparent stage to solid
 * black. So neither the type nor the extension can be assumed; both are read off the
 * data URL that actually arrived.
 */
export function previewKind(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:(image\/(jpeg|png));base64,/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], ext: match[2] === 'jpeg' ? 'jpg' : 'png' };
}

// Decoded by hand rather than with fetch(dataUrl): a data URL is not something every
// environment will fetch, and this is a handful of lines with no request in it.
export function dataUrlToBlob(dataUrl, contentType) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}
