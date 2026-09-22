import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LocationMapPicker } from '../LocationMapPicker';
import { resetGoogleMapsLoaderForTests } from '../../lib/googleMaps';
import { THEME } from '../../theme';

// A polygon's path as the mock geometry needs it: an array-like with getArray(), fed by
// whatever points the component drew or seeded it with.
function makeGooglePolygon(points = []) {
  return {
    getPath: () => ({
      getArray: () => points.map(({ lat, lng }) => ({ lat: () => lat, lng: () => lng })),
      addListener: vi.fn(),
    }),
    setMap: vi.fn(),
    addListener: vi.fn(),
  };
}

// Captures the map's 'click' handler, so a test can fire it the way clicking the map to
// place a vertex would, and every Polygon the component constructs (for seeded
// initialShapes, and for a shape finished by drawing) so a test can inspect its points.
function mockGoogleMaps() {
  let mapClickHandler = null;
  let mapInstance = null;
  const polygons = [];
  const polylines = [];

  const google = {
    maps: {
      Map: vi.fn(function () {
        mapInstance = {
          addListener: (event, handler) => {
            if (event === 'click') mapClickHandler = handler;
          },
          setOptions: vi.fn(),
        };
        return mapInstance;
      }),
      Polygon: vi.fn(function (options) {
        const polygon = makeGooglePolygon(options.paths);
        polygons.push({ polygon, options });
        return polygon;
      }),
      Polyline: vi.fn(function (options) {
        const polyline = { path: options.path ?? [], setMap: vi.fn() };
        polyline.setPath = vi.fn((path) => { polyline.path = path; });
        polylines.push(polyline);
        return polyline;
      }),
    },
  };

  return {
    google,
    polygons,
    polylines,
    get map() { return mapInstance; },
    clickMap: (point) => act(() => {
      mapClickHandler({ latLng: { lat: () => point.lat, lng: () => point.lng } });
    }),
  };
}

const TRIANGLE = [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }];

/** Draws TRIANGLE's points one map click at a time, then finishes the shape. */
const drawTriangle = (maps) => {
  fireEvent.click(screen.getByRole('button', { name: 'Draw shape' }));
  for (const point of TRIANGLE) maps.clickMap(point);
  fireEvent.click(screen.getByRole('button', { name: 'Finish shape' }));
};

describe('LocationMapPicker', () => {
  afterEach(() => {
    cleanup();
    delete window.google;
    resetGoogleMapsLoaderForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('asks for an API key rather than showing a broken map when none is configured', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    render(<LocationMapPicker t={THEME} />);

    expect(screen.getByText(/Add a Google Maps API key/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draw shape' })).not.toBeInTheDocument();
  });

  it('shows no shape list until something is drawn', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    window.google = mockGoogleMaps().google;
    render(<LocationMapPicker t={THEME} />);

    expect(screen.queryByText(/Shape 1/)).not.toBeInTheDocument();
  });

  it('cannot finish a shape with fewer than three points', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    render(<LocationMapPicker t={THEME} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draw shape' }));
    expect(screen.getByRole('button', { name: 'Finish shape' })).toBeDisabled();

    maps.clickMap(TRIANGLE[0]);
    maps.clickMap(TRIANGLE[1]);
    expect(screen.getByRole('button', { name: 'Finish shape' })).toBeDisabled();

    maps.clickMap(TRIANGLE[2]);
    expect(screen.getByRole('button', { name: 'Finish shape' })).not.toBeDisabled();
  });

  it('turns off map dragging while drawing, so a click places a point instead of panning', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    render(<LocationMapPicker t={THEME} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draw shape' }));
    expect(maps.map.setOptions).toHaveBeenLastCalledWith({ draggable: false, draggableCursor: 'crosshair' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(maps.map.setOptions).toHaveBeenLastCalledWith({ draggable: true, draggableCursor: null });
  });

  it('turns clicks on the map into a finished polygon, reported through onChange', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    const onChange = vi.fn();
    render(<LocationMapPicker t={THEME} onChange={onChange} />);

    drawTriangle(maps);

    expect(onChange).toHaveBeenLastCalledWith([{ path: TRIANGLE }]);
    expect(screen.getByText('Shape 1 · 3 points')).toBeInTheDocument();
    // Drawing mode ends, and clicking the map again does not add a second shape.
    expect(screen.getByRole('button', { name: 'Draw shape' })).toBeInTheDocument();
    maps.clickMap({ lat: 0, lng: 0 });
    expect(maps.polygons).toHaveLength(1);
  });

  it('abandons a shape when drawing is cancelled', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    render(<LocationMapPicker t={THEME} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draw shape' }));
    maps.clickMap(TRIANGLE[0]);
    maps.clickMap(TRIANGLE[1]);
    maps.clickMap(TRIANGLE[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(maps.polygons).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Draw shape' })).toBeInTheDocument();
  });

  it('seeds the map with shapes the project already has, and reports them once mounted', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    const onChange = vi.fn();
    render(<LocationMapPicker t={THEME} initialShapes={[{ path: TRIANGLE }]} onChange={onChange} />);

    expect(maps.google.maps.Polygon).toHaveBeenCalledTimes(1);
    expect(maps.polygons[0].options.paths).toEqual(TRIANGLE);
    expect(screen.getByText('Shape 1 · 3 points')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith([{ path: TRIANGLE }]);
  });

  it('ignores a seeded shape with fewer than 3 points — not a real polygon', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    render(<LocationMapPicker t={THEME} initialShapes={[{ path: TRIANGLE.slice(0, 2) }]} />);

    expect(maps.google.maps.Polygon).not.toHaveBeenCalled();
  });

  it('removes a shape from the map and reports the change', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    const onChange = vi.fn();
    render(<LocationMapPicker t={THEME} initialShapes={[{ path: TRIANGLE }]} onChange={onChange} />);
    const [{ polygon }] = maps.polygons;

    fireEvent.click(screen.getByRole('button', { name: 'Remove shape 1' }));

    expect(polygon.setMap).toHaveBeenCalledWith(null);
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText(/Shape 1/)).not.toBeInTheDocument();
  });

  it('numbers each shape by its position in the list, in draw order', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const maps = mockGoogleMaps();
    window.google = maps.google;
    render(<LocationMapPicker t={THEME} onChange={vi.fn()} />);

    drawTriangle(maps);
    fireEvent.click(screen.getByRole('button', { name: 'Draw shape' }));
    for (const point of [...TRIANGLE, { lat: 55.62, lng: 13 }]) maps.clickMap(point);
    fireEvent.click(screen.getByRole('button', { name: 'Finish shape' }));

    expect(screen.getByText('Shape 1 · 3 points')).toBeInTheDocument();
    expect(screen.getByText('Shape 2 · 4 points')).toBeInTheDocument();
  });
});
