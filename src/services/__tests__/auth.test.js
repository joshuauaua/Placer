import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * The Supabase SDK is faked whole, so no client is ever constructed and no request is
 * ever made. The shape of the fake matters as much as the assertions: from() offers
 * nothing but select and update, so a test fails the moment this module tries to insert
 * a profile or delete one — neither of which the rules in supabase/auth.sql allow, and
 * neither of which any assertion here would otherwise catch. Profiles are created by a
 * trigger on auth.users and removed by the cascade when an account goes.
 *
 * The SDK is loaded by a dynamic import, so getting hold of the client is async even
 * where the function around it is not — hence the flush() in the subscription tests.
 */

const signUp = vi.fn();
const signInWithPassword = vi.fn();
const signInWithOAuth = vi.fn();
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const getSession = vi.fn();
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe } } }));

const maybeSingle = vi.fn();
const selectAfterUpdate = vi.fn(() => ({ maybeSingle }));
const update = vi.fn(() => ({ select: selectAfterUpdate }));
const select = vi.fn(() => ({ maybeSingle }));
const from = vi.fn(() => ({ select, update }));

const createClient = vi.fn(() => ({
  from,
  auth: {
    signUp,
    signInWithPassword,
    signInWithOAuth,
    resetPasswordForEmail,
    updateUser,
    signOut,
    getSession,
    onAuthStateChange,
  },
}));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

let auth;

