/* PLACER — Stationary Activity Mapping: watching a square, one person at a time.
 *
 * Each observation is one person: a posture, the activity or activities that
 * go with it, and where in the square they were. The map builds itself up
 * from that, one person at a time.
 *
 * The postures and activities are the Public Life Data Protocol's, as Gehl's
 * field sheet names them, tuned for a tool where the user records posture first
 * and then picks the activities that fit it. Each posture is drawn as the sheet's
 * symbol (PostureSymbol.jsx), not a colour.
 */

/** Postures, in the order the field sheet lists them. */
export const POSTURES = {
  standing: { key: 'standing', label: 'Standing' },
  sittingPublic: { key: 'sittingPublic', label: 'Public sitting' },
  sittingPrivate: { key: 'sittingPrivate', label: 'Private sitting' },
  sittingCommercial: { key: 'sittingCommercial', label: 'Commercial sitting' },
  sittingInformally: { key: 'sittingInformally', label: 'Informal sitting' },
  lying: { key: 'lying', label: 'Lying down' },
  multiple: { key: 'multiple', label: 'Multiple movement' },
};

export const POSTURE_LIST = Object.values(POSTURES);

/** Activities, each carrying the postures it can pair with. */
export const ACTIVITIES = [
  { key: 'waiting', label: 'Waiting for transportation', postures: ['standing', 'sittingPublic', 'sittingInformally', 'sittingCommercial', 'multiple'] },
  { key: 'consuming', label: 'Consuming food and beverage', postures: ['sittingPublic', 'sittingPrivate', 'sittingCommercial', 'sittingInformally', 'lying'] },
  { key: 'commercial', label: 'Commercial activity', postures: ['standing', 'sittingCommercial', 'sittingInformally', 'multiple'] },
  // Anybody can be talking, whatever they are doing it in.
  { key: 'conversing', label: 'Conversing', postures: ['standing', 'sittingPublic', 'sittingPrivate', 'sittingCommercial', 'sittingInformally', 'lying', 'multiple'] },
  { key: 'cultural', label: 'Cultural activity', postures: ['standing', 'sittingPublic', 'sittingPrivate', 'sittingCommercial', 'sittingInformally'] },
  { key: 'recreation', label: 'Recreation and play/exercise', postures: ['standing', 'sittingInformally', 'lying', 'multiple'] },
];

/**
 * How to map, from the field sheet: walked once an hour along the same route,
 * everybody in the area spending time there.
 */
export const DIRECTIONS = [
  'Define a route through your space and use the same route for each hour.',
  'There are predefined categories and a symbol for each activity — see the key on this page. The symbols will be below your map, so no need to memorize them.',
  'To record activities, walk through the space outlined on your map and use the symbols to mark what people are doing, where they are doing it, and how many people are doing the same activity within the same area.',
  'Map everyone inside the outlined area, not only along the line (feel free to map activity outside the marked area, but do not add this to the summary of activities).',
  'If an area is small you may be able to do the mapping from one location.',
  'Map everyone spending time in the area. Do not map people moving through unless they are moving within the area (e.g., a skateboarder using an edge to practice tricks).',
  'If you are mapping more than one location or mapping the same location more than one time, please make sure to use individual maps and summarize all activity on each map individually.',
  'Please take notes of any observations you make during your mapping and also note if anything out of the ordinary happens or if large groups are doing the same activity.',
];

/** What the sheet asks for before it is handed in. */
export const HANDING_IN = 'Add your name, date, & day of the week to the sheet. Sum totals before handing in.';

/* --- The session: what the sheet's header asks for, and the area being mapped --- */

/** The weather, as the observer would note it. */
export const WEATHER = ['Sunny', 'Partly cloudy', 'Overcast', 'Rain', 'Snow', 'Windy'];

const pad = (number) => String(number).padStart(2, '0');

/** A session not filled in yet: today's date and the time now, everything else blank. */
export function emptySession(now = new Date()) {
  return {
    name: '',
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    weather: '',
    location: '',
    area: [],
  };
}

/** What is still missing before mapping can start, in the order the form asks. */
export function sessionProblems(session) {
  const problems = [];
  if ((session.area?.length ?? 0) < 3) problems.push('Outline the area on the map: at least three corners.');
  if (!session.name.trim()) problems.push('Add your name.');
  if (!session.date) problems.push('Add the date.');
  if (!session.time) problems.push('Add the time.');
  if (!session.weather) problems.push('Pick the weather.');
  if (!session.location.trim()) problems.push('Name the location.');
  return problems;
}

/** Whether `point` ({ lat, lng }) is inside the outline `path` — ray casting, flat. */
export function insideArea(point, path) {
  if (!point || (path?.length ?? 0) < 3) return false;
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i, i += 1) {
    const a = path[i];
    const b = path[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat)
      && point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng) {
      inside = !inside;
    }
  }
  return inside;
}

/** The session as the sheet's header: a line each for who, when, where and the weather. */
export function sessionLines(session) {
  if (!session) return [];
  const day = session.date
    ? new Date(`${session.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
    : '';
  return [
    `Observer: ${session.name}`,
    `Date: ${session.date}${day ? ` (${day})` : ''}, ${session.time}`,
    `Location: ${session.location}`,
    `Weather: ${session.weather}`,
  ];
}

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

export function summaryText(counts, session = null) {
  const lines = [
    'Stationary Activity Mapping — PLACER Toolkit',
    ...sessionLines(session),
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
