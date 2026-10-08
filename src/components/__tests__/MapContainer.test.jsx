import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import MapContainer from '../MapContainer';
import { fetchImaginations } from '../../services/api';
import { isSupabaseConfigured, readProjectLocations } from '../../services/projects';
import { stitchPanoTiles } from '../../lib/panoStitch';
import { resetGoogleMapsLoaderForTests } from '../../lib/googleMaps';
import { CHARACTER } from '../../theme';
import { clickLayer, clickMap, lastMap, maps } from '../../test/maplibreStub';
import { photonFeature, stubPhoton } from '../../test/photon';

// What the stand-in map's canvas reads back as: a capture of the map itself.
const MAP_IMAGE = 'data:image/png;base64,MAP';

vi.mock('../../services/api', () => ({
  fetchImaginations: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readProjectLocations: vi.fn(() => Promise.resolve([])),
}));

// Stitching is real canvas work, which jsdom has no 2D context for. Mocked so
// these tests can pin the request routing either side of it: a resolved value
// stands for a composed frame, null for one that could not be composed.
const STITCHED = 'data:image/jpeg;base64,mockStitched';
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

// The pins drawn for imaginations: every marker that can be clicked. The spot chosen
// for Street View is a marker too, but not one to click.
const pins = () => (lastMap()?.markers ?? []).filter((marker) => marker.getElement().getAttribute('role') === 'button');
const pinElements = () => pins().map((marker) => marker.getElement());

