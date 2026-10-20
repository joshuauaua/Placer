import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { IdeaVisualizerOnPage } from '../toolkit/IdeaVisualizerOnPage';
import { THEME } from '../../theme';
import { rememberAnswer } from '../../toolkit/rooms';
import { MAX_VISUALS, combineVisuals, personVisuals, recordedVisual, sceneProblems } from '../../lib/ideaVisualizer';

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
      state: { visuals: [
        { assets: [{ type: 'bench', x: 500, y: 350, scale: 1, rotation: 0 }], title: 'Somewhere to sit', description: '' },
      ] },
    }));
    expect(await screen.findByText('Recorded to the project. Thank you.')).toBeInTheDocument();
  });

  it('shows a grid of the results once recorded, its own first, then Create another', async () => {
    const service = fakeService([
      { state: { assets: [{ type: 'tree', x: 100, y: 100, scale: 1, rotation: 0 }], title: 'More trees' } },
    ]);
    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={service} />);
    fireEvent.click(screen.getByRole('button', { name: 'Visualize' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Place a bench' }));
    fireEvent.change(screen.getByLabelText('Name your idea'), { target: { value: 'Somewhere to sit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record my visualization' }));

    const grid = within(await screen.findByRole('list', { name: 'Visualizations' }));
    const items = grid.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Yours')).toBeInTheDocument();
    expect(within(items[0]).getByText('Somewhere to sit')).toBeInTheDocument();
    expect(within(items[1]).getByText('More trees')).toBeInTheDocument();
    expect(screen.queryByTestId('imagination-canvas')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create another' }));
    expect(await screen.findByText('0 placed')).toBeInTheDocument();
    expect(screen.getByLabelText('Name your idea')).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Place a bench' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record my visualization' }));

    await waitFor(() => expect(service.saveContribution).toHaveBeenCalledTimes(2));
    expect(service.saveContribution.mock.lastCall[0].state.visuals).toHaveLength(2);
    expect(within(await screen.findByRole('list', { name: 'Visualizations' })).getAllByText('Yours')).toHaveLength(2);
  });

  it('goes back to the results from Create another without recording', async () => {
    rememberAnswer('room-idea', { visuals: [{ assets: [{ type: 'bench', x: 1, y: 2, scale: 1, rotation: 0 }], title: 'Mine' }] });
    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={fakeService()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create another' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('list', { name: 'Visualizations' })).toBeInTheDocument();
  });

  it('stops offering another once somebody has recorded the most they can', () => {
    const one = { assets: [{ type: 'bench', x: 1, y: 2, scale: 1, rotation: 0 }] };
    rememberAnswer('room-idea', { visuals: Array.from({ length: MAX_VISUALS }, () => one) });
    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={fakeService()} />);

    expect(screen.getByRole('button', { name: 'Create another' })).toBeDisabled();
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

  it('opens again on the results for what this browser recorded before, even one visual from before', () => {
    rememberAnswer('room-idea', { assets: [{ type: 'bench', x: 1, y: 2, scale: 1, rotation: 0 }], title: 'Mine' });

    render(<IdeaVisualizerOnPage t={THEME} room={ROOM} service={fakeService()} />);

    const grid = within(screen.getByRole('list', { name: 'Visualizations' }));
    expect(grid.getByText('Mine')).toBeInTheDocument();
    expect(grid.getByText('Yours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create another' })).toBeEnabled();
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

  it('reads several visuals from one person, and counts them as one person', () => {
    const tree = { assets: [{ type: 'tree', x: 1, y: 1 }] };
    const combined = combineVisuals([{ visuals: [tree, { assets: [] }, tree] }, tree], KNOWN);

    expect(combined.people).toBe(2);
    expect(combined.visuals).toHaveLength(3);
    expect(personVisuals({ visuals: Array.from({ length: MAX_VISUALS + 5 }, () => tree) }, KNOWN)).toHaveLength(MAX_VISUALS);
  });
});
