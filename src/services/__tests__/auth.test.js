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
const eqUpdate = vi.fn(() => ({ select: selectAfterUpdate }));
const update = vi.fn(() => ({ eq: eqUpdate }));
const select = vi.fn(() => ({ maybeSingle }));
const from = vi.fn(() => ({ select, update }));
const rpc = vi.fn();

// Pictures go through services/media; media.test.js covers what happens inside it.
const upload = vi.fn();
const remove = vi.fn();
const mediaUrl = vi.fn((path) => (path ? `https://cdn.example/${path}` : null));

vi.mock('../media', () => ({
  uploadMedia: (...a) => upload(...a),
  removeMedia: (...a) => remove(...a),
  mediaUrl: (...a) => mediaUrl(...a),
}));

const createClient = vi.fn(() => ({
  from,
  rpc,
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
const signedIn = () => getSession.mockResolvedValue({ data: { session: { user: account() } }, error: null });

beforeEach(() => {
  for (const spy of [signUp, signInWithPassword, signInWithOAuth, resetPasswordForEmail,
    updateUser, signOut, getSession, onAuthStateChange, unsubscribe,
    maybeSingle, selectAfterUpdate, eqUpdate, update, select, from, rpc, upload, remove, mediaUrl,
    createClient]) {
    spy.mockClear();
  }
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
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
  it('sends the display name and invite code as metadata for the triggers to pick up', async () => {
    await load();
    signUp.mockResolvedValue({ data: { user: account(), session: null }, error: null });

    await auth.signUpWithPassword({
      email: 'mara@example.com', password: 'longenough', displayName: 'Mara Quinn',
      inviteCode: 'PLACER-MARA',
    });

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'mara@example.com',
      password: 'longenough',
      options: expect.objectContaining({
        data: { display_name: 'Mara Quinn', invite_code: 'PLACER-MARA' },
        emailRedirectTo: expect.stringContaining('/auth/callback'),
      }),
    }));
  });

  it('checks the invite code before trying, and stops at a bad one', async () => {
    await load();
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(auth.signUpWithPassword({
      email: 'a@b.co', password: 'longenough', inviteCode: 'NOPE',
    })).rejects.toThrow(auth.INVITE_REFUSED);
    expect(rpc).toHaveBeenCalledWith('invite_code_check', { p_code: 'NOPE' });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('explains a code the trigger refused, rather than a bare database error', async () => {
    await load();
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 500, message: 'Database error saving new user' },
    });

    await expect(auth.signUpWithPassword({
      email: 'a@b.co', password: 'longenough', inviteCode: 'LASTUSE',
    })).rejects.toThrow(auth.INVITE_REFUSED);
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

describe('reading a public profile', () => {
  it('asks profile_public for one account and shapes the row', async () => {
    await load();
    rpc.mockResolvedValue({
      data: [{ id: 'user-2', display_name: 'Devon Park', bio: null, location: 'Lund', avatar: null }],
      error: null,
    });

    await expect(auth.readPublicProfile('user-2')).resolves.toEqual({
      id: 'user-2', name: 'Devon Park', bio: '', location: 'Lund', avatar: null,
      accountType: 'individual', contactEmail: '', website: '', coverPath: null, cover: null,
    });
    expect(rpc).toHaveBeenCalledWith('profile_public', { p_id: 'user-2' });
    // Never the table: it is readable only by its owner.
    expect(from).not.toHaveBeenCalled();
  });

  it('is null for an account that does not exist', async () => {
    await load();
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(auth.readPublicProfile('user-9')).resolves.toBeNull();
  });
});

describe('cover images', () => {
  const file = (type, size = 1000) => ({ type, size });

  it('uploads into the account\'s own folder and returns the path', async () => {
    await load();
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    upload.mockImplementation((supabase, path) => Promise.resolve(path));

    const path = await auth.uploadCover(file('image/png'));

    expect(path).toMatch(/^covers\/user-1\/cover-\d+\.png$/);
    expect(upload).toHaveBeenCalledWith(expect.anything(), path, expect.objectContaining({ type: 'image/png' }));
  });

  it('refuses anything but a JPEG, PNG or WebP before uploading', async () => {
    await load();

    await expect(auth.uploadCover(file('image/gif'))).rejects.toThrow(/JPEG, PNG or WebP/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('refuses a file over 5 MB before uploading', async () => {
    await load();

    await expect(auth.uploadCover(file('image/jpeg', 6 * 1024 * 1024))).rejects.toThrow(/5 MB/);
    expect(upload).not.toHaveBeenCalled();
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
      .resolves.toEqual({ id: 'user-1', name: 'Mara Quinn', bio: 'Cyclist', location: 'Malmö', avatar: 'tree',
        accountType: 'individual', contactEmail: '', website: '', coverPath: null, cover: null });
  });

  it('defaults location and avatar when the row has none', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Mara Quinn', bio: '', location: null, avatar: null }, error: null,
    });

    await expect(auth.readOwnProfile())
      .resolves.toEqual({ id: 'user-1', name: 'Mara Quinn', bio: '', location: '', avatar: null,
        accountType: 'individual', contactEmail: '', website: '', coverPath: null, cover: null });
  });

  it('turns a cover path into its public URL', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Mara', cover_path: 'covers/user-1/cover-1.jpg',
        account_type: 'organisation', contact_email: 'hi@mara.se', website: 'https://mara.se' },
      error: null,
    });

    await expect(auth.readOwnProfile()).resolves.toEqual(expect.objectContaining({
      accountType: 'organisation', contactEmail: 'hi@mara.se', website: 'https://mara.se',
      coverPath: 'covers/user-1/cover-1.jpg', cover: 'https://cdn.example/covers/user-1/cover-1.jpg',
    }));
  });

  it('saves the details under their column names, with https:// added to a bare website', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { id: 'user-1', display_name: 'Mara' }, error: null });

    signedIn();
    await auth.saveOwnProfile({ accountType: 'organisation', contactEmail: 'hi@mara.se', website: 'mara.se' });

    expect(update).toHaveBeenCalledWith({
      account_type: 'organisation', contact_email: 'hi@mara.se', website: 'https://mara.se',
    });
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

    signedIn();
    await auth.saveOwnProfile({ name: 'Devon Park' });

    expect(update).toHaveBeenCalledWith({ display_name: 'Devon Park' });
  });

  it('sends a location and an avatar icon when they are the fields being changed', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Devon Park', bio: '', location: 'Malmö', avatar: 'tree' },
      error: null,
    });

    signedIn();
    await auth.saveOwnProfile({ location: 'Malmö', avatar: 'tree' });

    expect(update).toHaveBeenCalledWith({ location: 'Malmö', avatar: 'tree' });
  });

  it('filters the update to the session\'s own id, never one carried in the patch', async () => {
    await load();
    maybeSingle.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Devon Park', bio: '' }, error: null,
    });

    signedIn();
    await auth.saveOwnProfile({ name: 'Devon Park', bio: '' });

    expect(update).toHaveBeenCalledWith({ display_name: 'Devon Park', bio: '' });
    expect(update.mock.calls[0][0]).not.toHaveProperty('id');
    // The project refuses an UPDATE with no WHERE clause, so this filter is required.
    expect(eqUpdate).toHaveBeenCalledWith('id', 'user-1');
  });

  it('refuses to save without a session rather than sending an unfiltered update', async () => {
    await load();

    await expect(auth.saveOwnProfile({ name: 'Devon Park' })).rejects.toThrow(/Sign in/);
    expect(update).not.toHaveBeenCalled();
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
