import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { toPng } from 'html-to-image';
import MapContainer from '../MapContainer';
import { fetchImaginations } from '../../services/api';
import { stitchPanoTiles } from '../../lib/panoStitch';
import { CAT, THEME } from '../../theme';

vi.mock('html-to-image', () => ({
  toPng: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
}));

vi.mock('../../services/api', () => ({
  fetchImaginations: vi.fn(() => Promise.resolve([])),
}));

// Stitching is real canvas work, which jsdom has no 2D context for. Mocked so
// these tests can pin the request routing either side of it: a resolved value
// stands for a composed frame, null for one that could not be composed.
const STITCHED = 'data:image/jpeg;base64,mockStitched';
vi.mock('../../lib/panoStitch', () => ({
  stitchPanoTiles: vi.fn(() => Promise.resolve(STITCHED)),
}));

// A StreetViewPanorama stub. Defaults to hidden so the map capture path — which
// this change leaves alone — stays the default in every pre-existing test.
function mockPanorama({
  visible = false,
  position = { lat: 55.6, lng: 12.98 },
  pov = { heading: 0, pitch: 0 },
  zoom = 1,
} = {}) {
  return {
    getVisible: vi.fn(() => visible),
    getPosition: vi.fn(() =>
      position && {
        lat: () => position.lat,
        lng: () => position.lng,
      }
    ),
    getPov: vi.fn(() => pov),
    getZoom: vi.fn(() => zoom),
  };
}

// Captures the listeners MapContainer registers on the map, so tests can fire a
// map click the way Maps would.
let mapListeners = {};

function mockGoogleMaps({ getZoom = vi.fn(() => 1), panorama = mockPanorama() } = {}) {
  mapListeners = {};
  return {
    maps: {
      Map: vi.fn(function () {
        return {
          getZoom,
          getStreetView: vi.fn(() => panorama),
          setCenter: vi.fn(),
          setZoom: vi.fn(),
          panTo: vi.fn(),
          addListener: vi.fn((event, handler) => { mapListeners[event] = handler; }),
        };
      }),
      Marker: vi.fn(function (options) {
        const listeners = {};
        return {
          ...options,
          setMap: vi.fn(),
          addListener: vi.fn((event, handler) => { listeners[event] = handler; }),
          // Test-only hook for firing a pin click the way Maps would.
          fire: (event) => listeners[event]?.(),
        };
      }),
      SymbolPath: { CIRCLE: 'circle' },
      event: { clearInstanceListeners: vi.fn() },
      places: {
        Autocomplete: vi.fn(function () {
          return {
            addListener: vi.fn(),
            getPlace: vi.fn(() => ({})),
          };
        }),
      },
    },
  };
}

