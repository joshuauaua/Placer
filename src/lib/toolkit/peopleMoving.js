/* PLACER — People Moving Count: everybody who crosses a line, counted as they cross.
 *
 * After Gehl's Public Life Data Protocol. The organiser draws the count line on a map
 * — across a street, a path or a square's entrance — and the observer stands by it and
 * taps once for each person who crosses it, in either direction, by how they move. A
 * timer runs over the count, which the protocol keeps to ten minutes.
 *
 * Every mode but cycling counts as a pedestrian; people on bicycles are counted apart.
 */

/** How people move, in the order the counting screen gives them. */
export const MODES = [
  { key: 'walking', label: 'Walking', example: null, group: 'pedestrian' },
  { key: 'running', label: 'Running / jogging', example: null, group: 'pedestrian' },
  { key: 'supported', label: 'Supported', example: 'e.g. wheelchair', group: 'pedestrian' },
  { key: 'carried', label: 'Carried', example: 'e.g. stroller', group: 'pedestrian' },
  { key: 'rolling', label: 'Rolling', example: 'e.g. skateboard', group: 'pedestrian' },
  { key: 'bicycle', label: 'People on bicycles', example: null, group: 'bicycle' },
];

export const MODE_BY_KEY = Object.fromEntries(MODES.map((mode) => [mode.key, mode]));

/** The two groups the modes add up to. */
export const GROUPS = [
  { key: 'pedestrian', label: 'Pedestrians' },
  { key: 'bicycle', label: 'People on bicycles' },
];

export const modesIn = (group) => MODES.filter((mode) => mode.group === group);

/** How long the protocol counts for, each time: ten minutes. */
export const COUNT_SECONDS = 10 * 60;

/** How to count, after the protocol's field sheet. */
export const DIRECTIONS = [
  'Stand where you can see the whole count line on your map, and count from the same spot each time.',
  'Count for 10 minutes. Start the timer as you start counting; the first tap starts it too.',
  'Tap once for every person who crosses the line, in either direction, by how they are moving.',
  'Walking, running or jogging, supported (e.g. in a wheelchair), carried (e.g. in a stroller) and rolling (e.g. on a skateboard) all count as pedestrians. People on bicycles are counted on their own.',
  'Count a person only once, as they cross. Do not count people who stop short of the line or are standing on it.',
  'Count a group by its people: a family of four walking across is four taps on Walking, and a child in a stroller is one more on Carried.',
  'If you tap the wrong one, take it off with its minus button.',
  'Note anything out of the ordinary while you count — an event, roadworks, a sudden downpour.',
];

/* --- The line --- */

// project_tools.config is kept small (supabase/project-tool-config.sql: 2000
// characters), so a line has at most this many points, each to about 10 cm.
export const MAX_POINTS = 12;
const round = (value) => Math.round(value * 1e6) / 1e6;

/** What is wrong with the count line, if anything. */
export function lineProblems(line) {
  return (line?.length ?? 0) < 2 ? ['Draw the count line on the map: at least two points.'] : [];
}

/* --- A project's setup: the line and location everybody counting for it shares --- */

/** A project's setup not filled in yet. */
export function defaultProjectSetup() {
  return { line: [], location: '' };
}

/** What a project's setup is missing, as sentences. */
export function projectSetupProblems(setup) {
  const problems = [...lineProblems(setup?.line)];
  if (!setup?.location?.trim()) problems.push('Name the location.');
  return problems;
}

/** A project's setup as it is saved: points rounded, the location trimmed. */
export function projectSetupToSave(setup) {
  return {
    line: (setup.line ?? []).slice(0, MAX_POINTS).map(({ lat, lng }) => ({ lat: round(lat), lng: round(lng) })),
    location: setup.location.trim(),
  };
}

/** Whether a project's setup fixes the line and location, so observers do not choose them. */
export function hasProjectSetup(setup) {
  return projectSetupProblems(setup).length === 0;
}

/* --- The session: the sheet's header, and the line being counted --- */

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
    line: [],
  };
}

/** A session started from a project's setup: its line and location, the rest as emptySession. */
export function sessionFromSetup(setup, now = new Date()) {
  const session = emptySession(now);
  if (!hasProjectSetup(setup)) return session;
  return { ...session, line: setup.line, location: setup.location };
}

/** What is still missing before counting can start, in the order the form asks. */
export function sessionProblems(session) {
  const problems = [...lineProblems(session.line)];
  if (!session.name.trim()) problems.push('Add your name.');
  if (!session.date) problems.push('Add the date.');
  if (!session.time) problems.push('Add the time.');
  if (!session.weather) problems.push('Pick the weather.');
  if (!session.location.trim()) problems.push('Name the location.');
  return problems;
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

/* --- The count --- */

/** A count with nobody in it yet: zero for every mode. */
export function emptyCounts() {
  return Object.fromEntries(MODES.map((mode) => [mode.key, 0]));
}

/** `counts` with one more (or, with `by` -1, one fewer, never below none) for `mode`. */
export function bump(counts, mode, by = 1) {
  if (!MODE_BY_KEY[mode]) return counts;
  return { ...counts, [mode]: Math.max(0, (counts[mode] ?? 0) + by) };
}

/** The count added up: by group, and everybody. */
export function totals(counts) {
  const sum = (group) => modesIn(group).reduce((total, mode) => total + (counts[mode.key] ?? 0), 0);
  const pedestrian = sum('pedestrian');
  const bicycle = sum('bicycle');
  return { pedestrian, bicycle, total: pedestrian + bicycle };
}

/** Seconds as a clock: "4:07", or "1:02:09" past the hour. */
export function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

export function peopleWord(count) {
  return count === 1 ? 'person' : 'people';
}

/** The count as text, to copy out and hand in. */
export function summaryText(counts, session = null, seconds = null) {
  const sums = totals(counts);
  const lines = [
    'People Moving Count — PLACER Toolkit',
    ...sessionLines(session),
    ...(seconds !== null ? [`Counted for: ${clock(seconds)}`] : []),
    `${sums.total} ${peopleWord(sums.total)} crossed the line`,
    '',
  ];
  for (const group of GROUPS) {
    lines.push(`${group.label} — ${sums[group.key]}`);
    const modes = modesIn(group.key);
    // A group of one is its own line.
    if (modes.length > 1) {
      for (const mode of modes) lines.push(`  - ${mode.label}: ${counts[mode.key] ?? 0}`);
    }
  }
  return lines.join('\n');
}
