/* PLACER — notifications: the feed, and how loud each kind of it is allowed to be.
 *
 * Like services/rooms.js, there is no localStorage fallback. A notification is by
 * definition about something someone else did — a comment on your imagination, a
 * follow, a post from someone you follow — and with no Supabase project there is
 * nobody else's action to hear about. So with no project configured these throw,
 * and the UI asks isSupabaseConfigured() before it offers the bell at all.
 *
 * Every row in public.notifications is written by a trigger in supabase/notifications.sql,
 * never by this module — there is no `create`. What lives here is reading the feed,
 * marking things read, dismissing one, and reading and saving notification_preferences,
 * which is the one table a client does write to directly.
 *
 * The `_email` half of a preference is stored and shown in Settings, but nothing sends
 * mail yet — see supabase/notifications.sql's header. Resend is wired up later against
 * these same columns.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';

export const NOTIFICATIONS_TABLE = 'notifications';
export const PREFERENCES_TABLE = 'notification_preferences';
export const PROJECT_SETTINGS_TABLE = 'project_notification_settings';

/**
 * How loud answers in a project's Toolkit sessions are, for the people who run it —
 * see supabase/notifications-projects.sql. Every answer as it comes in, one summary
 * when a session is closed, or none.
 */
export const PROJECT_RESPONSE_LEVELS = ['every', 'session', 'off'];

/** The four kinds of alert PLACER sends, in the order Settings shows them. */
export const NOTIFICATION_CATEGORIES = ['engagement', 'activity', 'follower', 'system'];

// One row per category × channel, matching the columns notification_preferences
// actually has — a missing row (nobody has opened Settings yet) means every one
// of these, the same default the database falls back to in notification_wants().
export const DEFAULT_PREFERENCES = {
  engagement_inapp: true, engagement_email: true,
  activity_inapp: true, activity_email: true,
  follower_inapp: true, follower_email: true,
  system_inapp: true, system_email: true,
  // Not a category: answers on your projects, for every project at once.
  project_responses: 'every',
};

export { isSupabaseConfigured };

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      'Notifications need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

const asNotification = (row) => ({
  id: row.id,
  category: row.category,
  title: row.title,
  body: row.body,
  linkType: row.link_type,
  linkId: row.link_id,
  readAt: row.read_at,
  createdAt: row.created_at,
});

/** The most recent notifications, newest first. */
export async function listNotifications({ limit = 30 } = {}) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select('id, category, title, body, link_type, link_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  return (data ?? []).map(asNotification);
}

/** How many are unread — what the bell's badge shows. */
export async function unreadCount() {
  const supabase = await client();
  const { count, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) throw new Error(`Could not check unread notifications: ${error.message}`);
  return count ?? 0;
}

/** Mark one or more notifications read. Already-read ones are left alone. */
export async function markRead(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) return;

  const supabase = await client();
  const { error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update({ read_at: new Date().toISOString() })
    .in('id', list)
    .is('read_at', null);

  if (error) throw new Error(`Could not mark notifications read: ${error.message}`);
}

/** Mark every notification read, the "clear the badge" action. */
export async function markAllRead() {
  const supabase = await client();
  const { error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) throw new Error(`Could not mark notifications read: ${error.message}`);
}

/** Remove one notification from the feed. */
export async function dismissNotification(id) {
  const supabase = await client();
  const { error } = await supabase.from(NOTIFICATIONS_TABLE).delete().eq('id', id);
  if (error) throw new Error(`Could not remove that notification: ${error.message}`);
}

/** This account's notification preferences, defaulted for anyone who never set any. */
export async function readPreferences() {
  const supabase = await client();
  const { data: account } = await supabase.auth.getUser();
  const userId = account?.user?.id;
  if (!userId) throw new Error('Reading preferences needs an account.');

  const { data, error } = await supabase
    .from(PREFERENCES_TABLE)
    .select(
      'engagement_inapp, engagement_email, activity_inapp, activity_email, ' +
      'follower_inapp, follower_email, system_inapp, system_email, project_responses'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load your notification settings: ${error.message}`);
  return { ...DEFAULT_PREFERENCES, ...data };
}

/** Save a patch of preference columns, e.g. `{ engagement_email: false }`. */
export async function savePreferences(patch) {
  const supabase = await client();
  const { data: account } = await supabase.auth.getUser();
  const userId = account?.user?.id;
  if (!userId) throw new Error('Saving preferences needs an account.');

  const { error } = await supabase
    .from(PREFERENCES_TABLE)
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) throw new Error(`Could not save your notification settings: ${error.message}`);
}

/**
 * How loud answers in one project are for this account: one of
 * PROJECT_RESPONSE_LEVELS, or null when it follows the account's own default.
 */
export async function readProjectResponses(projectId) {
  const supabase = await client();
  const { data: account } = await supabase.auth.getUser();
  const userId = account?.user?.id;
  if (!userId) throw new Error('Reading project notifications needs an account.');

  const { data, error } = await supabase
    .from(PROJECT_SETTINGS_TABLE)
    .select('responses')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw new Error(`Could not load this project's notification settings: ${error.message}`);
  return data?.responses ?? null;
}

/**
 * Set how loud answers in one project are for this account, or pass null to go back
 * to the account's own default, which removes the project's row.
 */
export async function saveProjectResponses(projectId, level) {
  if (level !== null && !PROJECT_RESPONSE_LEVELS.includes(level)) {
    throw new Error(`Unknown notification level: ${level}`);
  }

  const supabase = await client();
  const { data: account } = await supabase.auth.getUser();
  const userId = account?.user?.id;
  if (!userId) throw new Error('Saving project notifications needs an account.');

  const { error } = level === null
    ? await supabase.from(PROJECT_SETTINGS_TABLE).delete().eq('user_id', userId).eq('project_id', projectId)
    : await supabase.from(PROJECT_SETTINGS_TABLE).upsert(
      { user_id: userId, project_id: projectId, responses: level, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,project_id' },
    );

  if (error) throw new Error(`Could not save this project's notification settings: ${error.message}`);
}