describe('MapContainer', () => {
  afterEach(() => {
    cleanup();
    delete window.google;
    vi.restoreAllMocks();
    vi.mocked(fetchImaginations).mockResolvedValue([]);
    // restoreAllMocks does not reach the module-level toPng mock, so its call
    // history would otherwise leak between tests.
    vi.clearAllMocks();
  });

  it('renders the "Google Maps API Key Required" warning banner when apiKey is empty', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="" />);
    expect(screen.getByText('Google Maps API Key Required')).toBeInTheDocument();
  });

  it('does not render the warning banner when apiKey is provided', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.queryByText('Google Maps API Key Required')).not.toBeInTheDocument();
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

    const searchBox = screen.getByPlaceholderText('Search for an address...').parentElement;
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

    const searchBox = screen.getByPlaceholderText('Search for an address...').parentElement;
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
      pov: { heading: 0, pitch: 0, zoom: 1 },
      // A map capture has no panorama field of view.
      fov: null,
      source: 'map',
      timestamp: expect.any(String),
      screenshot: 'data:image/png;base64,mock',
    });
  });

  it('sends capture data with a numeric pov.zoom read from the live map', async () => {
    const getZoom = vi.fn(() => 15);
    window.google = mockGoogleMaps({ getZoom });
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    fireEvent.click(screen.getByLabelText('Capture view'));

    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    const captureData = onCaptureView.mock.calls[0][0];
    expect(captureData.pov).toEqual({ heading: 0, pitch: 0, zoom: 15 });
    expect(getZoom).toHaveBeenCalled();
  });

  it('calls onCaptureView with screenshot: null when html-to-image throws', async () => {
    toPng.mockImplementationOnce(() => Promise.reject(new Error('capture failed')));
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

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
    // html-to-image cannot rasterize the panorama's WebGL canvas or its
    // cross-origin tiles, so capture goes through Google's Street View Static
    // API instead. These tests pin that routing.
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
      expect(toPng).not.toHaveBeenCalled();
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

    it('falls back to a top-down map image when the spot has no Street View coverage', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      // return_error_code=true makes Google 404 rather than serve a gray tile.
      // Keyed on the endpoint rather than call order, since the tiles go out
      // together and there is no guaranteed order among them.
      const fetchMock = vi.fn((url) => Promise.resolve(
        new URL(url).pathname === '/maps/api/streetview'
          ? { ok: false, status: 404 }
          : {
            ok: true,
            status: 200,
            blob: () => Promise.resolve(new Blob(['tile'], { type: 'image/png' })),
          }
      ));
      vi.stubGlobal('fetch', fetchMock);
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const requests = requestsOf(fetchMock);
      const fallback = requests[requests.length - 1];
      expect(fallback.pathname).toBe('/maps/api/staticmap');
      expect(fallback.params.get('center')).toBe('55.60123,12.98456');
      // Exactly one map request: a 404 from the tiles already means no coverage,
      // so there is no point asking the same endpoint for the wide image too.
      expect(requests.filter((r) => r.pathname === '/maps/api/staticmap')).toHaveLength(1);
      expect(requests.filter((r) => r.pathname === '/maps/api/streetview')).toHaveLength(4);
      expect(onCaptureView.mock.calls[0][0].screenshot)
        .toMatch(/^data:image\/png;base64,/);
    });

    it('does not retry as a map image when the key is rejected with a 403', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch({ status: 403 });
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      // A misconfigured key is not missing coverage — retrying either the wide
      // image or the map fallback would just 403 again and hide the real cause.
      const requests = requestsOf(fetchMock);
      expect(requests.every((r) => r.pathname === '/maps/api/streetview')).toBe(true);
      expect(onCaptureView.mock.calls[0][0].screenshot).toBeNull();
    });
  });

  it('does not re-initialize Google Map when currentPosition changes', async () => {
    let clickHandler;
    const googleMaps = mockGoogleMaps();
    googleMaps.maps.Map = vi.fn(function () {
      return {
        getZoom: vi.fn(() => 1),
        getStreetView: vi.fn(() => mockPanorama()),
        setCenter: vi.fn(),
        setZoom: vi.fn(),
        addListener: vi.fn((event, handler) => {
          if (event === 'click') {
            clickHandler = handler;
          }
        }),
      };
    });
    window.google = googleMaps;

    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    expect(googleMaps.maps.Map).toHaveBeenCalledTimes(1);

    act(() => {
      clickHandler({ latLng: { lat: () => 1.2345, lng: () => 6.789 } });
    });

    // The captured payload is the only surface for currentPosition now that the
    // coordinate readout is gone — it proves the click updated state...
    fireEvent.click(screen.getByLabelText('Capture view'));
    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());
    expect(onCaptureView.mock.calls[0][0].position).toEqual({ lat: 1.2345, lng: 6.789 });

    // ...without the init effect rebuilding the map.
    expect(googleMaps.maps.Map).toHaveBeenCalledTimes(1);
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
      window.google = mockGoogleMaps();
      vi.mocked(fetchImaginations).mockResolvedValue(SAVED);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() =>
        expect(window.google.maps.Marker).toHaveBeenCalledTimes(2)
      );
    });

    it('colours each pin by its category and labels it with the title', async () => {
      window.google = mockGoogleMaps();
      vi.mocked(fetchImaginations).mockResolvedValue(SAVED);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(window.google.maps.Marker).toHaveBeenCalledTimes(2));

      const [first, second] = window.google.maps.Marker.mock.calls.map((call) => call[0]);
      expect(first.position).toEqual({ lat: 55.61, lng: 12.99 });
      expect(first.title).toBe('Pocket park');
      expect(first.icon.fillColor).toBe(CAT.green.color);
      expect(second.icon.fillColor).toBe(CAT.seating.color);
    });

    it('skips imaginations saved without usable coordinates', async () => {
      window.google = mockGoogleMaps();
      vi.mocked(fetchImaginations).mockResolvedValue([
        ...SAVED,
        { id: 'img-3', title: 'No position', cat: 'art', position: null },
        { id: 'img-4', title: 'Partial', cat: 'art', position: { lat: 55.6 } },
        { id: 'img-5', title: 'Legacy record with no position field', cat: 'art' },
      ]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(window.google.maps.Marker).toHaveBeenCalledTimes(2));
    });

    it('falls back to the accent colour for an unrecognised category', async () => {
      window.google = mockGoogleMaps();
      vi.mocked(fetchImaginations).mockResolvedValue([
        { id: 'img-9', title: 'Odd one', cat: 'not-a-category', position: { lat: 1, lng: 2 } },
      ]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(window.google.maps.Marker).toHaveBeenCalledTimes(1));
      expect(window.google.maps.Marker.mock.calls[0][0].icon.fillColor).toBe(THEME.accent);
    });

    it('draws no pins when nothing has been saved yet', async () => {
      window.google = mockGoogleMaps();
      vi.mocked(fetchImaginations).mockResolvedValue([]);

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(fetchImaginations).toHaveBeenCalled());
      expect(window.google.maps.Marker).not.toHaveBeenCalled();
    });

    it('keeps the map usable when the pins fail to load', async () => {
      window.google = mockGoogleMaps();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fetchImaginations).mockRejectedValue(new Error('storage unavailable'));

      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      await waitFor(() => expect(consoleError).toHaveBeenCalled());
      expect(screen.getByPlaceholderText('Search for an address...')).toBeInTheDocument();
      expect(window.google.maps.Marker).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('removes its markers on unmount', async () => {
      window.google = mockGoogleMaps();
      vi.mocked(fetchImaginations).mockResolvedValue(SAVED);

      const { unmount } = render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      await waitFor(() => expect(window.google.maps.Marker).toHaveBeenCalledTimes(2));

      const markers = window.google.maps.Marker.mock.results.map((r) => r.value);
      unmount();

      markers.forEach((marker) => expect(marker.setMap).toHaveBeenCalledWith(null));
    });
  });

  describe('initialCenter', () => {
    it('opens on the default location and zoom when no centre is given', () => {
      window.google = mockGoogleMaps();
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);

      const options = window.google.maps.Map.mock.calls[0][1];
      expect(options.center).toEqual({ lat: 55.6054, lng: 12.9854 });
      expect(options.zoom).toBe(15);
    });

    it('opens centred and zoomed in on the given position', () => {
      window.google = mockGoogleMaps();
      render(
        <MapContainer
          onCaptureView={vi.fn()}
          apiKey="test-key"
          initialCenter={{ lat: 55.61, lng: 12.99 }}
        />
      );

      const options = window.google.maps.Map.mock.calls[0][1];
      expect(options.center).toEqual({ lat: 55.61, lng: 12.99 });
      expect(options.zoom).toBe(17);
    });

    it('ignores an incomplete position and keeps the default', () => {
      window.google = mockGoogleMaps();
      render(
        <MapContainer onCaptureView={vi.fn()} apiKey="test-key" initialCenter={{ lat: 55.61 }} />
      );

      const options = window.google.maps.Map.mock.calls[0][1];
      expect(options.center).toEqual({ lat: 55.6054, lng: 12.9854 });
      expect(options.zoom).toBe(15);
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
      window.google = mockGoogleMaps();
      vi.mocked(fetchImaginations).mockResolvedValue(saved);
      render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
      await waitFor(() =>
        expect(window.google.maps.Marker).toHaveBeenCalledTimes(saved.length)
      );
      return window.google.maps.Marker.mock.results.map((r) => r.value);
    };

    it('shows no preview until a pin is clicked', async () => {
      await renderWithPins();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the preview for the clicked pin', async () => {
      const markers = await renderWithPins();

      act(() => markers[0].fire('click'));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Pocket park')).toBeInTheDocument();
      expect(screen.queryByText('Shade on 8th')).not.toBeInTheDocument();
    });

    it('pans the map to the clicked pin', async () => {
      const markers = await renderWithPins();
      const mapInstance = window.google.maps.Map.mock.results[0].value;

      act(() => markers[1].fire('click'));

      expect(mapInstance.panTo).toHaveBeenCalledWith({ lat: 55.62, lng: 13.01 });
    });

    it('swaps the preview when a different pin is clicked', async () => {
      const markers = await renderWithPins();

      act(() => markers[0].fire('click'));
      expect(await screen.findByText('Pocket park')).toBeInTheDocument();

      act(() => markers[1].fire('click'));

      expect(await screen.findByText('Shade on 8th')).toBeInTheDocument();
      expect(screen.queryByText('Pocket park')).not.toBeInTheDocument();
    });

    it('closes the preview from its close button', async () => {
      const markers = await renderWithPins();
      act(() => markers[0].fire('click'));
      await screen.findByRole('dialog');

      fireEvent.click(screen.getByLabelText('Close preview'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the preview on Escape', async () => {
      const markers = await renderWithPins();
      act(() => markers[0].fire('click'));
      await screen.findByRole('dialog');

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the preview when the map itself is clicked', async () => {
      const markers = await renderWithPins();
      act(() => markers[0].fire('click'));
      await screen.findByRole('dialog');

      act(() => mapListeners.click({ latLng: null }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('still records the clicked position when the map click closes the preview', async () => {
      const markers = await renderWithPins();
      act(() => markers[0].fire('click'));
      await screen.findByRole('dialog');

      // Dismissing the card must not swallow the position update the map click
      // carries — the capture button depends on it.
      act(() => mapListeners.click({ latLng: { lat: () => 10, lng: () => 20 } }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(toPng).toHaveBeenCalled());
    });
  });
});
