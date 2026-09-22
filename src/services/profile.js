/* PLACER — the signed-in person, as far as this browser is concerned.
 *
 * There is no auth and no backend to authenticate against, so the "current user"
 * is a record in localStorage, in the same spirit as services/api.js. Everything
 * that needs to know who is posting reads it through here rather than hardcoding
 * a name, which is what App.jsx and PostPage.jsx used to do. When real accounts
 * arrive, this module is the one that changes.
 *
 * Synchronous, unlike api.js: the nav bar reads the profile on every render, and
 * a promise there would mean the avatar flickering in on every page load.
 */

// The same literal as STORAGE_KEYS.PROFILE in services/api.js, declared here rather
// than imported: the nav bar reads this module, and importing api.js would mean any
// test that mocks api.js also breaks the profile. api.js walks its own registry for
// the GDPR export and erasure, so the key has to appear in both places;
// services/__tests__/api.test.js fails if the two ever drift apart.
export const PROFILE_KEY = 'placemaking_profile';

/** What an imagination is credited to before anyone renames themselves. */
export const DEFAULT_NAME = 'You There';

const DEFAULT_PROFILE = { name: DEFAULT_NAME, bio: '', location: '', avatar: null };

// A visitor who has never touched the account menu is treated as signed in under
// the default name, because that is how the app behaved before profiles existed.
// Being logged out is therefore an explicit stored state, not the absence of one.
const asProfile = (stored) => {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_PROFILE };
  if (stored.signedIn === false) return null;
  return {
    name: typeof stored.name === 'string' && stored.name.trim() ? stored.name : DEFAULT_NAME,
    bio: typeof stored.bio === 'string' ? stored.bio : '',
    location: typeof stored.location === 'string' ? stored.location : '',
    // null means "no icon chosen, fall back to initials" — never coerced to '' so
    // Avatar's `icon ? ... : initials` branch reads it the same way readProfile does.
    avatar: typeof stored.avatar === 'string' && stored.avatar ? stored.avatar : null,
  };
};

/** The current profile, or null when logged out. */
export function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw === null) return { ...DEFAULT_PROFILE };
    return asProfile(JSON.parse(raw));
  } catch {
    // Unparseable record, or storage blocked (private mode, cookies disabled).
    // Fall back to the default rather than leaving the nav with no identity.
    return { ...DEFAULT_PROFILE };
  }
}

function write(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Without storage the change holds for this page load only.
  }
  return profile;
}

/** Merge changes into the current profile and persist it. Returns the new profile. */
export function saveProfile(patch) {
  const current = readProfile() ?? { ...DEFAULT_PROFILE };
  return write({ ...current, ...patch, signedIn: true });
}

/** Log in under a display name. */
export function signIn(name = DEFAULT_NAME) {
  const trimmed = typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_NAME;
  return write({ ...DEFAULT_PROFILE, name: trimmed, signedIn: true });
}

/**
 * Log out. The name and bio are dropped rather than kept for a later login: the
 * profile is personal data, and holding it for someone who has logged out would
 * be keeping it for no reason they asked for.
 */
export function signOut() {
  write({ signedIn: false });
  return null;
}
