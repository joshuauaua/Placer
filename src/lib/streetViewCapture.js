// A Street View panorama's current view, as an image: the imagine map's capture, and a
// project's Idea Visualizer setup (ConfigureToolDialog) both take their photo this way.
//
// The browser cannot screenshot the panorama itself (see staticMaps.js), so the view is
// asked of Google's servers: as a grid of narrow tiles stitched into one frame sharper
// than the 640px cap allows, when that is worth the extra requests, and otherwise as
// one wide image.

import {
  DEFAULT_SIZE, fetchAsDataUrl, fovFromPanoramaZoom, streetViewBackgroundTiles, streetViewStaticUrl,
} from './staticMaps';
import { tilingGain } from './panoGeometry';

// Below this resolution gain, tiling is not worth its extra requests: the gain
// comes from spending a whole 640px tile on a slice of the view, so it shrinks as
// the panorama zooms in and the wide shot is already spending its own 640px on a
// narrow arc. At two columns this bows out somewhere around fov 30.
const MIN_TILING_GAIN = 1.25;

// Ceiling on the stitched output, independent of the gain. Composing runs one
// inverse projection per output pixel, and past the 1000x700 stage the extra
// pixels cost time for detail nothing displays.
const MAX_TILING_SCALE = 2;

/**
 * A live StreetViewPanorama's view — { position, heading, pitch, zoom, fov } — or null
 * when it is not showing. `fallback` stands in for its position until it settles on a
 * photo, when getPosition() is still null.
 */
export function readPanoramaView(panorama, fallback = null) {
  if (!panorama?.getVisible?.()) return null;
  const position = panorama.getPosition?.();
  const pov = panorama.getPov?.() || {};
  const zoom = panorama.getZoom?.();
  return {
    position: position ? { lat: position.lat(), lng: position.lng() } : fallback,
    heading: Number(pov.heading),
    pitch: Number(pov.pitch) || 0,
    zoom,
    fov: fovFromPanoramaZoom(zoom),
  };
}

// The view as stitched tiles, or null when tiling is not worth its extra requests or
// composing them failed, leaving the caller on the single wide request.
//
// Fetch failures are not caught here on purpose. A 404 means the spot has no coverage;
// anything else — a rejected key, a network fault — would meet the single wide request
// in exactly the same way, so retrying it just spends another request to learn the
// same thing.
async function captureTiled(apiKey, view) {
  const wide = { width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height, fov: view.fov };
  const sources = streetViewBackgroundTiles({
    apiKey,
    location: view.position,
    heading: view.heading,
    pitch: view.pitch,
    fov: view.fov,
    wideSize: DEFAULT_SIZE,
  });
  const tiles = sources.map(({ tile }) => tile);
  const gain = tilingGain(tiles, wide);
  if (gain < MIN_TILING_GAIN) return null;

  const images = await Promise.all(sources.map(({ url }) => fetchAsDataUrl(url)));

  try {
    const { stitchPanoTiles } = await import('./panoStitch');
    return await stitchPanoTiles({ images, tiles, wide, scale: Math.min(gain, MAX_TILING_SCALE) });
  } catch (error) {
    // Composing is all that can still fail with the images already in hand, and a
    // wide capture does not depend on it — so that one is worth a try.
    console.warn('Could not stitch the tiled capture — falling back to one wide image', error);
    return null;
  }
}

/**
 * The view as a data: URL. Throws a StaticImageError with status 404 where the spot
 * has no Street View coverage (return_error_code=true in streetViewStaticUrl makes
 * Google send that instead of a gray placeholder), for the caller to fall back on.
 */
export async function captureStreetView(apiKey, view) {
  const stitched = await captureTiled(apiKey, view);
  if (stitched) return stitched;
  return fetchAsDataUrl(streetViewStaticUrl({
    apiKey,
    location: view.position,
    heading: view.heading,
    pitch: view.pitch,
    fov: view.fov,
  }));
}
