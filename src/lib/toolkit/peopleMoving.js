/* PLACER — People Moving Count: everybody who crosses a line, counted as they cross.
 *
 * After Gehl's Public Life Data Protocol. The organiser outlines the area on a map, then
 * draws the count line on top of it — across a street, a path or a square's entrance —
 * and the observer stands by it and taps once for each person who crosses it, in either
 * direction, by how they move. A timer can run over the count: ten minutes by the
 * protocol, or another length, or none, as the organiser sets it.
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
export const COUNT_MINUTES = 10;
export const COUNT_SECONDS = COUNT_MINUTES * 60;

/** The lengths the timer can be set to, in minutes. */
export const TIMER_MINUTES = [5, 10, 15, 20, 30, 60];

/** How long a setup's timer runs, in seconds, or null for no timer. */
export function timerSeconds(setup) {
  if (!setup || setup.minutes === undefined) return COUNT_SECONDS;
  return TIMER_MINUTES.includes(setup.minutes) ? setup.minutes * 60 : null;
}

/** How to count, after the protocol's field sheet. */
export const DIRECTIONS = [
  'Stand where you can see the whole count line on your map, and count from the same spot each time.',
  'Count for the time on the timer (10 minutes by the protocol). Start it as you start counting; the first tap starts it too.',
  'Tap once for every person who crosses the line, in either direction, by how they are moving.',
  'Walking, running or jogging, supported (e.g. in a wheelchair), carried (e.g. in a stroller) and rolling (e.g. on a skateboard) all count as pedestrians. People on bicycles are counted on their own.',
  'Count a person only once, as they cross. Do not count people who stop short of the line or are standing on it.',
  'Count a group by its people: a family of four walking across is four taps on Walking, and a child in a stroller is one more on Carried.',
  'If you tap the wrong one, take it off with its minus button.',
  'Note anything out of the ordinary while you count — an event, roadworks, a sudden downpour.',
];

/* --- The area, and the line on top of it --- */

// project_tools.config is kept small (supabase/project-tool-config.sql: 2000
// characters), so an area has at most this many corners and a line this many points,
// each to about 10 cm.
export const MAX_CORNERS = 24;
export const MAX_POINTS = 10;
const round = (value) => Math.round(value * 1e6) / 1e6;
const rounded = (points, most) => (points ?? []).slice(0, most).map(({ lat, lng }) => ({ lat: round(lat), lng: round(lng) }));

/** What is wrong with the outline of the area, if anything. */
export function areaProblems(area) {
  return (area?.length ?? 0) < 3 ? ['Outline the area on the map with the polygon tool: at least three corners.'] : [];
}

/** What is wrong with the count line, if anything. */
export function lineProblems(line) {
  return (line?.length ?? 0) < 2 ? ['Draw the count line over the area with the line tool: at least two points.'] : [];
}

/* --- A project's setup: one slide's area, line, location and timer --- */

/** A slide not filled in yet: no area or line, and the protocol's ten-minute timer. */
export function defaultProjectSetup() {
  return { area: [], line: [], location: '', minutes: COUNT_MINUTES };
}

/** What is wrong with the area and the line, in the order they are drawn. */
export function siteProblems(setup) {
  return [...areaProblems(setup?.area), ...lineProblems(setup?.line)];
}

/** What is wrong with the location, the slide's title. */
export function locationProblems(setup) {
  return setup?.location?.trim() ? [] : ['Name the location.'];
}

/** What is wrong with the timer: a length it cannot be set to. None at all is fine. */
export function timerProblems(setup) {
  const minutes = setup?.minutes;
  return minutes === null || minutes === undefined || TIMER_MINUTES.includes(minutes)
    ? [] : ['Pick how long the timer runs.'];
}

/** What a slide's setup is missing, as sentences. */
export function projectSetupProblems(setup) {
  return [...siteProblems(setup), ...locationProblems(setup), ...timerProblems(setup)];
}

/** A slide's setup as it is saved: points rounded, the location trimmed. */
export function projectSetupToSave(setup) {
  return {
    area: rounded(setup.area, MAX_CORNERS),
    line: rounded(setup.line, MAX_POINTS),
    location: setup.location.trim(),
    minutes: setup.minutes ?? null,
  };
}

/** Whether a setup fixes the area, line and location, so observers do not choose them. */
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
    area: [],
    line: [],
  };
}

/** A session started from a project's setup: its area, line and location, the rest as emptySession. */
export function sessionFromSetup(setup, now = new Date()) {
  const session = emptySession(now);
  if (!hasProjectSetup(setup)) return session;
  return { ...session, area: setup.area, line: setup.line, location: setup.location };
}

/** What is still missing before counting can start, in the order the form asks. */
export function sessionProblems(session) {
  const problems = [...siteProblems(session)];
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

/**
 * Everybody's counts in a room, added up: each counter's state is { counts, session },
 * as PeopleMovingCount sends it. Anything that is not a count is ignored, so a broken
 * or hostile state cannot throw the total off by more than its own numbers.
 */
export function combineCounts(states = []) {
  const counts = emptyCounts();
  let observers = 0;
  for (const state of states) {
    const theirs = state?.counts;
    if (!theirs || typeof theirs !== 'object') continue;
    observers += 1;
    for (const mode of MODES) {
      const value = Number(theirs[mode.key]);
      if (Number.isFinite(value) && value > 0) counts[mode.key] += Math.floor(value);
    }
  }
  return { counts, observers };
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
