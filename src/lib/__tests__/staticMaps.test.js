import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import {
  DEFAULT_SIZE,
  MAX_STATIC_SIZE,
  MAX_STATIC_URL_LENGTH,
  StaticImageError,
  encodePolyline,
  fetchAsDataUrl,
  fovFromPanoramaZoom,
  staticMapUrl,
  streetViewBackgroundTiles,
  streetViewStaticUrl,
} from '../staticMaps';

const KEY = 'test-key';
const LOCATION = { lat: 55.6054, lng: 12.9854 };

// Parse a built URL into an easily-asserted params object.
function paramsOf(url) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

describe('fovFromPanoramaZoom', () => {
  it('maps panorama zoom 1 to the API default 90 degree field of view', () => {
    expect(fovFromPanoramaZoom(1)).toBe(90);
  });

  it('halves the field of view for each zoom step', () => {
    expect(fovFromPanoramaZoom(2)).toBe(45);
    expect(fovFromPanoramaZoom(3)).toBe(22.5);
  });

  it('clamps to the documented 120 degree maximum when zoomed all the way out', () => {
    // Zoom 0 would compute to 180, above what the API accepts.
    expect(fovFromPanoramaZoom(0)).toBe(120);
  });

  it('clamps deep zoom to a 10 degree floor', () => {
    expect(fovFromPanoramaZoom(20)).toBe(10);
  });

  it('falls back to 90 degrees when zoom is not a number', () => {
    expect(fovFromPanoramaZoom(undefined)).toBe(90);
    expect(fovFromPanoramaZoom(NaN)).toBe(90);
  });
});

describe('streetViewStaticUrl', () => {
  it('targets the Street View Static endpoint with location, pov and key', () => {
    const url = streetViewStaticUrl({
      apiKey: KEY,
      location: LOCATION,
      heading: 151.78,
      pitch: -0.76,
      fov: 90,
    });

    expect(url.startsWith('https://maps.googleapis.com/maps/api/streetview?')).toBe(true);
    expect(paramsOf(url)).toMatchObject({
      location: '55.6054,12.9854',
      heading: '151.78',
      pitch: '-0.76',
      fov: '90',
      key: KEY,
    });
  });

  it('always sets return_error_code so missing coverage 404s instead of returning a gray tile', () => {
    const url = streetViewStaticUrl({ apiKey: KEY, location: LOCATION });
    expect(paramsOf(url).return_error_code).toBe('true');
  });

  it('omits heading when none is available, letting Google aim at the location', () => {
    const url = streetViewStaticUrl({ apiKey: KEY, location: LOCATION, heading: NaN });
    expect(paramsOf(url).heading).toBeUndefined();
  });

  it('defaults to a size matching the 1000x700 canvas aspect ratio', () => {
    const url = streetViewStaticUrl({ apiKey: KEY, location: LOCATION });
    expect(paramsOf(url).size).toBe('640x448');
    expect(DEFAULT_SIZE.width / DEFAULT_SIZE.height).toBeCloseTo(1000 / 700, 5);
  });

  it('clamps oversized requests to 640px while preserving aspect ratio', () => {
    // The API silently returns a square 640x640 for oversized requests rather
    // than honouring the aspect ratio, so clamping has to happen here.
    const url = streetViewStaticUrl({
      apiKey: KEY,
      location: LOCATION,
      size: { width: 2000, height: 1400 },
    });
    expect(paramsOf(url).size).toBe(`${MAX_STATIC_SIZE}x448`);
  });

  it('clamps fov to the documented maximum and pitch to vertical limits', () => {
    const url = streetViewStaticUrl({
      apiKey: KEY,
      location: LOCATION,
      fov: 500,
      pitch: 400,
    });
    const params = paramsOf(url);
    expect(params.fov).toBe('120');
    expect(params.pitch).toBe('90');
  });
});

