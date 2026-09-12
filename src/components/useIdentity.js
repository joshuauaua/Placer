/* PLACER — who is signed in, whichever way that is being answered.
 *
 * There are two identities in this app and this hook is the only place that knows it.
 *
 * With a Supabase project configured, a person has a real account: Supabase holds the
 * login and public.profiles holds the display name, and finding out who they are is a
 * request that takes a moment. With no project configured — a clean checkout, or the
 * whole test suite, which src/test/setup.js stubs into exactly that state — there is
 * no account to have, and identity falls back to the localStorage record in
 * services/profile.js that the app used before accounts existed.
 *
 * Every consumer sees one shape either way: a `profile` of { name, bio } or null. That
 * is what keeps UserMenu, ProfilePage and the author line on a posted imagination from
 * having to care, and it is why services/auth.js maps display_name to `name` at its own
 * boundary rather than leaking the column name up here.
 *
 * The one difference worth knowing is what "no record" means. On the local path, a
 * visitor who has never touched the account menu is signed in under the default name,
 * because that is how the app behaved before profiles existed and there is nothing to
 * be signed out of. On the account path the rule inverts: no session is signed out.
 * Both are correct for their own world, and status says which world you are in.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { readProfile, saveProfile, signIn as signInLocally, signOut as signOutLocally } from '../services/profile';
import {
  isSupabaseConfigured,
  readOwnProfile,
  saveOwnProfile,
  signOutOfAccount,
  subscribeToAuth,
} from '../services/auth';

/** Where UserMenu's "Sign in" goes when there are real accounts to sign in to. */
export const SIGN_IN_PATH = '/signin';

/**
 * The signed-in person.
 *
 * Returns { profile, status, accountId, email, signIn, signOut, saveProfile }.
 *
 * status is 'local' when there is no project and identity is a browser record;
 * otherwise 'loading' until the session has been read once, then 'signedIn' or
 * 'signedOut'. Callers that render something different for a signed-out person should
 * wait out 'loading' rather than treating it as signed out, or the page will flash the
 * wrong state on every load.
 */
export function useIdentity() {
  // Read once per mount, not per render: the value cannot change while the page is
  // open, and a test that stubs the environment needs a stable answer for the whole
  // of a render tree.
  const [configured] = useState(isSupabaseConfigured);
  const [, navigate] = useLocation();

  const [account, setAccount] = useState(null);
  const [profile, setProfileState] = useState(() => (configured ? null : readProfile()));
  const [status, setStatus] = useState(() => (configured ? 'loading' : 'local'));

  // So the profile fetch can tell whether the account it was started for is still the
  // one signed in, and drop its answer if it is not.
  const accountRef = useRef(null);

  useEffect(() => {
    if (!configured) return undefined;

    const unsubscribe = subscribeToAuth((next) => {
      accountRef.current = next?.id ?? null;
      setAccount(next);

      if (!next) {
        setProfileState(null);
        setStatus('signedOut');
        return;
      }

      // The account is known before the profile is, and that is the honest state to
      // report: signed in, name still arriving. The nav bar has an avatar and a name
      // to draw, so it waits for this rather than rendering a blank one.
      readOwnProfile()
        .then((found) => {
          if (accountRef.current !== next.id) return;
          setProfileState(found);
          setStatus('signedIn');
        })
        .catch((err) => {
          if (accountRef.current !== next.id) return;
          // A session with no readable profile should not lock somebody out of their
          // own account, so fall back to the email's local part. The trigger in
          // supabase/auth.sql means this is close to unreachable; it is here because
          // "signed in with no name to show" would otherwise render as an empty avatar.
          console.error('Could not read your profile:', err);
          setProfileState({ name: next.email?.split('@')[0] || 'You', bio: '' });
          setStatus('signedIn');
        });
    });

    return unsubscribe;
  }, [configured]);

  const signIn = useCallback(() => {
    if (configured) {
      navigate(SIGN_IN_PATH);
      return;
    }
    // No project, so there is nothing to authenticate against and nothing to ask for:
    // this is the instant local login the app has always had.
    setProfileState(signInLocally());
  }, [configured, navigate]);

  const signOut = useCallback(async () => {
    if (!configured) {
      setProfileState(signOutLocally());
      return;
    }
    // The listener is what clears the profile, so this only has to ask.
    await signOutOfAccount();
  }, [configured]);

  /** Merge changes into the profile and persist them. Resolves to the new profile. */
  const save = useCallback(async (patch) => {
    if (!configured) {
      const next = saveProfile(patch);
      setProfileState(next);
      return next;
    }

    const next = await saveOwnProfile(patch);
    if (next) setProfileState(next);
    return next;
  }, [configured]);

  return {
    profile,
    status,
    accountId: account?.id ?? null,
    email: account?.email ?? null,
    signIn,
    signOut,
    saveProfile: save,
  };
}

export default useIdentity;
