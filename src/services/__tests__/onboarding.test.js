import { describe, it, expect, vi, afterEach } from 'vite-plus/test';

/*
 * The Supabase SDK is faked whole, as in follows.test.js: no client is built and no
 * request is made. The module may only read and write profiles.onboarded_at, which is
 * all supabase/profile-onboarding.sql grants it.
 */
const maybeSingle = vi.fn();
const selectEq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq: selectEq }));
const updateEq = vi.fn(() => Promise.resolve({ error: null }));
const update = vi.fn(() => ({ eq: updateEq }));
const from = vi.fn(() => ({ select, update }));
const createClient = vi.fn(() => ({ from }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

let onboarding;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  onboarding = await import('../onboarding');
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('onboarding', () => {
  it('is needed for an account whose profile has not seen the tour', async () => {
    await load();
    maybeSingle.mockResolvedValueOnce({ data: { onboarded_at: null }, error: null });

    await expect(onboarding.needsOnboarding('user-1')).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('onboarded_at');
    expect(selectEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('is not needed once the profile says it has been seen, and remembers that here', async () => {
    await load();
    maybeSingle.mockResolvedValueOnce({ data: { onboarded_at: '2026-10-14T09:00:00.000Z' }, error: null });

    await expect(onboarding.needsOnboarding('user-1')).resolves.toBe(false);
    await expect(onboarding.needsOnboarding('user-1')).resolves.toBe(false);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('is not needed when the profile cannot be read, as before the column exists', async () => {
    await load();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'column profiles.onboarded_at does not exist' } });

    await expect(onboarding.needsOnboarding('user-1')).resolves.toBe(false);
  });

  it('is never needed without an account or a project', async () => {
    await load();
    await expect(onboarding.needsOnboarding(null)).resolves.toBe(false);

    await load({ configured: false });
    await expect(onboarding.needsOnboarding('user-1')).resolves.toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('marks the tour seen on the profile and in this browser', async () => {
    await load();
    await onboarding.markOnboarded('user-1');

    expect(update).toHaveBeenCalledWith({ onboarded_at: expect.any(String) });
    expect(updateEq).toHaveBeenCalledWith('id', 'user-1');
    await expect(onboarding.needsOnboarding('user-1')).resolves.toBe(false);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it('remembers it here even when the profile cannot be saved', async () => {
    await load();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    updateEq.mockResolvedValueOnce({ error: { message: 'permission denied' } });

    await onboarding.markOnboarded('user-1');

    await expect(onboarding.needsOnboarding('user-1')).resolves.toBe(false);
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