describe('staticMapUrl', () => {
  it('targets the Maps Static endpoint centred on the given position', () => {
    const url = staticMapUrl({ apiKey: KEY, center: LOCATION, zoom: 18 });

    expect(url.startsWith('https://maps.googleapis.com/maps/api/staticmap?')).toBe(true);
    expect(paramsOf(url)).toMatchObject({
      center: '55.6054,12.9854',
      zoom: '18',
      size: '640x448',
      key: KEY,
    });
  });

  it('defaults to roadmap, since satellite and hybrid are refused under EEA terms', () => {
    const url = staticMapUrl({ apiKey: KEY, center: LOCATION });
    expect(paramsOf(url).maptype).toBe('roadmap');
  });

  it('asks for double-density pixels, which this endpoint supports and Street View does not', () => {
    // 640x448 at scale 2 is delivered as 1280x896, enough to fill the 1000x700
    // stage without upscaling, and still billed as one request.
    expect(paramsOf(staticMapUrl({ apiKey: KEY, center: LOCATION })).scale).toBe('2');
  });

  it('clamps scale to what the API accepts', () => {
    expect(paramsOf(staticMapUrl({ apiKey: KEY, center: LOCATION, scale: 4 })).scale).toBe('2');
    expect(paramsOf(staticMapUrl({ apiKey: KEY, center: LOCATION, scale: 0 })).scale).toBe('1');
  });

  it('still accepts scale 1 for callers that want the smaller payload', () => {
    expect(paramsOf(staticMapUrl({ apiKey: KEY, center: LOCATION, scale: 1 })).scale).toBe('1');
  });

  it('draws a filled polygon per path and lets Google fit the viewport, given paths instead of center/zoom', () => {
    const shapes = [{ path: [{ lat: 1, lng: 2 }, { lat: 1, lng: 3 }, { lat: 2, lng: 3 }] }];
    const url = staticMapUrl({ apiKey: KEY, paths: shapes, pathColor: '#2f91a2' });

    const params = new URL(url).searchParams;
    expect(params.getAll('path')).toEqual([
      `color:0x2f91a2ff|weight:2|fillcolor:0x2f91a240|enc:${encodePolyline(shapes[0].path)}`,
    ]);
    expect(params.has('center')).toBe(false);
    expect(params.has('zoom')).toBe(false);
  });

  it('draws one path per shape, in order', () => {
    const shapes = [
      { path: [{ lat: 1, lng: 2 }, { lat: 1, lng: 3 }, { lat: 2, lng: 3 }] },
      { path: [{ lat: 5, lng: 6 }, { lat: 5, lng: 7 }, { lat: 6, lng: 7 }] },
    ];
    const url = staticMapUrl({ apiKey: KEY, paths: shapes });

    expect(new URL(url).searchParams.getAll('path')).toHaveLength(2);
  });

  it('skips a shape with no points rather than emitting an empty path', () => {
    const url = staticMapUrl({ apiKey: KEY, paths: [{ path: [] }] });
    expect(new URL(url).searchParams.getAll('path')).toHaveLength(0);
  });

  it('thins a long outline until the URL fits under the length Google accepts', () => {
    // A traced outline of a few thousand points, which as raw pairs would run far
    // past the cap.
    const path = Array.from({ length: 4000 }, (_, i) => ({
      lat: 55.6 + 0.01 * Math.sin(i / 50),
      lng: 12.98 + 0.01 * Math.cos(i / 37),
    }));
    const url = staticMapUrl({ apiKey: KEY, paths: [{ path }] });

    expect(url.length).toBeLessThanOrEqual(MAX_STATIC_URL_LENGTH);
    expect(new URL(url).searchParams.getAll('path')).toHaveLength(1);
  });
});

describe('encodePolyline', () => {
  it("matches the worked example in Google's polyline algorithm docs", () => {
    const points = [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }];
    expect(encodePolyline(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });
});

describe('streetViewBackgroundTiles', () => {
  const view = { apiKey: KEY, location: LOCATION, heading: 90, pitch: 0, fov: 90 };

  it('covers the frame in a grid, one request per tile', () => {
    const tiles = streetViewBackgroundTiles({ ...view, cols: 2, rows: 2 });
    expect(tiles).toHaveLength(4);
    for (const { url } of tiles) {
      expect(paramsOf(url).size).toBe(`${MAX_STATIC_SIZE}x${MAX_STATIC_SIZE}`);
    }
  });

  it('asks each tile for a narrower FOV than the wide shot — the whole point', () => {
    const [{ url }] = streetViewBackgroundTiles({ ...view, cols: 2, rows: 2 });
    expect(Number(paramsOf(url).fov)).toBeLessThan(view.fov);
  });

  it('spreads the tiles either side of the requested heading', () => {
    const headings = streetViewBackgroundTiles({ ...view, cols: 2, rows: 1 })
      .map(({ url }) => Number(paramsOf(url).heading));
    expect(headings).toHaveLength(2);
    expect(headings[0]).toBeLessThan(90);
    expect(headings[1]).toBeGreaterThan(90);
  });

  it('wraps headings past north into the 0-360 range the API accepts', () => {
    const headings = streetViewBackgroundTiles({ ...view, heading: 10, cols: 2, rows: 1 })
      .map(({ url }) => Number(paramsOf(url).heading));
    for (const heading of headings) {
      expect(heading).toBeGreaterThanOrEqual(0);
      expect(heading).toBeLessThan(360);
    }
    // -12.5 rather than 347.5 would be rejected.
    expect(headings[0]).toBeCloseTo(347.5, 4);
  });

  it('aims the rows above and below the horizon, unlike the road-band row', () => {
    const pitches = streetViewBackgroundTiles({ ...view, cols: 1, rows: 2 })
      .map(({ url }) => Number(paramsOf(url).pitch));
    expect(pitches[0]).toBeGreaterThan(0);
    expect(pitches[1]).toBeLessThan(0);
  });

  it('returns the tile descriptor the stitcher needs alongside each URL', () => {
    const [first] = streetViewBackgroundTiles({ ...view, cols: 2, rows: 2 });
    expect(first.tile).toMatchObject({
      width: MAX_STATIC_SIZE,
      height: MAX_STATIC_SIZE,
    });
    expect(Number.isFinite(first.tile.headingOffset)).toBe(true);
    expect(Number.isFinite(first.tile.pitchOffset)).toBe(true);
  });
});

describe('fetchAsDataUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a successful response to a data URL', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['pixels'], { type: 'image/jpeg' })),
    })));

    const result = await fetchAsDataUrl('https://example.test/image.jpg');

    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('throws a StaticImageError carrying the status so callers can detect a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })));

    await expect(fetchAsDataUrl('https://example.test/missing.jpg'))
      .rejects.toBeInstanceOf(StaticImageError);

    await expect(fetchAsDataUrl('https://example.test/missing.jpg'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('surfaces a 403 distinctly from a 404, so a bad key is not read as missing coverage', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 403 })));

    await expect(fetchAsDataUrl('https://example.test/forbidden.jpg'))
      .rejects.toMatchObject({ status: 403 });
  });
});
