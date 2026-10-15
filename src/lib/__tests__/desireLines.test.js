import { describe, it, expect } from 'vite-plus/test';
import {
  MAX_NOTE, SOLO_SITE as SOLO, addInquiry, inquiryConfig, inquirySite,
  BASE_TYPES, MAX_ELEMENTS_PER_SITE, MAX_TYPES, addElement, cleanElements, elementCount, elementName, elementsOf,
  elementsOthersOn, makeElement, paletteOf, removeElement, typesOf,
  MAX_PATHS_PER_SITE, MAX_SITES, SOLO_SITE, addPath, alignment, cleanPaths, clearSite, combineDesire, compare,
  distance, emptyDesire, makePath, makeSite, nextSiteId, othersOn, pathCount, pathLength, pathsOf, removePath,
  setupProblems, simplify, sitesOf, toGeoJSON,
} from '../desireLines';

// Due east along a street, a point every ~11 m (0.0001° of longitude at 52°N is ~6.9 m).
const east = (from, count, lat = 52.52) => Array.from({ length: count }, (_, i) => [from + i * 0.0001, lat]);
// 0.0001° of latitude is ~11 m.
const northOf = (points, dLat) => points.map(([lng, lat]) => [lng, lat + dLat]);

describe('measuring', () => {
  it('knows a degree of latitude is about 111 km', () => {
    expect(distance([13, 52], [13, 53])).toBeGreaterThan(110000);
    expect(distance([13, 52], [13, 53])).toBeLessThan(112000);
  });

  it('adds up a path', () => {
    const points = east(13.4, 11);
    expect(pathLength(points)).toBeCloseTo(distance(points[0], points[10]), 0);
  });
});

describe('making a path from a drawing', () => {
  it('drops the points that a straight line already says', () => {
    const path = makePath(east(13.4, 50));
    expect(path.points).toHaveLength(2);
    expect(path.points[0]).toEqual([13.4, 52.52]);
  });

  it('keeps a bend', () => {
    const bent = [...east(13.4, 20), ...northOf(east(13.4 + 19 * 0.0001, 20), 0.0004).slice(1)];
    // The corner is a single step the long way round, so the path needs a point there.
    const path = makePath([...east(13.4, 20), [13.4 + 19 * 0.0001, 52.5204], ...bent.slice(21)]);
    expect(path.points.length).toBeGreaterThan(2);
  });

  it('is nothing if it is too short to be a walk, or not a line at all', () => {
    expect(makePath([[13.4, 52.52], [13.40001, 52.52]])).toBeNull();
    expect(makePath([[13.4, 52.52]])).toBeNull();
    expect(makePath([[13.4, 52.52], ['x', 1], [200, 100]])).toBeNull();
    expect(makePath(null)).toBeNull();
  });

  it('rounds to about a metre, and gives each path an id of its own', () => {
    const a = makePath([[13.4000049, 52.5200049], [13.4010049, 52.5200049]]);
    const b = makePath(east(13.4, 11));
    expect(a.points[0]).toEqual([13.4, 52.52]);
    expect(a.id).not.toBe(b.id);
  });

  it('never keeps more points than a path may', () => {
    const wiggle = Array.from({ length: 2000 }, (_, i) => [13.4 + i * 0.00002, 52.52 + (i % 2) * 0.0001]);
    expect(makePath(wiggle).points.length).toBeLessThanOrEqual(200);
  });

  it('simplifies a line to within the tolerance', () => {
    expect(simplify([[13.4, 52.52]])).toEqual([[13.4, 52.52]]);
    expect(simplify(east(13.4, 5), 3)).toHaveLength(2);
  });
});

describe("one person's walks", () => {
  const path = (id) => ({ id, points: east(13.4, 11) });

  it('adds, removes and clears them site by site', () => {
    let state = emptyDesire();
    state = addPath(state, 's1', path('a'));
    state = addPath(state, 's1', path('b'));
    state = addPath(state, 's2', path('c'));

    expect(pathsOf(state, 's1').map((p) => p.id)).toEqual(['a', 'b']);
    expect(pathCount(state)).toBe(3);
    expect(pathCount(state, 's2')).toBe(1);

    state = removePath(state, 's1', 'a');
    expect(pathsOf(state, 's1').map((p) => p.id)).toEqual(['b']);

    state = clearSite(state, 's1');
    expect(pathCount(state)).toBe(1);
  });

  it('stops at the most walks one person may draw on a site', () => {
    let state = emptyDesire();
    for (let i = 0; i < MAX_PATHS_PER_SITE + 5; i += 1) state = addPath(state, SOLO_SITE, path(`p${i}`));
    expect(pathCount(state, SOLO_SITE)).toBe(MAX_PATHS_PER_SITE);
  });

  it('ignores a path that is not there', () => {
    const state = emptyDesire();
    expect(addPath(state, 's1', null)).toBe(state);
  });
});

