// Stitch a grid of Street View tiles into one higher-resolution wide frame.
//
// The Street View Static API caps every image at 640px per side and, unlike the
// Maps Static API, has no `scale` parameter — so the only route to a sharper
// background is several narrow-FOV tiles covering the same view (see
// planGridTiles) recombined here.
//
// Tiles and the wide frame are rectilinear views from one optical centre,
// differing only in orientation, which makes tile -> wide an exact homography.
// Canvas 2D applies affine transforms only, and an affine approximation of a
// homography misaligns the seams, so the composite is built by inverse mapping
// instead: every output pixel asks which tile sees its direction
// (unprojectWidePoint) and samples that tile bilinearly.
//
// Where tiles overlap, a pixel takes the one whose centre it sits nearest in
// tile-normalised coordinates — a hard boundary, not a blend. Blending two views
// of the same scene softens exactly the detail these extra requests were paid
// for, and since both tiles resolve the seam equally well there is nothing to
// gain from mixing them.

import { projectTilePoint, unprojectWidePoint } from './panoGeometry.js';

// Samples per tile edge when working out which part of the output a tile covers.
// The edges bow under projection, so corners alone would clip the bulge.
const EDGE_SAMPLES = 8;

/**
 * Bilinear sample from an RGBA buffer, written into dest at destOffset.
 *
 * Coordinates are in pixel-centre convention (the centre of the top-left pixel
 * is 0.5, 0.5), matching what unprojectWidePoint returns. Reads clamp at the
 * edges rather than wrapping, so a sample landing fractionally outside a tile
 * repeats its border instead of pulling in the opposite side.
 */
