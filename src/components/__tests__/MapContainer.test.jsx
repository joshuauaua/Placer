import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import MapContainer from '../MapContainer';
import { stitchPanoTiles } from '../../lib/panoStitch';
import { encodeImage } from '../../lib/imageEncode';
import { resetGoogleMapsLoaderForTests } from '../../lib/googleMaps';
import { clickMap, lastMap, maps } from '../../test/maplibreStub';
import { photonFeature, stubPhoton } from '../../test/photon';

// What the stand-in map's canvas reads back as: a capture of the map itself, which
// is never taken as the photo.
const MAP_IMAGE = 'data:image/png;base64,MAP';
// The mocked encodeImage's blob, read back as a data URL.
const UPLOADED = `data:image/webp;base64,${btoa('photo')}`;

const streetViewButton = () => screen.getByRole('button', { name: 'Street View' });
const takePhotoButton = () => screen.getByRole('button', { name: 'Take this photo' });
const uploadPhoto = (file = new File(['raw'], 'corner.jpg', { type: 'image/jpeg' })) =>
  fireEvent.change(screen.getByTestId('upload-photo'), { target: { files: [file] } });

// Stitching is real canvas work, which jsdom has no 2D context for. Mocked so
// these tests can pin the request routing either side of it: a resolved value
// stands for a composed frame, null for one that could not be composed.
const STITCHED = 'data:image/jpeg;base64,mockStitched';
// Re-encoding is canvas work too. An uploaded photo comes back as this blob.
vi.mock('../../lib/imageEncode', () => ({
  IMAGE_PRESETS: { scene: { maxSide: 1600, quality: 0.82 } },
  encodeImage: vi.fn(() => Promise.resolve({ blob: new Blob(['photo'], { type: 'image/webp' }) })),
}));

vi.mock('../../lib/panoStitch', () => ({
  stitchPanoTiles: vi.fn(() => Promise.resolve(STITCHED)),
}));

// A StreetViewPanorama stub. Defaults to hidden, the way the panorama starts out over
// the map, so the map capture path is the default in every test.
function mockPanorama({
  visible = false,
  position = { lat: 55.6, lng: 12.98 },
  pov = { heading: 0, pitch: 0 },
  zoom = 1,
} = {}) {
  const listeners = {};
  const panorama = {
    getVisible: vi.fn(() => visible),
    getPosition: vi.fn(() =>
      position && {
        lat: () => position.lat,
        lng: () => position.lng,
      }
    ),
    getPov: vi.fn(() => pov),
    getZoom: vi.fn(() => zoom),
    setPano: vi.fn(),
    setPov: vi.fn(),
    setZoom: vi.fn(),
    setVisible: vi.fn((next) => {
      visible = next;
      listeners.visible_changed?.();
    }),
    addListener: vi.fn((event, handler) => { listeners[event] = handler; }),
  };
  return panorama;
}

// Google, as far as Street View needs it. `coverage` is what StreetViewService answers
// for the nearest photo: a pano id, or null for none nearby.
function mockGoogleMaps({ panorama = mockPanorama(), coverage = 'pano-1' } = {}) {
  return {
    maps: {
      StreetViewPanorama: vi.fn(function () { return panorama; }),
      StreetViewService: vi.fn(function () {
        return {
          getPanorama: vi.fn((request, callback) => callback(
            coverage ? { location: { pano: coverage } } : null,
            coverage ? 'OK' : 'ZERO_RESULTS',
          )),
        };
      }),
      StreetViewPreference: { NEAREST: 'nearest' },
      StreetViewSource: { OUTDOOR: 'outdoor' },
    },
  };
}

// Markers that can be clicked. The spot chosen for Street View is a marker too, but not
// one to click, and nothing else on this map is a marker any more.
const pins = () => (lastMap()?.markers ?? []).filter((marker) => marker.getElement().getAttribute('role') === 'button');

