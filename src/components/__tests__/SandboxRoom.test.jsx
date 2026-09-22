import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../../theme';
import { rememberHostedRoom } from '../../sandbox/rooms';
import SandboxPage from '../SandboxPage';

const createRoom = vi.fn();
const readRoom = vi.fn();
const readContributions = vi.fn();
const saveContribution = vi.fn();
const closeRoom = vi.fn();
const subscribeToRoom = vi.fn();
const isSupabaseConfigured = vi.fn(() => true);

vi.mock('../../services/rooms', () => ({
  createRoom: (...a) => createRoom(...a),
  readRoom: (...a) => readRoom(...a),
  readContributions: (...a) => readContributions(...a),
  saveContribution: (...a) => saveContribution(...a),
  closeRoom: (...a) => closeRoom(...a),
  subscribeToRoom: (...a) => subscribeToRoom(...a),
  isSupabaseConfigured: (...a) => isSupabaseConfigured(...a),
}));

/**
 * An ISO deadline this many hours from now. Future deadlines get half a minute of
 * slack, because the countdown floors to whole minutes and the milliseconds spent
 * rendering would otherwise turn "2h" into "1h 59m".
 */
const hours = (n) => new Date(Date.now() + n * 3600000 + (n > 0 ? 30000 : 0)).toISOString();

/** A room that is live, with the full two hours ahead of it. */
const openRoom = () => ({ experiment: 'budget-ballot', status: 'open', expiresAt: hours(2) });

function renderAt(path, searchPath = '', props = {}) {
  const location = memoryLocation({ path, searchPath, record: true });
  render(
    <Router hook={location.hook}>
      <SandboxPage t={THEME} {...props} />
    </Router>
  );
  return location;
}

beforeEach(() => {
  for (const spy of [createRoom, readRoom, readContributions, saveContribution, closeRoom, subscribeToRoom]) {
    spy.mockReset();
  }
  isSupabaseConfigured.mockReset().mockReturnValue(true);
  readContributions.mockResolvedValue([]);
  subscribeToRoom.mockReturnValue(() => {});
  saveContribution.mockResolvedValue(true);
});

afterEach(() => {
  localStorage.clear();
});

describe('an experiment outside a room', () => {
  it('is exactly as it was, with no room furniture on it', () => {
    renderAt('/sandbox/budget-ballot');

    expect(screen.getByRole('heading', { level: 1, name: 'Budget Ballot' })).toBeInTheDocument();
    expect(screen.queryByText(/you are in a room/i)).not.toBeInTheDocument();
    expect(screen.queryByText("The room's ballot")).not.toBeInTheDocument();
    expect(readRoom).not.toHaveBeenCalled();
  });

  it('offers a room on an experiment that can host one', () => {
    renderAt('/sandbox/budget-ballot');

    expect(screen.getByRole('button', { name: /start a room/i })).toBeInTheDocument();
  });

  it('offers nothing on an experiment that cannot', () => {
    renderAt('/sandbox/street-mixer');

    expect(screen.queryByRole('button', { name: /start a room/i })).not.toBeInTheDocument();
  });

  it('offers nothing when there is no database to host it in', () => {
    isSupabaseConfigured.mockReturnValue(false);

    renderAt('/sandbox/budget-ballot');

    expect(screen.queryByRole('button', { name: /start a room/i })).not.toBeInTheDocument();
  });
});

describe('opening a room', () => {
  it('goes to the room it just opened', async () => {
    createRoom.mockResolvedValue({
      id: 'room-1', pin: '839201', facilitatorToken: 'facilitator-1', expiresAt: hours(2),
    });
    readRoom.mockResolvedValue(openRoom());

    const location = renderAt('/sandbox/budget-ballot');

    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));

    await waitFor(() => {
      expect(location.history.at(-1)).toBe('/sandbox/budget-ballot?room=room-1');
    });
    expect(createRoom).toHaveBeenCalledWith('budget-ballot', null);
  });

  it('attaches the room to a project named in the URL', async () => {
    createRoom.mockResolvedValue({
      id: 'room-1', pin: '839201', facilitatorToken: 'facilitator-1', expiresAt: hours(2),
    });
    readRoom.mockResolvedValue(openRoom());

    renderAt('/sandbox/budget-ballot', 'project=proj-1');

    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('budget-ballot', 'proj-1'));
  });
});

