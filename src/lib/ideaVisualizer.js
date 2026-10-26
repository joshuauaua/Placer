// PLACER — Idea Visualizer run for a project, pure logic.
//
// A project runs the tool in a room (toolkit/tools.js). Its setup is the scene: the
// address, and the Street View photo of it the organiser took (ConfigureToolDialog),
// uploaded and kept by its path. Everybody taking part places assets on that same
// photo, and what they record — the assets, and what the idea is — goes into their
// contribution to the room, which the others can see drawn on the photo again. One
// person can record several, so their contribution holds a list of them.
//
// An asset is kept by its type and where it sits on the 1000 × 700 stage
// (ImaginationCanvas), not by its picture: the artwork is looked up from ASSET_LIB
// when it is drawn, so a recorded idea outlives a change to how the files are named.

export const STAGE = { width: 1000, height: 700 };
export const MAX_TITLE = 80;
export const MAX_DESCRIPTION = 500;
const MAX_ASSETS = 100;

const isPoint = (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng);

/** The setup a new room starts from: no place or photo yet. */
export function defaultSceneSetup() {
  return { address: '', point: null, imagePath: null, view: null };
}

/** What is wrong with the scene, as sentences for the organiser. */
export function sceneProblems(setup) {
  const problems = [];
  if (!isPoint(setup?.point)) problems.push('Pick the address from the suggestions.');
  if (typeof setup?.imagePath !== 'string' || !setup.imagePath) {
    problems.push('Open Street View, frame the view, and take its photo.');
  }
  return problems;
}

const clampTo = (value, max) => (Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : null);
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * A visual as it is recorded, from the canvas or from a room (which may hold anything):
 * each asset's type, place, size and turn, and the idea's title and description.
 * `knownTypes` is the set of asset types there are; anything else is dropped.
 */
export function recordedVisual({ assets, title, description } = {}, knownTypes) {
  const placed = (Array.isArray(assets) ? assets : [])
    .filter((asset) => knownTypes.has(asset?.type))
    .map((asset) => ({
      type: asset.type,
      x: clampTo(asset.x, STAGE.width),
      y: clampTo(asset.y, STAGE.height),
      scale: Number.isFinite(asset.scale) ? Math.min(10, Math.max(0.1, asset.scale)) : 1,
      rotation: Number.isFinite(asset.rotation) ? asset.rotation % 360 : 0,
    }))
    .filter((asset) => asset.x !== null && asset.y !== null)
    .slice(0, MAX_ASSETS);
  return { assets: placed, title: text(title, MAX_TITLE), description: text(description, MAX_DESCRIPTION) };
}

/**
 * An idea made with the tool on its own, as it is kept on a profile (services/
 * inquiries.js): what kind of idea, where it was captured from, and what was placed on
 * it, which is what it takes to open it on the canvas again. The title and description
 * are the inquiry's own title and note. The picture is not here: it is uploaded, and its
 * key added as `preview`.
 */
export function ideaInquiryConfig({ category, loc, capturedView, canvasAssets, projectId = null }) {
  return {
    category: category || null,
    loc: loc || null,
    position: capturedView?.position ?? null,
    source: capturedView?.source ?? null,
    pov: capturedView?.pov ?? null,
    fov: capturedView?.fov ?? null,
    canvasAssets: Array.isArray(canvasAssets) ? canvasAssets : [],
    projectId,
  };
}

/** The state a person starts from in a room: nothing recorded yet. */
export function emptyVisual() {
  return {};
}

// How many visuals one person can record in a room. The room keeps one contribution
// per person, so they all share its 64 KB (room-size-limits.sql); a visual is a
// kilobyte or two.
export const MAX_VISUALS = 10;

/**
 * One person's recorded visuals, oldest first: their state is { visuals: [...] }, or a
 * single visual as an earlier version recorded it. Only those with something placed,
 * as recordedVisual has them. `knownTypes` as there.
 */
export function personVisuals(state, knownTypes) {
  if (!state || typeof state !== 'object') return [];
  return (Array.isArray(state.visuals) ? state.visuals : [state])
    .filter((visual) => visual && typeof visual === 'object')
    .map((visual) => recordedVisual(visual, knownTypes))
    .filter((visual) => visual.assets.length > 0)
    .slice(0, MAX_VISUALS);
}

/**
 * Everybody's recorded visuals, newest person last: how many people recorded one, and
 * every visual they recorded. `knownTypes` as recordedVisual has it.
 */
export function combineVisuals(states, knownTypes) {
  const byPerson = (states ?? []).map((state) => personVisuals(state, knownTypes))
    .filter((visuals) => visuals.length > 0);
  return { people: byPerson.length, visuals: byPerson.flat() };
}
