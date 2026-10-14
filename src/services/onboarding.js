/* PLACER — whether an account has been through the welcome tour.
 *
 * profiles.onboarded_at (supabase/profile-onboarding.sql) is null until the tour in
 * components/OnboardingDialog.jsx is finished or closed. It is read on its own rather
 * than with the rest of the profile in services/auth.js, so a project the column has
 * not reached yet still signs people in and only goes without the tour.
 *
 * A copy is kept in localStorage per account as well, so a tour that was closed while
 * the save failed does not come back on every visit from the same browser.
 */

import { getSupabase } from './supabase';

const PROFILES_TABLE = 'profiles';
const storageKey = (accountId) => `placer:onboarded:${accountId}`;

function seenHere(accountId) {
  try {
    return window.localStorage.getItem(storageKey(accountId)) !== null;
  } catch {
    return false;
  }
}

function rememberHere(accountId) {
  try {
    window.localStorage.setItem(storageKey(accountId), new Date().toISOString());
  } catch {
    // Private windows and blocked storage: the database copy is the one that counts.
  }
}

/**
 * True when the tour should open for `accountId`: signed in, and neither this browser
 * nor the profile says it has been seen. False whenever that cannot be told, so a
 * failed read never shows the tour to somebody who has already had it.
 */
export async function needsOnboarding(accountId) {
  if (!accountId || seenHere(accountId)) return false;
  const supabase = await getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select('onboarded_at')
    .eq('id', accountId)
    .maybeSingle();

  if (error) {
    console.error('Could not tell whether you have seen the welcome tour:', error.message);
    return false;
  }
  if (data?.onboarded_at) {
    rememberHere(accountId);
    return false;
  }
  return Boolean(data);
}

/** Record that `accountId` has seen the tour, here and on the profile. */
export async function markOnboarded(accountId) {
  if (!accountId) return;
  rememberHere(accountId);
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', accountId);

  if (error) console.error('Could not save that you have seen the welcome tour:', error.message);
}