describe("everybody's walks", () => {
  const mine = { id: 'mine', points: east(13.4, 11) };
  const theirs = { id: 'theirs', points: east(13.4, 11) };

  it('gathers them by site, and counts the people who drew', () => {
    const combined = combineDesire([
      { sites: { s1: [mine], s2: [theirs] } },
      { sites: { s1: [{ ...theirs, id: 'x' }] } },
      { sites: {} },
    ]);

    expect(combined.people).toBe(2);
    expect(combined.sites.s1.map((p) => p.id)).toEqual(['mine', 'x']);
    expect(combined.sites.s2).toHaveLength(1);
  });

  it('is empty when nobody has drawn', () => {
    expect(combineDesire([])).toEqual({ people: 0, sites: {}, elements: {} });
  });

  it('ignores what a database might hold that is not a walk', () => {
    const combined = combineDesire([
      null, { sites: 'x' }, { sites: { s1: 'no' } },
      { sites: { s1: [{ id: 3, points: [] }, { id: 'a', points: [[1, 2]] }, { id: 'b', points: [[1, 2], ['x', 1]] }, mine] } },
    ]);
    expect(combined.sites.s1.map((p) => p.id)).toEqual(['mine']);
    expect(combined.people).toBe(1);
    expect(cleanPaths('nope')).toEqual([]);
  });

  it("leaves out one's own when looking at the others'", () => {
    const combined = { sites: { s1: [mine, theirs] } };
    expect(othersOn(combined, 's1', [mine]).map((p) => p.id)).toEqual(['theirs']);
    expect(othersOn(null, 's1', [mine])).toEqual([]);
  });

  it('is a GeoJSON line for each walk', () => {
    const geo = toGeoJSON([mine], { site: 'Square' });
    expect(geo.features[0].geometry).toEqual({ type: 'LineString', coordinates: mine.points });
    expect(geo.features[0].properties).toMatchObject({ id: 'mine', site: 'Square' });
  });
});

describe('comparing walks', () => {
  const street = { id: 'street', points: east(13.4, 21) };

  it('finds a walk that follows the others aligned', () => {
    const along = { id: 'along', points: northOf(east(13.4, 21), 0.00005) }; // ~5 m off
    expect(compare(along, [street])).toEqual([{ points: expect.any(Array), aligned: true }]);
    expect(alignment([along], [street]).share).toBe(1);
  });

  it('finds a walk that goes its own way', () => {
    const away = { id: 'away', points: northOf(east(13.4, 21), 0.001) }; // ~110 m off
    expect(compare(away, [street])).toEqual([{ points: expect.any(Array), aligned: false }]);
    expect(alignment([away], [street]).share).toBe(0);
  });

  it('splits a walk where it leaves the others', () => {
    const leaves = {
      id: 'leaves',
      points: [...east(13.4, 11), [13.4 + 0.001, 52.52 + 0.0005], [13.4 + 0.002, 52.52 + 0.001]],
    };
    const runs = compare(leaves, [street]);
    expect(runs[0].aligned).toBe(true);
    expect(runs[runs.length - 1].aligned).toBe(false);
    const { share } = alignment([leaves], [street]);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });

  it('has nothing to compare with when nobody else has drawn', () => {
    expect(compare(street, [])).toEqual([{ points: street.points, aligned: false }]);
    expect(alignment([], [street])).toEqual({ total: 0, shared: 0, share: 0 });
  });
});

