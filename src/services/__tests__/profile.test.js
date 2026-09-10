import { describe, it, expect, afterEach } from 'vite-plus/test';
import { readProfile, saveProfile, signIn, signOut, DEFAULT_NAME } from '../profile';

// The literal rather than the import, so renaming the key fails this test.
const PROFILE_KEY = 'placemaking_profile';

describe('profile', () => {
  afterEach(() => {
    // Nothing resets localStorage between tests, so each file clears its own.
    localStorage.clear();
  });

  it('treats a visitor who has never touched it as signed in by default', () => {
    expect(readProfile()).toEqual({ name: DEFAULT_NAME, bio: '' });
  });

  it('keeps the default name that saved imaginations are credited to', () => {
    // Guards the two existing tests that assert on 'You There' as an author.
    expect(DEFAULT_NAME).toBe('You There');
  });

  it('merges a change into the profile and persists it', () => {
    saveProfile({ name: 'Mara Quinn' });

    expect(readProfile()).toMatchObject({ name: 'Mara Quinn', bio: '' });
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY))).toMatchObject({ name: 'Mara Quinn' });
  });

  it('leaves the rest of the profile alone when one field changes', () => {
    saveProfile({ name: 'Mara Quinn', bio: 'Cyclist' });
    saveProfile({ bio: 'Tree enthusiast' });

    expect(readProfile()).toMatchObject({ name: 'Mara Quinn', bio: 'Tree enthusiast' });
  });

  it('reports nobody signed in after logging out', () => {
    saveProfile({ name: 'Mara Quinn' });
    signOut();

    expect(readProfile()).toBeNull();
  });

  it('signs back in under the default name', () => {
    signOut();
    signIn();

    expect(readProfile()).toEqual({ name: DEFAULT_NAME, bio: '' });
  });

  it('falls back to the default rather than a blank name', () => {
    saveProfile({ name: '   ' });

    expect(readProfile()).toMatchObject({ name: DEFAULT_NAME });
  });

  it('survives a stored record it cannot parse', () => {
    localStorage.setItem(PROFILE_KEY, 'not json');

    expect(readProfile()).toEqual({ name: DEFAULT_NAME, bio: '' });
  });
});
