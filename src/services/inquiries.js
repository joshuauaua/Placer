/* PLACER — inquiries kept on somebody's profile.
 *
 * A tool used on its own can be kept by somebody signed in, to start or join a project's
 * from later (supabase/profile-inquiries.sql). Private to the account: the table's
 * policies let only its owner read it, so these only work signed in.
 *
 * An inquiry is { id, tool, title, note, config, createdAt }.
 */

import { getSupabase } from './supabase';
import { track } from '../analytics';

const TABLE = 'profile_inquiries';

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Saved inquiries need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

const toInquiry = (row) => ({
  id: row.id,
  tool: row.tool,
  title: row.title,
  note: row.note ?? '',
  config: row.config ?? {},
  createdAt: row.created_at ?? null,
});

/** Keep an inquiry on the signed-in account's profile. Resolves to what was saved. */
export async function saveInquiry({ tool, title, note = '', config }) {
  const supabase = await client();
  const { data: session } = await supabase.auth.getSession();
  const ownerId = session?.session?.user?.id;
  if (!ownerId) throw new Error('Sign in to keep this on your profile.');

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ owner_id: ownerId, tool, title: title.trim().slice(0, 120), note, config })
    .select('id, tool, title, note, config, created_at')
    .single();

  if (error) throw new Error(`Could not save this to your profile: ${error.message}`);
  track('inquiry_saved', { tool });
  return toInquiry(data);
}

/** The signed-in account's inquiries, newest first — only those of `tool` when given. */
export async function readInquiries(tool = null) {
  const supabase = await client();
  let query = supabase.from(TABLE).select('id, tool, title, note, config, created_at')
    .order('created_at', { ascending: false });
  if (tool) query = query.eq('tool', tool);
  const { data, error } = await query;

  if (error) throw new Error(`Could not load your saved inquiries: ${error.message}`);
  return (data ?? []).map(toInquiry);
}

export async function deleteInquiry(id) {
  const supabase = await client();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(`Could not delete this inquiry: ${error.message}`);
}
