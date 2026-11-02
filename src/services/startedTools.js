/* PLACER — the tools somebody has started, from the configuration page.
 *
 * Kept in this browser's localStorage for now, one list per account (the local,
 * no-Supabase identity shares one list), so they show only on the device they were
 * started on. A database table can take its place later without the pages changing:
 * they only call these functions.
 *
 * A started tool is { id, tool, slides, createdAt, updatedAt }: `tool` is the id of the
 * tool in the register, and `slides` its slides, each { id, setup }. A tool that runs
 * as one has a single slide.
 *
 * Every read and write may fail — a private window, storage blocked or full — and a
 * failure is treated as there being nothing kept, never as an error to show.
 */

const KEY_PREFIX = 'placer_started_tools';

const keyFor = (accountId) => `${KEY_PREFIX}.${accountId ?? 'local'}`;

function readAll(accountId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(accountId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeAll(accountId, list) {
  try {
    localStorage.setItem(keyFor(accountId), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** A fresh id for a started tool or a slide. */
export function newId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

/** The account's started tools, the most recently changed first. */
export function listStartedTools(accountId) {
  return readAll(accountId).sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
}

/** One started tool, or null. */
export function readStartedTool(accountId, id) {
  return readAll(accountId).find((entry) => entry.id === id) ?? null;
}

/**
 * Keep a started tool: `{ id, tool, slides }`, added if new and replaced if not.
 * Resolves nothing; returns what was kept, with its dates.
 */
export function saveStartedTool(accountId, { id, tool, slides }) {
  const list = readAll(accountId);
  const now = new Date().toISOString();
  const existing = list.find((entry) => entry.id === id);
  const kept = { id, tool, slides, createdAt: existing?.createdAt ?? now, updatedAt: now };
  writeAll(accountId, [kept, ...list.filter((entry) => entry.id !== id)]);
  return kept;
}

/** Forget a started tool. */
export function removeStartedTool(accountId, id) {
  writeAll(accountId, readAll(accountId).filter((entry) => entry.id !== id));
}
