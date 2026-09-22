import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * The Supabase SDK is faked whole, so no client is ever constructed and no request
 * is ever made. The shape of the fake matters as much as the assertions: `from()`
 * offers nothing but `select`, so a test fails the moment this module tries to
 * insert into or update the contributions table directly — which the rules in
 * supabase/rooms.sql do not allow, and which no policy would catch here.
 *
 * The SDK is loaded by a dynamic import, so getting hold of the client is async even
 * where the function around it is not — hence the flush() in the subscription tests.
 */

const rpc = vi.fn();
const order = vi.fn();
const eq = vi.fn(() => ({ order }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const removeChannel = vi.fn();
const subscribe = vi.fn(() => ({ id: 'channel' }));
const on = vi.fn(() => ({ subscribe }));
const channel = vi.fn(() => ({ on }));

const createClient = vi.fn(() => ({ rpc, from, channel, removeChannel }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

/** An awaitable Supabase result that also answers .single() and .maybeSingle(). */
function result(payload) {
  const thenable = Promise.resolve(payload);
  thenable.single = () => Promise.resolve(payload);
  thenable.maybeSingle = () => Promise.resolve(payload);
  return thenable;
}

let rooms;

/** Let the dynamic import of the SDK settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  // The module reads the environment at call time but caches the client, so each
  // test needs its own copy.
  rooms = await import('../rooms');
}

beforeEach(() => {
  for (const spy of [rpc, order, eq, select, from, channel, on, subscribe, removeChannel, createClient]) {
    spy.mockClear();
  }
  order.mockReturnValue(result({ data: [], error: null }));
});

describe('sandbox rooms without a project configured', () => {
  beforeEach(async () => {
    await load({ configured: false });
  });

  it('says plainly that rooms need a backend rather than pretending to work', async () => {
    // Everything else in services/ falls back to localStorage. A room cannot: it is
    // shared between devices by definition.
    await expect(rooms.joinRoom('839201')).rejects.toThrow(/need a Supabase project/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('reports itself as unconfigured so the UI can hide the feature', () => {
    expect(rooms.isSupabaseConfigured()).toBe(false);
  });
});

describe('opening a room', () => {
  beforeEach(async () => {
    await load();
  });

  it('lets the database choose the PIN and hands back the facilitator token', async () => {
    rpc.mockReturnValue(result({
      data: {
        room_id: 'room-1',
        pin: '839201',
        facilitator_token: 'facilitator-1',
        expires_at: '2026-09-11T12:00:00Z',
      },
      error: null,
    }));

    const room = await rooms.createRoom('budget-ballot');

    expect(rpc).toHaveBeenCalledWith('sandbox_room_create', { p_experiment: 'budget-ballot', p_project_id: null });
    expect(room).toEqual({
      id: 'room-1',
      pin: '839201',
      facilitatorToken: 'facilitator-1',
      // The deadline comes from the database, never from the browser's clock.
      expiresAt: '2026-09-11T12:00:00Z',
    });
  });

  it('attaches a project when one is given, so its dashboard can see the room', async () => {
    rpc.mockReturnValue(result({
      data: { room_id: 'room-1', pin: '839201', facilitator_token: 'facilitator-1',
        expires_at: '2026-09-11T12:00:00Z' },
      error: null,
    }));

    await rooms.createRoom('budget-ballot', 'proj-1');

    expect(rpc).toHaveBeenCalledWith('sandbox_room_create', { p_experiment: 'budget-ballot', p_project_id: 'proj-1' });
  });

  it('surfaces a failure as an error rather than a room that is not there', async () => {
    rpc.mockReturnValue(result({ data: null, error: { message: 'no PIN free' } }));

    await expect(rooms.createRoom('budget-ballot')).rejects.toThrow(/no PIN free/);
  });
});

describe('joining a room', () => {
  beforeEach(async () => {
    await load();
  });

  it('asks for the room by PIN and gets back only the id and the experiment', async () => {
    rpc.mockReturnValue(result({
      data: { room_id: 'room-1', experiment: 'budget-ballot' },
      error: null,
    }));

    const room = await rooms.joinRoom('839201');

    expect(rpc).toHaveBeenCalledWith('sandbox_room_join', { p_pin: '839201' });
    expect(room).toEqual({ id: 'room-1', experiment: 'budget-ballot' });
    // The token that closes a room is never part of joining one.
    expect(room).not.toHaveProperty('facilitatorToken');
  });

  it('is null for a PIN that is unknown or closed, not an error', async () => {
    rpc.mockReturnValue(result({ data: null, error: null }));

    await expect(rooms.joinRoom('000000')).resolves.toBeNull();
  });
});

describe('reading a room', () => {
  beforeEach(async () => {
    await load();
  });

  it('reads only the four columns the anon role is granted', async () => {
    await rooms.readContributions('room-1');

    expect(from).toHaveBeenCalledWith('sandbox_contributions');
    expect(select).toHaveBeenCalledWith('room_id, display_name, state, updated_at');
    expect(eq).toHaveBeenCalledWith('room_id', 'room-1');
  });

  it('never reaches for an operation the table would refuse', async () => {
    await rooms.readContributions('room-1');

    // Insert, update and delete on this table are not granted to anon at all —
    // contributions go through an RPC. If that ever changes here, this fails.
    const chain = from.mock.results[0].value;
    expect(Object.keys(chain)).toEqual(['select']);
  });

  it('renames the rows into the shape the UI uses', async () => {
    order.mockReturnValue(result({
      data: [{ room_id: 'room-1', display_name: 'Mara', state: { benches: 2 }, updated_at: 't' }],
      error: null,
    }));

    await expect(rooms.readContributions('room-1')).resolves.toEqual([
      { displayName: 'Mara', state: { benches: 2 }, updatedAt: 't' },
    ]);
  });

  it('reports which of the three states a room is in, and when it goes', async () => {
    rpc.mockReturnValue(result({
      data: { experiment: 'budget-ballot', status: 'expired', expires_at: '2026-09-11T12:00:00Z' },
      error: null,
    }));

    await expect(rooms.readRoom('room-1')).resolves.toEqual({
      experiment: 'budget-ballot',
      status: 'expired',
      expiresAt: '2026-09-11T12:00:00Z',
    });
  });

  it('keeps closed and expired apart, because they are told differently', async () => {
    rpc.mockReturnValue(result({
      data: { experiment: 'budget-ballot', status: 'closed', expires_at: '2026-09-11T12:00:00Z' },
      error: null,
    }));

    await expect(rooms.readRoom('room-1')).resolves.toMatchObject({ status: 'closed' });
  });

  it('has no room at all for an id that does not exist', async () => {
    rpc.mockReturnValue(result({ data: null, error: null }));

    await expect(rooms.readRoom('nope')).resolves.toBeNull();
  });
});

describe('contributing to a room', () => {
  beforeEach(async () => {
    await load();
  });

  it('sends the state through the function, with the participant token', async () => {
    rpc.mockReturnValue(result({ data: true, error: null }));

    const saved = await rooms.saveContribution({
      roomId: 'room-1',
      participantToken: 'participant-1',
      displayName: 'Mara',
      state: { benches: 2 },
    });

    expect(rpc).toHaveBeenCalledWith('sandbox_contribution_save', {
      p_room_id: 'room-1',
      p_token: 'participant-1',
      p_name: 'Mara',
      p_state: { benches: 2 },
    });
    expect(saved).toBe(true);
  });

  it('is false, not an error, when the room closed underneath them', async () => {
    rpc.mockReturnValue(result({ data: false, error: null }));

    await expect(
      rooms.saveContribution({ roomId: 'room-1', participantToken: 'p', state: {} })
    ).resolves.toBe(false);
  });

  it('sends no name when the browser has not set one', async () => {
    rpc.mockReturnValue(result({ data: true, error: null }));

    await rooms.saveContribution({ roomId: 'room-1', participantToken: 'p', state: {} });

    expect(rpc).toHaveBeenCalledWith('sandbox_contribution_save', expect.objectContaining({
      p_name: null,
    }));
  });
});

describe('closing a room', () => {
  beforeEach(async () => {
    await load();
  });

  it('needs the facilitator token, and reports whether it worked', async () => {
    rpc.mockReturnValue(result({ data: true, error: null }));

    await expect(rooms.closeRoom('room-1', 'facilitator-1')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('sandbox_room_close', {
      p_room_id: 'room-1',
      p_token: 'facilitator-1',
    });
  });

  it('is false for a browser that did not open the room', async () => {
    rpc.mockReturnValue(result({ data: false, error: null }));

    await expect(rooms.closeRoom('room-1', 'not-the-facilitator')).resolves.toBe(false);
  });
});

describe('following a room', () => {
  beforeEach(async () => {
    await load();
  });

  it('subscribes to this room only, and re-reads rather than trusting the payload', async () => {
    const onChange = vi.fn();

    rooms.subscribeToRoom('room-1', onChange);
    await flush();

    expect(channel).toHaveBeenCalledWith('sandbox-room-room-1');
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'sandbox_contributions', filter: 'room_id=eq.room-1' }),
      expect.any(Function)
    );

    // The handler takes no notice of what arrived — a change is only a nudge.
    const handler = on.mock.calls[0][2];
    handler({ new: { state: { benches: 99 } } });
    expect(onChange).toHaveBeenCalledWith();
  });

  it('hands back something that takes the channel down again', async () => {
    const unsubscribe = rooms.subscribeToRoom('room-1', vi.fn());
    await flush();

    unsubscribe();

    expect(removeChannel).toHaveBeenCalledWith({ id: 'channel' });
  });

  it('never opens a socket for a room that was left before it connected', async () => {
    // The cleanup of a useEffect can run before the dynamic import resolves.
    const unsubscribe = rooms.subscribeToRoom('room-1', vi.fn());
    unsubscribe();
    await flush();

    expect(channel).not.toHaveBeenCalled();
    expect(removeChannel).not.toHaveBeenCalled();
  });
});
