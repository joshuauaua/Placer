/* PLACER — Desire Lines: the paths people actually take across a square.
 *
 * The plaza below is laid out the way plazas usually are — a ring around the edge
 * and a cross through the middle — while the things people walk between sit in the
 * corners. So the paving asks for a right angle and the walk wants a diagonal, and
 * the worn line through the grass is the argument.
 *
 * Everything is in metres, with the plaza's own origin at its top-left corner.
 */

import { distanceField, cellAt, cellCentre } from './gridPath';

export const PLAZA = {
  width: 100,
  height: 60,
  // Coarse enough to stay cheap, fine enough that a 3 m path is two cells wide.
  cell: 2,
};

PLAZA.cols = PLAZA.width / PLAZA.cell;
PLAZA.rows = PLAZA.height / PLAZA.cell;

/** The paving as designed: a perimeter ring and a central cross. */
export const PAVING = [
  { x: 4, y: 4, w: 92, h: 3 },      // north side
  { x: 4, y: 53, w: 92, h: 3 },     // south side
  { x: 4, y: 4, w: 3, h: 52 },      // west side
  { x: 93, y: 4, w: 3, h: 52 },     // east side
  { x: 4, y: 28.5, w: 92, h: 3 },   // cross, east-west
  { x: 48.5, y: 4, w: 3, h: 52 },   // cross, north-south
];

export const DESTINATIONS = [
  { id: 'metro', label: 'Metro entrance', x: 8, y: 8 },
  { id: 'cafe', label: 'Café', x: 92, y: 8 },
  { id: 'school', label: 'School gate', x: 8, y: 52 },
  { id: 'tram', label: 'Tram stop', x: 92, y: 52 },
  { id: 'fountain', label: 'Fountain', x: 50, y: 30 },
];

export function isPaved(x, y) {
  return PAVING.some((rect) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
}

// The paved mask never changes, so it is built once and the distance fields that
// depend on it are memoised per starting cell.
const PAVED_MASK = (() => {
  const mask = new Uint8Array(PLAZA.cols * PLAZA.rows);
  for (let i = 0; i < mask.length; i += 1) {
    const { x, y } = cellCentre(PLAZA, i, PLAZA.cell);
    mask[i] = isPaved(x, y) ? 1 : 0;
  }
  return mask;
})();

const isPavedCell = (index) => PAVED_MASK[index] === 1;
const fieldCache = new Map();

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The paved cell closest to a point, for stepping on and off the path network. */
export function nearestPavedCell(point) {
  const start = cellAt(PLAZA, point.x, point.y, PLAZA.cell);
  if (isPavedCell(start)) return start;

  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < PAVED_MASK.length; i += 1) {
    if (!isPavedCell(i)) continue;
    const centre = cellCentre(PLAZA, i, PLAZA.cell);
    const d = distance(point, centre);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * How far it is between two points if you keep to the paving, in metres. Points
 * off the paving are joined to their nearest path by a straight line, so a walk
 * that starts on the grass is not counted as impossible.
 */
export function pavedDistance(a, b) {
  const from = nearestPavedCell(a);
  const to = nearestPavedCell(b);
  if (from < 0 || to < 0) return Infinity;

  let field = fieldCache.get(from);
  if (!field) {
    field = distanceField({
      cols: PLAZA.cols,
      rows: PLAZA.rows,
      passable: isPavedCell,
      sources: [from],
    });
    fieldCache.set(from, field);
  }

  const steps = field[to];
  if (!Number.isFinite(steps)) return Infinity;

  const onPaving = steps * PLAZA.cell;
  const approach = distance(a, cellCentre(PLAZA, from, PLAZA.cell));
  const arrival = distance(b, cellCentre(PLAZA, to, PLAZA.cell));
  return onPaving + approach + arrival;
}

/** Points along a straight walk, one every `step` metres, ends included. */
export function samplePoints(a, b, step = 1) {
  const length = distance(a, b);
  const count = Math.max(1, Math.ceil(length / step));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return points;
}

/** The share of a walk spent off the paving, 0–1. */
export function offPavedShare(line) {
  const points = samplePoints(line.from, line.to, 0.5);
  const off = points.filter((point) => !isPaved(point.x, point.y)).length;
  return off / points.length;
}

/**
 * Count how many separate journeys cross each cell. A single journey only ever
 * counts once per cell, so a line drawn slowly is not louder than a short one.
 *
 * @returns {{cols: number, rows: number, cell: number, counts: Uint16Array, max: number}}
 */
export function rasterize(lines) {
  const counts = new Uint16Array(PLAZA.cols * PLAZA.rows);
  let max = 0;

  for (const line of lines) {
    const seen = new Set();
    for (const point of samplePoints(line.from, line.to, PLAZA.cell / 2)) {
      seen.add(cellAt(PLAZA, point.x, point.y, PLAZA.cell));
    }
    for (const index of seen) {
      counts[index] += 1;
      if (counts[index] > max) max = counts[index];
    }
  }

  return { cols: PLAZA.cols, rows: PLAZA.rows, cell: PLAZA.cell, counts, max };
}

/**
 * The unpaved cells that enough journeys cross to be worth paving. Cells already
 * paved are left out — the tool is only ever suggesting something new.
 */
export function suggestPaving(lines, { minJourneys = 3 } = {}) {
  if (lines.length === 0) return [];
  const { counts } = rasterize(lines);
  const suggestions = [];

  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] < minJourneys || isPavedCell(i)) continue;
    const centre = cellCentre(PLAZA, i, PLAZA.cell);
    suggestions.push({ index: i, x: centre.x, y: centre.y, journeys: counts[i] });
  }

  return suggestions.sort((a, b) => b.journeys - a.journeys);
}

