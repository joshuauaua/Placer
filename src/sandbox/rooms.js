/* PLACER — sandbox rooms, the parts with no network in them.
 *
 * PIN formatting, the two URLs a room is reached by, and the tokens that say who
 * this browser is in a room. Kept apart from services/rooms.js so all of it can be
 * tested without a Supabase client anywhere in sight.
 *
 * Two tokens, doing different jobs:
 *
 *   - the participant token identifies this browser's own contribution, so the
 *     same person editing their ballot updates their row instead of adding another.
 *     One per browser, reused across every room.
 *   - a facilitator token is the proof that this browser opened a particular room,
 *     and is the only thing that can close it. One per room, and only the room's
 *     creator ever has it.
 *
 * Both live in localStorage, and both are therefore listed in STORAGE_KEYS in
 * services/api.js — a key missing from that registry is silently skipped by the
 * GDPR export and erasure requests. The literals are declared here rather than
 * imported, matching services/profile.js; services/__tests__/api.test.js holds the
 * two sides together.
 */

/** This browser's participant token. */
const PARTICIPANT_KEY = 'placemaking_room_participant';
/** Rooms this browser opened: { [roomId]: { pin, token } }. */
const HOSTED_KEY = 'placemaking_rooms_hosted';

export const PIN_LENGTH = 6;

/** '839201' → '839-201'. Grouped because six digits read back badly in one run. */
export function formatPin(pin) {
  const digits = String(pin ?? '').replace(/\D/g, '');
  if (digits.length !== PIN_LENGTH) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

/**
 * Whatever somebody typed or pasted, as a bare six-digit PIN — or null if it is
 * not one. Spaces, dashes and a pasted join URL all arrive here.
 */
export function parsePin(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  return digits.length === PIN_LENGTH ? digits : null;
}

/**
 * How long a room has left, as something to put on a screen — or null once it has
 * none, which is the caller's signal to stop showing a countdown and say it is over.
 *
 * Deliberately coarse. Watching seconds tick away would make a workshop feel like a
 * game show, and the deadline is only accurate to whenever the page last heard from
 * the database anyway. `now` is a parameter so this can be tested without waiting.
 */
export function timeRemaining(expiresAt, now = Date.now()) {
  const deadline = new Date(expiresAt ?? 0).getTime();
  if (!Number.isFinite(deadline)) return null;

  const left = deadline - now;
  if (left <= 0) return null;

  const minutes = Math.floor(left / 60000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function origin() {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** The link a QR code encodes, and the one somebody can be sent. */
export function joinUrl(pin) {
  return `${origin()}/join?pin=${encodeURIComponent(String(pin ?? ''))}`;
}

/** Where a room is actually played, once joined. */
export function roomPath(experimentId, roomId) {
  return `/sandbox/${experimentId}?room=${encodeURIComponent(String(roomId ?? ''))}`;
}

/** The room id in ?room=…, or null. */
export function roomIdFrom(search) {
  // Accepts what wouter's useSearch() returns, with or without the leading '?'.
  const query = String(search ?? '').replace(/^\?/, '');
  if (!query) return null;
  const value = new URLSearchParams(query).get('room');
  return value ? value : null;
}

// Storage is wrapped everywhere: in private mode a read or a write can throw, and
// the honest fallback is that the value holds for this page load only.
function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignored on purpose — see above.
  }
}

function newToken() {
  try {
    return window.crypto.randomUUID();
  } catch {
    // Older browsers, and any context where crypto is unavailable. Not a secret
    // that has to resist guessing: it only has to be unlikely to collide.
    return `r-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

// Held in memory too, so a browser that refuses storage still gets one stable
// token for the life of the page rather than a new row on every keystroke.
let participantFallback = null;

/** This browser's participant token, minted on first use. */
export function participantToken() {
  const stored = readJson(PARTICIPANT_KEY);
  if (typeof stored === 'string' && stored) return stored;

  if (!participantFallback) participantFallback = newToken();
  writeJson(PARTICIPANT_KEY, participantFallback);
  return participantFallback;
}

/** Remember that this browser opened a room, and how to close it again. */
export function rememberHostedRoom(roomId, { pin, token }) {
  const hosted = readJson(HOSTED_KEY) ?? {};
  hosted[roomId] = { pin, token };
  writeJson(HOSTED_KEY, hosted);
}

/** What this browser knows about a room it opened, or null if it did not. */
export function hostedRoom(roomId) {
  const hosted = readJson(HOSTED_KEY);
  const entry = hosted?.[roomId];
  return entry && entry.token ? entry : null;
}

/** Drop a room from the hosted list, once it is closed. */
export function forgetHostedRoom(roomId) {
  const hosted = readJson(HOSTED_KEY);
  if (!hosted || !(roomId in hosted)) return;
  delete hosted[roomId];
  writeJson(HOSTED_KEY, hosted);
}
