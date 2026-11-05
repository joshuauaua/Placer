import { describe, it, expect, vi, afterEach } from 'vite-plus/test';

/*
 * The Supabase SDK is faked whole, the way follows.test.js has it: no client is built
 * and no request is made, and the calls this module makes are part of what is checked.
 */
const fresh = () => ({ list: { data: [], error: null }, read: { data: null, error: null },
  save: { data: null, error: null }, carry: { error: null }, remove: { error: null } });
const result = fresh();
const order = vi.fn(() => Promise.resolve(result.list));
const maybeSingle = vi.fn(() => Promise.resolve(result.read));
const selectEq = vi.fn(() => ({ order, maybeSingle }));
const select = vi.fn(() => ({ eq: selectEq }));
const single = vi.fn(() => Promise.resolve(result.save));
const upsert = vi.fn((rows, options) => (options?.ignoreDuplicates
  ? Promise.resolve(result.carry)
  : { select: () => ({ single }) }));
const deleteEq = vi.fn(() => Promise.resolve(result.remove));
const del = vi.fn(() => ({ eq: deleteEq }));
const from = vi.fn(() => ({ select, upsert, delete: del }));
const createClient = vi.fn(() => ({ from }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

let store;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  store = await import('../startedTools');
}

const ROW = { id: 'tool-1', tool: 'open-vote', slides: [{ id: 's1', setup: { question: 'Trees?' } }],
  name: 'Tuesday poll', project_id: 'proj-1', live: true,
  created_at: '2026-11-01T10:00:00.000Z', updated_at: '2026-11-02T10:00:00.000Z' };

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  Object.assign(result, fresh());
});

