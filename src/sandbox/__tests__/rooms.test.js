import { describe, it, expect, afterEach } from 'vite-plus/test';
import {
  PIN_LENGTH,
  ROOM_LIFETIMES,
  codeJoinUrl,
  isLongRoom,
  parseJoinCode,
  timeRemaining,
  forgetHostedRoom,
  formatPin,
  hostedRoom,
  joinUrl,
  parsePin,
  participantToken,
  projectIdFrom,
  rememberHostedRoom,
  roomIdFrom,
  roomPath,
} from '../rooms';

describe('room PINs', () => {
  it('groups a six-digit PIN so it can be read aloud', () => {
    expect(formatPin('839201')).toBe('839-201');
  });

  it('keeps a leading zero, because 000-123 is a real PIN', () => {
    expect(formatPin('000123')).toBe('000-123');
    expect(parsePin('000-123')).toBe('000123');
  });

  it('reads a PIN back however somebody typed it', () => {
    for (const input of ['839201', '839-201', '839 201', ' 839—201 ']) {
      expect(parsePin(input)).toBe('839201');
    }
  });

  it('refuses anything that is not exactly six digits', () => {
    for (const input of ['', '83920', '8392011', 'abcdef', null, undefined]) {
      expect(parsePin(input)).toBeNull();
    }
  });

  it('agrees with itself about how long a PIN is', () => {
    expect(parsePin('1'.repeat(PIN_LENGTH))).toHaveLength(PIN_LENGTH);
  });
});

describe('room URLs', () => {
  it('points the join link at the PIN, so a scan needs no typing', () => {
    expect(joinUrl('839201')).toBe(`${window.location.origin}/join?pin=839201`);
  });

  it('plays a room on the experiment it belongs to', () => {
    expect(roomPath('budget-ballot', 'abc-123')).toBe('/sandbox/budget-ballot?room=abc-123');
  });

  it('reads the room back out of a query string, with or without the ?', () => {
    expect(roomIdFrom('?room=abc-123')).toBe('abc-123');
    expect(roomIdFrom('room=abc-123')).toBe('abc-123');
  });

  it('has no room when the query says nothing about one', () => {
    expect(roomIdFrom('')).toBeNull();
    expect(roomIdFrom('?pin=839201')).toBeNull();
    expect(roomIdFrom(undefined)).toBeNull();
  });

  it('reads the project a room should attach to out of the query string', () => {
    expect(projectIdFrom('?project=proj-1')).toBe('proj-1');
    expect(projectIdFrom('project=proj-1')).toBe('proj-1');
  });

  it('has no project when the query says nothing about one', () => {
    expect(projectIdFrom('')).toBeNull();
    expect(projectIdFrom('?room=abc-123')).toBeNull();
    expect(projectIdFrom(undefined)).toBeNull();
  });
});

describe('who this browser is in a room', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('mints one participant token and then reuses it', () => {
    const first = participantToken();

    expect(first).toEqual(expect.any(String));
    expect(first).not.toHaveLength(0);
    // The same browser editing its answer has to update its row, not add another.
    expect(participantToken()).toBe(first);
  });

  it('remembers a room it opened, and what closes it', () => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });

    expect(hostedRoom('room-1')).toEqual({ pin: '839201', token: 'facilitator-1' });
  });

  it('does not claim to have opened a room it only joined', () => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });

    expect(hostedRoom('room-2')).toBeNull();
  });

  it('keeps a long room\'s join code alongside its token', () => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1', code: 'a'.repeat(32) });

    expect(hostedRoom('room-1')).toEqual({ pin: '839201', token: 'facilitator-1', code: 'a'.repeat(32) });
  });

  it('forgets a room once it is closed, and leaves the others alone', () => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    rememberHostedRoom('room-2', { pin: '111222', token: 'facilitator-2' });

    forgetHostedRoom('room-1');

    expect(hostedRoom('room-1')).toBeNull();
    expect(hostedRoom('room-2')).toEqual({ pin: '111222', token: 'facilitator-2' });
  });
});

describe('how long a room has left', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  const inMinutes = (n) => new Date(now + n * 60000).toISOString();

  it('counts hours and minutes while there is plenty left', () => {
    expect(timeRemaining(inMinutes(120), now)).toBe('2h');
    expect(timeRemaining(inMinutes(118), now)).toBe('1h 58m');
  });

  it('drops to minutes in the last hour', () => {
    expect(timeRemaining(inMinutes(59), now)).toBe('59m');
    expect(timeRemaining(inMinutes(9), now)).toBe('9m');
  });

  it('stops pretending to be precise in the last minute', () => {
    expect(timeRemaining(inMinutes(0.5), now)).toBe('under a minute');
  });

  it('is null once there is none left, which is the signal to stop counting', () => {
    expect(timeRemaining(inMinutes(0), now)).toBeNull();
    expect(timeRemaining(inMinutes(-5), now)).toBeNull();
  });

  it('counts in days once a room has weeks to run', () => {
    expect(timeRemaining(inMinutes(30 * 24 * 60), now)).toBe('30d');
    expect(timeRemaining(inMinutes((3 * 24 + 4) * 60 + 20), now)).toBe('3d 4h');
    // Under two days it is still hours, which is what somebody deciding on one more
    // round wants to know.
    expect(timeRemaining(inMinutes(47 * 60), now)).toBe('47h');
  });

  it('is null rather than NaN for a deadline that is not one', () => {
    expect(timeRemaining(null, now)).toBeNull();
    expect(timeRemaining(undefined, now)).toBeNull();
    expect(timeRemaining('not a date', now)).toBeNull();
  });
});

describe('rooms that stay open for weeks', () => {
  const opened = '2026-09-24T12:00:00Z';

  it('offers exactly the lifetimes the database accepts', () => {
    // sandbox_room_create in supabase/rooms-lifetime.sql refuses anything else.
    expect(ROOM_LIFETIMES.map((option) => option.id)).toEqual(['2h', '1w', '30d', '90d']);
  });

  it('tells a workshop room from a long one by how long it was opened for', () => {
    expect(isLongRoom({ createdAt: opened, expiresAt: '2026-09-24T14:00:00Z' })).toBe(false);
    expect(isLongRoom({ createdAt: opened, expiresAt: '2026-10-24T12:00:00Z' })).toBe(true);
    expect(isLongRoom({ createdAt: null, expiresAt: null })).toBe(false);
  });

  it('points a long room\'s link at its code, never its PIN', () => {
    expect(codeJoinUrl('a'.repeat(32))).toBe(`${window.location.origin}/join?code=${'a'.repeat(32)}`);
  });

  it('only takes a code that could be one', () => {
    expect(parseJoinCode(` ${'A'.repeat(32)} `)).toBe('a'.repeat(32));
    expect(parseJoinCode('839201')).toBeNull();
    expect(parseJoinCode('z'.repeat(32))).toBeNull();
    expect(parseJoinCode(null)).toBeNull();
  });
});
