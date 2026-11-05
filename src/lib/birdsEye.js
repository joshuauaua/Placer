/* PLACER — Birds Eye View: a plan of a place, its pieces, and everybody's layout.
 *
 * The organiser draws the place's outline from above and gives it its real size, then
 * adds the pieces that go in it — a rectangle or a circle each, titled ("Work bench"),
 * sized and placed. Everybody taking part answers by moving and turning those pieces
 * into the layout they would want, and sends it.
 *
 * Everything is in metres, on a plan whose top left is (0, 0) and whose y runs down,
 * as on a screen:
 *
 *   outline   [{ x, y }, …]            the place's edge, three corners or more
 *   assets    [{ id, title, shape, w, d, x, y, r }]
 *                                       a piece: 'rect' or 'circle', w wide and d deep,
 *                                       centred at (x, y), turned r degrees clockwise
 *
 * A participant's state is `{ layout: { [asset id]: { x, y, r } } }`: where they put
 * each piece, or nothing yet. The timer is Word Cloud's (lib/wordCloud.js).
 */

import { roomTimer as wordCloudRoomTimer, timerProblems as wordCloudTimerProblems } from './wordCloud';

export const DEFAULT_PROMPT = 'How would you lay this place out?';
export const MAX_PROMPT_LENGTH = 200;
export const MAX_TITLE_LENGTH = 40;
export const MAX_ASSETS = 30;
export const MIN_SIDE = 0.2;
export const MAX_SIDE = 500;
export const SHAPES = ['rect', 'circle'];

/** A rectangle of `w` by `d` metres, as an outline. */
export function rectangleOutline(w = 20, d = 12) {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];
}

/** The setup a new plan starts from: a 20 by 12 metre rectangle with nothing in it. */
export function defaultBirdsEyeSetup() {
  return { prompt: '', outline: rectangleOutline(), assets: [], timer: null };
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const round = (value, step = 0.01) => Math.round(value / step) * step;

/** The outline's corners, or [] for anything that is not one. */
export function readOutline(outline) {
  if (!Array.isArray(outline)) return [];
  const points = outline.filter((point) => isNumber(point?.x) && isNumber(point?.y)).map(({ x, y }) => ({ x, y }));
  return points.length >= 3 ? points : [];
}

/** The box round the outline: { minX, minY, maxX, maxY, width, depth }. */
export function bounds(points) {
  if (!points?.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, depth: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, depth: maxY - minY };
}

/** Each side of the outline: from one corner to the next, its length and its middle. */
export function sides(points) {
  return points.map((from, index) => {
    const to = points[(index + 1) % points.length];
    return {
      from, to, length: Math.hypot(to.x - from.x, to.y - from.y),
      mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    };
  });
}

/** The outline's area in square metres (the shoelace formula). */
export function area(points) {
  let sum = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    sum += point.x * next.y - next.x * point.y;
  });
  return Math.abs(sum) / 2;
}

/** "12.5 m", "80 cm": a length, as it is labelled on the plan. */
export function formatLength(metres) {
  if (metres < 1) return `${Math.round(metres * 100)} cm`;
  return `${Number(metres.toFixed(metres < 10 ? 1 : 0))} m`;
}

/**
 * The outline, the pieces in it with it, stretched to be `width` by `depth` metres
 * overall: the way to give a shape drawn by eye its real size.
 */
export function scalePlan(setup, width, depth) {
  const outline = readOutline(setup.outline);
  const box = bounds(outline);
  if (!(width > 0) || !(depth > 0) || box.width <= 0 || box.depth <= 0) return setup;
  const sx = width / box.width;
  const sy = depth / box.depth;
  const at = (point) => ({ x: round((point.x - box.minX) * sx), y: round((point.y - box.minY) * sy) });
  return {
    ...setup,
    outline: outline.map(at),
    assets: (setup.assets ?? []).map((asset) => ({ ...asset, ...at(asset) })),
  };
}

