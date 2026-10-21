/* PLACER — smaller copies of an uploaded picture, for smaller screens.
 *
 * A picture is uploaded at the size it is shown at its largest (lib/imageEncode.js),
 * which is far more than a phone needs for a card. So a picture whose preset asks for
 * it is also uploaded at the narrower widths below, beside it, and the page offers all
 * of them in a srcset for the browser to choose from.
 *
 * Which copies a picture has is in its name, so nothing has to be stored or looked up:
 * a picture uploaded this way ends in '-w<its width>', and has a copy at each of
 * RESPONSIVE_WIDTHS narrower than that, named the same with that width instead:
 *
 *   projects/<id>/image-1729500000000-w1600.webp    the picture
 *   projects/<id>/image-1729500000000-w1080.webp    a copy 1080px wide
 *   projects/<id>/image-1729500000000-w640.webp     and 640px
 *
 * A picture uploaded before this, without '-w' in its name, has no copies and is shown
 * as it is. The media function (supabase/functions/media) knows the same names: a
 * picture's copies are kept and deleted with it.
 */

/** The widths of the copies, narrowest first. */
export const RESPONSIVE_WIDTHS = [640, 1080];

const SIZED = /-w(\d+)\.(webp|jpg|png)$/;

/** The widths a picture `width` wide has copies at. */
export function copyWidths(width) {
  return RESPONSIVE_WIDTHS.filter((each) => each < width);
}

/** The key or address of a picture: `base` with its width and extension on the end. */
export function sizedName(base, width, ext) {
  return `${base}-w${width}.${ext}`;
}

/**
 * The files a picture from encodeImage (lib/imageEncode.js) is uploaded as, under
 * `base` — its key without the extension — in order, as [{ path, blob }]: its copies
 * first, so a page never asks for one that is not there yet, and the picture last.
 * One without copies keeps the plain name it always had.
 */
export function photoUploads(base, { blob, ext, width, copies = [] }) {
  if (copies.length === 0) return [{ path: `${base}.${ext}`, blob }];
  return [
    ...copies.map((copy) => ({ path: sizedName(base, copy.width, ext), blob: copy.blob })),
    { path: sizedName(base, width, ext), blob },
  ];
}

/**
 * The srcset for a picture's address: its copies and itself, by width — or undefined
 * for a picture without copies, which is then shown from its src alone.
 */
export function srcSetFor(url) {
  if (typeof url !== 'string') return undefined;
  const [address, query = ''] = url.split(/(?=\?)/);
  const match = SIZED.exec(address);
  if (!match) return undefined;
  const width = Number(match[1]);
  const widths = copyWidths(width);
  if (widths.length === 0) return undefined;
  const base = address.slice(0, match.index);
  return [...widths.map((each) => `${sizedName(base, each, match[2])}${query} ${each}w`), `${url} ${width}w`].join(', ');
}

/**
 * The attributes for an <img> of a photo bundled with the site, which comes at its
 * full 1600px and an 800px copy beside it (src/assets/*-800.webp), shown `sizes` wide.
 */
export function bundledImage(small, large, sizes) {
  return { src: large, srcSet: `${small} 800w, ${large} 1600w`, sizes, decoding: 'async' };
}

/**
 * The attributes for an <img> of an uploaded picture shown `sizes` wide (a sizes
 * attribute: '(max-width: 640px) 100vw, 400px'), loaded only when it is near the screen.
 * Spread onto the img: <img {...responsiveImage(url, sizes)} alt="" />.
 */
export function responsiveImage(url, sizes, { eager = false } = {}) {
  const srcSet = srcSetFor(url);
  return {
    src: url,
    ...(srcSet ? { srcSet, sizes } : {}),
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
  };
}
