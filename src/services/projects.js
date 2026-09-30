/* PLACER — projects.
 *
 * Needs an account, the same reason services/rooms.js gives: a project is shared
 * between an owner and its collaborators by definition, and one that existed only in
 * one browser would not be a project. So unlike services/imaginations.js and
 * services/profile.js there is no localStorage fallback here at all — every function
 * throws with no project configured, and the UI asks isSupabaseConfigured() before it
 * offers project creation the way SandboxPage already does for opening a room.
 *
 * Mirrors the shape of services/imaginations.js: camelCase in, camelCase out, and the
 * table's own column names never leak past this file's fromRow/toRow.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { mediaUrl, preparePhoto, removeMedia, uploadMedia } from './media';

export const PROJECTS_TABLE = 'projects';
export const COLLABORATORS_TABLE = 'project_collaborators';
export const LINKS_TABLE = 'project_links';
// The folder project images go under in the R2 bucket (supabase/functions/media).
// Named after the project, not the uploader: any collaborator may replace it.
export const PROJECT_IMAGES_FOLDER = 'projects';

export { isSupabaseConfigured };

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      'Projects need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

/**
 * What kind of project it is, asked on the second step of starting one — see
 * supabase/project-types.sql. `key` is what is stored; the rest is how the setup
 * page asks the question and tailors what follows it.
 */
export const PROJECT_TYPES = [
  {
    key: 'steward',
    title: 'I have a say over a place',
    description: 'You own or look after a space, or have decision-making power over it, '
      + 'and want to involve other people in what to do with it.',
    goalsHint: 'What do you want to decide together with the people who use this place?',
  },
  {
    key: 'advocate',
    title: 'I want to push for change in a place',
    description: 'You do not have decision-making power over the space, and want to get '
      + 'other people involved to try and create change.',
    goalsHint: 'What change do you want to see, and who needs to hear the case for it?',
  },
  {
    key: 'other',
    title: 'Something else',
    description: 'Your project does not fit either of these.',
    goalsHint: 'What is this project trying to find out or bring about?',
  },
];

const PROJECT_COLUMNS = 'id, owner_id, owner_name, name, description, start_date, end_date, '
  + 'locations, location_shapes, image_path, project_type, organisation_id, created_at, updated_at';