describe('a room seen by the facilitator', () => {
  beforeEach(() => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    readRoom.mockResolvedValue(openRoom());
  });

  it('shows the PIN grouped, and a QR code of the join link', async () => {
    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByLabelText('Room PIN 839-201')).toHaveTextContent('839-201');
    // react-qr-code renders an svg; the link it encodes is the join URL.
    const qr = document.querySelector('svg[viewBox]');
    expect(qr).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy join link/i })).toBeInTheDocument();
  });

  it('says how many people have contributed', async () => {
    readContributions.mockResolvedValue([
      { displayName: 'Mara', state: { benches: 4 }, updatedAt: 'a' },
      { displayName: 'Sam', state: { benches: 2 }, updatedAt: 'b' },
    ]);

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/2 people have contributed/i)).toBeInTheDocument();
  });

  it('follows the room, and stops following it on the way out', async () => {
    const unsubscribe = vi.fn();
    subscribeToRoom.mockReturnValue(unsubscribe);

    const { unmount } = render(
      <Router hook={memoryLocation({ path: '/sandbox/budget-ballot', searchPath: 'room=room-1' }).hook}>
        <SandboxPage t={THEME} />
      </Router>
    );

    await waitFor(() => expect(subscribeToRoom).toHaveBeenCalled());
    expect(subscribeToRoom.mock.calls[0][0]).toBe('room-1');

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("combines everybody's ballots into the room's own", async () => {
    readContributions.mockResolvedValue([
      { displayName: 'Mara', state: { benches: 4 }, updatedAt: 'a' },
      { displayName: 'Sam', state: { benches: 2 }, updatedAt: 'b' },
    ]);

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByText("The room's ballot")).toBeInTheDocument();
    // benches are 900 each and 4 and 2 average to 3, so the room commits 2,700 —
    // not the 5,400 that adding the two ballots together would report.
    expect(screen.getByText('€2,700')).toBeInTheDocument();
    expect(screen.getByText('2 cast')).toBeInTheDocument();
  });

  it('waits for somebody to actually choose something', async () => {
    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/nobody has cast a ballot yet/i)).toBeInTheDocument();
  });

  it('asks once before closing the room, then closes it', async () => {
    closeRoom.mockResolvedValue(true);

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    const close = await screen.findByRole('button', { name: 'Close room' });
    fireEvent.click(close);

    // The first press only arms it: closing ends the room for everybody in it.
    expect(closeRoom).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /close — confirm/i }));

    await waitFor(() => expect(closeRoom).toHaveBeenCalledWith('room-1', 'facilitator-1'));
    expect(await screen.findByRole('status')).toHaveTextContent(/this room is closed/i);
  });
});

describe('a room seen by somebody who joined it', () => {
  beforeEach(() => {
    readRoom.mockResolvedValue(openRoom());
  });

  it('tells them they are in it, without showing them the PIN or the close button', async () => {
    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/you are in a room/i)).toBeInTheDocument();
    expect(screen.queryByText('839-201')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close room/i })).not.toBeInTheDocument();
  });

  it('publishes their ballot once they move something', async () => {
    renderAt('/sandbox/budget-ballot', 'room=room-1');

    await screen.findByText(/you are in a room/i);

    // Nothing is sent for a ballot nobody has touched: a room full of zeroes would
    // count people who have not chosen and drag the average down with them.
    expect(saveContribution).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Benches with backs'), { target: { value: '3' } });

    await waitFor(
      () => {
        expect(saveContribution).toHaveBeenCalledWith(
          expect.objectContaining({
            roomId: 'room-1',
            state: expect.objectContaining({ benches: 3 }),
          })
        );
      },
      { timeout: 2000 }
    );
  });
});

