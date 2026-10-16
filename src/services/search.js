/* PLACER — the nav bar's search: tools, projects, people, organisations and case studies.
 *
 * Three sources, asked at once:
 *   - the Toolkit's tools, matched in the browser against the register
 *     (toolkit/tools.js), which is only loaded once somebody searches
 *   - people, organisations and projects by name, in one call to placer_search
 *     (supabase/search.sql), which answers only for a signed-in account
 *   - case studies, the Resources page's articles, through Storyblok's own search
 *     (services/storyblok.js), which is likewise only loaded to search
 * A source that is not set up — no Supabase project, no Storyblok token — is skipped,
 * and one that fails does not take the others' results with it: the search fails only
 * when nothing came back and something went wrong.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { mediaUrl } from './media';

export { isSupabaseConfigured };

/** Shorter than this, and a search is not sent: it would match nearly everything. */
export const MIN_QUERY_LENGTH = 2;

/** How many tools, and how many case studies, a search suggests at most. */
const PER_KIND = 4;

/** The tools whose name, tagline, description or organisation match. */
async function searchTools(query) {
  const { TOOLS, filterTools, findCategory } = await import('../toolkit/tools');
  return filterTools(TOOLS, { query }).slice(0, PER_KIND).map((tool) => ({
    kind: 'tool',
    id: tool.id,
    name: tool.name,
    detail: [findCategory(tool.category)?.name, tool.createdBy].filter(Boolean).join(' · '),
    image: tool.image ?? null,
    icon: tool.icon,
  }));
}

/** People, organisations and projects, from placer_search. */
async function searchPlatform(query) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('placer_search', { p_query: query });
  if (error) throw new Error(`Could not search: ${error.message}`);

  return (data ?? []).map((row) => ({
    kind: row.kind,
    id: row.id,
    name: row.name,
    detail: row.detail ?? '',
    image: mediaUrl(row.image_path),
  }));
}

/** The case studies that match, by the slug their article is found at. */
async function searchCaseStudies(query) {
  if (!import.meta.env.VITE_STORYBLOK_TOKEN) return [];
  const { searchResources } = await import('./storyblok');
  const found = await searchResources(query, PER_KIND);
  return found.map((resource) => ({
    kind: 'caseStudy',
    id: resource.slug,
    name: resource.title,
    detail: resource.excerpt,
    image: resource.cover?.src ?? null,
  }));
}

/**
 * What matches `query`, as `{ kind, id, name, detail, image }`, where kind is 'tool',
 * 'person', 'organisation', 'project' or 'caseStudy' — a few of each at most. A tool
 * also carries its `icon`.
 */
export async function search(query) {
  const trimmed = (query ?? '').trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const settled = await Promise.allSettled([
    searchTools(trimmed), searchPlatform(trimmed), searchCaseStudies(trimmed),
  ]);
  const found = settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : []));
  const failure = settled.find((outcome) => outcome.status === 'rejected');
  if (found.length === 0 && failure) throw failure.reason;
  if (failure) console.error('Part of a search failed:', failure.reason);
  return found;
}