function fromRow(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    name: row.name,
    description: row.description ?? '',
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    locations: row.locations ?? [],
    // Polygons outlining where the project is — see supabase/projects.sql section 1.
    // Additive to `locations`, not a replacement for it: a place name and its shape
    // on the map are two different things about the same location.
    locationShapes: row.location_shapes ?? [],
    // An uploaded picture, shown instead of the map of the area when there is one.
    imagePath: row.image_path ?? null,
    image: mediaUrl(row.image_path),
    // One of PROJECT_TYPES' keys, or null for a project started before there was a choice.
    projectType: row.project_type ?? null,
    // The organisation it is run in the name of, or null for one run by its owner
    // alone — see supabase/organisations.sql section 6.
    organisationId: row.organisation_id ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Start a project. `ownerId` is required and checked against auth.uid() by the
 * insert policy, the same shape postImagination uses for userId — a missing one is a
 * refused write here rather than a policy violation there.
 */
export async function createProject({ ownerId, ownerName, name, description = '',
  startDate = null, endDate = null, locations = [], locationShapes = [], projectType = null,
  organisationId = null }) {
  if (!ownerId) throw new Error('Starting a project needs an account.');

  const supabase = await client();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .insert({
      owner_id: ownerId,
      owner_name: ownerName,
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      locations,
      location_shapes: locationShapes,
      project_type: projectType,
      organisation_id: organisationId,
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw new Error(`Could not start that project: ${error.message}`);
  return fromRow(data);
}

/** One project by id, or null. Public — no account needed to read it. */
export async function readProject(id) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select(PROJECT_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Could not load that project: ${error.message}`);
  return data ? fromRow(data) : null;
}

/**
 * Every project's drawn location outline, for the community map — id and name (so a
 * click can be attributed and can navigate) plus whatever shapes it has. Public, no
 * account needed, the same as readProject; projects with no drawn shape are left out
 * since there is nothing for the map to draw.
 */
export async function readProjectLocations() {
  const supabase = await client();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select('id, name, location_shapes');

  if (error) throw new Error(`Could not load project locations: ${error.message}`);
  return (data ?? [])
    .map((row) => ({ id: row.id, name: row.name, locationShapes: row.location_shapes ?? [] }))
    .filter((project) => project.locationShapes.length > 0);
}

// How many recent projects readRelatedProjects ranks before it picks its few.
const RELATED_POOL = 24;

/**
 * A few other projects to offer at the foot of a project's page. Public, like
 * readProject. "Related" is kept simple: from the most recent projects, the ones
 * that share a place name with this one come first, and the rest by recency.
 */
export async function readRelatedProjects(project, limit = 3) {
  if (!project?.id) return [];

  const supabase = await client();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select(PROJECT_COLUMNS)
    .neq('id', project.id)
    .order('created_at', { ascending: false })
    .limit(RELATED_POOL);

  if (error) throw new Error(`Could not load related projects: ${error.message}`);

  const places = new Set((project.locations ?? []).map((place) => place.toLowerCase()));
  const shared = (candidate) => candidate.locations.filter((place) => places.has(place.toLowerCase())).length;

  // Array.prototype.sort is stable, so equal overlaps keep their newest-first order.
  return (data ?? [])
    .map(fromRow)
    .sort((a, b) => shared(b) - shared(a))
    .slice(0, limit);
}

/** Every project run in an organisation's name, newest first. Public, like readProject. */
export async function readOrganisationProjects(organisationId) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select(PROJECT_COLUMNS)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load the organisation's projects: ${error.message}`);
  return (data ?? []).map(fromRow);
}

/**
 * Every project this account owns or collaborates on, newest first. Two queries
 * rather than one: `project_collaborators` only tells this account about its own
 * membership (that is the whole point of its read policy), so there is no single
 * filter that reaches both halves at once.
 */
export async function readMyProjects(accountId) {
  if (!accountId) return [];

  const supabase = await client();

  const owned = supabase
    .from(PROJECTS_TABLE)
    .select(PROJECT_COLUMNS)
    .eq('owner_id', accountId)
    .order('created_at', { ascending: false });

  const collaboratingOn = supabase
    .from(COLLABORATORS_TABLE)
    .select('project_id')
    .eq('user_id', accountId);

  const [ownedResult, collabResult] = await Promise.all([owned, collaboratingOn]);

  if (ownedResult.error) throw new Error(`Could not load your projects: ${ownedResult.error.message}`);
  if (collabResult.error) throw new Error(`Could not load your projects: ${collabResult.error.message}`);

  const ownedIds = new Set((ownedResult.data ?? []).map((row) => row.id));
  const collabIds = (collabResult.data ?? [])
    .map((row) => row.project_id)
    .filter((id) => !ownedIds.has(id));

  let collaborating = [];
  if (collabIds.length > 0) {
    const { data, error } = await supabase
      .from(PROJECTS_TABLE)
      .select(PROJECT_COLUMNS)
      .in('id', collabIds)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load your projects: ${error.message}`);
    collaborating = data ?? [];
  }

  return [...(ownedResult.data ?? []), ...collaborating].map(fromRow);
}

/** Change a project's setup. Only the fields given are touched. */
export async function updateProject(id, patch) {
  const supabase = await client();

  const columns = {
    ownerName: 'owner_name', name: 'name', description: 'description',
    startDate: 'start_date', endDate: 'end_date', locations: 'locations',
    locationShapes: 'location_shapes', imagePath: 'image_path', projectType: 'project_type',
    organisationId: 'organisation_id',
  };
  const row = {};
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] !== undefined) row[column] = patch[key];
  }

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .update(row)
    .eq('id', id)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw new Error(`Could not save that project: ${error.message}`);
  return fromRow(data);
}

/**
 * Upload an image for a project and return the path to save on it with
 * updateProject({ imagePath }). The project has to exist already, since its id names
 * the folder, and the caller has to be its owner or a collaborator.
 */
export async function uploadProjectImage(projectId, file) {
  // Resized and stripped of its metadata (location included) before anything is sent.
  const { blob, ext } = await preparePhoto(file, 'project', 'A project image');
  const supabase = await client();
  const path = `${PROJECT_IMAGES_FOLDER}/${projectId}/image-${Date.now()}.${ext}`;
  try {
    return await uploadMedia(supabase, path, blob);
  } catch (error) {
    throw new Error(`Could not upload the project image: ${error.message}`);
  }
}

/** Delete a project image no longer in use. Best effort, like removeProfileImageFile. */
export async function removeProjectImageFile(path) {
  if (!path) return;
  const supabase = await client();
  try {
    await removeMedia(supabase, path);
  } catch (error) {
    console.error('Could not delete the old project image:', error.message);
  }
}

/** Remove a project. Owner-only — the delete policy refuses anyone else. */
export async function deleteProject(id) {
  const supabase = await client();

  // Read the path before the row that holds it is gone.
  const { data: existing } = await supabase
    .from(PROJECTS_TABLE)
    .select('image_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq('id', id);
  if (error) throw new Error(`Could not remove that project: ${error.message}`);

  // After the row, not before: a refused delete must not cost the project its image.
  // The media function lets anyone clear the files of a project that no longer exists.
  await removeProjectImageFile(existing?.image_path);
  return { success: true };
}

/** Everyone on a project's roster, in the shape the dashboard shows. */
export async function readCollaborators(projectId) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(COLLABORATORS_TABLE)
    .select('user_id, email, display_name, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load the project's collaborators: ${error.message}`);
  return (data ?? []).map((row) => ({
    userId: row.user_id, email: row.email, displayName: row.display_name, createdAt: row.created_at,
  }));
}

/**
 * Invite a collaborator by email. Owner-only, and there is no directory to search —
 * see project_add_collaborator in supabase/projects.sql for the full reasoning.
 */
export async function addCollaborator(projectId, email) {
  const supabase = await client();
  const { error } = await supabase.rpc('project_add_collaborator', {
    p_project_id: projectId, p_email: email,
  });
  if (error) throw new Error(`Could not add that collaborator: ${error.message}`);
  return { success: true };
}

/** Remove a collaborator. Owner-only. */
export async function removeCollaborator(projectId, userId) {
  const supabase = await client();
  const { error } = await supabase.rpc('project_remove_collaborator', {
    p_project_id: projectId, p_user_id: userId,
  });
  if (error) throw new Error(`Could not remove that collaborator: ${error.message}`);
  return { success: true };
}

/** A project's documentation: external links only, oldest first. */
export async function readLinks(projectId) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(LINKS_TABLE)
    .select('id, title, url, added_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load the project's links: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id, title: row.title, url: row.url, addedBy: row.added_by, createdAt: row.created_at,
  }));
}

