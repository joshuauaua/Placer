import { describe, it, expect, vi } from 'vite-plus/test';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { createRoom, readRoom, readContributions, saveContribution } from '../../test/roomServices';
import { hours, renderAt, useRoomServices } from '../../test/toolkitRoom';
import { configureTool, save } from '../../test/configureTool';
import { lastMap } from '../../test/maplibreStub';

vi.mock('../../services/rooms', () => import('../../test/roomServices'));

useRoomServices();

const site = { id: 's1', name: 'Market square', point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: null };

function drag(map, steps = 12) {
  fireEvent.pointerDown(map, { clientX: 0, clientY: 0, pointerId: 1 });
  for (let i = 1; i <= steps; i += 1) fireEvent.pointerMove(map, { clientX: i * 10, clientY: i * 4, pointerId: 1 });
  fireEvent.pointerUp(map, { clientX: steps * 10, clientY: steps * 4, pointerId: 1 });
}

describe('Desire Lines in a room', () => {
  it("draws on the room's sites, and publishes the walks", async () => {
    readRoom.mockResolvedValue({
      tool: 'desire-lines', status: 'open', expiresAt: hours(2), config: { prompt: 'Which way?', sites: [site] },
    });

    renderAt('/toolkit/desire-lines', 'room=room-1');
    await screen.findByText(/you are in a room/i);
    await act(async () => { await lastMap().ready; });

    expect(screen.getByText('Market square')).toBeInTheDocument();
    drag(screen.getByRole('application'));

    await waitFor(
      () => expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({
        roomId: 'room-1', state: { sites: { s1: [expect.objectContaining({ points: expect.any(Array) })] }, elements: {} },
      })),
      { timeout: 2000 },
    );
  });

  it("lays the others' walks over one's own when asked", async () => {
    readRoom.mockResolvedValue({
      tool: 'desire-lines', status: 'open', expiresAt: hours(2), config: { sites: [site] },
    });
    readContributions.mockResolvedValue([
      { displayName: null, updatedAt: 'a', state: { sites: { s1: [{ id: 'z', points: [[13.4, 52.52], [13.404, 52.52]] }] } } },
    ]);

    renderAt('/toolkit/desire-lines', 'room=room-1');
    await screen.findByText(/you are in a room/i);
    await act(async () => { await lastMap().ready; });
    fireEvent.click(await screen.findByRole('button', { name: /show other people/i }));

    expect(lastMap().getSource('others').data.features).toHaveLength(1);
    expect(screen.getByText(/1 walk by other people/)).toBeInTheDocument();
  });
});

describe('setting Desire Lines up for a project', () => {
  it('asks for a site, framed on the map, and opens the room with it', async () => {
    createRoom.mockResolvedValue({ id: 'room-1', pin: '123456', facilitatorToken: 'facilitator-1' });
    const { onConfigured } = configureTool('desire-lines');

    // No site yet, so there is nothing to open a room with.
    expect(screen.getByRole('button', { name: 'Add this site' })).toBeDisabled();
    await act(async () => { await lastMap().ready; });
    fireEvent.change(screen.getByLabelText('Site name'), { target: { value: 'Market square' } });
    act(() => {
      lastMap().jumpTo({ center: [13.4, 52.52], zoom: 17 });
      lastMap().fire('moveend');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add this site' }));

    expect(screen.getByRole('list', { name: 'Sites' })).toHaveTextContent('Market square');
    fireEvent.change(screen.getByLabelText(/what do you want to know/i), { target: { value: 'Which way?' } });
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom).toHaveBeenCalledWith('desire-lines', 'proj-1', expect.any(String), {
      prompt: 'Which way?',
      note: '',
      types: [],
      sites: [expect.objectContaining({ id: 's1', name: 'Market square', point: { lat: 52.52, lng: 13.4 }, elements: [] })],
    }, null);
  });

  it('adds kinds of thing to mark, and marks them on a site', async () => {
    createRoom.mockResolvedValue({ id: 'room-1', pin: '123456', facilitatorToken: 'facilitator-1' });
    const { onConfigured } = configureTool('desire-lines');
    await act(async () => { await lastMap().ready; });

    fireEvent.change(screen.getByLabelText('Name a kind of thing'), { target: { value: 'Bench' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add kind' }));
    expect(screen.getByRole('list', { name: 'Kinds of thing to mark' })).toHaveTextContent('Bench');

    fireEvent.change(screen.getByLabelText('Site name'), { target: { value: 'Market square' } });
    act(() => {
      lastMap().jumpTo({ center: [13.4, 52.52], zoom: 17 });
      lastMap().fire('moveend');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add this site' }));

    fireEvent.click(screen.getByRole('button', { name: 'Mark things on Market square' }));
    const map = screen.getByRole('application', { name: /tap the map to mark/i });
    fireEvent.click(screen.getByRole('button', { name: 'Bench' }));
    fireEvent.pointerDown(map, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(map, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(screen.getByRole('list', { name: 'Marked on Market square' })).toHaveTextContent('Bench');
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom.mock.calls[0][3]).toMatchObject({
      types: [{ id: 't1', label: 'Bench' }],
      sites: [{ id: 's1', elements: [{ type: 't1', label: 'Bench' }] }],
    });
  });

  it('will not open a room with no site', async () => {
    configureTool('desire-lines');

    save();

    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one site');
    expect(createRoom).not.toHaveBeenCalled();
  });
});
