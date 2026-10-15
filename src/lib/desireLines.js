/* PLACER — Desire Lines: the paths people actually take across a place.
 *
 * Somebody picks a site on the map and draws the walks they really make across it.
 * A path is a list of [lng, lat] points (GeoJSON's order, which is also MapLibre's),
 * kept short: a drawing is simplified to a few metres' tolerance and rounded to
 * five decimals, about a metre, before it is stored or sent to a room.
 *
 * One person's state is { sites: { [siteId]: [path, ...] }, elements: { [siteId]: [element, ...] } }
 * with path = { id, points } and element = { id, type, label, point }: the entrances,
 * obstacles and other things on the ground that the walks go to, around or through. A tool used on its own has the one site, SOLO_SITE; a project
 * names several (its setup, below). Everything here is pure, so it is tested without
 * a map.
 */

const EARTH_RADIUS = 6371008.8; // metres

/** The site of a tool used on its own, where there is only the one. */
export const SOLO_SITE = 'site';

export const MAX_SITES = 6;
export const MAX_SITE_NAME = 80;
export const MAX_PROMPT = 200;
export const MAX_PATHS_PER_SITE = 40;
export const MAX_POINTS_PER_PATH = 200;
export const MAX_ELEMENTS_PER_SITE = 30;
export const MAX_LABEL = 40;
export const MAX_TYPES = 4;
export const MAX_NOTE = 600;
export const MAX_ELEMENT_NOTE = 140;

/**
 * The kinds of element anybody can put on the map. 'other' is the blank one: whoever
 * places it says what it is. A project may add kinds of its own (see paletteOf).
 */
export const BASE_TYPES = [
  { id: 'entrance', label: 'Entrance', initial: 'E' },
  { id: 'obstacle', label: 'Obstacle', initial: 'O' },
  { id: 'other', label: 'Something else', initial: '?', blank: true },
];

/** Shorter than this and a drag was a slip, not a walk. */
export const MIN_PATH_METRES = 8;
/** A drawing is simplified until it strays no further than this from what was drawn. */
export const SIMPLIFY_METRES = 3;
/** Two walks within this of each other, side by side, count as the same way across. */
export const ALIGN_METRES = 15;

const rad = (degrees) => (degrees * Math.PI) / 180;

/** Metres between two [lng, lat] points. */
export function distance(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** How long a path is, in metres. */
export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  return total;
}

// Flat metres around `origin` — good to a centimetre over the size of a site.
function flatten(points, origin) {
  const kx = Math.cos(rad(origin[1])) * rad(1) * EARTH_RADIUS;
  const ky = rad(1) * EARTH_RADIUS;
  return points.map(([lng, lat]) => [(lng - origin[0]) * kx, (lat - origin[1]) * ky]);
}

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const u = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
}

