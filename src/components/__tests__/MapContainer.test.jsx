import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MapContainer from '../MapContainer';

vi.mock('html2canvas', () => ({
  default: vi.fn(() =>
    Promise.resolve({
      toDataURL: () => 'data:image/png;base64,fake'
    })
  )
}));

describe('MapContainer', () => {
  let originalGoogle;
  let mapInstance;

  beforeEach(() => {
    originalGoogle = window.google;

    mapInstance = {
      getZoom: vi.fn(() => 15),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      addListener: vi.fn()
    };

    window.google = {
      maps: {
        Map: vi.fn(function () {
          return mapInstance;
        }),
        Marker: vi.fn(),
        event: {
          clearInstanceListeners: vi.fn()
        },
        places: {
          Autocomplete: vi.fn(function () {
            return {
              addListener: vi.fn(),
              getPlace: vi.fn(() => ({}))
            };
          })
        }
      }
    };
  });

  afterEach(() => {
    window.google = originalGoogle;
  });

  it('sends capture data with a numeric pov.zoom read from the live map', async () => {
    const onCaptureView = vi.fn();
    const { unmount } = render(<MapContainer onCaptureView={onCaptureView} apiKey="fake-key" />);

    fireEvent.click(screen.getByText('Capture View'));

    await waitFor(() => expect(onCaptureView).toHaveBeenCalled());

    const captureData = onCaptureView.mock.calls[0][0];
    expect(captureData.pov).toEqual({ heading: 0, pitch: 0, zoom: 15 });
    expect(mapInstance.getZoom).toHaveBeenCalled();

    unmount();
  });
});
