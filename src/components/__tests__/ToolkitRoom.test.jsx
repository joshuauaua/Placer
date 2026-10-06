import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../../theme';
import { rememberHostedRoom } from '../../toolkit/rooms';
import { defaultBallotSetup } from '../../lib/budgetBallot';
import ToolkitPage from '../ToolkitPage';

const createRoom = vi.fn();
const readRoom = vi.fn();
const readContributions = vi.fn();
const saveContribution = vi.fn();
const closeRoom = vi.fn();
const deleteRoom = vi.fn();
const subscribeToRoom = vi.fn();
const isSupabaseConfigured = vi.fn(() => true);

vi.mock('../../services/rooms', () => ({
  createRoom: (...a) => createRoom(...a),
  readRoom: (...a) => readRoom(...a),
  readContributions: (...a) => readContributions(...a),
  saveContribution: (...a) => saveContribution(...a),
  closeRoom: (...a) => closeRoom(...a),
  deleteRoom: (...a) => deleteRoom(...a),
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
const openRoom = () => ({ tool: 'budget-ballot', status: 'open', expiresAt: hours(2) });

/** The page at `path`, past the tool's cover page — these are about the tool. */
function renderAt(path, searchPath = '', props = {}) {
  const location = memoryLocation({ path, searchPath, record: true });
  render(
    <Router hook={location.hook}>
      <ToolkitPage t={THEME} {...props} />
    </Router>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  return location;
}

beforeEach(() => {
  for (const spy of [createRoom, readRoom, readContributions, saveContribution, closeRoom, deleteRoom, subscribeToRoom]) {
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

describe('a tool outside a room', () => {
  it('is exactly as it was, with no room furniture on it', () => {
    renderAt('/toolkit/budget-ballot');

    expect(screen.getByRole('heading', { level: 1, name: 'Budget Ballot' })).toBeInTheDocument();
    expect(screen.queryByText(/you are in a room/i)).not.toBeInTheDocument();
    expect(screen.queryByText("The room's ballot")).not.toBeInTheDocument();
    expect(readRoom).not.toHaveBeenCalled();
  });

  it('offers a room on a tool that can host one', () => {
    renderAt('/toolkit/budget-ballot');

    expect(screen.getByRole('button', { name: /start a room/i })).toBeInTheDocument();
  });

  it('offers nothing on a tool that cannot', () => {
    renderAt('/toolkit/street-mixer');

    expect(screen.queryByRole('button', { name: /start a room/i })).not.toBeInTheDocument();
  });

  it('offers nothing when there is no database to host it in', () => {
    isSupabaseConfigured.mockReturnValue(false);

    renderAt('/toolkit/budget-ballot');

    expect(screen.queryByRole('button', { name: /start a room/i })).not.toBeInTheDocument();
  });
});

describe('opening a room', () => {
  it('goes to the room it just opened', async () => {
    createRoom.mockResolvedValue({
      id: 'room-1', pin: '839201', facilitatorToken: 'facilitator-1', expiresAt: hours(2),
    });
    readRoom.mockResolvedValue(openRoom());

    const location = renderAt('/toolkit/budget-ballot');

    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Open the room' }));

    await waitFor(() => {
      expect(location.history.at(-1)).toBe('/toolkit/budget-ballot?room=room-1');
    });
    expect(createRoom).toHaveBeenCalledWith('budget-ballot', null, '2h', defaultBallotSetup());
  });

  it('attaches the room to a project named in the URL', async () => {
    createRoom.mockResolvedValue({
      id: 'room-1', pin: '839201', facilitatorToken: 'facilitator-1', expiresAt: hours(2),
    });
    readRoom.mockResolvedValue(openRoom());

    renderAt('/toolkit/budget-ballot', 'project=proj-1');

    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Open the room' }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('budget-ballot', 'proj-1', '2h', defaultBallotSetup()));
  });
});

describe('setting a room up before it opens', () => {
  const ballotSetup = { budget: 50000, items: ['benches', 'lighting'] };

  it('shows the setup in place of the tool, and Cancel puts the tool back', () => {
    renderAt('/toolkit/budget-ballot');

    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));

    expect(screen.getByText('Set up the room')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget, in euros')).toHaveValue(250000);
    expect(screen.queryByText('What the street could have')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Set up the room')).not.toBeInTheDocument();
    expect(screen.getByText('What the street could have')).toBeInTheDocument();
  });

  it('opens the room with the budget and the ballot the organiser chose', async () => {
    createRoom.mockResolvedValue({
      id: 'room-1', pin: '839201', joinCode: 'a'.repeat(32), facilitatorToken: 'facilitator-1',
      expiresAt: hours(24 * 30),
    });
    readRoom.mockResolvedValue({ ...openRoom(), expiresAt: hours(24 * 30), config: ballotSetup });

    renderAt('/toolkit/budget-ballot', 'project=proj-1');
    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));

    fireEvent.change(screen.getByLabelText('Budget, in euros'), { target: { value: '50000' } });
    for (const checkbox of screen.getAllByRole('checkbox')) {
      if (!/benches with backs|street lighting/i.test(checkbox.closest('label').textContent)) fireEvent.click(checkbox);
    }
    fireEvent.change(screen.getByLabelText(/open for/i), { target: { value: '30d' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open the room' }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('budget-ballot', 'proj-1', '30d', ballotSetup));
  });

  it('will not open until the setup is complete, and says why', () => {
    renderAt('/toolkit/budget-ballot');
    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Open the room' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Put at least one thing on the ballot.');
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('shows everybody in the room the ballot as it was set up', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: ballotSetup });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText('€50,000')).toBeInTheDocument();
    expect(screen.getByLabelText('Benches with backs')).toBeInTheDocument();
    expect(screen.queryByLabelText('Street trees')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "The council's draft" })).not.toBeInTheDocument();
  });

  it('shows the tool as it ships in a room opened without a setup', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: {} });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText("The room's ballot")).toBeInTheDocument();
    expect(screen.getByText('€250,000')).toBeInTheDocument();
    expect(screen.getByLabelText('Street trees')).toBeInTheDocument();
  });

  it('refuses a setup the tool does not accept rather than guessing', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: { budget: -1, items: [] } });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/set up in a way this version of the tool cannot show/i)).toBeInTheDocument();
  });
});

