import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../../theme';
import { rememberHostedRoom } from '../../toolkit/rooms';
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

    expect(screen.getByRole('heading', { level: 1, name: 'Co-Budget' })).toBeInTheDocument();
    expect(screen.queryByText(/you are in a room/i)).not.toBeInTheDocument();
    expect(screen.queryByText("The room's ballot")).not.toBeInTheDocument();
    expect(readRoom).not.toHaveBeenCalled();
  });

  it('offers no way to start a room: a project opens those from its dashboard', () => {
    renderAt('/toolkit/budget-ballot');

    expect(screen.queryByRole('button', { name: /start a room/i })).not.toBeInTheDocument();
    expect(createRoom).not.toHaveBeenCalled();
  });
});

describe('a room set up by its project', () => {
  const ballotSetup = { budget: 50000, items: ['benches', 'lighting'] };

  it('shows everybody in the room the posts the organiser wrote', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: {
      budget: 20000, posts: [{ key: 'post-1', label: 'Water fountain', icon: 'sparkle', unitCost: 4500 }],
    } });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    const more = await screen.findByRole('button', { name: 'One more: Water fountain' });
    for (let i = 0; i < 4; i += 1) fireEvent.click(more);
    // €4,500 each, so €20,000 buys four.
    expect(more).toBeDisabled();
    expect(screen.getByText('€20,000')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Street trees' })).not.toBeInTheDocument();
  });

  it('still shows a room set up before posts could be written', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: ballotSetup });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText('€50,000')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Benches with backs' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Street trees' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "The council's draft" })).not.toBeInTheDocument();
  });

  it('shows the tool as it ships in a room opened without a setup', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: {} });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText("The room's ballot")).toBeInTheDocument();
    expect(screen.getByText('€250,000')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Street trees' })).toBeInTheDocument();
  });

  it('refuses a setup the tool does not accept rather than guessing', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: { budget: -1, items: [] } });

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/set up in a way this version of the tool cannot show/i)).toBeInTheDocument();
  });
});

