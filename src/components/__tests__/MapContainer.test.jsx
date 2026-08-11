import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { toPng } from 'html-to-image';
import MapContainer from '../MapContainer';

vi.mock('html-to-image', () => ({
  toPng: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
}));

function mockGoogleMaps({ getZoom = vi.fn(() => 1) } = {}) {
  return {
    maps: {
      Map: vi.fn(function () {
        return {
          getZoom,
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

  it('does not re-initialize Google Map when currentPosition changes', async () => {
    let clickHandler;
    const googleMaps = mockGoogleMaps();
    googleMaps.maps.Map = vi.fn(function () {
      return {
        getZoom: vi.fn(() => 1),
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
