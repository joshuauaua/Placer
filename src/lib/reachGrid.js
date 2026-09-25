/* PLACER — 15-Minute Reach: what a neighbourhood can walk to.
 *
 * A 16 × 16 grid of 100-metre cells, with a railway across the middle that can only
 * be crossed at two bridges. Amenities get placed by hand; the grid answers how much
 * of the population can reach one of every kind inside a fifteen-minute walk.
 *
 * The railway is the whole reason this is worth building: coverage measured as the
 * crow flies looks fine, and coverage measured on foot does not.
 */

import { distanceField } from './gridPath';

export const GRID = { cols: 16, rows: 16, cellMetres: 100 };

/** 4.8 km/h — an unhurried walk, and the figure most 15-minute-city work uses. */
export const WALK_METRES_PER_MIN = 80;
export const REACH_MINUTES = 15;

export const RAIL_ROW = 8;
export const BRIDGE_COLS = [3, 12];

export const AMENITY_TYPES = {
  groceries: { key: 'groceries', label: 'Food shop', color: '#6B2E00', icon: 'cart' },
  school: { key: 'school', label: 'School', color: '#9E4600', icon: 'play' },
  clinic: { key: 'clinic', label: 'Clinic', color: '#3A2480', icon: 'heart' },
  park: { key: 'park', label: 'Park', color: '#123F73', icon: 'tree' },
  transit: { key: 'transit', label: 'Transit stop', color: '#1D5FA8', icon: 'bike' },
};

export const AMENITY_LIST = Object.values(AMENITY_TYPES);

const CELL_COUNT = GRID.cols * GRID.rows;

export function cellIndex(x, y) {
  return y * GRID.cols + x;
}

export function cellCoords(index) {
  const x = index % GRID.cols;
  return { x, y: (index - x) / GRID.cols };
}

/** The railway blocks its row everywhere except the bridges. */
export function isPassable(index) {
  const { x, y } = cellCoords(index);
  if (y !== RAIL_ROW) return true;
  return BRIDGE_COLS.includes(x);
}

/**
 * Where people live. Four housing clusters plus a low background, worked out from a
 * formula rather than stored, so the grid is identical every run and the coverage
 * percentages in the tests mean something.
 */
export const POPULATION = (() => {
  const clusters = [
    { x: 4, y: 3, weight: 1 },
    { x: 11, y: 5, weight: 0.8 },
    { x: 5, y: 12, weight: 0.95 },
    { x: 12, y: 13, weight: 0.65 },
  ];
  const spread = 3.2;
  const values = new Float64Array(CELL_COUNT);

  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (!isPassable(i)) continue; // nobody lives on the tracks
    const { x, y } = cellCoords(i);
    let value = 0.12;
    for (const cluster of clusters) {
      const d2 = (x - cluster.x) ** 2 + (y - cluster.y) ** 2;
      value += cluster.weight * Math.exp(-d2 / (2 * spread ** 2));
    }
    values[i] = value;
  }

  return values;
})();

export const TOTAL_POPULATION = POPULATION.reduce((sum, value) => sum + value, 0);

/** A starting point that looks sensible and strands everyone south of the tracks. */
export const PRESETS = {
  empty: [],
  draft: [
    { type: 'groceries', cell: cellIndex(5, 4) },
    { type: 'school', cell: cellIndex(3, 5) },
    { type: 'clinic', cell: cellIndex(7, 3) },
    { type: 'park', cell: cellIndex(9, 5) },
    { type: 'transit', cell: cellIndex(6, 6) },
  ],
};

export function loadPreset(key) {
  return (PRESETS[key] ?? []).map((placement, i) => ({ ...placement, id: `${key}-${i}` }));
}

const minutesPerStep = GRID.cellMetres / WALK_METRES_PER_MIN;

/**
 * Walking minutes to the nearest amenity of each kind, for every cell.
 *
 * @param {{type: string, cell: number}[]} placements
 * @returns {Record<string, Float64Array>} minutes per category; Infinity where there
 *   is none of that kind, or none this side of the railway.
 */
export function walkMinutes(placements) {
  const byCategory = {};

  for (const type of Object.keys(AMENITY_TYPES)) {
    const sources = placements.filter((placement) => placement.type === type).map((placement) => placement.cell);
    const steps = distanceField({ cols: GRID.cols, rows: GRID.rows, passable: isPassable, sources });
    const minutes = new Float64Array(CELL_COUNT);
    for (let i = 0; i < CELL_COUNT; i += 1) {
      minutes[i] = steps[i] * minutesPerStep;
    }
    byCategory[type] = minutes;
  }

  return byCategory;
}

/**
 * How well the placements serve the people who actually live here.
 *
 * share       — population within REACH_MINUTES of *every* category.
 * byCategory  — the same, one category at a time, so a single weak link is visible.
 * inReach     — per cell, how many categories are close enough (for the shading).
 * strandedShare — population that can reach nothing at all, which is what the
 *   railway does to a neighbourhood when every amenity sits on one side of it.
 */
export function coverage(placements) {
  const minutes = walkMinutes(placements);
  const categories = Object.keys(AMENITY_TYPES);
  const inReach = new Uint8Array(CELL_COUNT);
  const reached = Object.fromEntries(categories.map((key) => [key, 0]));

  let complete = 0;
  let stranded = 0;

  for (let i = 0; i < CELL_COUNT; i += 1) {
    const people = POPULATION[i];
    if (people <= 0) continue;

    let count = 0;
    for (const key of categories) {
      if (minutes[key][i] <= REACH_MINUTES) {
        count += 1;
        reached[key] += people;
      }
    }

    inReach[i] = count;
    if (count === categories.length) complete += people;
    if (count === 0) stranded += people;
  }

  const share = (value) => (TOTAL_POPULATION > 0 ? value / TOTAL_POPULATION : 0);

  return {
    share: share(complete),
    strandedShare: share(stranded),
    byCategory: Object.fromEntries(categories.map((key) => [key, share(reached[key])])),
    inReach,
    minutes,
    categoryCount: categories.length,
  };
}

/** Population living in a cell, as a share of the neighbourhood. */
export function populationShare(index) {
  return TOTAL_POPULATION > 0 ? POPULATION[index] / TOTAL_POPULATION : 0;
}
