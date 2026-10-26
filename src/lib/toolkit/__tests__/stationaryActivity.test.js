import { describe, it, expect } from 'vite-plus/test';
import {
  ACTIVITIES,
  ACTIVITIES_BY_POSTURE,
  DIRECTIONS,
  GRID,
  HANDING_IN,
  POSTURE_LIST,
  cellCoords,
  cellIndex,
  cellInGrid,
  emptyTallies,
  normaliseObservation,
  peopleWord,
  summaryText,
  tally,
  emptySession,
  insideArea,
  sessionProblems,
} from '../stationaryActivity';

describe('the field sheet', () => {
  it("offers the field sheet's seven postures, by its names", () => {
    expect(POSTURE_LIST.map((posture) => posture.key)).toEqual([
      'standing',
      'sittingPublic',
      'sittingPrivate',
      'sittingCommercial',
      'sittingInformally',
      'lying',
      'multiple',
    ]);
    expect(POSTURE_LIST.map((posture) => posture.label)).toEqual([
      'Standing', 'Public sitting', 'Private sitting', 'Commercial sitting', 'Informal sitting',
      'Lying down', 'Multiple movement',
    ]);
  });

  it('offers six activities, each with at least one posture', () => {
    expect(ACTIVITIES.map((activity) => activity.key)).toEqual([
      'waiting',
      'consuming',
      'commercial',
      'conversing',
      'cultural',
      'recreation',
    ]);
    expect(ACTIVITIES.map((activity) => activity.label)).toEqual([
      'Waiting for transportation', 'Consuming food and beverage', 'Commercial activity', 'Conversing',
      'Cultural activity', 'Recreation and play/exercise',
    ]);
    for (const activity of ACTIVITIES) {
      expect(activity.label).toBeTruthy();
      expect(activity.postures.length).toBeGreaterThan(0);
      for (const key of activity.postures) {
        expect(POSTURE_LIST.map((posture) => posture.key)).toContain(key);
      }
    }
    for (const posture of POSTURE_LIST) {
      expect(ACTIVITIES_BY_POSTURE[posture.key].length).toBeGreaterThan(0);
    }
  });
});

describe('the directions', () => {
  it('carry every point of the field sheet, and what to do before handing it in', () => {
    expect(DIRECTIONS).toHaveLength(8);
    expect(DIRECTIONS[0]).toBe('Define a route through your space and use the same route for each hour.');
    expect(HANDING_IN).toMatch(/name, date, & day of the week/);
  });

  it('let anybody be conversing, whatever their posture', () => {
    for (const posture of POSTURE_LIST) {
      expect(ACTIVITIES_BY_POSTURE[posture.key].map((activity) => activity.key)).toContain('conversing');
    }
  });
});

describe('normaliseObservation', () => {
  it('accepts a sound observation', () => {
    expect(normaliseObservation({ posture: 'standing', activities: ['waiting'], cell: 9 })).toEqual({
      posture: 'standing',
      activities: ['waiting'],
      cell: 9,
    });
  });

  it('rejects an unknown posture outright', () => {
    expect(normaliseObservation({ posture: 'hovering', activities: ['waiting'], cell: 9 })).toBeNull();
  });

  it('drops activities that do not belong to the posture', () => {
    expect(normaliseObservation({ posture: 'lying', activities: ['waiting', 'consuming'] })).toEqual({
      posture: 'lying',
      activities: ['consuming'],
      cell: null,
    });
  });

  it('counts a doubled activity once', () => {
    expect(normaliseObservation({ posture: 'standing', activities: ['waiting', 'waiting'] })).toEqual({
      posture: 'standing',
      activities: ['waiting'],
      cell: null,
    });
  });

  it('clears a cell off the grid rather than trusting it', () => {
    expect(normaliseObservation({ posture: 'sittingPublic', activities: ['recreation'], cell: GRID.cols * GRID.rows })).toEqual({
      posture: 'sittingPublic',
      activities: [],
      cell: null,
    });
  });
});

