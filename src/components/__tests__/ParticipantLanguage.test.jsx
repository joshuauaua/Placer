import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { setLanguage } from '../../i18n';
import { readRoom, saveContribution } from '../../test/roomServices';
import { hours, renderAt, useRoomServices } from '../../test/toolkitRoom';

vi.mock('../../services/rooms', () => import('../../test/roomServices'));

useRoomServices();

afterEach(() => {
  setLanguage('en');
});

describe('a participant who reads Turkish', () => {
  beforeEach(() => {
    readRoom.mockResolvedValue({ tool: 'word-cloud', status: 'open', expiresAt: hours(2) });
  });

  it('switches the room to Turkish from the bar above it, and can still take part', async () => {
    renderAt('/toolkit/word-cloud', 'room=room-1');
    await screen.findByText(/you are in a room/i);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'tr' } });

    expect(await screen.findByText('Bir odadasın')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('tr');
    expect(screen.getByText('Kelime Bulutu')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Kelimen'), { target: { value: 'Yeşil' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }));

    // What somebody types is sent as they typed it, whatever the screen is in.
    await waitFor(
      () => {
        expect(saveContribution).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', state: { words: ['yeşil'] } })
        );
      },
      { timeout: 2000 }
    );
  });
});
