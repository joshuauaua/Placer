/* PLACER — a tool's slides, published as rooms people go through in order.
 *
 * A tool set up as several slides (`slides` in toolkit/tools.js) is published as a
 * room per slide, so each slide keeps answers, and results, of its own. The rooms are
 * one run all the same: each one's setup carries where it stands in it,
 *
 *   config.sequence = { id, index, count, next }
 *
 * — the run's id, shared by all of them; this slide's place in it, from 0; how many
 * slides there are; and the id of the room for the slide after it, or null for the
 * last. A room's setup is fixed once it is opened, so they are opened last first
 * (PublishToolDialog), each knowing the one after it.
 *
 * Whoever published them keeps the run's room ids in this browser (rememberSequence),
 * so ending the session from any of its rooms ends all of them.
 */

const SEQUENCES_KEY = 'placemaking_room_sequences';

/** Where a room's setup puts it in a run of slides, or null for a room on its own. */
export function roomSequence(config) {
  const sequence = config?.sequence;
  if (!sequence || typeof sequence !== 'object') return null;
  const { id, index, count, next = null } = sequence;
  if (typeof id !== 'string' || !Number.isInteger(index) || !Number.isInteger(count)) return null;
  if (count < 2 || index < 0 || index >= count) return null;
  return { id, index, count, next: typeof next === 'string' && next ? next : null };
}

/** A slide's setup, with its place in the run. */
export function withSequence(setup, sequence) {
  return { ...setup, sequence };
}

/**
 * The open rooms of each run of slides in `rooms`, in slide order, keyed by run id;
 * rooms on their own are left out.
 */
export function groupSequences(rooms) {
  const runs = new Map();
  for (const room of rooms ?? []) {
    const sequence = roomSequence(room?.config);
    if (!sequence) continue;
    if (!runs.has(sequence.id)) runs.set(sequence.id, []);
    runs.get(sequence.id).push(room);
  }
  for (const list of runs.values()) {
    list.sort((a, b) => roomSequence(a.config).index - roomSequence(b.config).index);
  }
  return runs;
}

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEQUENCES_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Keep, in this browser, which rooms make up a run it published. */
export function rememberSequence(sequenceId, roomIds) {
  try {
    localStorage.setItem(SEQUENCES_KEY, JSON.stringify({ ...readAll(), [sequenceId]: roomIds }));
  } catch {
    // Without storage the session is ended a room at a time, from the dashboard.
  }
}

/** The rooms of a run this browser published, or []. */
export function rememberedSequence(sequenceId) {
  const ids = readAll()[sequenceId];
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
}

/** A fresh id for a run. */
export function newSequenceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `seq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
