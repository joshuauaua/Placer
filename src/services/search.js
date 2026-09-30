/* PLACER — the nav bar's search: people, organisations and projects by name.
 *
 * One call to placer_search (supabase/search.sql), which answers for all three kinds at
 * once and only for a signed-in account. With no Supabase project there is nothing to
 * search, and the nav bar does not offer it — see isSupabaseConfigured().
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { mediaUrl } from './media';

export { isSupabaseConfigured };

/** Shorter than this, and a search is not sent: it would match nearly everything. */
export const MIN_QUERY_LENGTH = 2;

/**
 * What matches `query`, as `{ kind, id, name, detail, image }` — kind is 'person',
 * 'organisation' or 'project', in that order, a few of each at most.
 */
export async function search(query) {
  const trimmed = (query ?? '').trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const supabase = await getSupabase();
  if (!supabase) throw new Error('Search needs a Supabase project.');

  const { data, error } = await supabase.rpc('placer_search', { p_query: trimmed });
  if (error) throw new Error(`Could not search: ${error.message}`);

  return (data ?? []).map((row) => ({
    kind: row.kind,
    id: row.id,
    name: row.name,
    detail: row.detail ?? '',
    image: mediaUrl(row.image_path),
  }));
}
