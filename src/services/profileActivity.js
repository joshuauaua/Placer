/* PLACER — what a public profile shows of somebody's time on PLACER.
 *
 * When they joined and the projects they are involved in, from
 * profile_public_activity() (supabase/profile-activity.sql), and the comments they
 * have left on projects, read from project_comments by author — readable wherever
 * its project is (supabase/project-public-page.sql). Comments they posted as an
 * organisation are the organisation's, not theirs, and are left out.
 */

import { getSupabase } from './supabase';
import { mediaUrl } from './media';

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Profiles need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

/**
 * { joinedAt, projects } for an account, or null when there is no such account. Each
 * project is { id, name, summary, description, image, startDate, endDate, role }, role
 * 'owner' or 'collaborator', newest first — only those the caller may see.
 */
export async function readProfileActivity(userId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('profile_public_activity', { p_user_id: userId });

  if (error) throw new Error(`Could not load this profile's projects: ${error.message}`);
  if (!data) return null;

  return {
    joinedAt: data.joined_at ?? null,
    projects: (data.projects ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.summary ?? '',
      description: row.description ?? '',
      image: mediaUrl(row.image_path),
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      role: row.role,
    })),
  };
}

/** The comments an account has left on projects, newest first, each with its project's name. */
export async function readProfileComments(userId, limit = 50) {
  const supabase = await client();
  const { data, error } = await supabase
    .from('project_comments')
    .select('id, body, created_at, project_id, projects(name)')
    .eq('author_id', userId)
    .is('organisation_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load this profile's comments: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    projectId: row.project_id,
    projectName: row.projects?.name ?? 'A project',
  }));
}
