import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import {
  DEFAULT_SIZE,
  MAX_STATIC_SIZE,
  StaticImageError,
  fetchAsDataUrl,
  fovFromPanoramaZoom,
  staticMapUrl,
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
