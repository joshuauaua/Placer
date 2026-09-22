/* PLACER — accounts, the network half.
 *
 * Supabase Auth owns the login: the email address, the password hash, the Google
 * identity, whether the address has been confirmed. None of that is stored by this
 * app and none of it is ours to read. What this module adds on top is the profile —
 * the display name, bio, location and avatar icon in public.profiles — because that
 * is the part of a person the app actually renders.
 *
 * Unlike services/profile.js, which keeps an identity in localStorage and is
 * therefore synchronous, everything here is a request and everything here is async.
 * The two are reconciled in components/useIdentity.js, which picks this module when a
 * project is configured and profile.js when there is none, so the app still runs
 * end to end with no Supabase project at all — the promise made in .env.example.
 *
 * Errors throw with a sentence a person could read, matching services/rooms.js. A
 * failed sign-in is not an exception to that: the message is deliberately vague about
 * which half was wrong, because Supabase is vague about it on purpose and saying more
 * would help somebody working through a list of addresses.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';

export const PROFILES_TABLE = 'profiles';

export { isSupabaseConfigured };

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      'Accounts need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

/**
 * Where Supabase sends somebody back to. A single route for every case — the
 * confirmation link, the return leg of a Google sign-in, the password reset — because
 * every one of them arrives as a ?code= to exchange, and the code does not care what
 * it was issued for. `next` is where to go once it has been spent.
 *
 * Every value this produces has to be listed under Authentication -> URL
 * Configuration in the dashboard, or Supabase refuses the redirect. See
 * supabase/README.md section 9.
 */
function callbackUrl(next = '/') {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Start an email and password signup.
 *
 * Returns `{ needsConfirmation }`. With "Confirm email" on in the dashboard — which
 * is how this app is meant to be configured — there is no session yet: the account
 * exists but cannot do anything until the link in the email is clicked. The display
 * name is passed as user metadata rather than written here, because the profile row
 * is created by a trigger on auth.users (supabase/auth.sql section 3) which reads it
 * from there. The browser cannot be relied on to still be present at that point.
 *
 * An address that is already registered does NOT throw. Supabase answers it exactly
 * as it answers a new one, so that this call cannot be used to find out who has an
 * account, and this function keeps that property rather than unpicking it.
 */
export async function signUpWithPassword({ email, password, displayName }) {
  const supabase = await client();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName ?? null },
      emailRedirectTo: callbackUrl('/'),
    },
  });

  if (error) throw new Error(`Could not create your account: ${error.message}`);

  return { needsConfirmation: !data?.session };
}

/**
 * Sign in with an email address and password. Null when the pair is not right, or
 * when the address has not been confirmed yet — both are the same answer to whoever
 * is typing, and telling them apart would only help somebody guessing.
 */
export async function signInWithPassword({ email, password }) {
  const supabase = await client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Anything Supabase treats as "those credentials do not work" is a null rather
    // than a throw; a genuine fault (no network, project down) still throws.
    if (error.status === 400) return null;
    throw new Error(`Could not sign you in: ${error.message}`);
  }

  return accountFrom(data?.user ?? null);
}

/**
 * Hand off to Google. This navigates the browser away, so nothing after it runs and
 * there is no account to return — the session arrives on the way back through
 * /auth/callback.
 */
export async function signInWithGoogle() {
  const supabase = await client();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl('/') },
  });

  if (error) throw new Error(`Could not reach Google: ${error.message}`);
}

/**
 * Email a password reset link. Deliberately says nothing about whether the address
 * has an account: Supabase does not, and neither does the screen that calls this.
 */
export async function sendPasswordReset(email) {
  const supabase = await client();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl('/reset'),
  });

  if (error) throw new Error(`Could not send the reset email: ${error.message}`);
}

/** Set a new password. Needs the session the reset link established. */
export async function updatePassword(password) {
  const supabase = await client();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) throw new Error(`Could not change your password: ${error.message}`);
}

/** Sign out, and drop the stored session. */
export async function signOutOfAccount() {
  const supabase = await client();
  const { error } = await supabase.auth.signOut();

  if (error) throw new Error(`Could not sign you out: ${error.message}`);
}

/** The signed-in account, or null. */
export async function readSession() {
  const supabase = await client();
  const { data, error } = await supabase.auth.getSession();

  if (error) throw new Error(`Could not read the session: ${error.message}`);
  return accountFrom(data?.session?.user ?? null);
}

/**
 * The signed-in account's own profile, shaped the way services/profile.js shapes it
 * so that everything downstream — the nav bar, the profile page, the author line on a
 * posted imagination — cannot tell which of the two it is looking at.
 *
 * Null when nobody is signed in: the select policy is scoped to auth.uid(), so with no
 * session there is simply no row to find.
 */
export async function readOwnProfile() {
  const supabase = await client();
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select('id, display_name, bio, location, avatar')
    .maybeSingle();

  if (error) throw new Error(`Could not read your profile: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    name: data.display_name,
    bio: data.bio ?? '',
    location: data.location ?? '',
    avatar: data.avatar ?? null,
  };
}

/**
 * Change the display name, the bio, or both, and return the profile as stored.
 *
 * Only the keys given are touched, so saving a name cannot blank a bio. The update
 * carries no id: the policy scopes it to auth.uid() already, and a client-supplied id
 * would be a way of asking to edit somebody else — refused, but not worth offering.
 */
export async function saveOwnProfile({ name, bio, location, avatar }) {
  const supabase = await client();

  const patch = {};
  if (name !== undefined) patch.display_name = name;
  if (bio !== undefined) patch.bio = bio;
  if (location !== undefined) patch.location = location;
  if (avatar !== undefined) patch.avatar = avatar;

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .update(patch)
    .select('id, display_name, bio, location, avatar')
    .maybeSingle();

  if (error) throw new Error(`Could not save your profile: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    name: data.display_name,
    bio: data.bio ?? '',
    location: data.location ?? '',
    avatar: data.avatar ?? null,
  };
}

/**
 * Call `onChange(account)` whenever the signed-in account changes — a sign-in, a sign
 * out, a token refresh, or the ?code= on the way back from a confirmation link being
 * exchanged for a session.
 *
 * Stays synchronous even though the client loads on demand, because the caller uses
 * the returned function as a useEffect cleanup and that cannot await. The pattern is
 * lifted from subscribeToRoom in services/rooms.js: if the component unmounts before
 * the client is up, `cancelled` stops the subscription being made at all.
 *
 * Fires once with the session as it stands at subscribe time, so a caller does not
 * have to read it separately and then worry about the gap between the two.
 *
 * Returns the unsubscribe function.
 */
export function subscribeToAuth(onChange) {
  let cancelled = false;
  let teardown = null;

  (async () => {
    const supabase = await client();
    if (cancelled) return;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      onChange(accountFrom(session?.user ?? null));
    });

    teardown = () => data?.subscription?.unsubscribe();

    // After subscribing, not before: getSession() is what spends a ?code= in the URL,
    // and doing it in this order means the resulting sign-in arrives through the
    // listener above rather than being missed in the gap.
    const { data: current } = await supabase.auth.getSession();
    if (cancelled) return;
    onChange(accountFrom(current?.session?.user ?? null));
  })().catch(() => {
    // An account that cannot be checked is treated as signed out. The app still works
    // that way — it is what a visitor with no account gets — so this is a degraded
    // session rather than a broken page.
    if (!cancelled) onChange(null);
  });

  return () => {
    cancelled = true;
    if (teardown) teardown();
  };
}

/** The bits of a Supabase user this app has any use for. */
function accountFrom(user) {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}
