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
 * This is not a security control — anything here can be skipped by someone calling the
 * media function directly. The function's own byte check and size limits are what
 * enforce; this is what makes honest uploads small and clean.
 */

/** How each kind of picture is sized. `square` centre-crops, for the avatar circle. */
export const IMAGE_PRESETS = {
  avatar: { maxSide: 512, square: true, quality: 0.85 },
  cover: { maxSide: 1920, quality: 0.82 },
  project: { maxSide: 1600, quality: 0.82 },
  preview: { maxSide: 1920, quality: 0.85 },
};

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
 * `{ blob, type, ext }`: WebP where the browser can write it, else JPEG.
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

  const box = fitTo(bitmap.width, bitmap.height, preset);
  const draw = (background) => {
    const canvas = makeCanvas(box.width, box.height);
    const ctx = canvas.getContext('2d');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, box.width, box.height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, box.sx, box.sy, box.sw, box.sh, 0, 0, box.width, box.height);
    return canvas;
  };

  try {
    let blob = await canvasToBlob(draw(null), 'image/webp', preset.quality);
    // A browser that cannot write WebP hands back PNG instead, without saying so.
    // JPEG then — on white, since JPEG has no transparency and would turn it black.
    if (blob.type !== 'image/webp') blob = await canvasToBlob(draw('#FFFFFF'), 'image/jpeg', preset.quality);
    if (!EXTENSIONS[blob.type]) throw new Error('This browser could not prepare the picture for upload.');
    return { blob, type: blob.type, ext: EXTENSIONS[blob.type] };
  } finally {
    bitmap.close?.();
  }
}
