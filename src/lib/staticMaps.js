// Server-rendered map imagery via Google's Static APIs.
//
// The browser cannot screenshot a Street View panorama: Google renders it into a
// WebGL canvas over cross-origin tiles, and html-to-image (which rasterizes a DOM
// clone through an SVG <foreignObject>) carries neither across — it yields a black
// frame with only Google's DOM controls on top. Asking Google's servers for the
// image instead is the only reliable route from a static front end.

import { planGridTiles, planTiles } from './panoGeometry.js'

const STREET_VIEW_ENDPOINT = 'https://maps.googleapis.com/maps/api/streetview'
const STATIC_MAP_ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap'

// Both Static APIs cap output at 640px per side, and the Street View endpoint has
// no `scale` parameter to work around it. Oversized requests are not clamped to
// the requested aspect ratio — they come back square (a 1024x717 request returns
// 640x640), so callers must clamp before sending or the background arrives
// distorted.
export const MAX_STATIC_SIZE = 640

// The Konva stage in StreetScreen is 1000x700, so 640x448 fills it without
// stretching while staying inside the cap. It does not *fill* it at native
// resolution — 640 stretched to 1000 is visibly soft — which is what the
// scale parameter below and streetViewBackgroundTiles are for.
export const DEFAULT_SIZE = { width: 640, height: 448 }

// The Maps Static API accepts scale=1 or 2, where 2 "returns twice as many
// pixels while retaining the same coverage area and level of detail" — so a
// 640x448 request comes back 1280x896, enough to fill the stage natively. It
// counts as one request either way. The Street View endpoint has no equivalent,
// which is why higher resolution there needs tiling instead.
export const MAX_MAP_SCALE = 2

// Documented ceiling for the Street View `fov` parameter; the floor is ours, to
// keep an extreme panorama zoom from asking for a degenerate sliver.
const MAX_FOV = 120
const MIN_FOV = 10

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// Scale a size down to fit MAX_STATIC_SIZE, preserving aspect ratio.
function clampSize({ width, height }) {
  const factor = MAX_STATIC_SIZE / Math.max(width, height)
  if (factor >= 1) return { width: Math.round(width), height: Math.round(height) }
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  }
}

// A StreetViewPanorama's zoom is logarithmic: each step halves the visible arc,
// with zoom 1 corresponding to the API's default 90-degree field of view.
export function fovFromPanoramaZoom(zoom) {
  const z = Number.isFinite(zoom) ? zoom : 1
  return clamp(180 / 2 ** z, MIN_FOV, MAX_FOV)
}

