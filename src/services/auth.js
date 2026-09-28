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
import { mediaUrl, removeMedia, uploadMedia } from './media';

export const PROFILES_TABLE = 'profiles';
// The folder covers go under in the R2 bucket (supabase/functions/media).
export const COVERS_FOLDER = 'covers';

export const ACCOUNT_TYPES = [
  { key: 'individual', label: 'Individual' },
  { key: 'organisation', label: 'Organisation' },
];

const PROFILE_COLUMNS = 'id, display_name, bio, location, avatar, account_type, contact_email,'
  + ' website, cover_path';

// Cover images the media function accepts, and its size limit (supabase/functions/media).
const COVER_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

/** A profiles row, or a profile_public() row, in the shape the app speaks. */
function profileFrom(supabase, row) {
  return {
    id: row.id,
    name: row.display_name,
    bio: row.bio ?? '',
    location: row.location ?? '',
    avatar: row.avatar ?? null,
    accountType: row.account_type ?? 'individual',
    contactEmail: row.contact_email ?? '',
    website: row.website ?? '',
    coverPath: row.cover_path ?? null,
    cover: mediaUrl(row.cover_path),
  };
}

/**
 * What somebody typed as their website, as a link: "example.com" gets https:// in
 * front, since the database only accepts http(s) links. Blank stays blank.
 */
export function normaliseWebsite(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const INVITE_REFUSED =
  'That invite code is not valid, or has already been used. Check it for typos, or ask '
  + 'whoever sent it for a new one.';

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
 *
 * During the beta a new account needs an invite code, checked and spent by a trigger
 * on auth.users (supabase/invites.sql). It travels as user metadata for the same
 * reason the display name does. The code is looked at first, so that a mistyped one
 * gets a sentence; if it is refused anyway — used up by somebody else in between —
 * Supabase only reports a database error, which is translated back here.
 */
export async function signUpWithPassword({ email, password, displayName, inviteCode }) {
  const supabase = await client();

  const { data: valid, error: checkError } = await supabase.rpc('invite_code_check', {
    p_code: inviteCode ?? '',
  });
  if (checkError) throw new Error(`Could not check your invite code: ${checkError.message}`);
  if (!valid) throw new Error(INVITE_REFUSED);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName ?? null, invite_code: inviteCode ?? null },
      emailRedirectTo: callbackUrl('/'),
    },
  });

  if (error) {
    if (/database error saving new user/i.test(error.message)) throw new Error(INVITE_REFUSED);
    throw new Error(`Could not create your account: ${error.message}`);
  }

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
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`Could not read your profile: ${error.message}`);
  if (!data) return null;

  return profileFrom(supabase, data);
}

/**
 * Anybody's public profile — name, bio, location, avatar — by account id, or null if
 * there is no such account. Needs no session: it goes through profile_public()
 * (supabase/profiles-public.sql), which answers for one id at a time, because the
 * profiles table itself is readable only by its owner.
 */
export async function readPublicProfile(id) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('profile_public', { p_id: id });

  if (error) throw new Error(`Could not load this profile: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return profileFrom(supabase, row);
}

/**
 * Change the display name, the bio, or both, and return the profile as stored.
 *
 * Only the keys given are touched, so saving a name cannot blank a bio. The update is
 * filtered to the signed-in account's own id, read from the session rather than taken
 * from the caller. The policy scopes it to auth.uid() regardless, but the project
 * refuses any UPDATE without a WHERE clause, so the filter has to be there.
 */
export async function saveOwnProfile({ name, bio, location, avatar, accountType, contactEmail,
  website, coverPath }) {
  const supabase = await client();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('Sign in to save your profile.');

  const patch = {};
  if (name !== undefined) patch.display_name = name;
  if (bio !== undefined) patch.bio = bio;
  if (location !== undefined) patch.location = location;
  if (avatar !== undefined) patch.avatar = avatar;
  if (accountType !== undefined) patch.account_type = accountType;
  if (contactEmail !== undefined) patch.contact_email = contactEmail;
  if (website !== undefined) patch.website = normaliseWebsite(website);
  if (coverPath !== undefined) patch.cover_path = coverPath;

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`Could not save your profile: ${error.message}`);
  if (!data) return null;

  return profileFrom(supabase, data);
}

/**
 * Upload a cover image for the signed-in account and return the storage path to
 * save on the profile. A new file name every time, so a browser holding the old
 * picture in its cache cannot keep showing it.
 */
export async function uploadCover(file) {
  const ext = COVER_TYPES[file?.type];
  if (!ext) throw new Error('A cover has to be a JPEG, PNG or WebP image.');
  if (file.size > COVER_MAX_BYTES) throw new Error('A cover can be at most 5 MB.');

  const supabase = await client();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('Sign in to upload a cover.');

  const path = `${COVERS_FOLDER}/${userId}/cover-${Date.now()}.${ext}`;
  try {
    return await uploadMedia(supabase, path, file);
  } catch (error) {
    throw new Error(`Could not upload your cover: ${error.message}`);
  }
}

/**
 * Delete a cover image no longer in use. Best effort: a leftover file is a tidiness
 * problem, not a privacy one, since nothing points at it any more.
 */
export async function removeCoverFile(path) {
  if (!path) return;
  const supabase = await client();
  try {
    await removeMedia(supabase, path);
  } catch (error) {
    console.error('Could not delete the old cover:', error.message);
  }
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
