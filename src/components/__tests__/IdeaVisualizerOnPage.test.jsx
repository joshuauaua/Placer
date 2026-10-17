import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { IdeaVisualizerOnPage } from '../toolkit/IdeaVisualizerOnPage';
import { THEME } from '../../theme';
import { rememberAnswer } from '../../toolkit/rooms';
import { combineVisuals, recordedVisual, sceneProblems } from '../../lib/ideaVisualizer';

// Stands in for the Konva canvas: one button places a bench where the real one would.
vi.mock('../ImaginationCanvas', () => ({
  default: ({ canvasAssets, onCanvasAssetsChange, backgroundImage, fit }) => (
    <div data-testid="imagination-canvas" data-background={backgroundImage ?? ''} data-fit={String(fit)}>
      <span>{canvasAssets.length} placed</span>
      <button type="button" onClick={() => onCanvasAssetsChange([...canvasAssets, {
        id: `a-${canvasAssets.length}`, type: 'bench', label: 'Bench', cat: 'seating', x: 500, y: 350, scale: 1, rotation: 0,
      }])}>
        Place a bench
      </button>
    </div>
  ),
}));

const ROOM = {
  id: 'room-idea', expiresAt: '2026-11-05T12:00:00Z',
  config: { address: 'Folkets Park, Malmö', point: { lat: 55.59, lng: 13.01 }, imagePath: 'scenes/proj-1/scene-1.webp', view: null },
};
const KNOWN = new Set(['bench', 'tree']);

function fakeService(contributions = []) {
  let listener = () => {};
  return {
    readContributions: vi.fn(() => Promise.resolve(contributions)),
    subscribeToRoom: vi.fn((_, onChange) => { listener = onChange; return () => {}; }),
    saveContribution: vi.fn(() => Promise.resolve(true)),
    tell: () => listener(),
  };
}

afterEach(() => {
  localStorage.clear();
});

describe('Idea Visualizer on a project page', () => {
  it('opens on the photo, and the whole tool on Visualize', async () => {
    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={fakeService()} />);

    expect(screen.queryByTestId('imagination-canvas')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));

    const canvas = await screen.findByTestId('imagination-canvas');
    expect(canvas).toHaveAttribute('data-fit', 'true');
    expect(screen.getByRole('button', { name: 'Record my visualization' })).toBeDisabled();
  });

  it('records the idea to the project, without a name, and remembers it', async () => {
    const service = fakeService();
    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={service} />);
    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Place a bench' }));
    fireEvent.change(screen.getByLabelText('Name your idea'), { target: { value: 'Somewhere to sit' } });

    fireEvent.click(screen.getByRole('button', { name: 'Record my visualization' }));

    await waitFor(() => expect(service.saveContribution).toHaveBeenCalled());
    expect(service.saveContribution).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 'room-idea',
      displayName: null,
      state: { assets: [{ type: 'bench', x: 500, y: 350, scale: 1, rotation: 0 }], title: 'Somewhere to sit', description: '' },
    }));
    expect(await screen.findByText('Recorded to the project. Thank you.')).toBeInTheDocument();
  });

  it('shows everybody else\'s ideas on the same photo, live', async () => {
    const service = fakeService([
      { state: { assets: [{ type: 'tree', x: 100, y: 100, scale: 1, rotation: 0 }], title: 'More trees' } },
      { state: { assets: [] } },
    ]);
    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={service} />);

    fireEvent.click(await screen.findByRole('button', { name: 'See other visualizations (1)' }));

    const list = within(screen.getByRole('list', { name: 'Other visualizations' }));
    expect(list.getByRole('img', { name: 'More trees, drawn on the photo' })).toBeInTheDocument();
    expect(list.getByText('More trees')).toBeInTheDocument();

    service.readContributions.mockResolvedValue([
      { state: { assets: [{ type: 'tree', x: 100, y: 100, scale: 1, rotation: 0 }], title: 'More trees' } },
      { state: { assets: [{ type: 'bench', x: 10, y: 10, scale: 1, rotation: 0 }], title: 'A bench' } },
    ]);
    await act(async () => { service.tell(); });

    expect(await screen.findByText('A bench')).toBeInTheDocument();
  });

  it('says so when nobody has recorded one yet', async () => {
    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={fakeService()} />);

    fireEvent.click(screen.getByRole('button', { name: 'See other visualizations' }));

    expect(await screen.findByText('Nobody has recorded a visualization yet. Be the first.')).toBeInTheDocument();
  });

  it('opens again on what this browser recorded before', () => {
    rememberAnswer('room-idea', { assets: [{ type: 'bench', x: 1, y: 2, scale: 1, rotation: 0 }], title: 'Mine' });

    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={fakeService()} />);

    expect(screen.getByText('1 placed')).toBeInTheDocument();
    expect(screen.getByLabelText('Name your idea')).toHaveValue('Mine');
    expect(screen.getByRole('button', { name: 'Update my visualization' })).toBeDisabled();
  });
});

describe('Idea Visualizer for a project, the logic', () => {
  it('needs the address and a photo before the room can open', () => {
    expect(sceneProblems({ point: null, imagePath: null })).toHaveLength(2);
    expect(sceneProblems({ point: { lat: 1, lng: 2 }, imagePath: 'scenes/p/s.webp' })).toEqual([]);
  });

  it('keeps only known assets, on the stage, and trims what the idea says', () => {
    expect(recordedVisual({
      assets: [
        { type: 'bench', x: 2000, y: -5, scale: 50, rotation: 400, icon: 'blob:x', label: 'Bench' },
        { type: 'spaceship', x: 1, y: 1 },
        { type: 'tree', x: 'nope', y: 1 },
      ],
      title: '  A bench  ',
      description: 'x'.repeat(600),
    }, KNOWN)).toEqual({
      assets: [{ type: 'bench', x: 1000, y: 0, scale: 10, rotation: 40 }],
      title: 'A bench',
      description: 'x'.repeat(500),
    });
  });

  it('lists the ideas with something on them', () => {
    const combined = combineVisuals([
      { assets: [{ type: 'tree', x: 1, y: 1 }] }, { assets: [] }, null, 'nonsense', {},
    ], KNOWN);

    expect(combined.people).toBe(1);
    expect(combined.visuals[0].assets[0].type).toBe('tree');
  });
});