describe('tally', () => {
  const corner = cellIndex(0, 0);
  const farCorner = cellIndex(7, 4);

  const session = [
    { posture: 'standing', activities: ['waiting', 'cultural'], cell: corner },
    { posture: 'sittingPublic', activities: ['waiting', 'conversing'], cell: null },
    { posture: 'multiple', activities: ['recreation', 'commercial'], cell: farCorner },
  ];

  it('counts people per posture', () => {
    const counts = tally(session);
    expect(counts.total).toBe(3);
    expect(counts.byPosture.standing).toBe(1);
    expect(counts.byPosture.sittingPublic).toBe(1);
    expect(counts.byPosture.multiple).toBe(1);
  });

  it('counts each activity once per person who does it', () => {
    const counts = tally(session);
    expect(counts.byActivity.waiting).toBe(2);
    expect(counts.byActivity.cultural).toBe(1);
    expect(counts.byActivity.conversing).toBe(1);
    expect(counts.byActivity.recreation).toBe(1);
    expect(counts.byActivity.commercial).toBe(1);
  });

  it('stacks people by spot, coloured by the posture that holds it', () => {
    const counts = tally(session);
    expect(counts.placed).toBe(2);
    expect(counts.byCell[corner]).toBe(1);
    expect(counts.byCell[farCorner]).toBe(1);
  });

  it('ignores nonsense and reports a clean empty sheet', () => {
    const counts = tally([null, { posture: 'nope' }, { activities: ['waiting'] }]);
    expect(counts).toEqual(emptyTallies());
  });
});

describe('the grid', () => {
  it('turns a row and column into an index and back again', () => {
    expect(cellIndex(0, 0)).toBe(0);
    expect(cellIndex(3, 2)).toBe(19);
    expect(cellCoords(19)).toEqual({ x: 3, y: 2 });
  });

  it('knows the edges of the square', () => {
    expect(cellInGrid(0)).toBe(true);
    expect(cellInGrid(GRID.cols * GRID.rows - 1)).toBe(true);
    expect(cellInGrid(GRID.cols * GRID.rows)).toBe(false);
    expect(cellInGrid(-1)).toBe(false);
    expect(cellInGrid(null)).toBe(false);
  });
});

describe('summaryText', () => {
  it('writes the tally out as a copyable field sheet', () => {
    const counts = tally([{ posture: 'standing', activities: ['waiting'], cell: 0 }]);
    const text = summaryText(counts);
    expect(text).toContain('Stationary Activity Mapping — PLACER Toolkit');
    expect(text).toContain('1 person recorded');
    expect(text).toContain('Standing — 1');
    expect(text).toContain('- Waiting for transportation: 1');
  });

  it("opens with the session's header when there is one", () => {
    const session = { ...emptySession(), name: 'Ada', date: '2026-10-26', time: '14:00',
      weather: 'Overcast', location: 'Stortorget' };
    const text = summaryText(tally([]), session);
    expect(text).toContain('Observer: Ada');
    expect(text).toContain('Date: 2026-10-26 (Monday), 14:00');
    expect(text).toContain('Location: Stortorget');
    expect(text).toContain('Weather: Overcast');
  });

  it('says people when it has to', () => {
    expect(peopleWord(1)).toBe('person');
    expect(peopleWord(2)).toBe('people');
  });
});

describe('the session', () => {
  const square = [{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }, { lat: 2, lng: 2 }, { lat: 2, lng: 0 }];

  it('starts on the date and time given, with the rest blank', () => {
    const session = emptySession(new Date(2026, 9, 26, 9, 5));
    expect(session).toEqual({ name: '', date: '2026-10-26', time: '09:05', weather: '', location: '', area: [] });
  });

  it('lists what is missing, and nothing once it is all there', () => {
    expect(sessionProblems(emptySession())).toHaveLength(4);
    expect(sessionProblems({ name: 'Ada', date: '2026-10-26', time: '09:00', weather: 'Sunny',
      location: 'Stortorget', area: square })).toEqual([]);
  });

  it('knows whether a spot is inside the outline', () => {
    expect(insideArea({ lat: 1, lng: 1 }, square)).toBe(true);
    expect(insideArea({ lat: 3, lng: 1 }, square)).toBe(false);
    expect(insideArea({ lat: 1, lng: 1 }, square.slice(0, 2))).toBe(false);
  });
});