describe("a project's setup", () => {
  const scope = { point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: [13.39, 52.51, 13.41, 52.53] };

  it('needs at least one site, each named and on the map', () => {
    expect(setupProblems({ prompt: '', sites: [] })).toHaveLength(1);
    expect(setupProblems({ sites: [makeSite([], 'Square', scope)] })).toEqual([]);
    expect(setupProblems({ sites: [{ id: 's1', name: ' ', point: scope.point }] })).toHaveLength(1);
    expect(setupProblems({ sites: [{ id: 's1', name: 'Square' }] })).toHaveLength(1);
  });

  it('allows a few sites at most, and a question of a sensible length', () => {
    const sites = [];
    for (let i = 0; i < MAX_SITES + 1; i += 1) sites.push(makeSite(sites, `Site ${i}`, scope));
    expect(setupProblems({ sites })).toHaveLength(1);
    expect(setupProblems({ prompt: 'x'.repeat(201), sites: sites.slice(0, 1) })).toHaveLength(1);
  });

  it('makes each site an id of its own, even after one is removed', () => {
    const one = makeSite([], 'One', scope);
    const two = makeSite([one], 'Two', scope);
    expect(new Set([one.id, two.id]).size).toBe(2);
    expect(nextSiteId([two])).not.toBe(two.id);
  });

  it('uses only the sites that are good', () => {
    const good = makeSite([], 'Square', scope);
    expect(sitesOf({ sites: [good, good, null, { id: 'z', name: 'No place' }] })).toEqual([good]);
    expect(sitesOf(null)).toEqual([]);
  });
});

describe('entrances, obstacles and other things', () => {
  const at = [13.4, 52.52];

  it('has an entrance, an obstacle, and a blank for whatever else', () => {
    expect(BASE_TYPES.map((type) => type.id)).toEqual(['entrance', 'obstacle', 'other']);
    expect(BASE_TYPES.find((type) => type.id === 'other').blank).toBe(true);
  });

  it('makes an element at a place, named by its kind unless it was given a name', () => {
    const entrance = makeElement('entrance', '', at);
    expect(entrance).toMatchObject({ type: 'entrance', label: '', point: at });
    expect(elementName(entrance)).toBe('Entrance');
    expect(elementName(makeElement('obstacle', ' Wall ', at))).toBe('Wall');
  });

  it('will not make the blank kind without a name, or any kind without a place', () => {
    expect(makeElement('other', '  ', at)).toBeNull();
    expect(makeElement('other', 'Bench', at)).toMatchObject({ type: 'other', label: 'Bench' });
    expect(makeElement('entrance', '', [200, 100])).toBeNull();
    expect(makeElement('entrance', '', null)).toBeNull();
  });

  it('adds, removes and counts them site by site, up to a limit', () => {
    let state = emptyDesire();
    state = addElement(state, 's1', makeElement('entrance', '', at, 'a'));
    state = addElement(state, 's2', makeElement('obstacle', '', at, 'b'));
    expect(elementCount(state)).toBe(2);
    expect(elementsOf(state, 's1').map((e) => e.id)).toEqual(['a']);
    state = removeElement(state, 's1', 'a');
    expect(elementCount(state, 's1')).toBe(0);

    for (let i = 0; i < MAX_ELEMENTS_PER_SITE + 3; i += 1) state = addElement(state, 's3', makeElement('entrance', '', at, `e${i}`));
    expect(elementCount(state, 's3')).toBe(MAX_ELEMENTS_PER_SITE);
  });

  it('is cleared with the rest of a site', () => {
    const state = addElement(addPath(emptyDesire(), 's1', { id: 'p', points: east(13.4, 11) }), 's1', makeElement('entrance', '', at));
    const cleared = clearSite(state, 's1');
    expect(pathCount(cleared)).toBe(0);
    expect(elementCount(cleared)).toBe(0);
  });

  it("gathers everybody's, and leaves one's own out of the others'", () => {
    const mine = makeElement('entrance', '', at, 'mine');
    const theirs = makeElement('obstacle', '', at, 'theirs');
    const combined = combineDesire([
      { elements: { s1: [mine] } }, { elements: { s1: [theirs] } }, { elements: { s1: [{ id: 'x', type: 'entrance', point: 'no' }] } },
    ]);
    expect(combined.people).toBe(2);
    expect(combined.elements.s1.map((e) => e.id)).toEqual(['mine', 'theirs']);
    expect(elementsOthersOn(combined, 's1', [mine]).map((e) => e.id)).toEqual(['theirs']);
    expect(cleanElements('nope')).toEqual([]);
  });

  it("offers a project's own kinds after the base ones", () => {
    const config = { types: [{ id: 't1', label: 'Bench' }, { id: 't2', label: ' ' }, null] };
    expect(paletteOf(config).map((type) => type.label)).toEqual(['Entrance', 'Obstacle', 'Something else', 'Bench']);
    expect(typesOf(config)).toEqual([{ id: 't1', label: 'Bench' }]);
    expect(paletteOf(null)).toEqual(BASE_TYPES);
  });

  it("holds a setup to a few kinds, each named", () => {
    const site = makeSite([], 'Square', { point: { lat: 52.52, lng: 13.4 } });
    expect(setupProblems({ sites: [site], types: [{ id: 't1', label: 'Bench' }] })).toEqual([]);
    expect(setupProblems({ sites: [site], types: [{ id: 't1', label: ' ' }] })).toHaveLength(1);
    const many = Array.from({ length: MAX_TYPES + 1 }, (_, i) => ({ id: `t${i}`, label: `Kind ${i}` }));
    expect(setupProblems({ sites: [site], types: many })).toHaveLength(1);
  });

  it("cleans the elements a site was set up with", () => {
    const site = { ...makeSite([], 'Square', { point: { lat: 52.52, lng: 13.4 } }), elements: [makeElement('entrance', '', at, 'a'), { id: 1 }] };
    expect(sitesOf({ sites: [site] })[0].elements.map((e) => e.id)).toEqual(['a']);
  });
});

