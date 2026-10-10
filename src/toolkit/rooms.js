/* PLACER — toolkit rooms, the parts with no network in them.
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
 * A third key, ANSWERS_KEY, remembers what this browser answered in a room from a
 * project's page, so coming back shows the results rather than the question again.
 *
 * All three live in localStorage, and all are therefore listed in STORAGE_KEYS in
 * services/api.js — a key missing from that registry is silently skipped by the
 * GDPR export and erasure requests. The literals are declared here rather than
 * imported, matching services/profile.js; services/__tests__/api.test.js holds the
 * two sides together.
 */

/** This browser's participant token. */
const PARTICIPANT_KEY = 'placemaking_room_participant';
/** Rooms this browser opened: { [roomId]: { pin, token, code } }. */
const HOSTED_KEY = 'placemaking_rooms_hosted';
/** What this browser answered in a room from a project's page: { [roomId]: state }. */
const ANSWERS_KEY = 'placemaking_room_answers';

export const PIN_LENGTH = 6;

/**
 * How long a room can be opened for — the same four values toolkit_room_create in
 * supabase/rooms-lifetime.sql accepts, and nothing else. Only the first is a workshop:
 * the rest are for a poll left running on a poster, need a project behind them, and
 * are joined by their code rather than their PIN.
 */
export const ROOM_LIFETIMES = [
  { id: '2h', label: '2 hours' },
  { id: '1w', label: '1 week' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

export const DEFAULT_LIFETIME = '2h';

/**
 * True for a room opened for longer than a workshop — the same test toolkit_room_join
 * applies in supabase/rooms-lifetime.sql, and the reason such a room is reached by its
 * join code and never its PIN.
 */
export function isLongRoom({ createdAt, expiresAt }) {
  const span = new Date(expiresAt ?? NaN).getTime() - new Date(createdAt ?? NaN).getTime();
  return Number.isFinite(span) && span > 2 * 60 * 60 * 1000;
}

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
  // Past two days, minutes stop meaning anything to somebody reading a countdown on a
  // room that runs for weeks.
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return restHours === 0 ? `${days}d` : `${days}d ${restHours}h`;
  }

  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** '2026-10-24T…' → '24 October 2026', for saying when a long room ends. */
export function formatRoomDate(value) {
  const date = new Date(value ?? NaN);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Today in this browser's calendar, as 'YYYY-MM-DD'. */
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The days a project's room can be scheduled to start on, as { min, max } in
 * 'YYYY-MM-DD': within the project's dates and not before today. Null when there are
 * none — a project without both dates, or one that has already ended. The database
 * holds the same line (supabase/rooms-schedule.sql); this is so the picker can.
 */
export function scheduleRange(project, today = localToday()) {
  const start = project?.startDate ?? null;
  const end = project?.endDate ?? null;
  if (!start || !end) return null;
  const min = start > today ? start : today;
  return min <= end ? { min, max: end } : null;
}

function origin() {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** The link a QR code encodes, and the one somebody can be sent. */
export function joinUrl(pin) {
  return `${origin()}/join?pin=${encodeURIComponent(String(pin ?? ''))}`;
}

/**
 * The link a long room's QR code encodes. Its code rather than its PIN: a room left
 * open for weeks cannot rest on six guessable digits — see supabase/rooms-lifetime.sql.
 */
export function codeJoinUrl(code) {
  return `${origin()}/join?code=${encodeURIComponent(String(code ?? ''))}`;
}

/** The join code in whatever arrived, or null if it is not one. */
export function parseJoinCode(input) {
  const code = String(input ?? '').trim().toLowerCase();
  return /^[0-9a-f]{32}$/.test(code) ? code : null;
}

/** Where a room is actually played, once joined. */
export function roomPath(toolId, roomId) {
  return `/toolkit/${toolId}?room=${encodeURIComponent(String(roomId ?? ''))}`;
}

/** The room id in ?room=…, or null. */
export function roomIdFrom(search) {
  // Accepts what wouter's useSearch() returns, with or without the leading '?'.
  const query = String(search ?? '').replace(/^\?/, '');
  if (!query) return null;
  const value = new URLSearchParams(query).get('room');
  return value ? value : null;
}

/**
 * The project id in ?project=…, or null. Set when a tool is opened from a project's
 * page, so the way back leads to the project and a launched tool (Idea Visualizer)
 * knows which project it is for. Rooms are not opened here; a project opens them from
 * its dashboard.
 */
export function projectIdFrom(search) {
  const query = String(search ?? '').replace(/^\?/, '');
  if (!query) return null;
  const value = new URLSearchParams(query).get('project');
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

/**
 * Remember that this browser opened a room, and how to close it again. `code` is only
 * set for a long room, and is what its QR code carries in place of the PIN. A
 * project's dashboard calls this too, so its owner can run a room from any browser.
 */
export function rememberHostedRoom(roomId, { pin, token, code = null }) {
  const hosted = readJson(HOSTED_KEY) ?? {};
  hosted[roomId] = code ? { pin, token, code } : { pin, token };
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

/**
 * Remember what this browser answered in a room, so a project's page can show the
 * results instead of the question when somebody comes back. Only a convenience: the
 * one-answer-per-browser rule itself is the participant token, which makes a second
 * answer replace the first rather than add to it (toolkit_contribution_save).
 */
export function rememberAnswer(roomId, state) {
  const answers = readJson(ANSWERS_KEY) ?? {};
  answers[roomId] = state;
  writeJson(ANSWERS_KEY, answers);
}

/** What this browser answered in a room, or null if it has not. */
export function rememberedAnswer(roomId) {
  return readJson(ANSWERS_KEY)?.[roomId] ?? null;
}
