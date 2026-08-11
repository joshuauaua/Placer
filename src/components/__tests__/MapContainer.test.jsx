import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { toPng } from 'html-to-image';
import MapContainer from '../MapContainer';

vi.mock('html-to-image', () => ({
  toPng: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
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

function mockGoogleMaps({ getZoom = vi.fn(() => 1), panorama = mockPanorama() } = {}) {
  return {
    maps: {
      Map: vi.fn(function () {
        return {
          getZoom,
          getStreetView: vi.fn(() => panorama),
          setCenter: vi.fn(),
          setZoom: vi.fn(),
          addListener: vi.fn(),
        };
      }),
      Marker: vi.fn(),
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
      bottom: '24px',
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

    it('sends the panorama position, heading, pitch and derived fov to the API', async () => {
      window.google = mockGoogleMaps({ panorama: mockPanorama(OPEN_PANORAMA) });
      const fetchMock = stubStaticImageFetch();
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
      expect(params.get('location')).toBe('55.60123,12.98456');
      expect(params.get('heading')).toBe('217.5');
      expect(params.get('pitch')).toBe('-4.25');
      // Panorama zoom 2 is a 45 degree field of view.
      expect(params.get('fov')).toBe('45');
      expect(params.get('key')).toBe('test-key');
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
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(new Blob(['tile'], { type: 'image/png' })),
        });
      vi.stubGlobal('fetch', fetchMock);
      const onCaptureView = vi.fn();
      render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

      fireEvent.click(screen.getByLabelText('Capture view'));
      await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const fallback = new URL(fetchMock.mock.calls[1][0]);
      expect(fallback.pathname).toBe('/maps/api/staticmap');
      expect(fallback.searchParams.get('center')).toBe('55.60123,12.98456');
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

      // A misconfigured key is not missing coverage — retrying the fallback
      // would just 403 again and hide the real cause.
      expect(fetchMock).toHaveBeenCalledTimes(1);
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
});
