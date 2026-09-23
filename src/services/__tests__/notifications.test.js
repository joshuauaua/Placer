import { describe, it, expect, vi, afterEach } from 'vite-plus/test';

/*
 * Same shape as rooms.test.js: no localStorage fallback, so every call either reaches
 * Supabase or throws. The Supabase SDK is faked whole, so no client is built and no
 * request is made, and the fake's shape is part of the assertion — this module may
 * only reach for what supabase/notifications.sql actually grants it.
 */
const limit = vi.fn();
const order = vi.fn(() => ({ limit }));
const isUnread = vi.fn();
const maybeSingle = vi.fn();
const eqPreferences = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ order, is: isUnread, eq: eqPreferences }));

const isAfterIn = vi.fn();
const inUpdate = vi.fn(() => ({ is: isAfterIn }));
const isUpdate = vi.fn();
const update = vi.fn(() => ({ in: inUpdate, is: isUpdate }));

const eqDelete = vi.fn();
const del = vi.fn(() => ({ eq: eqDelete }));

const upsert = vi.fn();

const from = vi.fn(() => ({ select, update, delete: del, upsert }));
const getUser = vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } }));

const createClient = vi.fn(() => ({ from, auth: { getUser } }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

let notifications;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  notifications = await import('../notifications');
}

const ROW = {
  id: 'note-1',
  category: 'engagement',
  title: 'New comment',
  body: 'Mara Quinn commented on "Pocket park on Lot 7"',
  link_type: 'imagination',
  link_id: 'img-1',
  read_at: null,
  created_at: '2026-09-23T10:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('notifications, with no Supabase project', () => {
  it('has nobody else\'s action to report, so every call throws', async () => {
    await load({ configured: false });

    await expect(notifications.listNotifications()).rejects.toThrow(/Supabase project/);
    await expect(notifications.unreadCount()).rejects.toThrow(/Supabase project/);
    await expect(notifications.markRead('note-1')).rejects.toThrow(/Supabase project/);
    await expect(notifications.markAllRead()).rejects.toThrow(/Supabase project/);
    await expect(notifications.dismissNotification('note-1')).rejects.toThrow(/Supabase project/);
    await expect(notifications.readPreferences()).rejects.toThrow(/Supabase project/);
    await expect(notifications.savePreferences({ engagement_email: false })).rejects.toThrow(/Supabase project/);
  });
});

describe('notifications, with a Supabase project', () => {
  it('lists the most recent notifications, camelCased', async () => {
    await load();
    limit.mockResolvedValueOnce({ data: [ROW], error: null });

    const list = await notifications.listNotifications();

    expect(from).toHaveBeenCalledWith('notifications');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(30);
    expect(list).toEqual([{
      id: 'note-1', category: 'engagement', title: 'New comment',
      body: 'Mara Quinn commented on "Pocket park on Lot 7"',
      linkType: 'imagination', linkId: 'img-1', readAt: null,
      createdAt: '2026-09-23T10:00:00.000Z',
    }]);
  });

  it('rejects when the list cannot be read', async () => {
    await load();
    limit.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });

    await expect(notifications.listNotifications()).rejects.toThrow('Could not load notifications: nope');
  });

  it('counts unread notifications', async () => {
    await load();
    isUnread.mockResolvedValueOnce({ count: 3, error: null });

    await expect(notifications.unreadCount()).resolves.toBe(3);
    expect(isUnread).toHaveBeenCalledWith('read_at', null);
  });

  it('marks a list of notifications read, leaving already-read ones alone', async () => {
    await load();
    isAfterIn.mockResolvedValueOnce({ error: null });

    await notifications.markRead(['note-1', 'note-2']);

    expect(update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(inUpdate).toHaveBeenCalledWith('id', ['note-1', 'note-2']);
    expect(isAfterIn).toHaveBeenCalledWith('read_at', null);
  });

  it('wraps a single id for markRead', async () => {
    await load();
    isAfterIn.mockResolvedValueOnce({ error: null });

    await notifications.markRead('note-1');

    expect(inUpdate).toHaveBeenCalledWith('id', ['note-1']);
  });

  it('does nothing for an empty markRead list, without reaching Supabase', async () => {
    await load();

    await notifications.markRead([]);

    expect(from).not.toHaveBeenCalled();
  });

  it('marks every notification read', async () => {
    await load();
    isUpdate.mockResolvedValueOnce({ error: null });

    await notifications.markAllRead();

    expect(update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(isUpdate).toHaveBeenCalledWith('read_at', null);
  });

  it('dismisses a notification', async () => {
    await load();
    eqDelete.mockResolvedValueOnce({ error: null });

    await notifications.dismissNotification('note-1');

    expect(eqDelete).toHaveBeenCalledWith('id', 'note-1');
  });

  it('reads preferences, defaulted for an account that never set any', async () => {
    await load();
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const prefs = await notifications.readPreferences();

    expect(eqPreferences).toHaveBeenCalledWith('user_id', 'user-1');
    expect(prefs).toEqual(notifications.DEFAULT_PREFERENCES);
  });

  it('overlays a saved preferences row onto the defaults', async () => {
    await load();
    maybeSingle.mockResolvedValueOnce({ data: { engagement_email: false }, error: null });

    const prefs = await notifications.readPreferences();

    expect(prefs).toEqual({ ...notifications.DEFAULT_PREFERENCES, engagement_email: false });
  });

  it('saves a preferences patch as an upsert keyed on the account', async () => {
    await load();
    upsert.mockResolvedValueOnce({ error: null });

    await notifications.savePreferences({ engagement_email: false });

    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', engagement_email: false, updated_at: expect.any(String) },
      { onConflict: 'user_id' },
    );
  });

  it('rejects when saving preferences fails', async () => {
    await load();
    upsert.mockResolvedValueOnce({ error: { message: 'nope' } });

    await expect(notifications.savePreferences({ system_inapp: false }))
      .rejects.toThrow('Could not save your notification settings: nope');
  });
});
