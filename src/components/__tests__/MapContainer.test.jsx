import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import html2canvas from 'html2canvas';
import MapContainer from '../MapContainer';

vi.mock('html2canvas', () => ({
  default: vi.fn(() =>
    Promise.resolve({
      toDataURL: () => 'data:image/png;base64,mock',
    })
  ),
}));

function mockGoogleMaps() {
  return {
    maps: {
      Map: vi.fn(() => ({
        setCenter: vi.fn(),
        setZoom: vi.fn(),
        addListener: vi.fn(),
      })),
      Marker: vi.fn(),
      event: { clearInstanceListeners: vi.fn() },
      places: {
        Autocomplete: vi.fn(() => ({
          addListener: vi.fn(),
        })),
      },
    },
  };
}

describe('MapContainer', () => {
  afterEach(() => {
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

  it('renders the "Capture View" button', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.getByText('Capture View')).toBeInTheDocument();
  });

  it('shows the default Stockholm coordinates in the position display', () => {
    render(<MapContainer onCaptureView={vi.fn()} apiKey="test-key" />);
    expect(screen.getByText('59.3293, 18.0686')).toBeInTheDocument();
  });

  it('calls onCaptureView with position, pov, timestamp, and screenshot data when "Capture View" is clicked', async () => {
    window.google = mockGoogleMaps();
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    fireEvent.click(screen.getByText('Capture View'));

    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    expect(onCaptureView).toHaveBeenCalledWith({
      position: { lat: 59.3293, lng: 18.0686 },
      pov: { heading: 0, pitch: 0, zoom: 1 },
      timestamp: expect.any(String),
      screenshot: 'data:image/png;base64,mock',
    });
  });

  it('calls onCaptureView with screenshot: null when html2canvas throws', async () => {
    html2canvas.mockImplementationOnce(() => Promise.reject(new Error('capture failed')));
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    fireEvent.click(screen.getByText('Capture View'));

    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    expect(onCaptureView).toHaveBeenCalledWith(
      expect.objectContaining({ screenshot: null })
    );
  });

  it('shows "Capturing..." and disables the button while capturing', () => {
    const onCaptureView = vi.fn();
    render(<MapContainer onCaptureView={onCaptureView} apiKey="test-key" />);

    fireEvent.click(screen.getByText('Capture View'));

    expect(screen.getByText('Capturing...')).toBeDisabled();
  });
});