export function streetViewStaticUrl({
  apiKey,
  location,
  heading,
  pitch = 0,
  fov = 90,
  size = DEFAULT_SIZE,
}) {
  const { width, height } = clampSize(size)
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${location.lat},${location.lng}`,
    pitch: String(clamp(pitch, -90, 90)),
    fov: String(clamp(fov, MIN_FOV, MAX_FOV)),
    // Without this Google answers a location it has no imagery for with a gray
    // "no image" tile and HTTP 200, which would silently become the canvas
    // background. With it we get a 404 we can branch on.
    return_error_code: 'true',
    key: apiKey,
  })
  // Omitting heading lets Google aim the camera at the location itself, which is
  // the sensible default when the panorama has not reported a direction yet.
  if (Number.isFinite(heading)) params.set('heading', String(heading))
  return `${STREET_VIEW_ENDPOINT}?${params.toString()}`
}

// fillcolor:0x...NN closes a path into a filled polygon (rather than an open
// line), matching what LocationMapPicker draws live while editing.
const PATH_FILL_ALPHA = '40'

// Google refuses a Maps Static URL longer than this with a 4xx, and the project
// page's <img> then shows nothing. An outline traced point by point can pass it.
export const MAX_STATIC_URL_LENGTH = 16384

// Google's encoded polyline format: each coordinate as a delta from the one
// before, at 1e-5 degrees, in base-64 chunks. About a quarter of the length of
// "lat,lng|" pairs, so a long outline stays well under the URL cap.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function encodeValue(value) {
  let v = value < 0 ? ~(value << 1) : value << 1
  let out = ''
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
    v >>= 5
  }
  return out + String.fromCharCode(v + 63)
}

export function encodePolyline(points) {
  let lastLat = 0
  let lastLng = 0
  let out = ''
  for (const { lat, lng } of points) {
    const e5Lat = Math.round(lat * 1e5)
    const e5Lng = Math.round(lng * 1e5)
    out += encodeValue(e5Lat - lastLat) + encodeValue(e5Lng - lastLng)
    lastLat = e5Lat
    lastLng = e5Lng
  }
  return out
}

// Every `step`th point of each outline, dropping any that fall below a polygon.
function samplePaths(paths, step) {
  return paths
    .map((shape) => (shape?.path ?? []).filter((_, i) => i % step === 0))
    .filter((points) => points.length >= 3)
}

export function staticMapUrl({
  apiKey,
  center,
  zoom = 18,
  // Deliberately not 'satellite': satellite and hybrid are refused with a 403
  // ("not available for your account and region") under Google's EEA terms for
  // the Maps Static API, which covers this project's account. roadmap and
  // terrain are the types that actually serve.
  maptype = 'roadmap',
  size = DEFAULT_SIZE,
  scale = MAX_MAP_SCALE,
  // A project's drawn location outline (locationShapes: [{ path: [{lat,lng},...] }]).
  // Given instead of center/zoom, Google fits the viewport to the shapes itself, the
  // same auto-fit ProjectSetupPage's live map gets for free from google.maps.Map —
  // there is no bounds math to duplicate here.
  paths,
  pathColor = '1D5FA8',
}) {
  const { width, height } = clampSize(size)
  const base = {
    size: `${width}x${height}`,
    // Requested in CSS-ish pixels: `size` stays inside the 640 cap and scale
    // multiplies the pixels delivered, so this is 1280x896 of image describing
    // the same 640x448 of map.
    scale: String(clamp(Math.round(scale), 1, MAX_MAP_SCALE)),
    maptype,
    key: apiKey,
  }

  if (!paths?.length) {
    const params = new URLSearchParams(base)
    params.set('center', `${center.lat},${center.lng}`)
    params.set('zoom', String(zoom))
    return `${STATIC_MAP_ENDPOINT}?${params.toString()}`
  }

  const color = pathColor.replace('#', '').toLowerCase()
  const style = `color:0x${color}ff|weight:2|fillcolor:0x${color}${PATH_FILL_ALPHA}`
  const longest = Math.max(...paths.map((shape) => shape?.path?.length ?? 0))

  // Thin the outlines until the URL fits. A thinned outline is a coarser shape
  // in the same place, which is better than no image at all.
  const build = (step) => {
    const params = new URLSearchParams(base)
    for (const points of samplePaths(paths, step)) {
      params.append('path', `${style}|enc:${encodePolyline(points)}`)
    }
    return `${STATIC_MAP_ENDPOINT}?${params.toString()}`
  }
  let step = 1
  let url = build(step)
  while (url.length > MAX_STATIC_URL_LENGTH && step < longest) {
    step += 1
    url = build(step)
  }
  return url
}

// Street View headings wrap at 360.
const wrapHeading = (deg) => ((deg % 360) + 360) % 360

/**
 * Build a row of higher-resolution tiles covering the same view as a single wide
 * capture.
 *
 * The 640px cap is per request, so several narrower tiles resolve the same scene
 * more finely — roughly 1.8x horizontally and 2x vertically at the defaults. See
 * src/lib/panoGeometry.js for the geometry and why the tiles must be square.
 *
 * @returns array of { url, tile } where tile is the geometry descriptor
 *          projectTileSegment needs to map detections back into the wide frame
 */
export function streetViewTileUrls({
  apiKey,
  location,
  heading,
  pitch = 0,
  fov = 90,
  tiles = 2,
  overlapDeg = 6,
  // Omit to aim the row at the middle of the wide view's road region, derived
  // from wideSize and skyFraction rather than assumed.
  pitchOffset,
  wideSize = DEFAULT_SIZE,
  skyFraction = 0.42,
  size = MAX_STATIC_SIZE,
}) {
  const plan = planTiles({
    fov,
    tiles,
    overlapDeg,
    pitchOffset,
    wide: { width: wideSize.width, height: wideSize.height, fov },
    skyFraction,
    size,
  });
  const baseHeading = Number.isFinite(heading) ? heading : 0;

  return plan.map((tile) => ({
    tile,
    url: streetViewStaticUrl({
      apiKey,
      location,
      heading: wrapHeading(baseHeading + tile.headingOffset),
      pitch: pitch + tile.pitchOffset,
      fov: tile.fov,
      size: { width: tile.width, height: tile.height },
    }),
  }));
}

/**
 * Build a grid of tiles covering the whole of a wide view, for stitching back
 * into one sharper background image.
 *
 * streetViewTileUrls above covers the road band only, which is all detection
 * reads. A background has to cover the sky too, so this walks both axes — at the
 * defaults, four requests resolving the scene ~1.8x more finely than the single
 * wide shot. See src/lib/panoStitch.js for the recombination.
 *
 * @returns array of { url, tile }, where tile is the descriptor stitchPanoTiles
 *          needs to place that image in the wide frame
 */
export function streetViewBackgroundTiles({
  apiKey,
  location,
  heading,
  pitch = 0,
  fov = 90,
  cols = 2,
  rows = 2,
  overlapDeg = 6,
  wideSize = DEFAULT_SIZE,
  size = MAX_STATIC_SIZE,
}) {
  const plan = planGridTiles({
    fov,
    cols,
    rows,
    overlapDeg,
    wide: { width: wideSize.width, height: wideSize.height, fov },
    size,
  });
  const baseHeading = Number.isFinite(heading) ? heading : 0;

  return plan.map((tile) => ({
    tile,
    url: streetViewStaticUrl({
      apiKey,
      location,
      heading: wrapHeading(baseHeading + tile.headingOffset),
      pitch: pitch + tile.pitchOffset,
      fov: tile.fov,
      size: { width: tile.width, height: tile.height },
    }),
  }));
}

export class StaticImageError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'StaticImageError'
    this.status = status
  }
}

// Fetch a static image and inline it as a data: URL.
//
// Both endpoints answer with `access-control-allow-origin: *`, so this works
// cross-origin. Inlining (rather than handing the URL straight to <img>) keeps
// the captured payload self-contained and leaves the Konva stage untainted, so a
// later stage.toDataURL() export stays possible. A non-ok response throws a
// StaticImageError carrying the status so callers can distinguish "no coverage
// here" (404) from a misconfigured key (403).
export async function fetchAsDataUrl(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new StaticImageError(
      `Static image request failed with ${response.status}`,
      response.status,
    )
  }
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new StaticImageError('Could not read image data'))
    reader.readAsDataURL(blob)
  })
}
