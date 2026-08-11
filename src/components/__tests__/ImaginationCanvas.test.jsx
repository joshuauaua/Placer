import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import ImaginationCanvas from '../ImaginationCanvas';

// The real detector pulls in ~4 MB of WASM, so it is mocked here. Its own
// behaviour is covered against real OpenCV.js in src/lib/__tests__/detectLines.test.js.
const detectMock = vi.fn();
const loadOpenCvMock = vi.fn(() => Promise.resolve({}));

vi.mock('../../lib/detectLines', () => ({
  detectLines: (...args) => detectMock(...args),
  loadOpenCv: (...args) => loadOpenCvMock(...args),
}));

// The component reads the pointer through Konva's stage
// (e.target.getStage().getPointerPosition()), so the mock Stage synthesizes that
// shape from the DOM event's clientX/clientY. Without it, drawing cannot be
// driven from jsdom at all.
const konvaEvent = (domEvent) => {
  const stage = {
    getPointerPosition: () => ({ x: Number(domEvent.clientX), y: Number(domEvent.clientY) }),
  };
  stage.getStage = () => stage;
  return { target: stage, evt: domEvent };
};

vi.mock('react-konva/lib/ReactKonvaCore', () => ({
  Stage: ({ children, onMouseDown, onTouchStart, onMouseMove, onMouseUp }) => (
    <div
      data-testid="stage"
      onMouseDown={(e) => onMouseDown?.(konvaEvent(e))}
      onTouchStart={onTouchStart}
      onMouseMove={(e) => onMouseMove?.(konvaEvent(e))}
      onMouseUp={(e) => onMouseUp?.(konvaEvent(e))}
    >
      {children}
    </div>
  ),
  Layer: ({ children }) => <div>{children}</div>,
  Circle: ({ x, y, onClick, onTap }) => (
    <div data-testid={`circle-${x}-${y}`} onClick={onClick} onTouchEnd={onTap} />
  ),
  Line: ({ points, stroke, strokeWidth, closed, dash, onClick }) => (
    <div
      data-testid={dash ? 'draft-line' : `line-${points.join(',')}`}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-closed={String(!!closed)}
      onClick={onClick}
    />
  ),
  Text: () => null,
  Transformer: () => null,
  Image: () => null,
}));

vi.mock('konva/lib/shapes/Circle', () => ({}));
vi.mock('konva/lib/shapes/Line', () => ({}));
vi.mock('konva/lib/shapes/Text', () => ({}));
vi.mock('konva/lib/shapes/Transformer', () => ({}));
vi.mock('konva/lib/shapes/Image', () => ({}));

vi.mock('use-image', () => ({
  default: () => [null],
}));

const asset = { id: 'canvas-asset-1', type: 'tree', label: 'Tree', cat: 'green', x: 10, y: 10, scale: 1 };

beforeEach(() => {
  detectMock.mockReset();
  loadOpenCvMock.mockReset().mockResolvedValue({});
  // Default: two segments and one vegetation polygon.
  detectMock.mockResolvedValue({
    lines: [
      { id: 'detected-1', cls: 'road_edge', points: [0, 0, 100, 100], closed: false },
      { id: 'detected-2', cls: 'horizontal', points: [0, 50, 100, 52], closed: false },
    ],
    stats: { road_edge: 1, horizontal: 1, vegetation: 0, markingSkipped: false, markingVMin: 175 },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ImaginationCanvas', () => {
  it('renders without crashing', () => {
    render(<ImaginationCanvas availableAssets={[]} canvasAssets={[]} onCanvasAssetsChange={() => {}} />);
    expect(screen.getByText('Asset Library')).toBeInTheDocument();
  });

  it('deletes the selected asset when Delete is pressed', () => {
    const onCanvasAssetsChange = vi.fn();
    render(
      <ImaginationCanvas
        availableAssets={[]}
        canvasAssets={[asset]}
        onCanvasAssetsChange={onCanvasAssetsChange}
      />
    );

    fireEvent.click(screen.getByTestId(`circle-${asset.x}-${asset.y}`));
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onCanvasAssetsChange).toHaveBeenCalledWith([]);
  });

  it('does not delete anything when no asset is selected', () => {
    const onCanvasAssetsChange = vi.fn();
    render(
      <ImaginationCanvas
        availableAssets={[]}
        canvasAssets={[asset]}
        onCanvasAssetsChange={onCanvasAssetsChange}
      />
    );

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onCanvasAssetsChange).not.toHaveBeenCalled();
  });
});

