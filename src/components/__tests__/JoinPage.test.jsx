import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../../theme';
import JoinPage from '../JoinPage';

const joinRoom = vi.fn();
const isSupabaseConfigured = vi.fn(() => true);

vi.mock('../../services/rooms', () => ({
  joinRoom: (...args) => joinRoom(...args),
  isSupabaseConfigured: (...args) => isSupabaseConfigured(...args),
}));

// record: true so the room the PIN resolved to can be asserted from the history.
function renderAt(searchPath) {
  const location = memoryLocation({ path: '/join', searchPath, record: true });
  render(
    <Router hook={location.hook}>
      <JoinPage t={THEME} />
    </Router>
  );
  return location;
}

beforeEach(() => {
  joinRoom.mockReset();
  isSupabaseConfigured.mockReset().mockReturnValue(true);
});

afterEach(() => {
  localStorage.clear();
});

describe('joining by a scanned code', () => {
  it('follows a PIN in the URL without anybody pressing anything', async () => {
    joinRoom.mockResolvedValue({ id: 'room-1', experiment: 'budget-ballot' });

    const location = renderAt('pin=839201');

    await waitFor(() => {
      expect(location.history.at(-1)).toBe('/sandbox/budget-ballot?room=room-1');
    });
    expect(joinRoom).toHaveBeenCalledWith('839201');
  });

  it('asks instead of failing silently when that PIN has been closed', async () => {
    joinRoom.mockResolvedValue(null);

    const location = renderAt('pin=839201');

    expect(await screen.findByRole('status')).toHaveTextContent(/no open room has that pin/i);
    // Went nowhere: still on the join page, with the form to try another PIN.
    expect(location.history).toHaveLength(1);
    expect(screen.getByLabelText('Room PIN')).toBeInTheDocument();
  });

  it('says so when the room is for an experiment this build does not have', async () => {
    joinRoom.mockResolvedValue({ id: 'room-1', experiment: 'from-the-future' });

    renderAt('pin=839201');

    expect(await screen.findByRole('status')).toHaveTextContent(/does not have/i);
  });

  it('reports a network failure rather than looking like a wrong PIN', async () => {
    joinRoom.mockRejectedValue(new Error('the database is unreachable'));

    renderAt('pin=839201');

    expect(await screen.findByRole('status')).toHaveTextContent(/unreachable/i);
  });
});

describe('joining by typing the PIN', () => {
  it('does not look anything up until there is a PIN to look up', () => {
    renderAt('');

    expect(joinRoom).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /join/i })).toBeDisabled();
  });

  it('groups the digits as they are typed, so they can be checked against a screen', () => {
    renderAt('');

    const input = screen.getByLabelText('Room PIN');
    fireEvent.change(input, { target: { value: '839201' } });

    expect(input).toHaveValue('839-201');
  });

  it('joins the room once six digits are in', async () => {
    joinRoom.mockResolvedValue({ id: 'room-2', experiment: 'budget-ballot' });

    const location = renderAt('');

    fireEvent.change(screen.getByLabelText('Room PIN'), { target: { value: '111222' } });
    fireEvent.click(screen.getByRole('button', { name: /join/i }));

    await waitFor(() => {
      expect(location.history.at(-1)).toBe('/sandbox/budget-ballot?room=room-2');
    });
    expect(joinRoom).toHaveBeenCalledWith('111222');
  });

  it('will not submit a half-typed PIN', () => {
    renderAt('');

    fireEvent.change(screen.getByLabelText('Room PIN'), { target: { value: '8392' } });
    fireEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinRoom).not.toHaveBeenCalled();
  });
});

describe('joining with no database behind the site', () => {
  it('explains that rooms are off instead of offering a form that cannot work', () => {
    isSupabaseConfigured.mockReturnValue(false);

    renderAt('pin=839201');

    expect(screen.getByRole('status')).toHaveTextContent(/not switched on/i);
    expect(screen.queryByLabelText('Room PIN')).not.toBeInTheDocument();
    expect(joinRoom).not.toHaveBeenCalled();
  });
});
