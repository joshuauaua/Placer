import { describe, it, expect } from 'vite-plus/test';
import {
  ACTIVITIES,
  ACTIVITIES_BY_POSTURE,
  GRID,
  POSTURE_LIST,
  cellCoords,
  cellIndex,
  cellInGrid,
  emptyTallies,
  normaliseObservation,
  peopleWord,
  summaryText,
  tally,
} from '../stationaryActivity';

describe('the field sheet', () => {
  it('offers seven postures with a colour each', () => {
    expect(POSTURE_LIST.map((posture) => posture.key)).toEqual([
      'standing',
      'sittingPublic',
      'sittingPrivate',
      'sittingCommercial',
      'sittingInformally',
      'lying',
      'multiple',
    ]);
    for (const posture of POSTURE_LIST) {
      expect(posture.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('offers six activities, each with at least one posture', () => {
    expect(ACTIVITIES.map((activity) => activity.key)).toEqual([
      'waiting',
      'consuming',
      'commercial',
      'cultural',
      'recreation',
      'leisure',
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
    expect(normaliseObservation({ posture: 'lying', activities: ['waiting', 'leisure'] })).toEqual({
      posture: 'lying',
      activities: ['leisure'],
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
    { posture: 'sittingPublic', activities: ['waiting', 'leisure'], cell: null },
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
    expect(counts.byActivity.leisure).toBe(1);
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
    expect(text).toContain('Stationary Activity Mapping — PLACER Sandbox');
    expect(text).toContain('1 person recorded');
    expect(text).toContain('Standing — 1');
    expect(text).toContain('- Waiting for Transport: 1');
  });

  it('says people when it has to', () => {
    expect(peopleWord(1)).toBe('person');
    expect(peopleWord(2)).toBe('people');
  });
});
