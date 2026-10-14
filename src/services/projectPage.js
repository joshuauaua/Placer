/* PLACER — what a project's public page shows beyond the project itself.
 *
 * Its numbers, its owner and its collaborators (project_public_summary), and its
 * updates and comments — all from supabase/project-public-page.sql. Like the rest of
 * services/projects.js, there is nothing here without a Supabase project.
 *
 * Who wrote an update or a comment is set by the database from the signed-in
 * account, so neither post function takes an author.
 */

import { getSupabase } from './supabase';
import { mediaUrl } from './media';

export const UPDATES_TABLE = 'project_updates';
export const COMMENTS_TABLE = 'project_comments';
export const UPDATE_MAX = 4000;
export const COMMENT_MAX = 2000;

const POST_COLUMNS = 'id, project_id, author_id, author_name, body, created_at';

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Projects need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function postFrom(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    authorId: row.author_id ?? null,
    authorName: row.author_name || 'Someone',
    body: row.body,
    createdAt: row.created_at,
  };
}

/**
 * The public page's header numbers and people:
 * { views, followers, interactions, owner, collaborators, canPostUpdate }.
 * `canPostUpdate` is whether the signed-in account organises the project: its owner
 * or an admin of the organisation it is run for. `owner` is
 * { id, name, bio, location, photo, joinedAt, projects } or null; each collaborator
 * is { id, name, photo }. Null when the project cannot be seen.
 */
export async function readProjectSummary(projectId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('project_public_summary', { p_project_id: projectId });

  if (error) throw new Error(`Could not load this project's numbers: ${error.message}`);
  if (!data) return null;

  const owner = data.owner ? {
    id: data.owner.id,
    name: data.owner.name ?? '',
    bio: data.owner.bio ?? '',
    location: data.owner.location ?? '',
    photo: mediaUrl(data.owner.avatar_path),
    joinedAt: data.owner.joined_at ?? null,
    projects: data.owner.projects ?? 0,
  } : null;

  return {
    views: data.views ?? 0,
    followers: data.followers ?? 0,
    interactions: data.interactions ?? 0,
    owner,
    collaborators: (data.collaborators ?? []).map((c) => ({ id: c.id, name: c.name, photo: mediaUrl(c.avatar_path) })),
    canPostUpdate: data.can_post_update === true,
  };
}

async function readPosts(table, projectId, what) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(table)
    .select(POST_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load this project's ${what}: ${error.message}`);
  return (data ?? []).map(postFrom);
}

async function addPost(table, projectId, body, what) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(table)
    .insert({ project_id: projectId, body: body.trim() })
    .select(POST_COLUMNS)
    .single();

  if (error) throw new Error(`Could not post that ${what}: ${error.message}`);
  return postFrom(data);
}

async function removePost(table, id, what) {
  const supabase = await client();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(`Could not remove that ${what}: ${error.message}`);
}

/** A project's updates, newest first. */
export const readUpdates = (projectId) => readPosts(UPDATES_TABLE, projectId, 'updates');
/** Post an update. The project's organisers only: its owner, or its organisation's admins. */
export const postUpdate = (projectId, body) => addPost(UPDATES_TABLE, projectId, body, 'update');
/** Remove an update. The project's organisers only, as for posting one. */
export const removeUpdate = (id) => removePost(UPDATES_TABLE, id, 'update');

/** A project's comments, newest first. */
export const readComments = (projectId) => readPosts(COMMENTS_TABLE, projectId, 'comments');
/** Comment on a project. Anybody signed in who can see it. */
export const postComment = (projectId, body) => addPost(COMMENTS_TABLE, projectId, body, 'comment');
/** Remove a comment. Its author, or the project's owner or a collaborator. */
export const removeComment = (id) => removePost(COMMENTS_TABLE, id, 'comment');