function sampleBilinear(source, x, y, dest, destOffset) {
  const { width, height, data } = source;
  if (!width || !height) return false;

  const fx = Math.min(Math.max(x - 0.5, 0), width - 1);
  const fy = Math.min(Math.max(y - 0.5, 0), height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  for (let c = 0; c < 3; c += 1) {
    const top = data[i00 + c] * (1 - tx) + data[i10 + c] * tx;
    const bottom = data[i01 + c] * (1 - tx) + data[i11 + c] * tx;
    dest[destOffset + c] = top * (1 - ty) + bottom * ty;
  }
  dest[destOffset + 3] = 255;
  return true;
}

/**
 * Output-pixel bounding box a tile can reach, so each tile only walks its own
 * region instead of the whole frame. Falls back to the full frame when any edge
 * sample projects behind the camera, which is the safe answer — slower, never
 * wrong.
 */
function outputBounds(tile, wide, out) {
  const scaleX = out.width / wide.width;
  const scaleY = out.height / wide.height;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i <= EDGE_SAMPLES; i += 1) {
    const t = i / EDGE_SAMPLES;
    const edges = [
      { x: t * tile.width, y: 0 },
      { x: t * tile.width, y: tile.height },
      { x: 0, y: t * tile.height },
      { x: tile.width, y: t * tile.height },
    ];
    for (const point of edges) {
      const p = projectTilePoint(point, tile, wide);
      if (!p) {
        return { x0: 0, y0: 0, x1: out.width - 1, y1: out.height - 1 };
      }
      minX = Math.min(minX, p.x * scaleX);
      maxX = Math.max(maxX, p.x * scaleX);
      minY = Math.min(minY, p.y * scaleY);
      maxY = Math.max(maxY, p.y * scaleY);
    }
  }

  const x0 = Math.max(0, Math.floor(minX) - 1);
  const y0 = Math.max(0, Math.floor(minY) - 1);
  const x1 = Math.min(out.width - 1, Math.ceil(maxX) + 1);
  const y1 = Math.min(out.height - 1, Math.ceil(maxY) + 1);
  if (x1 < x0 || y1 < y0) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Composite tiles into an output buffer. Pure: no canvas, no DOM.
 *
 * @param options.tiles   tile descriptors from planGridTiles
 * @param options.sources parallel array of {width, height, data} RGBA buffers
 * @param options.wide    {width, height, fov} frame the tiles were planned for
 * @param options.out     {width, height, data} RGBA buffer to write, whose
 *                        dimensions set the resolution gain over `wide`
 * @returns {filled, total} pixel counts, so callers can reject a composite that
 *          came out full of holes rather than show a part-drawn background
 */
export function composeTiles({ tiles, sources, wide, out }) {
  const scaleX = out.width / wide.width;
  const scaleY = out.height / wide.height;
  const total = out.width * out.height;
  // Nearest-centre wins, so each pixel remembers the best claim so far.
  const claim = new Float32Array(total).fill(Infinity);
  let filled = 0;

  tiles.forEach((tile, index) => {
    const source = sources[index];
    if (!source || !source.width || !source.height) return;
    const box = outputBounds(tile, wide, out);
    if (!box) return;

    for (let oy = box.y0; oy <= box.y1; oy += 1) {
      const wy = (oy + 0.5) / scaleY;
      for (let ox = box.x0; ox <= box.x1; ox += 1) {
        const wx = (ox + 0.5) / scaleX;
        const p = unprojectWidePoint({ x: wx, y: wy }, tile, wide);
        if (!p) continue;

        // Distance from the tile centre, normalised so 1 is its edge on either
        // axis. Above 1 the direction is outside this tile altogether.
        const dx = Math.abs(p.x - tile.width / 2) / (tile.width / 2);
        const dy = Math.abs(p.y - tile.height / 2) / (tile.height / 2);
        const distance = Math.max(dx, dy);
        if (distance > 1) continue;

        const pixel = oy * out.width + ox;
        if (distance >= claim[pixel]) continue;
        if (!sampleBilinear(source, p.x, p.y, out.data, pixel * 4)) continue;
        if (claim[pixel] === Infinity) filled += 1;
        claim[pixel] = distance;
      }
    }
  });

  return { filled, total };
}

// Decoding a data URL into pixels needs a real Image; jsdom has neither that nor
// a canvas, which is why every DOM touch in this module lives below this line and
// composeTiles above it stays testable.

// An <img> that neither loads nor errors leaves its promise pending forever, and
// the capture button stays stuck on "Capturing view" with no way out. Rejecting
// on a deadline turns that into an ordinary fallback to the single wide image.
const DECODE_TIMEOUT_MS = 10000;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(
      () => reject(new Error('Timed out decoding a Street View tile')),
      DECODE_TIMEOUT_MS,
    );
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Could not decode a Street View tile'));
    };
    image.src = src;
  });
}

function readPixels(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  // Tiles arrive as data: URLs precisely so this read is allowed — a canvas fed
  // a cross-origin URL is tainted and getImageData on it throws. See
  // fetchAsDataUrl in src/lib/staticMaps.js.
  return ctx.getImageData(0, 0, width, height);
}

// Below this share of the frame covered, treat the composite as failed and let
// the caller fall back to the single wide capture. A few missing pixels along an
// edge are invisible; a missing tile is not.
const MIN_COVERAGE = 0.98;

/**
 * Fetch-free entry point: turn already-downloaded tile images into one wide
 * data URL.
 *
 * @param options.images  data URLs, parallel to options.tiles
 * @param options.tiles   tile descriptors from planGridTiles
 * @param options.wide    {width, height, fov} the tiles were planned for
 * @param options.scale   output size relative to `wide` — pass the tilingGain so
 *                        the output holds the detail the tiles actually carry,
 *                        no more
 * @returns a data URL, or null if the tiles did not cover the frame
 */
export async function stitchPanoTiles({
  images,
  tiles,
  wide,
  scale = 1,
  mimeType = 'image/jpeg',
  quality = 0.88,
}) {
  const decoded = await Promise.all(images.map(loadImage));
  const sources = decoded.map(readPixels);

  const width = Math.round(wide.width * scale);
  const height = Math.round(wide.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(width, height);

  const { filled, total } = composeTiles({
    tiles,
    sources,
    wide,
    out: { width, height, data: out.data },
  });
  if (filled / total < MIN_COVERAGE) return null;

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL(mimeType, quality);
}
