import { describe, it, expect, vi, afterEach } from 'vite-plus/test';

/*
 * Same shape as imaginations.test.js: the Supabase SDK is faked whole, so no client is
 * built and no request is made, and the fake's shape is part of the assertion — this
 * module may only reach for what supabase/follows.sql actually grants it.
 */
const order = vi.fn();
const maybeSingle = vi.fn();
const eq2 = vi.fn(() => ({ maybeSingle }));
const eq1 = vi.fn(() => ({ order, eq: eq2 }));
const select = vi.fn(() => ({ eq: eq1 }));
const upsert = vi.fn();
const eqDelete2 = vi.fn();
const eqDelete1 = vi.fn(() => ({ eq: eqDelete2 }));
const del = vi.fn(() => ({ eq: eqDelete1 }));
const from = vi.fn(() => ({ select, upsert, delete: del }));
const getUser = vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } }));

const createClient = vi.fn(() => ({ from, auth: { getUser } }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

let follows;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  follows = await import('../follows');
}

const ROW = {
  id: 'follow-1',
  followed_type: 'imagination',
  followed_id: 'img-1',
  followed_label: 'Pocket park on Lot 7',
  created_at: '2026-09-20T10:00:00.000Z',
};

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('follows, with no Supabase project', () => {
  it('starts with nothing followed', async () => {
    await load({ configured: false });

    await expect(follows.readFollows('imagination')).resolves.toEqual([]);
    await expect(follows.isFollowing('imagination', 'img-1')).resolves.toBe(false);
  });

  it('follows something and reads it back', async () => {
    await load({ configured: false });

    await follows.follow('imagination', 'img-1', 'Pocket park on Lot 7');

    await expect(follows.isFollowing('imagination', 'img-1')).resolves.toBe(true);
    const all = await follows.readFollows('imagination');
    expect(all).toMatchObject([{ type: 'imagination', targetId: 'img-1', label: 'Pocket park on Lot 7' }]);
  });

  it('does not add a second row for a thing already followed', async () => {
    await load({ configured: false });

    await follows.follow('imagination', 'img-1', 'Pocket park on Lot 7');
    await follows.follow('imagination', 'img-1', 'Pocket park on Lot 7');

    await expect(follows.readFollows('imagination')).resolves.toHaveLength(1);
  });

  it('unfollows, and unfollowing again is a no-op', async () => {
    await load({ configured: false });
    await follows.follow('imagination', 'img-1', 'Pocket park on Lot 7');

    await follows.unfollow('imagination', 'img-1');
    await follows.unfollow('imagination', 'img-1');

    await expect(follows.readFollows('imagination')).resolves.toEqual([]);
  });

  it('keeps types apart: unfollowing a user does not touch an imagination of the same id', async () => {
    await load({ configured: false });
    await follows.follow('imagination', 'same-id', 'An imagination');
    await follows.follow('user', 'same-id', 'A person');

    await follows.unfollow('user', 'same-id');

    await expect(follows.isFollowing('imagination', 'same-id')).resolves.toBe(true);
    await expect(follows.isFollowing('user', 'same-id')).resolves.toBe(false);
  });

  it('persists across a reload of the module', async () => {
    await load({ configured: false });
    await follows.follow('city', 'malmo', 'Malmö');

    await load({ configured: false });

    await expect(follows.isFollowing('city', 'malmo')).resolves.toBe(true);
  });
});

describe('follows, with a Supabase project', () => {
  it('reads what an account follows of one type, newest first', async () => {
    await load();
    order.mockResolvedValue({ data: [ROW], error: null });

    const all = await follows.readFollows('imagination');

    expect(eq1).toHaveBeenCalledWith('followed_type', 'imagination');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(all).toEqual([
      { id: 'follow-1', type: 'imagination', targetId: 'img-1', label: 'Pocket park on Lot 7',
        createdAt: '2026-09-20T10:00:00.000Z' },
    ]);
  });

  it('throws a readable message when the read fails', async () => {
    await load();
    order.mockResolvedValue({ data: null, error: { message: 'network down' } });

    await expect(follows.readFollows('imagination')).rejects.toThrow('network down');
  });

  it('checks whether a thing is followed', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { id: 'follow-1' }, error: null });

    await expect(follows.isFollowing('imagination', 'img-1')).resolves.toBe(true);
    expect(eq2).toHaveBeenCalledWith('followed_id', 'img-1');
  });

  it('reports not following when there is no row', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(follows.isFollowing('imagination', 'img-1')).resolves.toBe(false);
  });

  it('upserts a follow scoped to the signed-in account, keyed so following twice cannot duplicate', async () => {
    await load();
    upsert.mockResolvedValue({ error: null });

    await follows.follow('imagination', 'img-1', 'Pocket park on Lot 7');

    expect(upsert).toHaveBeenCalledWith(
      { follower_id: 'user-1', followed_type: 'imagination', followed_id: 'img-1', followed_label: 'Pocket park on Lot 7' },
      { onConflict: 'follower_id,followed_type,followed_id' },
    );
  });

  it('refuses to follow anything with nobody signed in', async () => {
    await load();
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(follows.follow('imagination', 'img-1', 'x')).rejects.toThrow('needs an account');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('deletes a follow by type and id', async () => {
    await load();
    eqDelete2.mockResolvedValue({ error: null });

    await follows.unfollow('imagination', 'img-1');

    expect(eqDelete1).toHaveBeenCalledWith('followed_type', 'imagination');
    expect(eqDelete2).toHaveBeenCalledWith('followed_id', 'img-1');
  });
});