describe('opening a room that stays open for weeks', () => {
  it('only asks how long when a project is behind the room', () => {
    renderAt('/toolkit/open-vote');
    expect(screen.queryByLabelText(/open for/i)).not.toBeInTheDocument();
  });

  it('opens it for the lifetime chosen', async () => {
    createRoom.mockResolvedValue({
      id: 'room-1', pin: '839201', joinCode: 'a'.repeat(32), facilitatorToken: 'facilitator-1',
      expiresAt: hours(24 * 30),
    });
    readRoom.mockResolvedValue({ tool: 'open-vote', status: 'open', expiresAt: hours(24 * 30) });

    renderAt('/toolkit/open-vote', 'project=proj-1');

    // Open Vote is set up first, and how long it stays open is chosen there.
    fireEvent.click(screen.getByRole('button', { name: /start a room/i }));
    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Should the square be car-free?' } });
    fireEvent.change(screen.getByLabelText(/open for/i), { target: { value: '30d' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open the room' }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('open-vote', 'proj-1', '30d',
      { question: 'Should the square be car-free?' }));
  });
});

describe('a long room seen by the facilitator', () => {
  beforeEach(() => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1', code: 'a'.repeat(32) });
    // Past the ~24.8 days one setTimeout can wait, which would otherwise fire at once.
    readRoom.mockResolvedValue({ tool: 'open-vote', status: 'open', expiresAt: hours(24 * 60) });
  });

  it('says until when instead of showing a PIN, and offers the QR code to print', async () => {
    renderAt('/toolkit/open-vote', 'room=room-1');

    expect(await screen.findByText(/^Open until /)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Room PIN/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download qr/i })).toBeInTheDocument();
    expect((await screen.findAllByText(/60d left/)).length).toBeGreaterThan(0);
  });

  it('does not call a room months from ending over the moment it opens', async () => {
    renderAt('/toolkit/open-vote', 'room=room-1');

    expect(await screen.findByText(/^Open until /)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(/run out of time/i)).not.toBeInTheDocument();
  });
});

