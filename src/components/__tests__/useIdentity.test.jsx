import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { useIdentity } from '../useIdentity';
import {
  isSupabaseConfigured,
  readOwnProfile,
  saveOwnProfile,
  signOutOfAccount,
  subscribeToAuth,
} from '../../services/auth';

/*
 * services/auth is mocked rather than the SDK, because what is under test here is the
 * choice between the two identities — the real account and the localStorage record from
 * before accounts existed — and not how either one talks to Supabase. services/profile
 * is deliberately NOT mocked: the local path is supposed to write to localStorage, and
 * the assertions below check that it really does.
 */
vi.mock('../../services/auth', () => ({
  isSupabaseConfigured: vi.fn(() => false),
  readOwnProfile: vi.fn(),
  saveOwnProfile: vi.fn(),
  signOutOfAccount: vi.fn(() => Promise.resolve()),
  subscribeToAuth: vi.fn(() => () => {}),
}));

const PROFILE_KEY = 'placemaking_profile';

const account = { id: 'user-1', email: 'mara@example.com' };

/** Hand the hook a session, or null for signed out, the way subscribeToAuth would. */
const withSession = (session) => {
  vi.mocked(subscribeToAuth).mockImplementation((onChange) => {
    onChange(session);
    return () => {};
  });
};

const setup = (path = '/') => {
  const location = memoryLocation({ path, record: true });
  const wrapper = ({ children }) => <Router hook={location.hook}>{children}</Router>;
  return { ...renderHook(() => useIdentity(), { wrapper }), location };
};

describe('useIdentity with no Supabase project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    vi.mocked(subscribeToAuth).mockImplementation(() => () => {});
  });

  afterEach(() => {
    // Nothing resets localStorage between tests, so each file clears its own.
    localStorage.clear();
  });

  it('says it is the local identity, and never asks for a session', () => {
    const { result } = setup();

    expect(result.current.status).toBe('local');
    expect(subscribeToAuth).not.toHaveBeenCalled();
  });

  it('treats a visitor who has never touched the account menu as signed in', () => {
    const { result } = setup();

    // The rule from before accounts existed: no stored record is not the same as
    // being signed out, because there was nothing to be signed out of.
    expect(result.current.profile).toEqual({ name: 'You There', bio: '', location: '', avatar: null });
  });

  it('has no account id to offer, because there is no account', () => {
    const { result } = setup();

    expect(result.current.accountId).toBeNull();
    expect(result.current.email).toBeNull();
  });

  it('signs in on the spot rather than sending anybody to a form', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ signedIn: false }));
    const { result, location } = setup();

    expect(result.current.profile).toBeNull();

    act(() => { result.current.signIn(); });

    expect(result.current.profile).toMatchObject({ name: 'You There' });
    expect(location.history).toEqual(['/']);
  });

  it('signs out to the browser record', async () => {
    const { result } = setup();

    await act(async () => { await result.current.signOut(); });

    expect(result.current.profile).toBeNull();
    expect(signOutOfAccount).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY))).toEqual({ signedIn: false });
  });

  it('saves a name to localStorage', async () => {
    const { result } = setup();

    await act(async () => { await result.current.saveProfile({ name: 'Devon Park' }); });

    expect(result.current.profile).toMatchObject({ name: 'Devon Park' });
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY))).toMatchObject({ name: 'Devon Park' });
    expect(saveOwnProfile).not.toHaveBeenCalled();
  });
});

describe('useIdentity with a Supabase project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(subscribeToAuth).mockImplementation(() => () => {});
    vi.mocked(readOwnProfile).mockResolvedValue({ id: 'user-1', name: 'Mara Quinn', bio: '' });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts out loading rather than claiming anybody is signed out', () => {
    const { result } = setup();

    expect(result.current.status).toBe('loading');
    expect(result.current.profile).toBeNull();
  });

  it('reports signed out once the session has actually been read', async () => {
    withSession(null);
    const { result } = setup();

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.profile).toBeNull();
  });

  it('reports the account and its profile once both are in', async () => {
    withSession(account);
    const { result } = setup();

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.profile).toEqual({ id: 'user-1', name: 'Mara Quinn', bio: '' });
    expect(result.current.accountId).toBe('user-1');
    expect(result.current.email).toBe('mara@example.com');
  });

  it('ignores the browser record entirely, even when one is left over', async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: 'Stale Name', signedIn: true }));
    withSession(account);
    const { result } = setup();

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.profile.name).toBe('Mara Quinn');
  });

  it('sends somebody to the sign-in form instead of inventing an identity', async () => {
    withSession(null);
    const { result, location } = setup();

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    act(() => { result.current.signIn(); });

    expect(location.history.at(-1)).toBe('/signin');
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it('signs out through Supabase', async () => {
    withSession(account);
    const { result } = setup();

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    await act(async () => { await result.current.signOut(); });

    expect(signOutOfAccount).toHaveBeenCalled();
  });

  it('saves a name to the profiles table, not to the browser', async () => {
    withSession(account);
    vi.mocked(saveOwnProfile).mockResolvedValue({ id: 'user-1', name: 'Devon Park', bio: '' });
    const { result } = setup();

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    await act(async () => { await result.current.saveProfile({ name: 'Devon Park' }); });

    expect(saveOwnProfile).toHaveBeenCalledWith({ name: 'Devon Park' });
    expect(result.current.profile.name).toBe('Devon Park');
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it('still shows a name when the profile row cannot be read', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    withSession(account);
    vi.mocked(readOwnProfile).mockRejectedValue(new Error('offline'));
    const { result } = setup();

    // Signed in with a fallback name beats signed in with an empty avatar.
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.profile).toEqual({ name: 'mara', bio: '' });

    consoleError.mockRestore();
  });

  it('unsubscribes on unmount', () => {
    const stop = vi.fn();
    vi.mocked(subscribeToAuth).mockReturnValue(stop);
    const { unmount } = setup();

    unmount();

    expect(stop).toHaveBeenCalled();
  });
});
