import { describe, it, expect, vi } from 'vite-plus/test';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { rememberHostedRoom } from '../../toolkit/rooms';
import { readRoom, readContributions, saveContribution } from '../../test/roomServices';
import { hours, renderAt, useRoomServices } from '../../test/toolkitRoom';

vi.mock('../../services/rooms', () => import('../../test/roomServices'));

useRoomServices();

// A second room-capable tool, exercised through the same machinery as the Co-Budget
// in ToolkitRoom.test.jsx — this is what proves the room layer is generic rather than tuned to
// one tool's shape.
describe('Poll in a room', () => {
  const openVoteRoom = () => ({ tool: 'open-vote', status: 'open', expiresAt: hours(2) });

  it("publishes a participant's vote once they pick one", async () => {
    readRoom.mockResolvedValue(openVoteRoom());

    renderAt('/toolkit/open-vote', 'room=room-1');
    await screen.findByText(/you are in a room/i);

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    await waitFor(
      () => {
        expect(saveContribution).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', state: { choice: 'yes' } })
        );
      },
      { timeout: 2000 }
    );
  });

  it("combines everybody's votes into the room's tally", async () => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    readRoom.mockResolvedValue(openVoteRoom());
    readContributions.mockResolvedValue([
      { displayName: 'Mara', state: { choice: 'yes' }, updatedAt: 'a' },
      { displayName: 'Sam', state: { choice: 'yes' }, updatedAt: 'b' },
      { displayName: 'Devon', state: { choice: 'no' }, updatedAt: 'c' },
    ]);

    renderAt('/toolkit/open-vote', 'room=room-1');

    expect(await screen.findByText("The room's vote")).toBeInTheDocument();
    expect(screen.getByText('3 cast')).toBeInTheDocument();
    expect(screen.getByText('2 · 67%')).toBeInTheDocument();
    expect(screen.getByText('1 · 33%')).toBeInTheDocument();
  });
});