/** Headline numbers for the readout panel. */
export function journeyStats(lines) {
  if (lines.length === 0) {
    return { count: 0, cutting: 0, cuttingShare: 0, metresSaved: 0, averageSaved: 0, longestSaved: 0 };
  }

  let cutting = 0;
  let metresSaved = 0;
  let longestSaved = 0;

  for (const line of lines) {
    // Only a walk that actually leaves the paving is saving anything. Measuring
    // every walk would credit a stroll straight down the path with the couple of
    // metres the 2-metre grid rounds away.
    if (offPavedShare(line) <= 0.05) continue;
    cutting += 1;

    const direct = distance(line.from, line.to);
    const around = pavedDistance(line.from, line.to);
    const saved = Number.isFinite(around) ? Math.max(0, around - direct) : 0;
    metresSaved += saved;
    if (saved > longestSaved) longestSaved = saved;
  }

  return {
    count: lines.length,
    cutting,
    cuttingShare: cutting / lines.length,
    metresSaved: Math.round(metresSaved),
    averageSaved: Math.round(metresSaved / lines.length),
    longestSaved: Math.round(longestSaved),
  };
}

// A tiny linear congruential generator: the neighbours who "also walked here" are
// random-looking but identical on every run, which keeps the tool reproducible and
// its tests honest.
function randomiser(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * A plausible batch of other people's journeys: pairs of destinations, each with a
 * little scatter around the exact point, since nobody walks to a coordinate.
 */
export function neighbourJourneys(count = 10, seed = 20260827) {
  const random = randomiser(seed);
  const scatter = (value, spread) => value + (random() - 0.5) * spread;
  const lines = [];

  for (let i = 0; i < count; i += 1) {
    const from = DESTINATIONS[Math.floor(random() * DESTINATIONS.length)];
    let to = DESTINATIONS[Math.floor(random() * DESTINATIONS.length)];
    if (to.id === from.id) to = DESTINATIONS[(DESTINATIONS.indexOf(from) + 1) % DESTINATIONS.length];

    lines.push({
      id: `neighbour-${seed}-${i}`,
      walker: 'neighbour',
      from: { x: clampX(scatter(from.x, 6)), y: clampY(scatter(from.y, 6)) },
      to: { x: clampX(scatter(to.x, 6)), y: clampY(scatter(to.y, 6)) },
    });
  }

  return lines;
}

function clampX(x) {
  return Math.min(PLAZA.width - 1, Math.max(1, x));
}

function clampY(y) {
  return Math.min(PLAZA.height - 1, Math.max(1, y));
}
