/* PLACER — the tools somebody has started, from the configuration page.
 *
 * Two stores, the same shape either way, the way services/follows.js has them. With a
 * Supabase project configured and somebody signed in, a started tool is a row in
 * public.started_tools (supabase/started-tools.sql), private to its owner, so it
 * follows the account to any device. Otherwise it is kept in this browser's
 * localStorage, one list per account (the local, no-Supabase identity shares one).
 *
 * A browser may hold tools kept for an account before the table existed. The first
 * time that account's tools are listed with the table there, they are carried over
 * (with their dates, so the order holds) and the browser's copy is forgotten. If the
 * carrying over fails they are listed anyway, from the browser, and tried again next
 * time.
 *
 * A started tool is { id, tool, slides, name, projectId, live, createdAt, updatedAt }:
 * `tool` is the id of the tool in the register, and `slides` its slides, each
 * { id, setup }. A tool that runs as one has a single slide. `name` is what its owner
 * has called this one (null for the tool's own name), `projectId` the project it was
 * added to (null for none), and `live` whether it is to be run live with a group
 * (true) or left open at its link for people to fill in in their own time (false).
 *
 * Everything but newId is async. Writes to one tool are made one after another, in
 * the order they were asked for, so a slow save can never land after a later one, or
 * after the tool is deleted. A failure to reach the database rejects; a failure to
 * read or write localStorage — a private window, storage blocked or full — is treated
 * as there being nothing kept, never as an error.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';

export const STARTED_TOOLS_TABLE = 'started_tools';
const COLUMNS = 'id, tool, slides, name, project_id, live, created_at, updated_at';

const KEY_PREFIX = 'placer_started_tools';

const keyFor = (accountId) => `${KEY_PREFIX}.${accountId ?? 'local'}`;

// The database, for a signed-in account on a configured project; else this browser.
const remote = (accountId) => Boolean(accountId) && isSupabaseConfigured();

function readLocal(accountId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(accountId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocal(accountId, list) {
  try {
    if (list.length === 0) localStorage.removeItem(keyFor(accountId));
    else localStorage.setItem(keyFor(accountId), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const newestFirst = (list) => [...list]
  .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));

function fromRow(row) {
  return { id: row.id, tool: row.tool, slides: Array.isArray(row.slides) ? row.slides : [], name: row.name ?? null,
    projectId: row.project_id ?? null, live: row.live ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
}

function toRow({ id, tool, slides, name, projectId, live }) {
  return { id, tool, slides: slides ?? [], name, project_id: projectId ?? null, live: live ?? null };
}

async function client() {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Keeping started tools in the database needs a Supabase project.');
  return supabase;
}

// One queue of writes per tool, so they land in the order they were asked for.
const queues = new Map();
function inTurn(id, write) {
  const next = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(write);
  queues.set(id, next);
  next.catch(() => {}).finally(() => { if (queues.get(id) === next) queues.delete(id); });
  return next;
}

/** A fresh id for a started tool or a slide. */
export function newId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

// What this browser kept for the account, put in the database, then forgotten here.
// Rows already there are left as they are. Resolves to whatever could not be carried.
async function carryOver(supabase, accountId) {
  const local = readLocal(accountId);
  if (local.length === 0) return [];
  const rows = local.map((entry) => ({ ...toRow(entry), name: entry.name?.trim() || null,
    created_at: entry.createdAt ?? null, updated_at: entry.updatedAt ?? null }));
  const { error } = await supabase.from(STARTED_TOOLS_TABLE)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    console.error('Could not carry this browser\'s started tools over to the account:', error);
    return local;
  }
  writeLocal(accountId, []);
  return [];
}

/** The account's started tools, the most recently changed first. */
export async function listStartedTools(accountId) {
  if (!remote(accountId)) return newestFirst(readLocal(accountId));
  const supabase = await client();
  const left = await carryOver(supabase, accountId);
  const { data, error } = await supabase.from(STARTED_TOOLS_TABLE).select(COLUMNS)
    .eq('owner_id', accountId).order('updated_at', { ascending: false });
  if (error) throw error;
  const kept = (data ?? []).map(fromRow);
  const ids = new Set(kept.map((entry) => entry.id));
  return newestFirst([...kept, ...left.filter((entry) => !ids.has(entry.id))]);
}

/** One started tool, or null. */
export async function readStartedTool(accountId, id) {
  if (!remote(accountId)) return readLocal(accountId).find((entry) => entry.id === id) ?? null;
  const supabase = await client();
  const { data, error } = await supabase.from(STARTED_TOOLS_TABLE).select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (data) return fromRow(data);
  // Not carried over yet: this browser may still have it.
  return readLocal(accountId).find((entry) => entry.id === id) ?? null;
}

/**
 * Keep a started tool: `{ id, tool, slides, name, projectId, live }`, added if new and
 * replaced if not. Resolves to what was kept, with its dates.
 */
export function saveStartedTool(accountId, { id, tool, slides, name = null, projectId = null, live = null }) {
  const entry = { id, tool, slides, name: name?.trim() || null, projectId, live };
  return inTurn(id, async () => {
    if (!remote(accountId)) {
      const list = readLocal(accountId);
      const now = new Date().toISOString();
      const existing = list.find((kept) => kept.id === id);
      const kept = { ...entry, createdAt: existing?.createdAt ?? now, updatedAt: now };
      writeLocal(accountId, [kept, ...list.filter((other) => other.id !== id)]);
      return kept;
    }
    const supabase = await client();
    const { data, error } = await supabase.from(STARTED_TOOLS_TABLE)
      .upsert(toRow(entry), { onConflict: 'id' }).select(COLUMNS).single();
    if (error) throw error;
    // Kept in the database now: this browser's copy, if it had one, is done with.
    const local = readLocal(accountId);
    if (local.some((other) => other.id === id)) writeLocal(accountId, local.filter((other) => other.id !== id));
    return fromRow(data);
  });
}

/** Forget a started tool. */
export function removeStartedTool(accountId, id) {
  return inTurn(id, async () => {
    // From this browser either way, in case it had not been carried over yet.
    const local = readLocal(accountId);
    if (local.some((entry) => entry.id === id)) writeLocal(accountId, local.filter((entry) => entry.id !== id));
    if (!remote(accountId)) return;
    const supabase = await client();
    const { error } = await supabase.from(STARTED_TOOLS_TABLE).delete().eq('id', id);
    if (error) throw error;
  });
}