describe('notes on elements', () => {
  it('keeps an optional description, trimmed and kept short', () => {
    expect(makeElement('entrance', '', [13.4, 52.52], 'a', '  Step-free  ').note).toBe('Step-free');
    expect(makeElement('entrance', '', [13.4, 52.52], 'a').note).toBe('');
    expect(makeElement('entrance', '', [13.4, 52.52], 'a', 'x'.repeat(300)).note).toHaveLength(140);
  });

  it('carries it through the room and into GeoJSON', () => {
    const element = makeElement('obstacle', '', [13.4, 52.52], 'o', 'No ramp');
    expect(combineDesire([{ elements: { s1: [element] } }]).elements.s1[0].note).toBe('No ramp');
    expect(toGeoJSON([], {}, [element]).features[0].properties).toMatchObject({ note: 'No ramp', type: 'obstacle' });
  });
});

describe('inquiries kept on a profile', () => {
  const scope = { point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: [13.39, 52.51, 13.41, 52.53] };
  const walk = { id: 'w', points: east(13.4, 11) };
  const mark = makeElement('entrance', '', [13.4, 52.52], 'm', 'Step-free');
  const state = addElement(addPath(emptyDesire(), SOLO, walk), SOLO, mark);
  const config = inquiryConfig({ site: { name: 'Market square', scope }, note: '  Worn bare.  ', state });

  it('keeps the site, its marks, the note and the walks', () => {
    expect(config).toEqual({
      note: 'Worn bare.',
      site: { name: 'Market square', point: scope.point, zoom: 17, bounds: scope.bounds, elements: [mark] },
      walks: [walk],
    });
  });

  it('becomes a project site carrying the marks', () => {
    const site = inquirySite(config);
    expect(site).toMatchObject({ id: 's1', name: 'Market square', point: scope.point });
    expect(site.elements).toEqual([mark]);
    expect(inquirySite({ site: { name: ' ', point: scope.point } })).toBeNull();
    expect(inquirySite(null)).toBeNull();
  });

  it('is added to a setup without replacing what it has, joining the notes', () => {
    const existing = makeSite([], 'River park', scope);
    const setup = addInquiry({ prompt: 'Which way?', note: 'We care about the river.', types: [], sites: [existing] }, config);

    expect(setup.sites.map((site) => site.name)).toEqual(['River park', 'Market square']);
    expect(setup.sites[1].id).not.toBe(existing.id);
    expect(setup.note).toBe('We care about the river.\n\nWorn bare.');
    expect(setup.prompt).toBe('Which way?');
  });

  it('adds only its note when the setup is full, and never more than a note may hold', () => {
    const sites = [];
    for (let i = 0; i < MAX_SITES; i += 1) sites.push(makeSite(sites, `Site ${i}`, scope));
    const full = addInquiry({ note: '', sites }, config);
    expect(full.sites).toHaveLength(MAX_SITES);
    expect(full.note).toBe('Worn bare.');

    expect(addInquiry({ note: 'x'.repeat(MAX_NOTE), sites: [] }, config).note).toHaveLength(MAX_NOTE);
    expect(setupProblems({ sites: [makeSite([], 'Square', scope)], note: 'x'.repeat(MAX_NOTE + 1) })).toHaveLength(1);
  });
});
