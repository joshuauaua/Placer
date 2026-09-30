/* PLACER — following: users, imaginations, projects, organisations and cities.
 *
 * One module, two stores, the same shape either way, matching services/imaginations.js.
 * With a Supabase project configured a follow is a row in public.follows, private to the
 * account that made it. With no project it is a record in localStorage, the same way
 * services/profile.js keeps an identity before there are accounts to have.
 *
 * A single generic store rather than four, because two of the four things this app lets
 * somebody follow — a project, a city — have no table of their own yet, and a third
 * (another user's account) has a profile that is deliberately unreadable by anyone but
 * its owner (see the note in supabase/auth.sql). So every follow carries its own label,
 * captured at the moment of following, rather than being joined from elsewhere. That is
 * also why nothing here can tell you who follows a given thing — only what a given
 * follower follows.
 *
 * People, organisations and projects are followed from their public pages, and the
 * dashboard lists what an account follows. Cities have no page to follow one from yet;
 * the functions below work for them all the same.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { mediaUrl } from './media';

export const FOLLOWS_TABLE = 'follows';

/** The kinds of thing PLACER lets somebody follow. */
export const FOLLOW_TYPES = ['user', 'imagination', 'project', 'city', 'organisation'];

export { isSupabaseConfigured };

// Declared here rather than imported from services/api.js, the same reason
// services/profile.js gives for PROFILE_KEY: mocking this module in a test must not
// take api.js's mock down with it. api.js declares the same literal in STORAGE_KEYS so
// the GDPR export and erasure requests reach it; services/__tests__/api.test.js is what
// holds the two sides together.
const FOLLOWS_KEY = 'placemaking_follows';

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      'Following needs a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

function readLocalList() {
  try {
    const raw = localStorage.getItem(FOLLOWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Unparseable record, or storage blocked. Treated as nothing followed rather
    // than thrown, matching readProfile's fallback.
    return [];
  }
}

function writeLocalList(list) {
  try {
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(list));
  } catch {
    // Without storage the change holds for this page load only.
  }
  return list;
}

const localMatch = (entry, type, targetId) => entry.type === type && entry.targetId === targetId;

/** Everything this browser or account follows of one type, newest first. */
export async function readFollows(type) {
  if (!isSupabaseConfigured()) {
    return readLocalList()
      .filter((entry) => entry.type === type)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  const supabase = await client();
  const { data, error } = await supabase
    .from(FOLLOWS_TABLE)
    .select('id, followed_type, followed_id, followed_label, created_at')
    .eq('followed_type', type)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load what you follow: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.followed_type,
    targetId: row.followed_id,
    label: row.followed_label,
    createdAt: row.created_at,
  }));
}

/** Whether this thing is already followed. */
export async function isFollowing(type, targetId) {
  if (!isSupabaseConfigured()) {
    return readLocalList().some((entry) => localMatch(entry, type, targetId));
  }

  const supabase = await client();
  const { data, error } = await supabase
    .from(FOLLOWS_TABLE)
    .select('id')
    .eq('followed_type', type)
    .eq('followed_id', targetId)
    .maybeSingle();

  if (error) throw new Error(`Could not check what you follow: ${error.message}`);
  return Boolean(data);
}

/**
 * Follow something. `label` is what a followed list shows for it, snapshotted now
 * rather than looked up later — see the header for why. Following the same thing
 * twice is a no-op, not two rows.
 */
export async function follow(type, targetId, label) {
  if (!isSupabaseConfigured()) {
    const list = readLocalList();
    if (list.some((entry) => localMatch(entry, type, targetId))) return;
    writeLocalList([
      ...list,
      { id: `follow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type, targetId, label, createdAt: new Date().toISOString() },
    ]);
    return;
  }

  const supabase = await client();
  const { data: account } = await supabase.auth.getUser();
  const followerId = account?.user?.id;
  if (!followerId) throw new Error('Following needs an account.');

  // ignoreDuplicates makes this ON CONFLICT DO NOTHING. A plain upsert is ON CONFLICT
  // DO UPDATE, which needs UPDATE on the table even when nothing conflicts — and
  // follows.sql grants no UPDATE at all, so every follow was refused.
  const { error } = await supabase.from(FOLLOWS_TABLE).upsert(
    { follower_id: followerId, followed_type: type, followed_id: String(targetId), followed_label: label },
    { onConflict: 'follower_id,followed_type,followed_id', ignoreDuplicates: true },
  );

  if (error) throw new Error(`Could not follow that: ${error.message}`);
}

/** Unfollow something. Unfollowing something not followed is a no-op. */
export async function unfollow(type, targetId) {
  if (!isSupabaseConfigured()) {
    writeLocalList(readLocalList().filter((entry) => !localMatch(entry, type, targetId)));
    return;
  }

  const supabase = await client();
  const { error } = await supabase
    .from(FOLLOWS_TABLE)
    .delete()
    .eq('followed_type', type)
    .eq('followed_id', targetId);

  if (error) throw new Error(`Could not unfollow that: ${error.message}`);
}

/*
 * A public profile's followers and following (supabase/profile-social.sql). These
 * answer about any one account, not only the signed-in one, and need no session —
 * the profile page they appear on is public. They read names and pictures live, and
 * leave out anything followed that has since gone.
 */

/** How many follow this account, and how many people, organisations and projects it follows. */
export async function readFollowCounts(userId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('profile_follow_counts', { p_user_id: userId }).single();
  if (error) throw new Error(`Could not load the follow counts: ${error.message}`);
  return { followers: data?.followers ?? 0, following: data?.following ?? 0 };
}

/** The accounts following this one, newest first, as `{ type: 'user', id, name, image }`. */
export async function readFollowers(userId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('profile_followers', { p_user_id: userId });
  if (error) throw new Error(`Could not load the followers: ${error.message}`);
  return (data ?? []).map((row) => ({ type: 'user', id: row.id, name: row.name, image: mediaUrl(row.image_path) }));
}

/** The people, organisations and projects this account follows, newest first. */
export async function readFollowing(userId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('profile_following', { p_user_id: userId });
  if (error) throw new Error(`Could not load what this account follows: ${error.message}`);
  return (data ?? []).map((row) => ({ type: row.kind, id: row.id, name: row.name, image: mediaUrl(row.image_path) }));
}