/** Douglas–Peucker: the fewest points that keep the line within `tolerance` metres. */
export function simplify(points, tolerance = SIMPLIFY_METRES) {
  if (points.length <= 2) return points.slice();
  const flat = flatten(points, points[0]);
  const keep = Array.from({ length: points.length }, () => false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let far = -1;
    let farDistance = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const d = distanceToSegment(flat[i], flat[first], flat[last]);
      if (d > farDistance) {
        far = i;
        farDistance = d;
      }
    }
    if (far >= 0) {
      keep[far] = true;
      stack.push([first, far], [far, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

const round = (value) => Math.round(value * 1e5) / 1e5;

const isPoint = (point) => Array.isArray(point) && point.length >= 2
  && Number.isFinite(point[0]) && Number.isFinite(point[1])
  && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;

let counter = 0;
/** An id no other path in any browser has, near enough. */
export function newPathId() {
  counter += 1;
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter}`;
}

/**
 * A drawn line as a path, or null if it is too short to be a walk. Simplified, rounded,
 * and cut to the most points a path may have.
 */
export function makePath(points, id = newPathId()) {
  const clean = (points ?? []).filter(isPoint).map(([lng, lat]) => [round(lng), round(lat)]);
  if (clean.length < 2 || pathLength(clean) < MIN_PATH_METRES) return null;
  let tolerance = SIMPLIFY_METRES;
  let simple = simplify(clean, tolerance);
  while (simple.length > MAX_POINTS_PER_PATH) {
    tolerance *= 1.5;
    simple = simplify(clean, tolerance);
  }
  return { id, points: simple };
}

/** The state of somebody who has drawn nothing. */
export const emptyDesire = () => ({ sites: {}, elements: {} });

/** A person's paths on one site. */
export const pathsOf = (state, siteId) => (Array.isArray(state?.sites?.[siteId]) ? state.sites[siteId] : []);

/** `state` with `path` added to the site, unless that is as many as one person may draw. */
export function addPath(state, siteId, path) {
  const paths = pathsOf(state, siteId);
  if (!path || paths.length >= MAX_PATHS_PER_SITE) return state;
  return { ...state, sites: { ...state?.sites, [siteId]: [...paths, path] } };
}

export function removePath(state, siteId, pathId) {
  return { ...state, sites: { ...state?.sites, [siteId]: pathsOf(state, siteId).filter((path) => path.id !== pathId) } };
}

export function clearSite(state, siteId) {
  const { [siteId]: _gone, ...rest } = state?.sites ?? {};
  const { [siteId]: _gone2, ...elements } = state?.elements ?? {};
  return { ...state, sites: rest, elements };
}

/** How many paths a person has drawn, over every site or just `siteId`. */
export function pathCount(state, siteId = null) {
  if (siteId) return pathsOf(state, siteId).length;
  return Object.values(state?.sites ?? {}).reduce((sum, paths) => sum + (Array.isArray(paths) ? paths.length : 0), 0);
}

// ----- Elements: entrances, obstacles and whatever else -----

const trimLabel = (label) => (typeof label === 'string' ? label.trim().slice(0, MAX_LABEL) : '');

/** The kinds of element a room offers: the base ones, then the project's own. */
export function paletteOf(config) {
  const own = (Array.isArray(config?.types) ? config.types : [])
    .filter((type) => type && typeof type.id === 'string' && trimLabel(type.label))
    .slice(0, MAX_TYPES)
    .map((type) => ({ id: type.id, label: trimLabel(type.label), initial: trimLabel(type.label)[0].toUpperCase() }));
  return [...BASE_TYPES, ...own];
}

/** What an element is called on the map: the label it was given, or its kind's name. */
export function elementName(element, palette = BASE_TYPES) {
  return trimLabel(element.label) || palette.find((type) => type.id === element.type)?.label || 'Element';
}

const trimNote = (note) => (typeof note === 'string' ? note.trim().slice(0, MAX_ELEMENT_NOTE) : '');

/**
 * An element at `point` ([lng, lat]), or null if it has no place or, being blank, no
 * name. `note` is an optional description, shown when somebody hovers over it.
 */
export function makeElement(type, label, point, id = newPathId(), note = '') {
  if (!isPoint(point)) return null;
  const named = trimLabel(label);
  if (type === 'other' && !named) return null;
  return { id, type, label: named, note: trimNote(note), point: [round(point[0]), round(point[1])] };
}

export const elementsOf = (state, siteId) => (Array.isArray(state?.elements?.[siteId]) ? state.elements[siteId] : []);

export function addElement(state, siteId, element) {
  const elements = elementsOf(state, siteId);
  if (!element || elements.length >= MAX_ELEMENTS_PER_SITE) return state;
  return { ...state, elements: { ...state?.elements, [siteId]: [...elements, element] } };
}

export function removeElement(state, siteId, elementId) {
  return {
    ...state,
    elements: { ...state?.elements, [siteId]: elementsOf(state, siteId).filter((element) => element.id !== elementId) },
  };
}

/** Elements that came back from a database other browsers wrote to, cleaned for use. */
export function cleanElements(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((element) => element && typeof element.id === 'string' && typeof element.type === 'string'
      && isPoint(element.point))
    .map((element) => ({
      id: element.id, type: element.type, label: trimLabel(element.label), note: trimNote(element.note),
      point: [element.point[0], element.point[1]],
    }))
    .slice(0, MAX_ELEMENTS_PER_SITE);
}

/** How many elements a person placed, over every site or just `siteId`. */
export function elementCount(state, siteId = null) {
  if (siteId) return elementsOf(state, siteId).length;
  return Object.values(state?.elements ?? {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

// A path that came back from a database other browsers wrote to.
function cleanPath(raw) {
  if (!raw || typeof raw.id !== 'string' || !Array.isArray(raw.points)) return null;
  const points = raw.points.filter(isPoint).slice(0, MAX_POINTS_PER_PATH).map(([lng, lat]) => [lng, lat]);
  return points.length >= 2 ? { id: raw.id, points } : null;
}

/** Everything one person drew on a site, cleaned for use — malformed paths dropped. */
export function cleanPaths(raw) {
  return (Array.isArray(raw) ? raw : []).map(cleanPath).filter(Boolean).slice(0, MAX_PATHS_PER_SITE);
}

/**
 * Everyone's walks and elements, site by site:
 * { people, sites: { [siteId]: [path, ...] }, elements: { [siteId]: [element, ...] } }.
 * `people` is those who drew or placed at least one.
 */
export function combineDesire(states) {
  const sites = {};
  const elements = {};
  let people = 0;
  for (const state of states ?? []) {
    let drew = false;
    for (const [siteId, raw] of Object.entries(state?.sites ?? {})) {
      const paths = cleanPaths(raw);
      if (paths.length === 0) continue;
      drew = true;
      sites[siteId] = [...(sites[siteId] ?? []), ...paths];
    }
    for (const [siteId, raw] of Object.entries(state?.elements ?? {})) {
      const placed = cleanElements(raw);
      if (placed.length === 0) continue;
      drew = true;
      elements[siteId] = [...(elements[siteId] ?? []), ...placed];
    }
    if (drew) people += 1;
  }
  return { people, sites, elements };
}

/** Other people's paths on a site: everyone's, less those with an id in `mine`. */
export function othersOn(combined, siteId, mine) {
  const own = new Set(mine.map((path) => path.id));
  return cleanPaths(combined?.sites?.[siteId]).filter((path) => !own.has(path.id));
}

/** Other people's elements on a site: everyone's, less those with an id in `mine`. */
export function elementsOthersOn(combined, siteId, mine) {
  const own = new Set(mine.map((element) => element.id));
  return cleanElements(combined?.elements?.[siteId]).filter((element) => !own.has(element.id));
}

/** The paths, and any elements, as one GeoJSON FeatureCollection, to download or hand on. */
export function toGeoJSON(paths, properties = {}, elements = []) {
  return {
    type: 'FeatureCollection',
    features: [
      ...paths.map((path) => ({
        type: 'Feature',
        properties: { ...properties, id: path.id, metres: Math.round(pathLength(path.points)) },
        geometry: { type: 'LineString', coordinates: path.points },
      })),
      ...elements.map((element) => ({
        type: 'Feature',
        properties: { ...properties, id: element.id, type: element.type, label: element.label, note: element.note ?? '' },
        geometry: { type: 'Point', coordinates: element.point },
      })),
    ],
  };
}

// Points along a path every `step` metres, the ends included.
function sample(points, step) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const parts = Math.max(1, Math.ceil(distance(from, to) / step));
    for (let part = 1; part <= parts; part += 1) {
      const u = part / parts;
      out.push([from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u]);
    }
  }
  return out;
}

/**
 * Cut `path` into runs that run alongside what `others` drew and runs that go their own
 * way: [{ points, aligned }, ...] in order. A run is aligned while it stays within
 * `within` metres of some other path.
 */
export function compare(path, others, within = ALIGN_METRES) {
  const points = sample(path.points, 4);
  if (others.length === 0) return [{ points: path.points, aligned: false }];
  const origin = points[0];
  const flat = flatten(points, origin);
  const segments = others.flatMap((other) => {
    const line = flatten(other.points, origin);
    return line.slice(1).map((end, i) => [line[i], end]);
  });
  const near = flat.map((p) => segments.some(([a, b]) => distanceToSegment(p, a, b) <= within));

  const runs = [];
  points.forEach((point, index) => {
    const last = runs[runs.length - 1];
    if (last && last.aligned === near[index]) {
      last.points.push(point);
    } else {
      // A new run starts where the last ended, so the drawn line has no gap.
      runs.push({ aligned: near[index], points: last ? [last.points[last.points.length - 1], point] : [point] });
    }
  });
  return runs.filter((run) => run.points.length >= 2);
}

/**
 * How much of what somebody drew follows what others drew: metres drawn, metres of it
 * alongside others, and the share, 0–1 (0 when they drew nothing).
 */
export function alignment(paths, others, within = ALIGN_METRES) {
  let total = 0;
  let shared = 0;
  for (const path of paths) {
    for (const run of compare(path, others, within)) {
      const metres = pathLength(run.points);
      total += metres;
      if (run.aligned) shared += metres;
    }
  }
  return { total: Math.round(total), shared: Math.round(shared), share: total === 0 ? 0 : shared / total };
}

// ----- A project's setup: the sites it asks about -----

export const defaultSetup = () => ({ prompt: '', note: '', types: [], sites: [] });

const isScope = (site) => site && Number.isFinite(site.point?.lat) && Number.isFinite(site.point?.lng);

/** The kinds of element a setup adds to the base ones, as { id, label }. */
export function typesOf(config) {
  return paletteOf(config).slice(BASE_TYPES.length).map(({ id, label }) => ({ id, label }));
}

/** The sites of a setup that are good to use, in order, with their elements cleaned. */
export function sitesOf(config) {
  const sites = Array.isArray(config?.sites) ? config.sites : [];
  const seen = new Set();
  return sites.filter((site) => {
    if (!isScope(site) || typeof site.id !== 'string' || seen.has(site.id)) return false;
    seen.add(site.id);
    return typeof site.name === 'string' && site.name.trim() !== '';
  }).slice(0, MAX_SITES).map((site) => ({ ...site, elements: cleanElements(site.elements) }));
}

/** What is wrong with a setup, as sentences; empty when a room can open with it. */
export function setupProblems(setup) {
  const problems = [];
  const sites = Array.isArray(setup?.sites) ? setup.sites : [];
  if (setup?.prompt != null && (typeof setup.prompt !== 'string' || setup.prompt.length > MAX_PROMPT)) {
    problems.push(`Keep the question to ${MAX_PROMPT} characters.`);
  }
  if (setup?.note != null && (typeof setup.note !== 'string' || setup.note.length > MAX_NOTE)) {
    problems.push(`Keep the note about the site to ${MAX_NOTE} characters.`);
  }
  const types = Array.isArray(setup?.types) ? setup.types : [];
  if (types.length > MAX_TYPES || types.some((type) => !type || typeof type.id !== 'string' || !trimLabel(type.label))) {
    problems.push(`Give each kind of element a name, and add no more than ${MAX_TYPES}.`);
  }
  if (sites.length === 0) problems.push('Add at least one site for people to draw on.');
  if (sites.length > MAX_SITES) problems.push(`Ask about no more than ${MAX_SITES} sites.`);
  if (sitesOf({ sites }).length !== Math.min(sites.length, MAX_SITES)) {
    problems.push('Every site needs a name and a place on the map.');
  }
  return problems;
}

/** An id for a new site that none of `sites` has. */
export function nextSiteId(sites) {
  const taken = new Set(sites.map((site) => site.id));
  let n = sites.length + 1;
  while (taken.has(`s${n}`)) n += 1;
  return `s${n}`;
}

/** A site of a setup from what the organiser framed on the map. */
export function makeSite(sites, name, scope) {
  return {
    id: nextSiteId(sites),
    name: name.trim().slice(0, MAX_SITE_NAME),
    point: { lat: scope.point.lat, lng: scope.point.lng },
    zoom: scope.zoom ?? null,
    bounds: scope.bounds ?? null,
    elements: [],
  };
}

// ----- Inquiries: a standalone tool kept on a profile, to start a project's from -----

/**
 * What is kept of a standalone Desire Lines: the site and the marks on it, the note on
 * why it is of interest, and the walks drawn. `site` is { name, scope }.
 */
export function inquiryConfig({ site, note, state }) {
  return {
    note: (note ?? '').trim().slice(0, MAX_NOTE),
    site: {
      name: site.name, point: site.scope.point, zoom: site.scope.zoom ?? null, bounds: site.scope.bounds ?? null,
      elements: elementsOf(state, SOLO_SITE),
    },
    walks: pathsOf(state, SOLO_SITE),
  };
}

/** The inquiry's site as it would be a room's, with the marks that were put on it. */
export function inquirySite(config, sites = []) {
  const saved = config?.site;
  if (!isScope(saved) || typeof saved.name !== 'string' || !saved.name.trim()) return null;
  const site = makeSite(sites, saved.name, { point: saved.point, zoom: saved.zoom, bounds: saved.bounds });
  return { ...site, elements: cleanElements(saved.elements) };
}

/**
 * `setup` with an inquiry folded in: its site added (if there is room) and its note
 * joined to the setup's own. Nothing already in the setup is replaced.
 */
export function addInquiry(setup, config) {
  const sites = setup.sites ?? [];
  const site = sites.length < MAX_SITES ? inquirySite(config, sites) : null;
  const note = [setup.note, typeof config?.note === 'string' ? config.note : '']
    .map((text) => (text ?? '').trim()).filter(Boolean).join('\n\n').slice(0, MAX_NOTE);
  return { ...setup, note, sites: site ? [...sites, site] : sites };
}