describe('a room running out of time', () => {
  beforeEach(() => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
  });

  it('shows the facilitator how long is left', async () => {
    readRoom.mockResolvedValue({ experiment: 'budget-ballot', status: 'open', expiresAt: hours(2) });

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    // Anchored: the sentence below the PIN names the time left as well, and an
    // unanchored match would find both.
    expect(await screen.findByText(/^2h left$/)).toBeInTheDocument();
    expect(screen.getByText(/lasts two hours from opening/i)).toBeInTheDocument();
  });

  it('says it has run out of time, not that somebody closed it', async () => {
    readRoom.mockResolvedValue({ experiment: 'budget-ballot', status: 'expired', expiresAt: hours(-1) });

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/run out of time/i);
    expect(notice).not.toHaveTextContent(/is closed/i);
    expect(readContributions).not.toHaveBeenCalled();
  });

  it('gives up on a room whose deadline passes while the page is open', async () => {
    // Two seconds out, so the hook's timer fires during the test rather than in
    // two hours. The PIN must stop being offered the moment it stops working.
    readRoom.mockResolvedValue({
      experiment: 'budget-ballot',
      status: 'open',
      expiresAt: new Date(Date.now() + 1200).toISOString(),
    });

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByLabelText('Room PIN 839-201')).toBeInTheDocument();

    expect(await screen.findByText(/run out of time/i, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByLabelText('Room PIN 839-201')).not.toBeInTheDocument();
  });

  it('tells a participant which ending it was when their ballot is refused', async () => {
    readRoom
      .mockResolvedValueOnce({ experiment: 'budget-ballot', status: 'open', expiresAt: hours(2) })
      .mockResolvedValue({ experiment: 'budget-ballot', status: 'expired', expiresAt: hours(-1) });
    saveContribution.mockResolvedValue(false);

    renderAt('/sandbox/budget-ballot', 'room=room-1');
    await screen.findByLabelText('Room PIN 839-201');

    fireEvent.change(screen.getByLabelText('Benches with backs'), { target: { value: '3' } });

    expect(await screen.findByText(/run out of time/i, {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe('a room that has gone', () => {
  it('says it is closed rather than showing an empty one', async () => {
    readRoom.mockResolvedValue({ experiment: 'budget-ballot', status: 'closed', expiresAt: hours(2) });

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByRole('status')).toHaveTextContent(/this room is closed/i);
    expect(readContributions).not.toHaveBeenCalled();
  });

  it('says so when the id names no room at all', async () => {
    readRoom.mockResolvedValue(null);

    renderAt('/sandbox/budget-ballot', 'room=nope');

    expect(await screen.findByRole('status')).toHaveTextContent(/does not exist/i);
  });

  it('refuses a room that belongs to another experiment', async () => {
    readRoom.mockResolvedValue({ experiment: 'desire-lines', status: 'open', expiresAt: hours(2) });

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    expect(await screen.findByRole('status')).toHaveTextContent(/different experiment/i);
    expect(readContributions).not.toHaveBeenCalled();
  });

  it('leaves the experiment itself working', async () => {
    readRoom.mockResolvedValue({ experiment: 'budget-ballot', status: 'closed', expiresAt: hours(2) });

    renderAt('/sandbox/budget-ballot', 'room=room-1');

    await screen.findByRole('status');
    expect(screen.getByRole('heading', { level: 1, name: 'Budget Ballot' })).toBeInTheDocument();
    expect(screen.getByLabelText('Benches with backs')).toBeInTheDocument();
  });
});

/*
 * Opening a room creates something other people join, so it takes an account. Joining one
 * takes nothing at all — a participant scans a QR code or types a PIN, and stopping to
 * make an account at that moment would cost the room the people it was opened for.
 *
 * The boundary that actually matters is in supabase/rooms.sql, where sandbox_room_create
 * is the only function the anon role may not execute. These cover the half of it a person
 * can see.
 */
describe('opening a room takes an account', () => {
  it('asks for a sign in instead of offering the button', () => {
    renderAt('/sandbox/budget-ballot', '', { needsAccount: true });

    expect(screen.queryByRole('button', { name: /^start a room$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to start a room/i })).toBeInTheDocument();
  });

  it('says so rather than hiding the feature, which would look broken', () => {
    renderAt('/sandbox/budget-ballot', '', { needsAccount: true });

    // The control is still where it was; only what it does has changed.
    expect(screen.getByRole('button', { name: /sign in to start a room/i })).toBeInTheDocument();
  });

  it('sends somebody to sign in when they ask to', () => {
    const onSignIn = vi.fn();
    renderAt('/sandbox/budget-ballot', '', { needsAccount: true, onSignIn });

    fireEvent.click(screen.getByRole('button', { name: /sign in to start a room/i }));

    expect(onSignIn).toHaveBeenCalled();
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('offers the real button once there is an account', () => {
    renderAt('/sandbox/budget-ballot', '', { needsAccount: false });

    expect(screen.getByRole('button', { name: /^start a room$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in to start a room/i })).not.toBeInTheDocument();
  });

  it('offers neither where a room was never possible', () => {
    isSupabaseConfigured.mockReturnValue(false);

    renderAt('/sandbox/budget-ballot', '', { needsAccount: true });

    // Nothing to sign in for: there is no database to host a room in either way.
    expect(screen.queryByRole('button', { name: /sign in to start a room/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^start a room$/i })).not.toBeInTheDocument();
  });
});

describe('joining a room takes no account', () => {
  it('lets a signed-out participant into a room that is open', async () => {
    readRoom.mockResolvedValue(openRoom());

    renderAt('/sandbox/budget-ballot', 'room=room-1', { needsAccount: true });

    expect(await screen.findByText(/2h left/)).toBeInTheDocument();
    expect(screen.getByLabelText('Benches with backs')).toBeInTheDocument();
  });

  it('lets a signed-out participant contribute', async () => {
    readRoom.mockResolvedValue(openRoom());

    renderAt('/sandbox/budget-ballot', 'room=room-1', { needsAccount: true });
    await screen.findByText(/2h left/);

    fireEvent.change(screen.getByLabelText('Benches with backs'), { target: { value: '3' } });

    await waitFor(
      () => {
        expect(saveContribution).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1' })
        );
      },
      { timeout: 2000 }
    );
  });

  it('does not put a sign-in in front of somebody who is already in a room', async () => {
    readRoom.mockResolvedValue(openRoom());

    renderAt('/sandbox/budget-ballot', 'room=room-1', { needsAccount: true });
    await screen.findByText(/2h left/);

    expect(screen.queryByRole('button', { name: /sign in to start a room/i })).not.toBeInTheDocument();
  });
});