describe('a room seen by the facilitator', () => {
  beforeEach(() => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    readRoom.mockResolvedValue(openRoom());
  });

  it('shows the PIN grouped, and a QR code of the join link', async () => {
    renderAt('/toolkit/budget-ballot', 'room=room-1');

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

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/2 people have contributed/i)).toBeInTheDocument();
  });

  it('follows the room, and stops following it on the way out', async () => {
    const unsubscribe = vi.fn();
    subscribeToRoom.mockReturnValue(unsubscribe);

    const { unmount } = render(
      <Router hook={memoryLocation({ path: '/toolkit/budget-ballot', searchPath: 'room=room-1' }).hook}>
        <ToolkitPage t={THEME} />
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

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText("The room's ballot")).toBeInTheDocument();
    // benches are 900 each and 4 and 2 average to 3, so the room commits 2,700 —
    // not the 5,400 that adding the two ballots together would report.
    expect(screen.getByText('€2,700')).toBeInTheDocument();
    expect(screen.getByText('2 cast')).toBeInTheDocument();
  });

  it('waits for somebody to actually choose something', async () => {
    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/nobody has cast a ballot yet/i)).toBeInTheDocument();
  });

  it('asks once before closing the room, then closes it', async () => {
    closeRoom.mockResolvedValue(true);

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    const close = await screen.findByRole('button', { name: 'Close room' });
    fireEvent.click(close);

    // The first press only arms it: closing ends the room for everybody in it.
    expect(closeRoom).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /close — confirm/i }));

    await waitFor(() => expect(closeRoom).toHaveBeenCalledWith('room-1', 'facilitator-1'));
    expect(await screen.findByRole('status')).toHaveTextContent(/this room is closed/i);
  });

  it('asks once before deleting the room, then deletes it and what it held', async () => {
    deleteRoom.mockResolvedValue(true);

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete room' }));
    expect(deleteRoom).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /delete — confirm/i }));

    await waitFor(() => expect(deleteRoom).toHaveBeenCalledWith('room-1', 'facilitator-1'));
    expect(await screen.findByRole('status')).toHaveTextContent(/this room has been deleted/i);
  });
});

