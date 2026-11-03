import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { captureSize, captureStreetView } from '../streetViewCapture';

vi.mock('../panoStitch', () => ({ stitchPanoTiles: vi.fn(() => Promise.resolve(null)) }));

const VIEW = { position: { lat: 55.6, lng: 12.98 }, heading: 90, pitch: 0, zoom: 1, fov: 90 };

function stubFetch() {
  const fetchMock = vi.fn(() => Promise.resolve({
    ok: true, status: 200, blob: () => Promise.resolve(new Blob(['pixels'], { type: 'image/jpeg' })),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sizesAsked = (fetchMock) => fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get('size'));

describe('captureSize', () => {
  it('takes the shape it is given, at 640 pixels on its longer side', () => {
    expect(captureSize(16 / 9)).toEqual({ width: 640, height: 360 });
    expect(captureSize(3 / 4)).toEqual({ width: 480, height: 640 });
  });

  it('keeps to 10:7, the stage\'s old shape, without one', () => {
    expect(captureSize(undefined)).toEqual({ width: 640, height: 448 });
    expect(captureSize(0)).toEqual({ width: 640, height: 448 });
  });

  it('keeps an extreme shape within bounds', () => {
    expect(captureSize(10)).toEqual({ width: 640, height: 256 });
    expect(captureSize(0.1)).toEqual({ width: 320, height: 640 });
  });
});

describe('captureStreetView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the view in the shape it was on screen, so nothing is stretched or cut', async () => {
    const fetchMock = stubFetch();

    await captureStreetView('key', VIEW, { aspect: 1440 / 810 });

    // The last request is the single wide image, after the tiles could not be stitched.
    expect(sizesAsked(fetchMock).at(-1)).toBe('640x360');
  });

  it('asks for 10:7 when the shape is not known', async () => {
    const fetchMock = stubFetch();

    await captureStreetView('key', VIEW);

    expect(sizesAsked(fetchMock).at(-1)).toBe('640x448');
  });
});
