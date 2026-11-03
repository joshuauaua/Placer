/* PLACER — a picture chosen in a form, made small enough to send as text.
 *
 * Decoded, turned the right way up, scaled so its longer side is at most `maxSide`,
 * and encoded afresh as WebP (JPEG where the browser cannot write WebP), as a data URL.
 * Drawing it onto a canvas keeps the pixels and nothing else, so a phone photo's GPS
 * position and camera details never leave the device.
 */

// Past this many pixels a picture is refused before it is drawn: decoding one that big
// takes more memory than a phone browser gives a tab.
const MAX_PIXELS = 50_000_000;

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error ?? new Error('The picture could not be read.'));
  reader.readAsDataURL(blob);
});

const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be prepared.'))), type, quality);
});

/** `file` as a data URL no wider or taller than `maxSide`. Throws with a sentence to show. */
export async function pictureToDataUrl(file, { maxSide = 1600, quality = 0.8 } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file?.name ?? 'That file'} could not be read as a picture. Try a JPEG, PNG or WebP.`);
  }
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) {
      throw new Error(`${file.name} is too large. Try one under 50 megapixels.`);
    }
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let blob = await toBlob(canvas, 'image/webp', quality);
    if (blob.type !== 'image/webp') {
      // JPEG has no transparency, so a transparent PNG goes onto white rather than black.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await toBlob(canvas, 'image/jpeg', quality);
    }
    return await readAsDataUrl(blob);
  } finally {
    bitmap.close?.();
  }
}
