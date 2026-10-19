/* PLACER — what a project's public page shows beyond the project itself.
 *
 * Its numbers, its owner and its collaborators (project_public_summary), and its
 * updates and comments — all from supabase/project-public-page.sql — and the replies
 * to them (supabase/project-replies.sql). Like the rest of
 * services/projects.js, there is nothing here without a Supabase project.
 *
 * Who wrote an update or a comment is set by the database from the signed-in
 * account, so neither post function takes an author — only, for a project's
 * organisers, the organisation to post as instead of themselves
 * (supabase/project-posts-as-organisation.sql).
 */

import { getSupabase } from './supabase';
import { mediaUrl } from './media';
import { track } from '../analytics';

export const UPDATES_TABLE = 'project_updates';
export const COMMENTS_TABLE = 'project_comments';
export const UPDATE_MAX = 4000;
export const COMMENT_MAX = 2000;
export const REPLIES_TABLE = 'project_replies';
export const REPLY_MAX = 2000;

const POST_COLUMNS = 'id, project_id, author_id, author_name, organisation_id, body, created_at';
const REPLY_COLUMNS = `${POST_COLUMNS}, update_id, comment_id`;

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
    // Set when it was posted as the project's organisation, whose name authorName is.
    organisationId: row.organisation_id ?? null,
    // The author's profile photo, filled in by withAuthorPhotos; null for none.
    authorPhoto: null,
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

/**
 * `posts` with each person's profile photo (profile_photos, supabase/profile-photos.sql).
 * A post made as an organisation shows the organisation's picture instead, so its
 * author is not looked up. Without the photos the posts are returned as they are:
 * the initials stand in.
 */
async function withAuthorPhotos(supabase, posts) {
  const ids = [...new Set(posts.filter((post) => post.authorId && !post.organisationId).map((post) => post.authorId))];
  if (ids.length === 0) return posts;
  const { data, error } = await supabase.rpc('profile_photos', { p_ids: ids });
  if (error) {
    console.error('Could not load the photos beside these posts:', error.message);
    return posts;
  }
  const photos = new Map((data ?? []).map((row) => [row.id, mediaUrl(row.avatar_path)]));
  return posts.map((post) => (post.organisationId ? post : { ...post, authorPhoto: photos.get(post.authorId) ?? null }));
}

async function readPosts(table, projectId, what) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(table)
    .select(POST_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load this project's ${what}: ${error.message}`);
  return withAuthorPhotos(supabase, (data ?? []).map(postFrom));
}

async function addPost(table, projectId, body, what, organisationId) {
  const supabase = await client();
  const row = { project_id: projectId, body: body.trim() };
  if (organisationId) row.organisation_id = organisationId;
  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select(POST_COLUMNS)
    .single();

  if (error) throw new Error(`Could not post that ${what}: ${error.message}`);
  track(`project_${what}_posted`, { project_id: projectId, as_organisation: Boolean(organisationId) });
  return (await withAuthorPhotos(supabase, [postFrom(data)]))[0];
}

async function removePost(table, id, what) {
  const supabase = await client();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(`Could not remove that ${what}: ${error.message}`);
}

/** A project's updates, newest first. */
export const readUpdates = (projectId) => readPosts(UPDATES_TABLE, projectId, 'updates');
/**
 * Post an update. The project's organisers only: its owner, or its organisation's
 * admins. With `organisationId` (the project's), it is posted as the organisation.
 */
export const postUpdate = (projectId, body, organisationId = null) =>
  addPost(UPDATES_TABLE, projectId, body, 'update', organisationId);
/** Remove an update. The project's organisers only, as for posting one. */
export const removeUpdate = (id) => removePost(UPDATES_TABLE, id, 'update');

/** A project's comments, newest first. */
export const readComments = (projectId) => readPosts(COMMENTS_TABLE, projectId, 'comments');
/**
 * Comment on a project. Anybody signed in who can see it; an organiser may pass the
 * project's `organisationId` to comment as the organisation.
 */
export const postComment = (projectId, body, organisationId = null) =>
  addPost(COMMENTS_TABLE, projectId, body, 'comment', organisationId);
/** Remove a comment. Its author, or the project's owner or a collaborator. */
export const removeComment = (id) => removePost(COMMENTS_TABLE, id, 'comment');

function replyFrom(row) {
  return { ...postFrom(row), updateId: row.update_id ?? null, commentId: row.comment_id ?? null };
}

/**
 * Every reply to a project's updates and comments, oldest first, each with the
 * `updateId` or the `commentId` of the post it answers.
 */
export async function readReplies(projectId) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(REPLIES_TABLE)
    .select(REPLY_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load the replies on this project: ${error.message}`);
  return withAuthorPhotos(supabase, (data ?? []).map(replyFrom));
}

/**
 * Reply to an update or a comment: `to` is { updateId } or { commentId }. Anybody
 * signed in who can see the project; an organiser may pass the project's
 * `organisationId` to reply as the organisation.
 */
export async function postReply(to, body, organisationId = null) {
  const supabase = await client();
  const row = to.updateId ? { update_id: to.updateId } : { comment_id: to.commentId };
  row.body = body.trim();
  if (organisationId) row.organisation_id = organisationId;
  const { data, error } = await supabase
    .from(REPLIES_TABLE)
    .insert(row)
    .select(REPLY_COLUMNS)
    .single();

  if (error) throw new Error(`Could not post that reply: ${error.message}`);
  track('project_reply_posted', {
    project_id: data.project_id, to: to.updateId ? 'update' : 'comment', as_organisation: Boolean(organisationId),
  });
  return (await withAuthorPhotos(supabase, [replyFrom(data)]))[0];
}

/** Remove a reply. Its author, the project's owner or a collaborator, or an organiser. */
export const removeReply = (id) => removePost(REPLIES_TABLE, id, 'reply');
