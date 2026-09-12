import { describe, it, expect, afterEach } from 'vite-plus/test';
import {
  PIN_LENGTH,
  timeRemaining,
  forgetHostedRoom,
  formatPin,
  hostedRoom,
  joinUrl,
  parsePin,
  participantToken,
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

  it('is null rather than NaN for a deadline that is not one', () => {
    expect(timeRemaining(null, now)).toBeNull();
    expect(timeRemaining(undefined, now)).toBeNull();
    expect(timeRemaining('not a date', now)).toBeNull();
  });
});
