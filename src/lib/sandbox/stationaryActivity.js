/* PLACER — Stationary Activity Mapping: watching a square, one person at a time.
 *
 * Each observation is one person: a posture, the activity or activities that
 * go with it, and where in the square they were. The map builds itself up
 * from that, one person at a time.
 *
 * The taxonomy is a trimmed version of the one used in public-life observation
 * studies, tuned for a tool where the user records posture first and then
 * picks the activities that fit it.
 */

/** Postures, each with the colour it gets on the map. */
export const POSTURES = {
  standing: { key: 'standing', label: 'Standing', color: '#2F7BD6' },
  sittingPublic: { key: 'sittingPublic', label: 'Sitting in Public', color: '#E08A2B' },
  sittingPrivate: { key: 'sittingPrivate', label: 'Sitting in Private', color: '#D4407E' },
  sittingCommercial: { key: 'sittingCommercial', label: 'Sitting in a Commercial Area', color: '#7A52E0' },
  sittingInformally: { key: 'sittingInformally', label: 'Sitting Informally', color: '#16A085' },
  lying: { key: 'lying', label: 'Lying Down', color: '#2ECC71' },
  multiple: { key: 'multiple', label: 'Multiple / Movement', color: '#E74C3C' },
};

export const POSTURE_LIST = Object.values(POSTURES);

/** Activities, each carrying the postures it can pair with. */
export const ACTIVITIES = [
  { key: 'waiting', label: 'Waiting for Transport', postures: ['standing', 'sittingPublic', 'sittingInformally', 'sittingCommercial', 'multiple'] },
  { key: 'consuming', label: 'Consuming Food / Beverages', postures: ['sittingPublic', 'sittingPrivate', 'sittingCommercial', 'sittingInformally', 'lying'] },
  { key: 'commercial', label: 'Commercial Activity', postures: ['standing', 'sittingCommercial', 'sittingInformally', 'multiple'] },
  { key: 'cultural', label: 'Cultural Activity', postures: ['standing', 'sittingPublic', 'sittingPrivate', 'sittingCommercial', 'sittingInformally'] },
  { key: 'recreation', label: 'Recreation / Play / Exercise', postures: ['standing', 'sittingInformally', 'lying', 'multiple'] },
  { key: 'leisure', label: 'Leisure', postures: ['sittingPublic', 'sittingPrivate', 'sittingCommercial', 'sittingInformally', 'lying'] },
];

export const ACTIVITY_BY_KEY = Object.fromEntries(ACTIVITIES.map((activity) => [activity.key, activity]));

/** All the activities that can pair with one posture, in catalogue order. */
export function activitiesFor(posture) {
  return ACTIVITIES.filter((activity) => activity.postures.includes(posture));
}

export const ACTIVITIES_BY_POSTURE = Object.fromEntries(
  POSTURE_LIST.map((posture) => [posture.key, activitiesFor(posture.key)])
);

/** The map is the square as a coarse grid. */
export const GRID = { cols: 8, rows: 5 };
export const SPOT_METRES = 2.5;
export const CELL_COUNT = GRID.cols * GRID.rows;

export function cellIndex(x, y) {
  return y * GRID.cols + x;
}

export function cellCoords(index) {
  const x = index % GRID.cols;
  return { x, y: (index - x) / GRID.cols };
}

export function cellInGrid(index) {
  if (!Number.isInteger(index)) return false;
  const { x, y } = cellCoords(index);
  return x >= 0 && x < GRID.cols && y >= 0 && y < GRID.rows;
}

/**
 * One person as a sound observation: a known posture and activities that are
 * all allowed for it. Unknown keys are dropped rather than thrown, and the
 * activity list is deduplicated.
 */
export function normaliseObservation(observation = {}) {
  const posture = POSTURES[observation?.posture]?.key ?? null;
  if (!posture) return null;
  const allowed = ACTIVITIES_BY_POSTURE[posture].map((activity) => activity.key);
  const activities = [...new Set((observation.activities ?? []).filter((key) => allowed.includes(key)))];
  const cell = cellInGrid(observation.cell) ? observation.cell : null;
  return { posture, activities, cell };
}

export function emptyTallies() {
  const byCell = {};
  const byCellPosture = {};
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    byCell[cell] = 0;
    byCellPosture[cell] = Object.fromEntries(POSTURE_LIST.map((posture) => [posture.key, 0]));
  }
  return {
    total: 0,
    placed: 0,
    byPosture: Object.fromEntries(POSTURE_LIST.map((posture) => [posture.key, 0])),
    byActivity: Object.fromEntries(ACTIVITIES.map((activity) => [activity.key, 0])),
    byCell,
    byCellPosture,
  };
}

/**
 * Fold a session's observations into counts. One person counts once in their
 * posture and once per activity they are doing.
 */
export function tally(observations = []) {
  const counts = emptyTallies();
  for (const observation of observations) {
    const person = normaliseObservation(observation);
    if (!person) continue;
    counts.total += 1;
    counts.byPosture[person.posture] += 1;
    for (const key of person.activities) {
      counts.byActivity[key] += 1;
    }
    if (person.cell !== null) {
      counts.placed += 1;
      counts.byCell[person.cell] += 1;
      counts.byCellPosture[person.cell][person.posture] += 1;
    }
  }
  return counts;
}

export function peopleWord(count) {
  return count === 1 ? 'person' : 'people';
}

export function summaryText(counts) {
  const lines = [
    'Stationary Activity Mapping — PLACER Sandbox',
    `${counts.total} ${peopleWord(counts.total)} recorded`,
    '',
  ];
  for (const posture of POSTURE_LIST) {
    lines.push(`${posture.label} — ${counts.byPosture[posture.key]}`);
    const present = ACTIVITIES_BY_POSTURE[posture.key].filter(
      (activity) => counts.byActivity[activity.key] > 0
    );
    if (present.length === 0) {
      lines.push('  (none yet)');
    } else {
      for (const activity of present) {
        lines.push(`  - ${activity.label}: ${counts.byActivity[activity.key]}`);
      }
    }
  }
  return lines.join('\n');
}
