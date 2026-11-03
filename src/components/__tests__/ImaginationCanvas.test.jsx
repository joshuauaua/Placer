import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, fireEvent, screen, cleanup, within } from '@testing-library/react';
import ImaginationCanvas from '../ImaginationCanvas';
import { ASSET_LIB } from '../../data';
import { CAT } from '../../theme';

// Where the pointer is on the stage, in shown pixels, for the pen tests.
let pointerAt = { x: 0, y: 0 };

vi.mock('react-konva/lib/ReactKonvaCore', () => ({
  // React 19 hands a function component its ref as a prop; the stand-in stage answers
  // getPointerPosition the way Konva's does, and passes mouse events through.
  Stage: ({ children, ref, onMouseDown, onMouseMove, onMouseUp, width, height }) => {
    if (ref && typeof ref === 'object') ref.current = { getPointerPosition: () => pointerAt };
    return (
      <div data-testid="stage" data-size={`${width}x${height}`}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
        {children}
      </div>
    );
  },
  Line: ({ points, stroke, strokeWidth, opacity, globalCompositeOperation }) => (
    <div data-testid="line" data-points={points.join(',')} data-stroke={stroke} data-width={strokeWidth}
      data-opacity={opacity} data-mode={globalCompositeOperation} />
  ),
  Layer: ({ children }) => <div>{children}</div>,
  Circle: ({ x, y, onClick, onTap }) => (
    <div data-testid={`circle-${x}-${y}`} onClick={onClick} onTouchEnd={onTap} />
  ),
  Text: () => null,
  Transformer: () => null,
  Image: () => null,
}));

vi.mock('konva/lib/shapes/Circle', () => ({}));
vi.mock('konva/lib/shapes/Text', () => ({}));
vi.mock('konva/lib/shapes/Transformer', () => ({}));
vi.mock('konva/lib/shapes/Image', () => ({}));
vi.mock('konva/lib/shapes/Line', () => ({}));

vi.mock('use-image', () => ({
  default: () => [null],
}));

const asset = { id: 'canvas-asset-1', type: 'tree', label: 'Tree', cat: 'green', x: 10, y: 10, scale: 1 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ImaginationCanvas', () => {
  it('renders without crashing', () => {
    render(<ImaginationCanvas availableAssets={[]} canvasAssets={[]} onCanvasAssetsChange={() => {}} />);
    expect(screen.getByText('Asset Library')).toBeInTheDocument();
  });

  it('offers every asset in the library, grouped under its category', () => {
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}} />);

    for (const asset of ASSET_LIB) {
      const group = screen.getByRole('region', { name: CAT[asset.cat].label });
      expect(within(group).getByRole('button', { name: asset.label })).toBeInTheDocument();
    }
  });

  it('places an asset from the library on the stage', () => {
    const onCanvasAssetsChange = vi.fn();
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={onCanvasAssetsChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Picnic table' }));

    expect(onCanvasAssetsChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'picnic-table', label: 'Picnic table', cat: 'seating' }),
    ]);
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

describe('ImaginationCanvas, the pen', () => {
  const draw = (stage, from, to) => {
    pointerAt = from;
    fireEvent.mouseDown(stage);
    pointerAt = to;
    fireEvent.mouseMove(stage);
    fireEvent.mouseUp(stage);
  };

  it('offers no pen where nothing can keep a drawing', () => {
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Pen/ })).not.toBeInTheDocument();
  });

  it('opens the pen card from the Pen button over the library, and closes it again', () => {
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}}
      lines={[]} onLinesChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /^Pen/ }));
    const card = screen.getByRole('region', { name: 'Pen' });
    expect(within(card).getByRole('slider', { name: 'Colour wheel' })).toBeInTheDocument();
    expect(within(card).getByLabelText('Thickness')).toBeInTheDocument();
    expect(within(card).getByLabelText('Opacity')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Close the pen' }));
    expect(screen.queryByRole('region', { name: 'Pen' })).not.toBeInTheDocument();
  });

  it('draws a line with the chosen colour, thickness and opacity, in stage units', () => {
    const onLinesChange = vi.fn();
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}}
      lines={[]} onLinesChange={onLinesChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Pen/ }));
    fireEvent.click(screen.getByRole('button', { name: '#FF5A23' }));
    fireEvent.change(screen.getByLabelText('Thickness'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Opacity'), { target: { value: '40' } });

    draw(screen.getByTestId('stage'), { x: 10, y: 20 }, { x: 110, y: 120 });

    expect(onLinesChange).toHaveBeenCalledWith([expect.objectContaining({
      tool: 'pen', color: '#FF5A23', size: 24, opacity: 0.4, points: [10, 20, 10, 20, 110, 120],
    })]);
  });

  it('does not draw while the pen is put away', () => {
    const onLinesChange = vi.fn();
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}}
      lines={[]} onLinesChange={onLinesChange} />);

    draw(screen.getByTestId('stage'), { x: 10, y: 20 }, { x: 110, y: 120 });

    expect(onLinesChange).not.toHaveBeenCalled();
  });

  it('rubs out with the eraser, on the drawing only', () => {
    const onLinesChange = vi.fn();
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}}
      lines={[]} onLinesChange={onLinesChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Pen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));

    draw(screen.getByTestId('stage'), { x: 5, y: 5 }, { x: 50, y: 50 });

    expect(onLinesChange.mock.calls[0][0][0].tool).toBe('eraser');
  });

  it('draws what has been drawn, the eraser as a cut-out', () => {
    const lines = [
      { id: 'a', tool: 'pen', color: '#3A39FF', size: 8, opacity: 0.5, points: [0, 0, 10, 10] },
      { id: 'b', tool: 'eraser', color: '#3A39FF', size: 20, opacity: 1, points: [5, 5, 6, 6] },
    ];
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}}
      lines={lines} onLinesChange={() => {}} />);

    const [pen, eraser] = screen.getAllByTestId('line');
    expect(pen).toHaveAttribute('data-stroke', '#3A39FF');
    expect(pen).toHaveAttribute('data-opacity', '0.5');
    expect(pen).toHaveAttribute('data-mode', 'source-over');
    expect(eraser).toHaveAttribute('data-mode', 'destination-out');
  });

  it('undoes the last line, and clears them all', () => {
    const onLinesChange = vi.fn();
    const lines = [
      { id: 'a', tool: 'pen', color: '#111111', size: 8, opacity: 1, points: [0, 0, 1, 1] },
      { id: 'b', tool: 'pen', color: '#111111', size: 8, opacity: 1, points: [2, 2, 3, 3] },
    ];
    render(<ImaginationCanvas availableAssets={ASSET_LIB} canvasAssets={[]} onCanvasAssetsChange={() => {}}
      lines={lines} onLinesChange={onLinesChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Pen/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onLinesChange).toHaveBeenLastCalledWith([lines[0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear drawing' }));
    expect(onLinesChange).toHaveBeenLastCalledWith([]);
  });
});

describe('ImaginationCanvas, its shape', () => {
  it('keeps the stage the shape it is given', () => {
    render(<ImaginationCanvas availableAssets={[]} canvasAssets={[]} onCanvasAssetsChange={() => {}}
      width={1000} height={1333} />);
    // jsdom has no layout, so it is shown at its own size; the shape is what matters.
    expect(screen.getByTestId('stage')).toHaveAttribute('data-size', '1000x1333');
  });
});