/** A new piece, `shape`, in the middle of the outline. */
export function newAsset(setup, shape = 'rect', id = `asset-${Date.now().toString(36)}`) {
  const box = bounds(readOutline(setup.outline));
  const side = Math.max(1, round(Math.min(box.width, box.depth) / 5, 0.1));
  const count = (setup.assets ?? []).length;
  return {
    id, shape, title: shape === 'circle' ? `Round piece ${count + 1}` : `Piece ${count + 1}`,
    w: round(side * (shape === 'circle' ? 1 : 1.6), 0.1), d: side, x: round(box.minX + box.width / 2), y: round(box.minY + box.depth / 2), r: 0,
  };
}

/** A piece as it came back from somewhere else, or null if it is not one. */
export function readAsset(asset) {
  if (!asset || typeof asset.id !== 'string' || !SHAPES.includes(asset.shape)) return null;
  if (![asset.w, asset.d, asset.x, asset.y].every(isNumber)) return null;
  return { id: asset.id, title: typeof asset.title === 'string' ? asset.title : '', shape: asset.shape,
    w: asset.w, d: asset.d, x: asset.x, y: asset.y, r: isNumber(asset.r) ? asset.r : 0 };
}

export function readAssets(assets) {
  return Array.isArray(assets) ? assets.map(readAsset).filter(Boolean) : [];
}

/** What is wrong with the question. */
export function promptProblems(setup) {
  const prompt = typeof setup?.prompt === 'string' ? setup.prompt.trim() : '';
  if (!prompt) return ['Write what you want people to answer.'];
  if (prompt.length > MAX_PROMPT_LENGTH) return [`Keep the prompt under ${MAX_PROMPT_LENGTH} characters.`];
  return [];
}

/** What is wrong with the plan: its outline and its pieces. */
export function planProblems(setup) {
  const problems = [];
  if (readOutline(setup?.outline).length < 3) problems.push('Draw the outline of the place, with three corners or more.');
  const assets = readAssets(setup?.assets);
  if (assets.length === 0) problems.push('Add at least one piece for people to place.');
  if (assets.length > MAX_ASSETS) problems.push(`A plan can have at most ${MAX_ASSETS} pieces.`);
  assets.forEach((asset, index) => {
    if (!asset.title.trim()) problems.push(`Give piece ${index + 1} a title.`);
    else if (asset.title.length > MAX_TITLE_LENGTH) problems.push(`Keep piece ${index + 1}'s title under ${MAX_TITLE_LENGTH} characters.`);
    if (asset.w < MIN_SIDE || asset.d < MIN_SIDE || asset.w > MAX_SIDE || asset.d > MAX_SIDE) {
      problems.push(`Give piece ${index + 1} a size between ${MIN_SIDE * 100} cm and ${MAX_SIDE} m.`);
    }
  });
  return problems;
}

export function timerProblems(setup) {
  return wordCloudTimerProblems(setup);
}

export function birdsEyeSetupProblems(setup) {
  return [...promptProblems(setup), ...planProblems(setup), ...timerProblems(setup)];
}

/** Where each piece is in a layout, keeping only pieces the plan has. */
export function readLayout(layout, assets) {
  const out = {};
  if (!layout || typeof layout !== 'object') return out;
  for (const asset of assets) {
    const at = layout[asset.id];
    if (at && isNumber(at.x) && isNumber(at.y)) out[asset.id] = { x: at.x, y: at.y, r: isNumber(at.r) ? at.r : 0 };
  }
  return out;
}

/** The plan's pieces, each where `layout` puts it, or where the organiser did. */
export function placed(assets, layout = {}) {
  return assets.map((asset) => ({ ...asset, ...layout[asset.id] }));
}

/** The state one participant starts from: nothing moved yet. */
export function emptyLayout() {
  return { layout: null };
}

/** Everybody's layouts, and how many sent one. */
export function combineLayouts(states, config) {
  const assets = readAssets(config?.assets);
  const layouts = [];
  for (const state of states ?? []) {
    if (!state?.layout) continue;
    const layout = readLayout(state.layout, assets);
    if (Object.keys(layout).length > 0) layouts.push(layout);
  }
  return { layouts, people: layouts.length };
}

export function roomTimer(states) {
  return wordCloudRoomTimer(states);
}