/** Attach a link. `addedBy` is checked against auth.uid() by the insert policy. */
export async function addLink(projectId, { title, url, addedBy }) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(LINKS_TABLE)
    .insert({ project_id: projectId, title, url, added_by: addedBy })
    .select('id, title, url, added_by, created_at')
    .single();

  if (error) throw new Error(`Could not add that link: ${error.message}`);
  return { id: data.id, title: data.title, url: data.url, addedBy: data.added_by, createdAt: data.created_at };
}

/** Remove a link. Owner or collaborator only. */
export async function removeLink(linkId) {
  const supabase = await client();
  const { error } = await supabase.from(LINKS_TABLE).delete().eq('id', linkId);
  if (error) throw new Error(`Could not remove that link: ${error.message}`);
  return { success: true };
}

/**
 * The dashboard's numbers: how many imaginations and Sandbox rooms are tied to this
 * project, and the imaginations' total votes. Owner-or-collaborator only — the
 * project_stats function refuses anyone else, which is what lets it see past
 * sandbox_rooms having no select grant at all (rooms.sql's header).
 */
export async function readStats(projectId) {
  const supabase = await client();
  const { data, error } = await supabase
    .rpc('project_stats', { p_project_id: projectId })
    .single();

  if (error) throw new Error(`Could not load the project's dashboard: ${error.message}`);
  return {
    imaginationsCount: data?.imaginations_count ?? 0,
    imaginationsUpvotes: data?.imaginations_upvotes ?? 0,
    sandboxRoomsCount: data?.sandbox_rooms_count ?? 0,
  };
}

