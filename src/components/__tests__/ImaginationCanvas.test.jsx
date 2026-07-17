import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import ImaginationCanvas from '../ImaginationCanvas';

vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown, onTouchStart }) => (
    <div data-testid="stage" onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
      {children}
    </div>
  ),
  Layer: ({ children }) => <div>{children}</div>,
  Circle: ({ x, y, onClick, onTap }) => (
    <div data-testid={`circle-${x}-${y}`} onClick={onClick} onTouchEnd={onTap} />
  ),
  Text: () => null,
  Transformer: () => null,
  Image: () => null,
}));

vi.mock('use-image', () => ({
  default: () => [null],
}));

const asset = { id: 'canvas-asset-1', type: 'tree', label: 'Tree', cat: 'green', x: 10, y: 10, scale: 1 };

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