/** Let the dynamic import of the SDK settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  // The module reads the environment at call time but caches the client, so each test
  // needs its own copy.
  auth = await import('../auth');
}

const account = (over = {}) => ({ id: 'user-1', email: 'mara@example.com', ...over });

beforeEach(() => {
  for (const spy of [signUp, signInWithPassword, signInWithOAuth, resetPasswordForEmail,
    updateUser, signOut, getSession, onAuthStateChange, unsubscribe,
    maybeSingle, selectAfterUpdate, update, select, from, createClient]) {
    spy.mockClear();
  }
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
});

describe('auth, with no project configured', () => {
  it('says which variables are missing rather than failing obscurely', async () => {
    await load({ configured: false });

    await expect(auth.readSession()).rejects.toThrow(/VITE_SUPABASE_URL/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('reports itself unconfigured, so callers can offer the local identity instead', async () => {
    await load({ configured: false });

    expect(auth.isSupabaseConfigured()).toBe(false);
  });
});

describe('signing up', () => {
  it('sends the display name as metadata for the trigger to pick up', async () => {
    await load();
    signUp.mockResolvedValue({ data: { user: account(), session: null }, error: null });

    await auth.signUpWithPassword({
      email: 'mara@example.com', password: 'longenough', displayName: 'Mara Quinn',
    });

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'mara@example.com',
      password: 'longenough',
      options: expect.objectContaining({
        data: { display_name: 'Mara Quinn' },
        emailRedirectTo: expect.stringContaining('/auth/callback'),
      }),
    }));
  });

  it('reports that confirmation is needed when no session comes back', async () => {
    await load();
    signUp.mockResolvedValue({ data: { user: account(), session: null }, error: null });

    await expect(auth.signUpWithPassword({ email: 'a@b.co', password: 'longenough' }))
      .resolves.toEqual({ needsConfirmation: true });
  });

  it('reports no confirmation needed when the project hands back a session', async () => {
    await load();
    signUp.mockResolvedValue({
      data: { user: account(), session: { access_token: 'tok' } }, error: null,
    });

    await expect(auth.signUpWithPassword({ email: 'a@b.co', password: 'longenough' }))
      .resolves.toEqual({ needsConfirmation: false });
  });
});

describe('signing in with a password', () => {
  it('returns the account', async () => {
    await load();
    signInWithPassword.mockResolvedValue({ data: { user: account() }, error: null });

    await expect(auth.signInWithPassword({ email: 'mara@example.com', password: 'longenough' }))
      .resolves.toEqual({ id: 'user-1', email: 'mara@example.com' });
  });

  it('is null for details that do not match, rather than an error to show somebody', async () => {
    await load();
    signInWithPassword.mockResolvedValue({
      data: {}, error: { status: 400, message: 'Invalid login credentials' },
    });

    await expect(auth.signInWithPassword({ email: 'mara@example.com', password: 'nope' }))
      .resolves.toBeNull();
  });

  it('still throws when the failure is not about the credentials', async () => {
    await load();
    signInWithPassword.mockResolvedValue({
      data: {}, error: { status: 503, message: 'service unavailable' },
    });

    await expect(auth.signInWithPassword({ email: 'mara@example.com', password: 'longenough' }))
      .rejects.toThrow(/service unavailable/);
  });
});

describe('Google', () => {
  it('asks for the provider and a callback it can return to', async () => {
    await load();
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await auth.signInWithGoogle();

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    });
  });
});

describe('the password reset', () => {
  it('points the link at the screen that can change a password', async () => {
    await load();
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await auth.sendPasswordReset('mara@example.com');

    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'mara@example.com',
      { redirectTo: expect.stringContaining('next=%2Freset') },
    );
  });
});

describe('the profile', () => {
  it('is shaped like the local one, so nothing downstream can tell them apart', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Mara Quinn', bio: 'Cyclist', location: 'Malmö', avatar: 'tree' },
      error: null,
    });

    await expect(auth.readOwnProfile())
      .resolves.toEqual({ id: 'user-1', name: 'Mara Quinn', bio: 'Cyclist', location: 'Malmö', avatar: 'tree' });
  });

  it('defaults location and avatar when the row has none', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Mara Quinn', bio: '', location: null, avatar: null }, error: null,
    });

    await expect(auth.readOwnProfile())
      .resolves.toEqual({ id: 'user-1', name: 'Mara Quinn', bio: '', location: '', avatar: null });
  });

  it('is null when there is no row to read, rather than throwing', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(auth.readOwnProfile()).resolves.toBeNull();
  });

  it('sends only the fields being changed, so saving a name cannot blank a bio', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Devon Park', bio: 'Cyclist' }, error: null,
    });

    await auth.saveOwnProfile({ name: 'Devon Park' });

    expect(update).toHaveBeenCalledWith({ display_name: 'Devon Park' });
  });

  it('sends a location and an avatar icon when they are the fields being changed', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Devon Park', bio: '', location: 'Malmö', avatar: 'tree' },
      error: null,
    });

    await auth.saveOwnProfile({ location: 'Malmö', avatar: 'tree' });

    expect(update).toHaveBeenCalledWith({ location: 'Malmö', avatar: 'tree' });
  });

  it('carries no id on the update: the policy already scopes it to the caller', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Devon Park', bio: '' }, error: null,
    });

    await auth.saveOwnProfile({ name: 'Devon Park', bio: '' });

    expect(update).toHaveBeenCalledWith({ display_name: 'Devon Park', bio: '' });
    expect(update.mock.calls[0][0]).not.toHaveProperty('id');
  });
});

describe('following the session', () => {
  it('reports the session as it stands at subscribe time', async () => {
    await load();
    getSession.mockResolvedValue({
      data: { session: { user: account() } }, error: null,
    });
    const onChange = vi.fn();

    auth.subscribeToAuth(onChange);
    await flush();

    expect(onChange).toHaveBeenCalledWith({ id: 'user-1', email: 'mara@example.com' });
  });

  it('reports null when nobody is signed in', async () => {
    await load();
    const onChange = vi.fn();

    auth.subscribeToAuth(onChange);
    await flush();

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('subscribes before reading, so a sign-in mid-exchange is not missed', async () => {
    await load();
    const onChange = vi.fn();

    auth.subscribeToAuth(onChange);
    await flush();

    expect(onAuthStateChange).toHaveBeenCalled();
    expect(onAuthStateChange.mock.invocationCallOrder[0])
      .toBeLessThan(getSession.mock.invocationCallOrder[0]);
  });

  it('passes later changes through', async () => {
    await load();
    const onChange = vi.fn();

    auth.subscribeToAuth(onChange);
    await flush();
    onChange.mockClear();

    const listener = onAuthStateChange.mock.calls[0][0];
    listener('SIGNED_IN', { user: account({ id: 'user-2' }) });

    expect(onChange).toHaveBeenCalledWith({ id: 'user-2', email: 'mara@example.com' });
  });

  it('unsubscribes when torn down', async () => {
    await load();

    const stop = auth.subscribeToAuth(vi.fn());
    await flush();
    stop();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('treats an unreachable project as signed out rather than crashing the page', async () => {
    await load();
    getSession.mockRejectedValue(new Error('offline'));
    const onChange = vi.fn();

    auth.subscribeToAuth(onChange);
    await flush();

    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