describe('MapContainer', () => {
  afterEach(() => {
    cleanup();
    delete window.google;
    // The script-loading promise is cached at module scope (see src/lib/googleMaps.js) so
    // that two components sharing one Maps session never inject the script twice — but that
    // means it outlives a single test too, unless cleared here.
    resetGoogleMapsLoaderForTests();
    vi.restoreAllMocks();
    vi.mocked(fetchImaginations).mockResolvedValue([]);
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readProjectLocations).mockResolvedValue([]);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('draws the map without a Google key, and offers no Street View without one', () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    render(<MapContainer onCaptureView={vi.fn()} apiKey="" />);

    expect(maps).toHaveLength(1);
    expect(screen.getByLabelText('Capture view')).toBeInTheDocument();
    expect(screen.queryByLabelText('Open Street View at the chosen spot')).not.toBeInTheDocument();
    expect(appendChildSpy.mock.calls.some(([el]) => el.tagName === 'SCRIPT')).toBe(false);
  });

  it('offers Street View once Google has loaded', () => {
    window.google = mockGoogleMaps();
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.getByLabelText('Open Street View at the chosen spot')).toBeEnabled();
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

  it('renders the capture button as an icon only, with no visible text', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

    const button = screen.getByLabelText('Capture view');
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render a coordinate readout', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.queryByText('55.6054, 12.9854')).not.toBeInTheDocument();
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

  it('places the capture button after the search box in the same floating bar', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

    const searchBox = screen.getByPlaceholderText('Search for an address...').parentElement.parentElement;
    const floatingBar = searchBox.parentElement;
    const button = screen.getByLabelText('Capture view');

    expect(button.parentElement).toBe(floatingBar);

    const order = Array.from(floatingBar.children);
    expect(order.indexOf(button)).toBeGreaterThan(order.indexOf(searchBox));
  });

  it('calls onCaptureView with position, pov, timestamp, and screenshot data when "Capture View" is clicked', async () => {
    window.google = mockGoogleMaps();
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    fireEvent.click(screen.getByLabelText('Capture view'));

    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    expect(onCaptureView).toHaveBeenCalledWith({
      position: { lat: 55.6054, lng: 12.9854 },
      // The map's own zoom: it opens at 15.
      pov: { heading: 0, pitch: 0, zoom: 15 },
      // A map capture has no panorama field of view.
      fov: null,
      source: 'map',
      timestamp: expect.any(String),
      screenshot: MAP_IMAGE,
    });
  });

  it('sends capture data with a whole-number pov.zoom read from the live map', async () => {
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);
    lastMap().zoom = 15.4;

    fireEvent.click(screen.getByLabelText('Capture view'));

    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    const captureData = onCaptureView.mock.calls[0][0];
    expect(captureData.pov).toEqual({ heading: 0, pitch: 0, zoom: 15 });
  });

  it('calls onCaptureView with screenshot: null when the map cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);
    lastMap().canvas.toDataURL = () => { throw new Error('capture failed'); };

    fireEvent.click(screen.getByLabelText('Capture view'));

    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    expect(onCaptureView).toHaveBeenCalledWith(
      expect.objectContaining({ screenshot: null })
    );
  });

  it('relabels to "Capturing view" and disables the button while capturing', () => {
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    fireEvent.click(screen.getByLabelText('Capture view'));

    expect(screen.getByLabelText('Capturing view')).toBeDisabled();
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
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

      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      // The STPLN, Malmö default the map is centred on.
      expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('location'))
        .toBe('55.6054,12.9854');
      expect(onCaptureView.mock.calls[0][0].position)
        .toEqual({ lat: 55.6054, lng: 12.9854 });
    });

    it('falls back to the map at that spot when it has no Street View coverage', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      // return_error_code=true makes Google 404 rather than serve a gray tile.
      const fetchMock = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
      vi.stubGlobal('fetch', fetchMock);
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      // A 404 from the tiles already means no coverage, so there is no point asking
      // the same endpoint for the wide image too.
      expect(requestsOf(fetchMock)).toHaveLength(4);
      // The map, moved to where the panorama was and zoomed in, stands in for it.
      expect(lastMap().center).toEqual({ lat: 55.60123, lng: 12.98456 });
      expect(lastMap().zoom).toBe(18);
      expect(onCaptureView.mock.calls[0][0].screenshot).toBe(MAP_IMAGE);
    });

    it('does not retry as a map image when the key is rejected with a 403', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch({ status: 403 });
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      // A misconfigured key is not missing coverage — retrying the wide image would
      // just 403 again, and the map fallback would hide the real cause.
      const requests = requestsOf(fetchMock);
      expect(requests.every((r) => r.pathname === '/maps/api/streetview')).toBe(true);
      expect(onCaptureView.mock.calls[0][0].screenshot).toBeNull();
    });
  });

  it('does not re-initialize the map when the chosen spot changes', async () => {
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    expect(maps).toHaveLength(1);

    act(() => clickMap(lastMap(), { lat: 1.2345, lng: 6.789 }));

    // The captured payload is the only surface for the chosen spot now that the
    // coordinate readout is gone — it proves the click updated state...
    fireEvent.click(screen.getByLabelText('Capture view'));
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
  });

  describe('Street View', () => {
    it('opens at the nearest photo to the chosen spot', () => {
      const panorama = mockPanorama();
      window.google = mockGoogleMaps({ panorama, coverage: 'pano-42' });
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      act(() => clickMap(lastMap(), { lat: 55.59, lng: 13.0 }));

      act(() => fireEvent.click(screen.getByLabelText('Open Street View at the chosen spot')));

      const service = window.google.maps.StreetViewService.mock.results[0].value;
      expect(service.getPanorama).toHaveBeenCalledWith(
        expect.objectContaining({ location: { lat: 55.59, lng: 13.0 }, radius: 100 }), expect.any(Function));
      expect(panorama.setPano).toHaveBeenCalledWith('pano-42');
      expect(panorama.setVisible).toHaveBeenCalledWith(true);
      expect(screen.getByTestId('street-view')).toHaveStyle({ visibility: 'visible' });
      // The legend describes the map, which is hidden behind the panorama.
      expect(screen.queryByLabelText('Open Street View at the chosen spot')).not.toBeInTheDocument();
    });

    it('says so when there is no Street View near the chosen spot', () => {
      const panorama = mockPanorama();
      window.google = mockGoogleMaps({ panorama, coverage: null });
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      act(() => fireEvent.click(screen.getByLabelText('Open Street View at the chosen spot')));

      expect(screen.getByRole('status')).toHaveTextContent(/No Street View near this spot/);
      expect(panorama.setVisible).not.toHaveBeenCalled();
    });

    it('goes back to the map where Street View had walked to', () => {
      const panorama = mockPanorama({ position: { lat: 55.611, lng: 12.991 } });
      window.google = mockGoogleMaps({ panorama });
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      act(() => fireEvent.click(screen.getByLabelText('Open Street View at the chosen spot')));

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
      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());
      expect(onCaptureView.mock.calls[0][0].position).toEqual({ lat: 55.594, lng: 13.007 });
    });
  });

  describe('imagination pins', () => {
    const SAVED = [
      {
        id: 'img-1',
        title: 'Pocket park',
        cat: 'green',
        position: { lat: 55.61, lng: 12.99 },
      },
      {
        id: 'img-2',
        title: 'Shade on 8th',
        cat: 'seating',
        position: { lat: 55.62, lng: 13.01 },
      },
    ];

    it('drops one marker per saved imagination', async () => {
      vi.mocked(fetchImaginations).mockResolvedValue(SAVED);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(pins()).toHaveLength(2));
    });

    it('draws each pin in the citizen pin style and labels it with the title', async () => {
      vi.mocked(fetchImaginations).mockResolvedValue(SAVED);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(pins()).toHaveLength(2));

      const [first] = pins();
      expect(first.getLngLat()).toEqual({ lat: 55.61, lng: 12.99 });
      expect(screen.getByRole('button', { name: 'Pocket park' })).toBe(first.getElement());
      for (const element of pinElements()) {
        expect(element).toHaveStyle({ backgroundColor: CHARACTER.citizen.c100 });
        expect(element.style.border).toContain('2px solid');
      }
    });

    it('skips imaginations saved without usable coordinates', async () => {
      vi.mocked(fetchImaginations).mockResolvedValue([
        ...SAVED,
        { id: 'img-3', title: 'No position', cat: 'art', position: null },
        { id: 'img-4', title: 'Partial', cat: 'art', position: { lat: 55.6 } },
        { id: 'img-5', title: 'Legacy record with no position field', cat: 'art' },
      ]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(pins()).toHaveLength(2));
    });

    it('draws no pins when nothing has been saved yet', async () => {
      vi.mocked(fetchImaginations).mockResolvedValue([]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(fetchImaginations).toHaveBeenCalled());
      expect(pins()).toHaveLength(0);
    });

    it('keeps the map usable when the pins fail to load', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fetchImaginations).mockRejectedValue(new Error('storage unavailable'));

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(consoleError).toHaveBeenCalled());
      expect(screen.getByPlaceholderText('Search for an address...')).toBeInTheDocument();
      expect(pins()).toHaveLength(0);
      consoleError.mockRestore();
    });

    it('removes its markers on unmount', async () => {
      vi.mocked(fetchImaginations).mockResolvedValue(SAVED);

      const { unmount } = render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      await waitFor(() => expect(pins()).toHaveLength(2));

      const map = lastMap();
      const elements = pinElements();
      unmount();

      expect(map.markers).toHaveLength(0);
      expect(map.removed).toBe(true);
      elements.forEach((element) => expect(element).not.toBeInTheDocument());
    });
  });

  describe('project location outlines', () => {
    const TRIANGLE = [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }];
    const PROJECT = { id: 'proj-1', name: 'Riverside Greenway', locationShapes: [{ path: TRIANGLE }] };

    const areas = () => lastMap().getSource('project-areas')?.data.features ?? [];

    it('draws one polygon per shape a project has drawn', async () => {
      vi.mocked(readProjectLocations).mockResolvedValue([PROJECT]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(areas()).toHaveLength(1));
      expect(areas()[0].geometry.coordinates[0].slice(0, 3))
        .toEqual(TRIANGLE.map(({ lat, lng }) => [lng, lat]));
      expect(areas()[0].properties).toEqual({ fill: CHARACTER.cityWorker.c300, stroke: CHARACTER.cityWorker.c700 });
    });

    it('draws a polygon for every shape across every project', async () => {
      vi.mocked(readProjectLocations).mockResolvedValue([
        PROJECT,
        { id: 'proj-2', name: 'Second project', locationShapes: [{ path: TRIANGLE }, { path: TRIANGLE }] },
      ]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(areas()).toHaveLength(3));
    });

    it('ignores a shape with fewer than 3 points', async () => {
      vi.mocked(readProjectLocations).mockResolvedValue([
        { id: 'proj-1', name: 'Too small', locationShapes: [{ path: TRIANGLE.slice(0, 2) }] },
      ]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(readProjectLocations).toHaveBeenCalled());
      await act(async () => {});
      expect(areas()).toHaveLength(0);
    });

    it('draws no polygons when Supabase is not configured', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await act(async () => {});
      expect(readProjectLocations).not.toHaveBeenCalled();
      expect(areas()).toHaveLength(0);
    });

    it('sends you to the project\'s public page when its outline is clicked', async () => {
      vi.mocked(readProjectLocations).mockResolvedValue([PROJECT]);
      const onOpenProject = vi.fn();

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" onOpenProject={onOpenProject} />);

      await waitFor(() => expect(areas()).toHaveLength(1));
      act(() => clickLayer(lastMap(), 'project-areas-fill', 0));

      expect(onOpenProject).toHaveBeenCalledWith('proj-1');
    });

    it('does not count a click on an outline as choosing a spot', async () => {
      vi.mocked(readProjectLocations).mockResolvedValue([PROJECT]);
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" onOpenProject={vi.fn()} />);
      await waitFor(() => expect(areas()).toHaveLength(1));

      act(() => clickLayer(lastMap(), 'project-areas-fill', 0));
      fireEvent.click(screen.getByLabelText('Capture view'));

      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());
      expect(onCaptureView.mock.calls[0][0].position).toEqual({ lat: 55.6054, lng: 12.9854 });
    });

    it('removes its polygons on unmount', async () => {
      vi.mocked(readProjectLocations).mockResolvedValue([PROJECT]);

      const { unmount } = render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      await waitFor(() => expect(areas()).toHaveLength(1));

      const map = lastMap();
      unmount();

      expect(map.getLayer('project-areas-fill')).toBeUndefined();
      expect(map.getSource('project-areas')).toBeUndefined();
    });
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

    it('still opens on a just-posted imagination rather than the account location', () => {
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key"
        initialCenter={{ lat: 55.61, lng: 12.99 }} homeCenter={{ lat: 59.33, lng: 18.07 }} />);

      const options = lastMap().options;
      expect(lastMap().center).toEqual({ lat: 55.61, lng: 12.99 });
      expect(options.zoom).toBe(17);
    });
  });

  describe('imagination preview on pin click', () => {
    const SAVED = [
      {
        id: 'img-1',
        title: 'Pocket park',
        cat: 'green',
        blurb: 'Swap the asphalt for trees.',
        position: { lat: 55.61, lng: 12.99 },
        canvasAssets: [],
      },
      {
        id: 'img-2',
        title: 'Shade on 8th',
        cat: 'seating',
        blurb: 'Street trees every block.',
        position: { lat: 55.62, lng: 13.01 },
        canvasAssets: [],
      },
    ];

    const renderWithPins = async (saved = SAVED) => {
      vi.mocked(fetchImaginations).mockResolvedValue(saved);
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      await waitFor(() => expect(pins()).toHaveLength(saved.length));
      return pinElements().map((element) => ({ fire: () => fireEvent.click(element) }));
    };

    it('shows no preview until a pin is clicked', async () => {
      await renderWithPins();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the preview for the clicked pin', async () => {
      const markers = await renderWithPins();

      markers[0].fire();

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Pocket park')).toBeInTheDocument();
      expect(screen.queryByText('Shade on 8th')).not.toBeInTheDocument();
    });

    it('pans the map to the clicked pin', async () => {
      const markers = await renderWithPins();

      markers[1].fire();

      expect(lastMap().center).toEqual({ lat: 55.62, lng: 13.01 });
    });

    it('swaps the preview when a different pin is clicked', async () => {
      const markers = await renderWithPins();

      markers[0].fire();
      expect(await screen.findByText('Pocket park')).toBeInTheDocument();

      markers[1].fire();

      expect(await screen.findByText('Shade on 8th')).toBeInTheDocument();
      expect(screen.queryByText('Pocket park')).not.toBeInTheDocument();
    });

    it('closes the preview from its close button', async () => {
      const markers = await renderWithPins();
      markers[0].fire();
      await screen.findByRole('dialog');

      fireEvent.click(screen.getByLabelText('Close preview'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the preview on Escape', async () => {
      const markers = await renderWithPins();
      markers[0].fire();
      await screen.findByRole('dialog');

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the preview when the map itself is clicked', async () => {
      const markers = await renderWithPins();
      markers[0].fire();
      await screen.findByRole('dialog');

      act(() => clickMap(lastMap(), { lat: 10, lng: 20 }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('still records the clicked position when the map click closes the preview', async () => {
      const markers = await renderWithPins();
      markers[0].fire();
      await screen.findByRole('dialog');

      // Dismissing the card must not swallow the position update the map click
      // carries — the capture button depends on it.
      act(() => clickMap(lastMap(), { lat: 10, lng: 20 }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // The chosen spot moved there.
      expect(lastMap().markers.some((marker) => !pins().includes(marker)
        && marker.getLngLat().lat === 10 && marker.getLngLat().lng === 20)).toBe(true);
    });
  });
});
