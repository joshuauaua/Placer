/* PLACER — Public Life Tally: watching a space, one person at a time.
 *
 * The field sheet equivalent of a clicker. Each observation is one person, recorded
 * as a posture plus one or more activities that person is doing while holding it,
 * and optionally the spot on a coarse grid of the square where they were.
 *
 * The taxonomy is a trimmed version of the one used in public-life observation
 * studies (Gehl's "Public Life Data Protocol" is the fullest published version): a
 * small set of postures, and an activity list that is shorter than real life on
 * purpose, because the tool is for repeated field use and every extra category is
 * a hesitation in the middle of a busy hour.
 *
 * The interesting output is the cross-tab: postures read how many people the space
 * holds upright, safely seated, or stretched full-length on the ground, and the
 * activities read what being there is actually for.
 */

/** Postures, with the colour each one gets on the map. */
export const POSTURES = {
  standing: { key: 'standing', label: 'Standing', color: '#2F7BD6' },
  sitting: { key: 'sitting', label: 'Sitting', color: '#E08A2B' },
  lying: { key: 'lying', label: 'Lying', color: '#D4407E' },
  moving: { key: 'moving', label: 'Moving', color: '#3E9D4E' },
};

export const POSTURE_LIST = Object.values(POSTURES);

/**
 * Activities, each carrying the postures it can pair with. `postures` is the way
 * the recorder is steered: pick a posture first, and only the activities that fit
 * that posture are offered.
 */
export const ACTIVITIES = [
  { key: 'talking', label: 'Talking', postures: ['standing', 'sitting'] },
  { key: 'waiting', label: 'Waiting', postures: ['standing', 'sitting'] },
  { key: 'phone', label: 'On a phone', postures: ['standing', 'sitting', 'lying'] },
  { key: 'reading', label: 'Reading', postures: ['sitting', 'lying'] },
  { key: 'eating', label: 'Eating or drinking', postures: ['standing', 'sitting'] },
  { key: 'watching', label: 'Watching the scene', postures: ['standing', 'sitting', 'lying'] },
  { key: 'working', label: 'Working', postures: ['standing', 'sitting'] },
  { key: 'playing', label: 'Playing a game', postures: ['standing', 'sitting'] },
  { key: 'childcare', label: 'Watching children', postures: ['standing', 'sitting'] },
  { key: 'performing', label: 'Performing', postures: ['standing'] },
  { key: 'resting', label: 'Resting or dozing', postures: ['sitting', 'lying'] },
  { key: 'sunbathing', label: 'Sunbathing', postures: ['lying'] },
  { key: 'walking', label: 'Walking through', postures: ['moving'] },
  { key: 'running', label: 'Running or jogging', postures: ['moving'] },
  { key: 'cycling', label: 'Cycling', postures: ['moving'] },
  { key: 'scooting', label: 'Scooting or skating', postures: ['moving'] },
  { key: 'pushing', label: 'Pushing a pram or trolley', postures: ['moving'] },
  { key: 'dog', label: 'Walking a dog', postures: ['moving'] },
  { key: 'aid', label: 'Using a mobility aid', postures: ['moving'] },
];

export const ACTIVITY_BY_KEY = Object.fromEntries(ACTIVITIES.map((activity) => [activity.key, activity]));

/** All the activities that can pair with one posture, in catalogue order. */
export function activitiesFor(posture) {
  return ACTIVITIES.filter((activity) => activity.postures.includes(posture));
}

/** The same lookup, precomputed so the recorder and the table do not refilter. */
export const ACTIVITIES_BY_POSTURE = Object.fromEntries(
  POSTURE_LIST.map((posture) => [posture.key, activitiesFor(posture.key)])
);

/**
 * The map is the square as a coarse grid. SPOT_METRES is only a label — the grid is
 * deliberately coarse so a busy hour adds up in happy thick piles instead of a fog
 * of individual dots.
 */
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
 * One person as a sound observation: a known posture and activities that are all
 * allowed for it. Unknown keys are dropped rather than thrown, and the activity
 * list is deduplicated — a recorder doubled-tapping one activity is a common
 * finger error, and it should count the person once.
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
 * Fold a session's observations into counts. Posture and people counts are per
 * person; an activity is counted once per person who does it, so the activity rows
 * can exceed the total when one person is doing several things at once.
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

/** The count word for "one spot holds a lot of people", used under the map. */
export function peopleWord(count) {
  return count === 1 ? 'person' : 'people';
}

/** A plain-text version of the tally, for handing the session to somebody. */
export function summaryText(counts) {
  const lines = [
    'Public life tally — PLACER Sandbox',
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