describe('ImaginationCanvas line drawing', () => {
  // Helper: enter draw mode, optionally choosing a class, then drag a segment.
  function drawSegment(from, to) {
    const stage = screen.getByTestId('stage');
    fireEvent.mouseDown(stage, { clientX: from[0], clientY: from[1] });
    fireEvent.mouseMove(stage, { clientX: to[0], clientY: to[1] });
    fireEvent.mouseUp(stage, { clientX: to[0], clientY: to[1] });
  }

  function renderCanvas(props = {}) {
    const onLinesChange = vi.fn();
    render(
      <ImaginationCanvas
        availableAssets={[]}
        canvasAssets={[]}
        onCanvasAssetsChange={vi.fn()}
        lines={[]}
        onLinesChange={onLinesChange}
        {...props}
      />
    );
    return onLinesChange;
  }

  it('commits one straight two-point segment per drag', () => {
    const onLinesChange = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));

    drawSegment([10, 20], [110, 90]);

    expect(onLinesChange).toHaveBeenCalledTimes(1);
    const [created] = onLinesChange.mock.calls[0][0];
    expect(created.points).toEqual([10, 20, 110, 90]);
    expect(created.closed).toBe(false);
  });

  it('uses the active class, defaulting to road edge', () => {
    const onLinesChange = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));

    drawSegment([0, 0], [80, 80]);

    expect(onLinesChange.mock.calls[0][0][0].cls).toBe('road_edge');
  });

  it('draws in the class picked from the palette', () => {
    const onLinesChange = renderCanvas();
    // Picking a class also switches into draw mode, so no separate Draw click.
    fireEvent.click(screen.getByRole('button', { name: /Vegetation/ }));

    drawSegment([5, 5], [95, 95]);

    expect(onLinesChange.mock.calls[0][0][0].cls).toBe('vegetation');
  });

  it('does not draw while in select mode', () => {
    const onLinesChange = renderCanvas();

    drawSegment([10, 10], [200, 200]);

    expect(onLinesChange).not.toHaveBeenCalled();
  });

  it('ignores a stray click that barely moves', () => {
    const onLinesChange = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));

    // Below the 4px minimum — a click, not a line.
    drawSegment([50, 50], [51, 51]);

    expect(onLinesChange).not.toHaveBeenCalled();
  });

  it('renders existing lines with their class colour and stroke width', () => {
    renderCanvas({
      lines: [
        { id: 'l1', cls: 'road_edge', points: [0, 0, 10, 10], closed: false },
        { id: 'l2', cls: 'vegetation', points: [1, 1, 2, 2, 3, 3], closed: true },
      ],
    });

    const road = screen.getByTestId('line-0,0,10,10');
    expect(road).toHaveAttribute('data-stroke', '#00FFFF');
    expect(road).toHaveAttribute('data-stroke-width', '3');
    expect(road).toHaveAttribute('data-closed', 'false');

    // Imported vegetation contours are closed polygons with more than 2 points.
    const veg = screen.getByTestId('line-1,1,2,2,3,3');
    expect(veg).toHaveAttribute('data-stroke', '#00FF5A');
    expect(veg).toHaveAttribute('data-closed', 'true');
  });

  it('deletes the selected line when Delete is pressed', () => {
    const lines = [
      { id: 'l1', cls: 'road_edge', points: [0, 0, 10, 10], closed: false },
      { id: 'l2', cls: 'marking', points: [20, 20, 40, 40], closed: false },
    ];
    const onLinesChange = vi.fn();
    render(
      <ImaginationCanvas
        availableAssets={[]}
        canvasAssets={[]}
        onCanvasAssetsChange={vi.fn()}
        lines={lines}
        onLinesChange={onLinesChange}
      />
    );

    fireEvent.click(screen.getByTestId('line-0,0,10,10'));
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onLinesChange).toHaveBeenCalledWith([lines[1]]);
  });

  it('shows a dashed preview while dragging and removes it on commit', () => {
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    const stage = screen.getByTestId('stage');

    fireEvent.mouseDown(stage, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(stage, { clientX: 60, clientY: 60 });
    expect(screen.getByTestId('draft-line')).toBeInTheDocument();

    fireEvent.mouseUp(stage, { clientX: 60, clientY: 60 });
    expect(screen.queryByTestId('draft-line')).not.toBeInTheDocument();
  });

  it('renders vegetation above road lines regardless of creation order', () => {
    renderCanvas({
      lines: [
        { id: 'veg', cls: 'vegetation', points: [9, 9, 8, 8], closed: true },
        { id: 'road', cls: 'road_edge', points: [1, 1, 2, 2], closed: false },
      ],
    });

    const rendered = screen.getAllByTestId(/^line-/).map((el) => el.dataset.stroke);
    // Road edge cyan first (painted under), vegetation green last (on top).
    expect(rendered).toEqual(['#00FFFF', '#00FF5A']);
  });

  it('Escape abandons the in-progress drag and leaves draw mode', () => {
    const onLinesChange = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    const stage = screen.getByTestId('stage');

    fireEvent.mouseDown(stage, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(stage, { clientX: 90, clientY: 90 });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('draft-line')).not.toBeInTheDocument();
    fireEvent.mouseUp(stage, { clientX: 90, clientY: 90 });
    expect(onLinesChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'select' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables Auto-detect until a capture is available', () => {
    renderCanvas();
    expect(screen.getByRole('button', { name: /Auto-detect/ })).toBeDisabled();
  });

  it('enables Auto-detect once a background image is present', () => {
    renderCanvas({ backgroundImage: 'data:image/png;base64,AAAA' });
    expect(screen.getByRole('button', { name: /Auto-detect/ })).toBeEnabled();
  });

  it('appends detected lines to the existing ones and reports the count', async () => {
    const existing = { id: 'l1', cls: 'road_edge', points: [0, 0, 5, 5], closed: false };
    const onLinesChange = renderCanvas({
      backgroundImage: 'data:image/png;base64,AAAA',
      lines: [existing],
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));

    await waitFor(() => expect(onLinesChange).toHaveBeenCalled());
    const next = onLinesChange.mock.calls[0][0];
    // Existing lines are preserved, not replaced.
    expect(next[0]).toEqual(existing);
    expect(next).toHaveLength(3);
    expect(next.map((l) => l.cls)).toEqual(['road_edge', 'road_edge', 'horizontal']);
    expect(await screen.findByRole('status')).toHaveTextContent('2 lines');
  });

  it('surfaces the skipped-markings explanation rather than staying silent', async () => {
    detectMock.mockResolvedValueOnce({
      lines: [],
      stats: { markingSkipped: true, markingVMin: 245 },
    });
    renderCanvas({ backgroundImage: 'data:image/png;base64,AAAA' });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/lane markings skipped/i);
  });

  it('reports a raised marking threshold when the guard escalated', async () => {
    detectMock.mockResolvedValueOnce({
      lines: [],
      stats: { markingSkipped: false, markingVMin: 215 },
    });
    renderCanvas({ backgroundImage: 'data:image/png;base64,AAAA' });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('threshold raised to 215');
  });

  it('reports a failure instead of hanging when detection throws', async () => {
    detectMock.mockRejectedValueOnce(new Error('wasm exploded'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onLinesChange = renderCanvas({ backgroundImage: 'data:image/png;base64,AAAA' });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/failed/i);
    expect(onLinesChange).not.toHaveBeenCalled();
    // Button must return to idle so the user can retry.
    expect(screen.getByRole('button', { name: /Auto-detect lines/ })).toBeEnabled();
  });

  it('passes the stage dimensions so detected coordinates are scaled correctly', async () => {
    renderCanvas({ backgroundImage: 'data:image/png;base64,AAAA', width: 1000, height: 700 });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));

    await waitFor(() => expect(detectMock).toHaveBeenCalled());
    expect(detectMock.mock.calls[0][1]).toMatchObject({ stageWidth: 1000, stageHeight: 700 });
  });

  const STREETVIEW_CAPTURE = {
    source: 'streetview',
    position: { lat: 55.6054, lng: 12.9854 },
    pov: { heading: 217.5, pitch: -4.25, zoom: 2 },
    fov: 45,
    screenshot: 'data:image/png;base64,AAAA',
  };

  it('requests higher-resolution tiles for a street view capture', async () => {
    renderCanvas({
      backgroundImage: STREETVIEW_CAPTURE.screenshot,
      capturedView: STREETVIEW_CAPTURE,
      apiKey: 'test-key',
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));
    await waitFor(() => expect(detectMock).toHaveBeenCalled());

    const opts = detectMock.mock.calls[0][1];
    expect(opts.tileSources).toHaveLength(2);
    expect(opts.wideFov).toBe(45);
    // Each tile is a real Street View request aimed off the capture's heading.
    for (const { source, tile } of opts.tileSources) {
      expect(source).toContain('/maps/api/streetview');
      expect(tile.width).toBe(tile.height);
      expect(tile.fov).toBeLessThan(45);
    }
  });

  it('does not request tiles for a map capture', async () => {
    renderCanvas({
      backgroundImage: 'data:image/png;base64,AAAA',
      capturedView: { source: 'map', position: { lat: 1, lng: 2 }, fov: null },
      apiKey: 'test-key',
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));
    await waitFor(() => expect(detectMock).toHaveBeenCalled());

    expect(detectMock.mock.calls[0][1].tileSources).toBeUndefined();
  });

  it('falls back to the wide image when no API key is available', async () => {
    renderCanvas({
      backgroundImage: STREETVIEW_CAPTURE.screenshot,
      capturedView: STREETVIEW_CAPTURE,
      apiKey: '',
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));
    await waitFor(() => expect(detectMock).toHaveBeenCalled());

    expect(detectMock.mock.calls[0][1].tileSources).toBeUndefined();
  });

  it('mentions the tile count in the status line', async () => {
    detectMock.mockResolvedValueOnce({
      lines: [],
      stats: { tiles: 2, mergedAway: 7, markingSkipped: false, markingVMin: 175 },
    });
    renderCanvas({
      backgroundImage: STREETVIEW_CAPTURE.screenshot,
      capturedView: STREETVIEW_CAPTURE,
      apiKey: 'test-key',
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-detect/ }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('2 high-res tiles');
    expect(status).toHaveTextContent('7 duplicate segments merged');
  });

  it('Clear All removes both assets and lines', () => {
    const onCanvasAssetsChange = vi.fn();
    const onLinesChange = vi.fn();
    render(
      <ImaginationCanvas
        availableAssets={[]}
        canvasAssets={[asset]}
        onCanvasAssetsChange={onCanvasAssetsChange}
        lines={[{ id: 'l1', cls: 'road_edge', points: [0, 0, 5, 5], closed: false }]}
        onLinesChange={onLinesChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));

    expect(onCanvasAssetsChange).toHaveBeenCalledWith([]);
    expect(onLinesChange).toHaveBeenCalledWith([]);
  });
});