describe('MapContainer', () => {
  afterEach(() => {
    cleanup();
    delete window.google;
    // The script-loading promise is cached at module scope (see src/lib/googleMaps.js) so
    // that two components sharing one Maps session never inject the script twice — but that
    // means it outlives a single test too, unless cleared here.
    resetGoogleMapsLoaderForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('draws the map without a Google key, offering Street View but not letting it open', () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    render(<MapContainer onCaptureView={vi.fn()} apiKey="" />);

    expect(maps).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Upload a photo' })).toBeInTheDocument();
    // Still offered as one of the two ways to a photo, so uploading never looks like
    // the only one; it just cannot open without the key.
    expect(screen.getByRole('button', { name: 'Street View' })).toBeDisabled();
    expect(screen.getByText(/needs a Google Maps key/)).toBeInTheDocument();
    expect(appendChildSpy.mock.calls.some(([el]) => el.tagName === 'SCRIPT')).toBe(false);
  });

  it('offers Street View once Google has loaded', () => {
    window.google = mockGoogleMaps();
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(streetViewButton()).toBeEnabled();
  });

  it('appends a script tag to document.head when apiKey is provided and window.google is absent', () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

    expect(appendChildSpy).toHaveBeenCalled();
    const scriptEl = appendChildSpy.mock.calls[0][0];
    expect(scriptEl.tagName).toBe('SCRIPT');
    expect(scriptEl.src).toContain('maps.googleapis.com');
  });

  it('does not append a new script tag when window.google is already present', () => {
    window.google = mockGoogleMaps();
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  it('renders the search input with placeholder "Search for an address..."', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.getByPlaceholderText('Search for an address...')).toBeInTheDocument();
  });

  it('does not render a coordinate readout', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.queryByText('55.6054, 12.9854')).not.toBeInTheDocument();
  });

  it('offers no way to take the map itself as the photo', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.queryByRole('button', { name: 'Take this photo' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Capture view')).not.toBeInTheDocument();
  });

  it('pins an uploaded photo where the map is pinned, re-encoded on the device', async () => {
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="" />);
    act(() => clickMap(lastMap(), { lat: 55.59, lng: 13.0 }));

    const file = new File(['raw'], 'corner.jpg', { type: 'image/jpeg' });
    uploadPhoto(file);
    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    expect(encodeImage).toHaveBeenCalledWith(file, expect.objectContaining({ maxSide: 1600 }));
    expect(onCaptureView).toHaveBeenCalledWith({
      position: { lat: 55.59, lng: 13.0 },
      address: null,
      pov: null,
      fov: null,
      source: 'upload',
      timestamp: expect.any(String),
      screenshot: UPLOADED,
    });
  });

  it('says so, and goes nowhere, when an uploaded file is not a picture', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(encodeImage).mockRejectedValueOnce(new Error('That file could not be read as a picture.'));
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="" />);

    uploadPhoto();

    expect(await screen.findByRole('status')).toHaveTextContent('That file could not be read as a picture.');
    expect(onCaptureView).not.toHaveBeenCalled();
  });

  it('floats the search box centered along the bottom, on top of the map', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

    // The field, inside its suggestion list's wrapper, inside the search box.
    const searchBox = screen.getByPlaceholderText('Search for an address...').parentElement.parentElement;
    const floatingBar = searchBox.parentElement;

    expect(floatingBar).toHaveStyle({
      position: 'absolute',
      // Offset by the cookie banner's height while it is up, 0 otherwise.
      bottom: 'calc(24px + var(--placer-consent-inset, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
    });
    expect(Number(floatingBar.style.zIndex)).toBeGreaterThan(0);
  });

  describe('when a Street View panorama is open', () => {
    // The panorama's WebGL canvas and cross-origin tiles cannot be read back, so
    // capture goes through Google's Street View Static API instead. These tests pin
    // that routing.
    function stubStaticImageFetch({ status = 200 } = {}) {
      const fetchMock = vi.fn(() => Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        blob: () => Promise.resolve(new Blob(['pixels'], { type: 'image/jpeg' })),
      }));
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    const OPEN_PANORAMA = {
      visible: true,
      position: { lat: 55.60123, lng: 12.98456 },
      pov: { heading: 217.5, pitch: -4.25 },
      zoom: 2,
    };

    // Every request a capture made, as { pathname, params }.
    const requestsOf = (fetchMock) => fetchMock.mock.calls.map(([url]) => {
      const parsed = new URL(url);
      return { pathname: parsed.pathname, params: parsed.searchParams };
    });

    const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

    it('requests the Street View Static endpoint instead of rasterizing the DOM', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const requested = new URL(fetchMock.mock.calls[0][0]);
      expect(requested.pathname).toBe('/maps/api/streetview');
      expect(onCaptureView.mock.calls[0][0].screenshot).not.toBe(MAP_IMAGE);
    });

    it('fetches a grid of narrow tiles, since the endpoint caps one image at 640px', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const requests = requestsOf(fetchMock);
      expect(requests).toHaveLength(4);
      for (const { pathname, params } of requests) {
        expect(pathname).toBe('/maps/api/streetview');
        // Square and at the cap, to keep the vertical FOV as large as it allows.
        expect(params.get('size')).toBe('640x640');
        // Narrower than the 45 deg wide view is the whole source of the gain.
        expect(Number(params.get('fov'))).toBeLessThan(45);
      }
      expect(onCaptureView.mock.calls[0][0].screenshot).toBe(STITCHED);
    });

    it('sends the panorama position and key with every tile', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      for (const { params } of requestsOf(fetchMock)) {
        expect(params.get('location')).toBe('55.60123,12.98456');
        expect(params.get('key')).toBe('test-key');
      }
    });

    it('centres the tile grid on the panorama POV', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const requests = requestsOf(fetchMock);
      const headings = requests.map(({ params }) => Number(params.get('heading')));
      const pitches = requests.map(({ params }) => Number(params.get('pitch')));
      // The grid is symmetric about the view it stands in for, so the offsets
      // cancel: what the user was looking at is the middle of the composite.
      expect(mean(headings)).toBeCloseTo(217.5, 4);
      expect(mean(pitches)).toBeCloseTo(-4.25, 4);
      // Spread either side of it on both axes, rather than all aimed alike.
      expect(new Set(headings).size).toBe(2);
      expect(new Set(pitches).size).toBe(2);
    });

    it('skips tiling at a deep zoom, where a tile resolves no better than the wide shot', async () => {
      // Panorama zoom 4 is a 11.25 degree field of view; a tile would have to add
      // the seam overlap on top of its slice of that, coming out wider than the
      // wide shot itself. One request, at the exact POV.
      window.google = mockGoogleMaps({
        panorama: mockPanorama({ ...OPEN_PANORAMA, zoom: 4 }),
      });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const requests = requestsOf(fetchMock);
      expect(requests).toHaveLength(1);
      expect(requests[0].params.get('heading')).toBe('217.5');
      expect(requests[0].params.get('pitch')).toBe('-4.25');
      expect(requests[0].params.get('fov')).toBe('11.25');
      expect(requests[0].params.get('size')).toBe('640x448');
    });

    it('falls back to one wide image when the tiles cannot be composed', async () => {
      vi.mocked(stitchPanoTiles).mockResolvedValueOnce(null);
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const requests = requestsOf(fetchMock);
      expect(requests).toHaveLength(5);
      // The last one is the whole view in a single image, at the exact POV.
      const wide = requests[4].params;
      expect(wide.get('heading')).toBe('217.5');
      expect(wide.get('pitch')).toBe('-4.25');
      expect(wide.get('fov')).toBe('45');
      expect(onCaptureView.mock.calls[0][0].screenshot)
        .toMatch(/^data:image\/jpeg;base64,/);
    });

    it('records the real panorama POV rather than the hardcoded zeros', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const captureData = onCaptureView.mock.calls[0][0];
      expect(captureData.pov).toEqual({ heading: 217.5, pitch: -4.25, zoom: 2 });
      expect(captureData.position).toEqual({ lat: 55.60123, lng: 12.98456 });
      expect(captureData.screenshot).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('records the field of view and marks the capture as street view', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      // Auto-detect needs both to plan higher-resolution tiles over the same view.
      const captureData = onCaptureView.mock.calls[0][0];
      expect(captureData.source).toBe('streetview');
      expect(captureData.fov).toBe(45); // panorama zoom 2
    });

    it('falls back to the map position when the panorama has not settled yet', async () => {
      window.google = mockGoogleMaps({
        panorama: mockPanorama({ ...OPEN_PANORAMA, position: null }),
      });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      // The STPLN, Malmö default the map is centred on.
      expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('location'))
        .toBe('55.6054,12.9854');
      expect(onCaptureView.mock.calls[0][0].position)
        .toEqual({ lat: 55.6054, lng: 12.9854 });
    });

    it('says there is no photo, rather than taking the map, when the spot has no coverage', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      // return_error_code=true makes Google 404 rather than serve a gray tile.
      const fetchMock = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
      vi.stubGlobal('fetch', fetchMock);
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());

      expect(await screen.findByRole('status')).toHaveTextContent(/no Street View photo of this spot/);
      // A 404 from the tiles already means no coverage, so there is no point asking
      // the same endpoint for the wide image too.
      expect(requestsOf(fetchMock)).toHaveLength(4);
      expect(onCaptureView).not.toHaveBeenCalled();
    });

    it('says the photo could not be taken when the key is rejected with a 403', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch({ status: 403 });
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());

      expect(await screen.findByRole('status')).toHaveTextContent('Could not take the photo.');
      const requests = requestsOf(fetchMock);
      expect(requests.every((r) => r.pathname === '/maps/api/streetview')).toBe(true);
      expect(onCaptureView).not.toHaveBeenCalled();
    });

    it('relabels to "Taking the photo…" and disables the button while it is taken', () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      stubStaticImageFetch();
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      fireEvent.click(takePhotoButton());

      expect(screen.getByRole('button', { name: 'Taking the photo…' })).toBeDisabled();
    });
  });

  it('does not re-initialize the map when the chosen spot changes', async () => {
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    expect(maps).toHaveLength(1);

    act(() => clickMap(lastMap(), { lat: 1.2345, lng: 6.789 }));

    // The captured payload is the only surface for the chosen spot now that the
    // coordinate readout is gone — it proves the click updated state...
    uploadPhoto();
    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());
    expect(onCaptureView.mock.calls[0][0].position).toEqual({ lat: 1.2345, lng: 6.789 });

    // ...without the init effect rebuilding the map.
    expect(maps).toHaveLength(1);
    expect(lastMap().removed).toBe(false);
  });

  it('marks the chosen spot on the map', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

    act(() => clickMap(lastMap(), { lat: 1.2345, lng: 6.789 }));

    const spots = lastMap().markers.filter((marker) => !pins().includes(marker));
    expect(spots).toHaveLength(1);
    expect(spots[0].getLngLat()).toEqual({ lat: 1.2345, lng: 6.789 });
    // In the electric blue the guide names it by.
    expect(spots[0].color).toBe('#3A39FF');
  });

  describe('Street View', () => {
    it('opens at the nearest photo to the chosen spot', () => {
      const panorama = mockPanorama();
      window.google = mockGoogleMaps({ panorama, coverage: 'pano-42' });
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      act(() => clickMap(lastMap(), { lat: 55.59, lng: 13.0 }));

      act(() => fireEvent.click(streetViewButton()));

      const service = window.google.maps.StreetViewService.mock.results[0].value;
      expect(service.getPanorama).toHaveBeenCalledWith(
        expect.objectContaining({ location: { lat: 55.59, lng: 13.0 }, radius: 100 }), expect.any(Function));
      expect(panorama.setPano).toHaveBeenCalledWith('pano-42');
      expect(panorama.setVisible).toHaveBeenCalledWith(true);
      expect(screen.getByTestId('street-view')).toHaveStyle({ visibility: 'visible' });
      // The legend describes the map, which is hidden behind the panorama.
      expect(screen.queryByRole('button', { name: 'Street View' })).not.toBeInTheDocument();
    });

    it('says so when there is no Street View near the chosen spot', () => {
      const panorama = mockPanorama();
      window.google = mockGoogleMaps({ panorama, coverage: null });
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      act(() => fireEvent.click(streetViewButton()));

      expect(screen.getByRole('status')).toHaveTextContent(/No Street View near this spot/);
      expect(panorama.setVisible).not.toHaveBeenCalled();
    });

    it('goes back to the map where Street View had walked to', () => {
      const panorama = mockPanorama({ position: { lat: 55.611, lng: 12.991 } });
      window.google = mockGoogleMaps({ panorama });
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      act(() => fireEvent.click(streetViewButton()));

      act(() => fireEvent.click(screen.getByRole('button', { name: 'Back to the map' })));

      expect(panorama.setVisible).toHaveBeenLastCalledWith(false);
      expect(lastMap().center).toEqual({ lat: 55.611, lng: 12.991 });
      expect(screen.getByTestId('street-view')).toHaveStyle({ visibility: 'hidden' });
    });
  });

  describe('address search', () => {
    it('suggests places and goes to the one chosen, making it the chosen spot', async () => {
      stubPhoton([photonFeature({ name: 'Folkets Park', city: 'Malmö', country: 'Sweden', lat: 55.594, lng: 13.007 })]);
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.change(screen.getByPlaceholderText('Search for an address...'), { target: { value: 'Folkets' } });
      fireEvent.mouseDown(await screen.findByRole('option', { name: /Folkets Park/ }));

      expect(lastMap().center).toEqual({ lat: 55.594, lng: 13.007 });
      expect(lastMap().zoom).toBe(17);
      uploadPhoto();
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());
      // Pinned there, and under the address it was picked as.
      expect(onCaptureView.mock.calls[0][0].position).toEqual({ lat: 55.594, lng: 13.007 });
      expect(onCaptureView.mock.calls[0][0].address).toMatch(/^Folkets Park/);
    });
  });

  it('shows only the pin: no project areas and no map key', async () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

    expect(lastMap().getSource('project-areas')).toBeFalsy();
    expect(screen.queryByText('Map key')).not.toBeInTheDocument();
  });

  describe('initialCenter', () => {
    it('opens on the default location and zoom when no centre is given', () => {
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      const options = lastMap().options;
      expect(lastMap().center).toEqual({ lat: 55.6054, lng: 12.9854 });
      expect(options.zoom).toBe(15);
    });

    it('opens centred and zoomed in on the given position', () => {
      render(
        <MapContainer
          onCaptureView={vi.fn()}
          apiKey="test-key"
          initialCenter={{ lat: 55.61, lng: 12.99 }}
        />
      );

      const options = lastMap().options;
      expect(lastMap().center).toEqual({ lat: 55.61, lng: 12.99 });
      expect(options.zoom).toBe(17);
    });

    it('ignores an incomplete position and keeps the default', () => {
      render(
        <MapContainer onCaptureView={vi.fn()} apiKey="test-key" initialCenter={{ lat: 55.61 }} />
      );

      const options = lastMap().options;
      expect(lastMap().center).toEqual({ lat: 55.6054, lng: 12.9854 });
      expect(options.zoom).toBe(15);
    });

    it('opens over the place chosen as the account location, zoomed out to the town', () => {
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" homeCenter={{ lat: 59.33, lng: 18.07 }} />);

      const options = lastMap().options;
      expect(lastMap().center).toEqual({ lat: 59.33, lng: 18.07 });
      expect(options.zoom).toBe(13);
    });

    it('still opens where an idea was just saved rather than the account location', () => {
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key"
        initialCenter={{ lat: 55.61, lng: 12.99 }} homeCenter={{ lat: 59.33, lng: 18.07 }} />);

      const options = lastMap().options;
      expect(lastMap().center).toEqual({ lat: 55.61, lng: 12.99 });
      expect(options.zoom).toBe(17);
    });
  });
});