// Per tab, so a refresh or coming back to the page in the same session is one view.
const VIEWED_KEY = 'placer_project_viewed';

/**
 * Count one view of a project's public page. Once per project per browser session,
 * and the database ignores the project's own owner and collaborators
 * (project_view_record in supabase/project-views.sql). Never throws: a view that
 * could not be counted is not something the visitor should hear about.
 */
export async function recordProjectView(projectId) {
  if (!isSupabaseConfigured() || !projectId) return;

  let seen = [];
  try {
    seen = JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? '[]');
    if (!Array.isArray(seen)) seen = [];
  } catch {
    seen = [];
  }
  if (seen.includes(projectId)) return;

  try {
    const supabase = await client();
    const { error } = await supabase.rpc('project_view_record', { p_project_id: projectId });
    if (error) throw error;
    try {
      sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...seen, projectId]));
    } catch {
      // Without storage a refresh counts again, which is the lesser problem.
    }
  } catch (err) {
    console.error('Could not count this view:', err?.message ?? err);
  }
}

/**
 * The public page's views: all-time total, and one entry per day for the last
 * `days` days, oldest first, with a 0 for a day nobody came. Owner-or-collaborator
 * only, like readStats.
 */
export async function readProjectViews(projectId, days = 30) {
  const supabase = await client();
  const [total, daily] = await Promise.all([
    supabase.rpc('project_views_total', { p_project_id: projectId }),
    supabase.rpc('project_views_daily', { p_project_id: projectId, p_days: days }),
  ]);

  const error = total.error ?? daily.error;
  if (error) throw new Error(`Could not load this project's views: ${error.message}`);
  return {
    total: total.data ?? 0,
    daily: (daily.data ?? []).map((row) => ({ day: row.day, views: row.views ?? 0 })),
  };
}

/**
 * Every Sandbox room opened for this project, newest first, with how many people have
 * contributed to each. Owner-or-collaborator only (project_rooms in
 * supabase/rooms-lifetime.sql), and it includes each room's facilitator token — the
 * dashboard hands that to the Sandbox so a room can be run from any browser, not only
 * the one that opened it.
 */
export async function readProjectRooms(projectId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('project_rooms', { p_project_id: projectId });

  if (error) throw new Error(`Could not load this project's rooms: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.room_id,
    experiment: row.experiment,
    pin: row.pin,
    joinCode: row.join_code,
    facilitatorToken: row.facilitator_token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status,
    contributions: row.contributions ?? 0,
  }));
}

/**
 * How many Sandbox sessions have run for this project — the one number the public
 * page needs from a table it otherwise cannot see into at all. Needs no account;
 * see project_sandbox_activity in supabase/projects.sql for why a plain count is
 * safe to expose where the rest of sandbox_rooms is not.
 */
export async function readPublicSandboxActivity(projectId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('project_sandbox_activity', { p_project_id: projectId });

  if (error) throw new Error(`Could not load this project's Sandbox activity: ${error.message}`);
  return typeof data === 'number' ? data : 0;
}