describe('a room scheduled to start later', () => {
  it('says when it opens, and adds nothing to it until then', async () => {
    readRoom.mockResolvedValue({
      tool: 'open-vote', status: 'scheduled', expiresAt: hours(24 * 40), opensAt: hours(24 * 10),
      config: { question: 'Car-free?', answers: ['Yes', 'No'] },
    });

    renderAt('/toolkit/open-vote', 'room=room-1');

    expect(await screen.findByText(/This room opens on/)).toBeInTheDocument();
    expect(readContributions).not.toHaveBeenCalled();
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

    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'One more: Benches with backs' }));

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

describe('a Co-Budget room that lets people add their own posts', () => {
  const config = {
    currency: 'GBP', budget: 20000, ownPosts: true,
    posts: [{ key: 'post-1', label: 'Water fountain', icon: 'sparkle', unitCost: 4500 }],
  };

  it('lets a participant add a post, spend on it, and sends it as theirs', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config });

    renderAt('/toolkit/budget-ballot', 'room=room-1');
    await screen.findByText(/you are in a room/i);
    expect(screen.getByText('£20,000 left')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your post's name"), { target: { value: 'Bike racks' } });
    fireEvent.change(screen.getByLabelText("Your post's cost per item"), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    for (let i = 0; i < 2; i += 1) fireEvent.click(screen.getByRole('button', { name: 'One more: Bike racks' }));
    fireEvent.click(screen.getByRole('button', { name: 'One more: Water fountain' }));

    expect(screen.getByText('£13,900 left')).toBeInTheDocument();
    await waitFor(() => expect(saveContribution).toHaveBeenLastCalledWith(expect.objectContaining({
      state: { 'post-1': 1, own: [{ label: 'Bike racks', unitCost: 800, quantity: 2 }] },
    })), { timeout: 2000 });

    fireEvent.click(screen.getByRole('button', { name: 'Remove your post: Bike racks' }));
    expect(screen.queryByRole('button', { name: 'One more: Bike racks' })).not.toBeInTheDocument();
  });

  it('says what is wrong with a post before adding it', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config });

    renderAt('/toolkit/budget-ballot', 'room=room-1');
    await screen.findByText(/you are in a room/i);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Give your post a name.');
  });

  it("shows the room everybody's own posts apart from its ballot", async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config });
    readContributions.mockResolvedValue([
      { displayName: 'Mara', state: { 'post-1': 2, own: [{ label: 'Bike racks', unitCost: 800, quantity: 3 }] }, updatedAt: 'a' },
      { displayName: 'Sam', state: { 'post-1': 2, own: [{ label: 'bike racks', unitCost: 700, quantity: 1 }] }, updatedAt: 'b' },
    ]);

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    const proposals = within(await screen.findByRole('list', { name: 'Posts people added' }));
    expect(proposals.getByText('Bike racks')).toBeInTheDocument();
    expect(proposals.getByText(/2 people/)).toBeInTheDocument();
    expect(proposals.getByText('£3,100')).toBeInTheDocument();
  });

  it('offers nothing of the kind when the organiser did not allow it', async () => {
    readRoom.mockResolvedValue({ ...openRoom(), config: { ...config, ownPosts: false } });

    renderAt('/toolkit/budget-ballot', 'room=room-1');
    await screen.findByText(/you are in a room/i);

    expect(screen.queryByLabelText("Your post's name")).not.toBeInTheDocument();
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

    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'One more: Benches with backs' }));

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
    expect(screen.getByRole('heading', { level: 1, name: 'Co-Budget' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Benches with backs' })).toBeInTheDocument();
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
describe('joining a room takes no account', () => {
  it('lets a signed-out participant into a room that is open', async () => {
    readRoom.mockResolvedValue(openRoom());

    renderAt('/toolkit/budget-ballot', 'room=room-1');

    expect(await screen.findByText(/2h left/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Benches with backs' })).toBeInTheDocument();
  });

  it('lets a signed-out participant contribute', async () => {
    readRoom.mockResolvedValue(openRoom());

    renderAt('/toolkit/budget-ballot', 'room=room-1');
    await screen.findByText(/2h left/);

    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'One more: Benches with backs' }));

    await waitFor(
      () => {
        expect(saveContribution).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1' })
        );
      },
      { timeout: 2000 }
    );
  });

});

// A second room-capable tool, exercised through the same machinery as Budget
// Ballot above — this is what proves the room layer is generic rather than tuned to
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

describe('Pop Quiz in a room', () => {
  const QUIZ = {
    seconds: 20,
    questions: [
      { kind: 'choice', text: 'Which way is north?', choices: ['Up', 'Down', 'Left', 'Right'], correct: 0 },
      { kind: 'blank', text: 'The square is called ___.', answer: 'Möllan' },
    ],
  };
  const quizRoom = () => ({ tool: 'pop-quiz', status: 'open', expiresAt: hours(2), config: QUIZ });
  const from = (state, displayName = null) => ({ displayName, state, updatedAt: 'a' });
  const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
  const sent = (state) => waitFor(
    () => expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-1', state })),
    { timeout: 2000 }
  );
  const join = async (nickname = 'Mara') => {
    fireEvent.change(await screen.findByLabelText('Nickname'), { target: { value: nickname } });
    click('Join the quiz');
  };

  describe('for somebody who joined', () => {
    it('asks for a nickname first, then waits in the lobby', async () => {
      readRoom.mockResolvedValue(quizRoom());

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      await join('  Mara  ');

      expect(screen.getByRole('status')).toHaveTextContent('Welcome, Mara.');
      expect(screen.getByText(/starts when the facilitator is ready/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start the quiz' })).not.toBeInTheDocument();
      await sent({ nickname: 'Mara', answers: {} });
    });

    it('answers the question the facilitator has put up, timed from when it went up', async () => {
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([from({ host: { q: 0, at: Date.now() - 5000, shown: false } })]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      await join();
      expect(screen.getByRole('heading', { name: 'Question 1 of 2' })).toBeInTheDocument();
      click(/Up/);

      expect(screen.getByRole('status')).toHaveTextContent('Answer locked in.');
      expect(screen.getByRole('button', { name: /Down/ })).toBeDisabled();
      await sent({ nickname: 'Mara', answers: { 0: { value: 0, ms: expect.any(Number) } } });
      const { ms } = saveContribution.mock.calls.at(-1)[0].state.answers[0];
      expect(ms).toBeGreaterThanOrEqual(5000);
      expect(ms).toBeLessThan(8000);
    });

    it('can skip a question', async () => {
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([from({ host: { q: 0, at: Date.now(), shown: false } })]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      await join();
      click('Skip this question');

      expect(screen.getByRole('status')).toHaveTextContent('Skipped.');
      await sent({ nickname: 'Mara', answers: { 0: { skipped: true } } });
    });

    it('sees the answer and the scoreboard once the facilitator shows them', async () => {
      localStorage.setItem('placemaking_room_answers', JSON.stringify({
        'room-1': { nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } },
      }));
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 0, at: Date.now() - 12000, shown: true } }),
        from({ nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } }),
        from({ nickname: 'Sam', answers: { 0: { value: 0, ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');

      expect((await screen.findByText('Right!')).closest('p')).toHaveTextContent('Right! +750 points.');
      const board = within(screen.getByRole('list', { name: 'Scoreboard' })).getAllByRole('listitem');
      expect(board.map((row) => row.textContent)).toEqual(['1Sam1 right950', '2Mara (you)1 right750']);
      expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();
    });

    it('is told their score and place when the quiz is over', async () => {
      localStorage.setItem('placemaking_room_answers', JSON.stringify({
        'room-1': { nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } },
      }));
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 2, at: Date.now(), shown: false } }),
        from({ nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } }),
        from({ nickname: 'Sam', answers: { 0: { value: 0, ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');

      expect(await screen.findByText('750 points')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 right, and number 2 of 2.')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Final scores' })).toBeInTheDocument();
    });
  });

  describe('for the facilitator', () => {
    const host = () => rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });

    it('shows who has joined, and starts the quiz for the room', async () => {
      host();
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([from({ nickname: 'Mara', answers: {} }), from({ nickname: 'Sam', answers: {} })]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');

      const players = within(await screen.findByRole('list', { name: 'Players' }));
      expect(players.getAllByRole('listitem')).toHaveLength(2);
      expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();
      click('Start the quiz');

      expect(screen.getByRole('heading', { name: 'Question 1 of 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Up/ })).toBeDisabled();
      expect(screen.getByText('0 of 2 answered')).toBeInTheDocument();
      await sent({ host: { q: 0, at: expect.any(Number), shown: false } });
    });

    it('shows the answer, then moves the room on to the next question', async () => {
      host();
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 0, at: Date.now() - 3000, shown: false } }),
        from({ nickname: 'Mara', answers: { 0: { value: 0, ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      expect(await screen.findByText('1 of 1 answered')).toBeInTheDocument();
      click('Show the answer');

      expect(screen.getByRole('button', { name: /Up/ })).toHaveTextContent('the right answer');
      expect(within(screen.getByRole('list', { name: 'Scoreboard' })).getByText('950')).toBeInTheDocument();
      await sent({ host: { q: 0, at: expect.any(Number), shown: true } });

      click('Next question');
      expect(screen.getByRole('heading', { name: 'Question 2 of 2' })).toBeInTheDocument();
      await sent({ host: { q: 1, at: expect.any(Number), shown: false } });
    });

    it('ends on the final scores after the last question', async () => {
      host();
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 1, at: Date.now() - 3000, shown: true } }),
        from({ nickname: 'Mara', answers: { 1: { value: 'mollan', ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      expect(await screen.findByText('Möllan')).toBeInTheDocument();
      click('Show the final scores');

      const board = within(screen.getByRole('list', { name: 'Final scores' })).getAllByRole('listitem');
      expect(board.map((row) => row.textContent)).toEqual(['1Mara1 right950']);
      await sent({ host: { q: 2, at: expect.any(Number), shown: false } });
describe('Word Cloud in a room', () => {
  const wordCloudRoom = () => ({ tool: 'word-cloud', status: 'open', expiresAt: hours(2) });

  it("publishes a participant's words once they add one", async () => {
    readRoom.mockResolvedValue(wordCloudRoom());

    renderAt('/toolkit/word-cloud', 'room=room-1');
    await screen.findByText(/you are in a room/i);

    fireEvent.change(screen.getByLabelText('Your word'), { target: { value: 'Green' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(
      () => {
        expect(saveContribution).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', state: { words: ['green'] } })
        );
      },
      { timeout: 2000 }
    );
  });

  it("gathers everybody's words into the room's cloud", async () => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    readRoom.mockResolvedValue(wordCloudRoom());
    readContributions.mockResolvedValue([
      { displayName: 'Mara', state: { words: ['green', 'quiet'] }, updatedAt: 'a' },
      { displayName: 'Sam', state: { words: ['green'] }, updatedAt: 'b' },
    ]);

    renderAt('/toolkit/word-cloud', 'room=room-1');

    expect(await screen.findByText("The room's cloud")).toBeInTheDocument();
    expect(screen.getByText('2 people')).toBeInTheDocument();
    const cloud = within(screen.getByRole('list', { name: 'Word cloud' }));
    expect(cloud.getByText('green').closest('li')).toHaveAttribute('title', '2 people');
    expect(cloud.getByText('quiet').closest('li')).toHaveAttribute('title', '1 person');
    const answers = within(screen.getByRole('list', { name: /answers and how many times/i }));
    expect(answers.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['green2', 'quiet1']);
  });

  it('shows the prompt the room was set up with, and takes only as many words as it allows', async () => {
    readRoom.mockResolvedValue({ ...wordCloudRoom(), config: { prompt: 'One word for the square?', limit: 1 } });

    renderAt('/toolkit/word-cloud', 'room=room-1');

    expect(await screen.findByText('One word for the square?')).toBeInTheDocument();
    expect(screen.queryByLabelText('The prompt')).not.toBeInTheDocument();
    expect(screen.getByText('One word each.')).toBeInTheDocument();
  });

  describe('set up with a timer', () => {
    const timedRoom = () => ({ ...wordCloudRoom(), config: { prompt: 'One word for the square?', limit: 3, timer: 60 } });
    const host = () => rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    const carrying = (timer, words = []) => [{ displayName: 'Mara', state: { words, timer }, updatedAt: 'a' }];
    const sent = (state) => waitFor(
      () => expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-1', state })),
      { timeout: 2000 }
    );

    it('lets the facilitator start it, and tells the room', async () => {
      host();
      readRoom.mockResolvedValue(timedRoom());

      renderAt('/toolkit/word-cloud', 'room=room-1');
      fireEvent.click(await screen.findByRole('button', { name: 'Start the 60 second timer' }));

      expect(screen.getByRole('timer')).toHaveTextContent(/^(1:00|0:59)$/);
      await sent({ words: [], timer: { endsAt: expect.any(Number) } });
    });

    it('lets the facilitator pause it and carry on, and tells the room each time', async () => {
      host();
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() + 40000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');
      fireEvent.click(await screen.findByRole('button', { name: 'Pause' }));

      expect(screen.getByRole('timer')).toHaveTextContent(/^0:(40|39) · paused$/);
      await sent({ words: [], timer: { pausedLeft: expect.any(Number) } });

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByRole('timer')).toHaveTextContent(/^0:(40|39)$/);
      await sent({ words: [], timer: { endsAt: expect.any(Number) } });
    });

    it('lets the facilitator stop it, which locks the cloud for the room', async () => {
      host();
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() + 40000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');
      fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));

      expect(screen.getByRole('timer')).toHaveTextContent('Finished');
      expect(screen.getByLabelText('Your word')).toBeDisabled();
      expect(screen.queryByRole('button', { name: /start the/i })).not.toBeInTheDocument();
      await sent({ words: [], timer: { endsAt: expect.any(Number) } });
    });

    it('offers none of it to somebody who only joined', async () => {
      readRoom.mockResolvedValue(timedRoom());

      renderAt('/toolkit/word-cloud', 'room=room-1');
      await screen.findByText(/you are in a room/i);

      expect(screen.queryByRole('button', { name: /start the/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Your word')).toBeEnabled();
    });

    it('shows everybody the countdown once it has been started, without the buttons', async () => {
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() + 40000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');

      expect(await screen.findByRole('timer')).toHaveTextContent(/^0:(40|39)$/);
      expect(screen.getByLabelText('Your word')).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    });

    it('shows everybody that it is paused', async () => {
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ pausedLeft: 25000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');

      expect(await screen.findByRole('timer')).toHaveTextContent('0:25 · paused');
      expect(screen.getByLabelText('Your word')).toBeEnabled();
    });

    it('stops taking words once it is over', async () => {
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() - 30000 }, ['green']));

      renderAt('/toolkit/word-cloud', 'room=room-1');

      expect(await screen.findByRole('timer')).toHaveTextContent('Finished');
      expect(screen.getByLabelText('Your word')).toBeDisabled();
      expect(within(screen.getByRole('list', { name: 'Word cloud' })).getByText('green')).toBeInTheDocument();
    });
  });
});