describe('a room seen by somebody who joined it', () => {
  beforeEach(() => {
    readRoom.mockResolvedValue(openRoom());
  });

  it('tells them they are in it, without showing them the PIN or the close button', async () => {
    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/you are in a room/i)).toBeInTheDocument();
    expect(screen.queryByText('839-201')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close room/i })).not.toBeInTheDocument();
  });

  it('publishes their ballot once they move something', async () => {
    renderAt('/toolkit/budget-ballot', 'room=room-1');

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
    readRoom.mockResolvedValue({ tool: 'budget-ballot', status: 'open', expiresAt: hours(2) });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    // Anchored: the sentence below the PIN names the time left as well, and an
    // unanchored match would find both.
    expect(await screen.findByText(/^2h left$/)).toBeInTheDocument();
    expect(screen.getByText(/lasts two hours from opening/i)).toBeInTheDocument();
  });

  it('says it has run out of time, not that somebody closed it', async () => {
    readRoom.mockResolvedValue({ tool: 'budget-ballot', status: 'expired', expiresAt: hours(-1) });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/run out of time/i);
    expect(notice).not.toHaveTextContent(/is closed/i);
    expect(readContributions).not.toHaveBeenCalled();
  });

  it('gives up on a room whose deadline passes while the page is open', async () => {
    // Two seconds out, so the hook's timer fires during the test rather than in
    // two hours. The PIN must stop being offered the moment it stops working.
    readRoom.mockResolvedValue({
      tool: 'budget-ballot',
      status: 'open',
      expiresAt: new Date(Date.now() + 1200).toISOString(),
    });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByLabelText('Room PIN 839-201')).toBeInTheDocument();

    expect(await screen.findByText(/run out of time/i, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByLabelText('Room PIN 839-201')).not.toBeInTheDocument();
  });

  it('tells a participant which ending it was when their ballot is refused', async () => {
    readRoom
      .mockResolvedValueOnce({ tool: 'budget-ballot', status: 'open', expiresAt: hours(2) })
      .mockResolvedValue({ tool: 'budget-ballot', status: 'expired', expiresAt: hours(-1) });
    saveContribution.mockResolvedValue(false);

    renderAt('/toolkit/budget-ballot', 'room=room-1');
    await screen.findByLabelText('Room PIN 839-201');

    fireEvent.change(screen.getByLabelText('Benches with backs'), { target: { value: '3' } });

    expect(await screen.findByText(/run out of time/i, {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe('a room that has gone', () => {
  it('says it is closed rather than showing an empty one', async () => {
    readRoom.mockResolvedValue({ tool: 'budget-ballot', status: 'closed', expiresAt: hours(2) });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByRole('status')).toHaveTextContent(/this room is closed/i);
    expect(readContributions).not.toHaveBeenCalled();
  });

  it('says so when the id names no room at all', async () => {
    readRoom.mockResolvedValue(null);

    renderAt('/toolkit/budget-ballot', 'room=nope');

    expect(await screen.findByRole('status')).toHaveTextContent(/does not exist/i);
  });

  it('refuses a room that belongs to another tool', async () => {
    readRoom.mockResolvedValue({ tool: 'desire-lines', status: 'open', expiresAt: hours(2) });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByRole('status')).toHaveTextContent(/different tool/i);
    expect(readContributions).not.toHaveBeenCalled();
  });

  it('leaves the tool itself working', async () => {
    readRoom.mockResolvedValue({ tool: 'budget-ballot', status: 'closed', expiresAt: hours(2) });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

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
 * The boundary that actually matters is in supabase/rooms.sql, where toolkit_room_create
 * is the only function the anon role may not execute. These cover the half of it a person
 * can see.
 */
describe('opening a room takes an account', () => {
  it('asks for a sign in instead of offering the button', () => {
    renderAt('/toolkit/budget-ballot', '', { needsAccount: true });

    expect(screen.queryByRole('button', { name: /^start a room$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to start a room/i })).toBeInTheDocument();
  });

  it('says so rather than hiding the feature, which would look broken', () => {
    renderAt('/toolkit/budget-ballot', '', { needsAccount: true });

    // The control is still where it was; only what it does has changed.
    expect(screen.getByRole('button', { name: /sign in to start a room/i })).toBeInTheDocument();
  });

  it('sends somebody to sign in when they ask to', () => {
    const onSignIn = vi.fn();
    renderAt('/toolkit/budget-ballot', '', { needsAccount: true, onSignIn });

    fireEvent.click(screen.getByRole('button', { name: /sign in to start a room/i }));

    expect(onSignIn).toHaveBeenCalled();
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('offers the real button once there is an account', () => {
    renderAt('/toolkit/budget-ballot', '', { needsAccount: false });

    expect(screen.getByRole('button', { name: /^start a room$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in to start a room/i })).not.toBeInTheDocument();
  });

  it('offers neither where a room was never possible', () => {
    isSupabaseConfigured.mockReturnValue(false);

    renderAt('/toolkit/budget-ballot', '', { needsAccount: true });

    // Nothing to sign in for: there is no database to host a room in either way.
    expect(screen.queryByRole('button', { name: /sign in to start a room/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^start a room$/i })).not.toBeInTheDocument();
  });
});

describe('joining a room takes no account', () => {
  it('lets a signed-out participant into a room that is open', async () => {
    readRoom.mockResolvedValue(openRoom());

    renderAt('/toolkit/budget-ballot', 'room=room-1', { needsAccount: true });

    expect(await screen.findByText(/2h left/)).toBeInTheDocument();
    expect(screen.getByLabelText('Benches with backs')).toBeInTheDocument();
  });

  it('lets a signed-out participant contribute', async () => {
    readRoom.mockResolvedValue(openRoom());

    renderAt('/toolkit/budget-ballot', 'room=room-1', { needsAccount: true });
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

    renderAt('/toolkit/budget-ballot', 'room=room-1', { needsAccount: true });
    await screen.findByText(/2h left/);

    expect(screen.queryByRole('button', { name: /sign in to start a room/i })).not.toBeInTheDocument();
  });
});

// A second room-capable tool, exercised through the same machinery as Budget
// Ballot above — this is what proves the room layer is generic rather than tuned to
// one tool's shape.
describe('Open Vote in a room', () => {
  const openVoteRoom = () => ({ tool: 'open-vote', status: 'open', expiresAt: hours(2) });

  it('offers a room, same as any other room-capable tool', () => {
    renderAt('/toolkit/open-vote');

    expect(screen.getByRole('button', { name: /start a room/i })).toBeInTheDocument();
  });

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