describe('startedTools, in the browser', () => {
  it('keeps a started tool per account, the most recently changed first', async () => {
    await load({ configured: false });
    await store.saveStartedTool('a', { id: 'one', tool: 'open-vote', slides: [{ id: 's1', setup: null }] });
    await store.saveStartedTool('a', { id: 'two', tool: 'word-cloud', slides: [] });
    await store.saveStartedTool('b', { id: 'three', tool: 'pop-quiz', slides: [] });
    await store.saveStartedTool('a', { id: 'one', tool: 'open-vote', slides: [{ id: 's1', setup: { question: 'Hi?' } }] });

    expect((await store.listStartedTools('a')).map((entry) => entry.id)).toEqual(['one', 'two']);
    expect((await store.listStartedTools('b')).map((entry) => entry.id)).toEqual(['three']);
    expect((await store.readStartedTool('a', 'one')).slides[0].setup).toEqual({ question: 'Hi?' });
    await expect(store.readStartedTool('b', 'one')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps the date it was first kept when it is kept again', async () => {
    await load({ configured: false });
    const first = await store.saveStartedTool(null, { id: 'one', tool: 'open-vote', slides: [] });
    const again = await store.saveStartedTool(null, { id: 'one', tool: 'open-vote', slides: [] });

    expect(again.createdAt).toBe(first.createdAt);
    await expect(store.listStartedTools(null)).resolves.toHaveLength(1);
  });

  it('forgets one, and treats unreadable storage as nothing kept', async () => {
    await load({ configured: false });
    await store.saveStartedTool('a', { id: 'one', tool: 'open-vote', slides: [] });
    await store.removeStartedTool('a', 'one');
    await expect(store.listStartedTools('a')).resolves.toEqual([]);

    localStorage.setItem('placer_started_tools.a', 'not json');
    await expect(store.listStartedTools('a')).resolves.toEqual([]);
  });

  it('keeps them in the browser with a Supabase project but nobody signed in', async () => {
    await load();
    await store.saveStartedTool(null, { id: 'one', tool: 'open-vote', slides: [] });

    await expect(store.listStartedTools(null)).resolves.toHaveLength(1);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('startedTools, in the database', () => {
  it('lists the account’s rows, newest first, in the app’s shape', async () => {
    await load();
    result.list = { data: [ROW], error: null };

    await expect(store.listStartedTools('user-1')).resolves.toEqual([{ id: 'tool-1', tool: 'open-vote',
      slides: ROW.slides, name: 'Tuesday poll', projectId: 'proj-1', live: true,
      createdAt: ROW.created_at, updatedAt: ROW.updated_at }]);
    expect(from).toHaveBeenCalledWith('started_tools');
    expect(selectEq).toHaveBeenCalledWith('owner_id', 'user-1');
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: false });
    // Nothing in this browser to carry over.
    expect(upsert).not.toHaveBeenCalled();
  });

  it('carries over what this browser kept for the account, with its dates, then forgets it', async () => {
    await load({ configured: false });
    await store.saveStartedTool('user-1', { id: 'old', tool: 'word-cloud', name: ' Words ', slides: [] });
    const [kept] = await store.listStartedTools('user-1');
    await load();
    result.list = { data: [ROW], error: null };

    await store.listStartedTools('user-1');

    expect(upsert).toHaveBeenCalledWith([{ id: 'old', tool: 'word-cloud', slides: [], name: 'Words',
      project_id: null, live: null, created_at: kept.createdAt, updated_at: kept.updatedAt }],
    { onConflict: 'id', ignoreDuplicates: true });
    expect(localStorage.getItem('placer_started_tools.user-1')).toBeNull();
  });

  it('lists what could not be carried over from the browser, and keeps it there', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await load({ configured: false });
    await store.saveStartedTool('user-1', { id: 'old', tool: 'word-cloud', slides: [] });
    await load();
    result.carry = { error: { message: 'offline' } };
    result.list = { data: [ROW], error: null };

    expect((await store.listStartedTools('user-1')).map((entry) => entry.id)).toEqual(['old', 'tool-1']);
    expect(localStorage.getItem('placer_started_tools.user-1')).not.toBeNull();
  });

  it('rejects when the rows cannot be read', async () => {
    await load();
    result.list = { data: null, error: { message: 'offline' } };

    await expect(store.listStartedTools('user-1')).rejects.toEqual({ message: 'offline' });
  });

  it('reads one by its id', async () => {
    await load();
    result.read = { data: ROW, error: null };

    await expect(store.readStartedTool('user-1', 'tool-1')).resolves.toMatchObject({ id: 'tool-1', projectId: 'proj-1' });
    expect(selectEq).toHaveBeenCalledWith('id', 'tool-1');
  });

  it('saves with an upsert of only the columns the browser may write', async () => {
    await load();
    result.save = { data: ROW, error: null };

    await expect(store.saveStartedTool('user-1', { id: 'tool-1', tool: 'open-vote', slides: ROW.slides,
      name: 'Tuesday poll', projectId: 'proj-1', live: true })).resolves.toMatchObject({ updatedAt: ROW.updated_at });
    expect(upsert).toHaveBeenCalledWith({ id: 'tool-1', tool: 'open-vote', slides: ROW.slides,
      name: 'Tuesday poll', project_id: 'proj-1', live: true }, { onConflict: 'id' });
  });

  it('makes one tool’s writes in the order they were asked for', async () => {
    await load();
    const done = [];
    let release;
    single.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ data: ROW, error: null }); }));
    deleteEq.mockImplementationOnce(() => { done.push('delete'); return Promise.resolve({ error: null }); });

    const saving = store.saveStartedTool('user-1', { id: 'tool-1', tool: 'open-vote', slides: [] })
      .then(() => done.push('save'));
    const removing = store.removeStartedTool('user-1', 'tool-1');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(deleteEq).not.toHaveBeenCalled();

    release();
    await Promise.all([saving, removing]);
    expect(done).toEqual(['save', 'delete']);
  });

  it('deletes by id, and rejects when it cannot', async () => {
    await load();
    await store.removeStartedTool('user-1', 'tool-1');
    expect(deleteEq).toHaveBeenCalledWith('id', 'tool-1');

    result.remove = { error: { message: 'offline' } };
    await expect(store.removeStartedTool('user-1', 'tool-1')).rejects.toEqual({ message: 'offline' });
  });
});
