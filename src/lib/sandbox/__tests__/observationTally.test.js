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
} from '../observationTally';

describe('the field sheet', () => {
  it('offers four postures with a colour each', () => {
    expect(POSTURE_LIST.map((posture) => posture.key)).toEqual([
      'standing',
      'sitting',
      'lying',
      'moving',
    ]);
    for (const posture of POSTURE_LIST) {
      expect(posture.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('gives every activity a posture it can pair with, and every posture an activity', () => {
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

  it('sorts a posture-specific activity list from the catalog, not the other way round', () => {
    const keys = ACTIVITIES_BY_POSTURE.lying.map((activity) => activity.key);
    expect(keys).toEqual(['phone', 'reading', 'watching', 'resting', 'sunbathing']);
  });
});

describe('normaliseObservation', () => {
  it('accepts a sound observation', () => {
    expect(normaliseObservation({ posture: 'standing', activities: ['talking'], cell: 9 })).toEqual({
      posture: 'standing',
      activities: ['talking'],
      cell: 9,
    });
  });

  it('rejects an unknown posture outright', () => {
    expect(normaliseObservation({ posture: 'hovering', activities: ['talking'], cell: 9 })).toBeNull();
  });

  it('drops activities that do not belong to the posture', () => {
    // Lying offers no "talking" — window shoppers stand to talk.
    expect(normaliseObservation({ posture: 'lying', activities: ['talking', 'sunbathing'] })).toEqual({
      posture: 'lying',
      activities: ['sunbathing'],
      cell: null,
    });
  });

  it('counts a doubled activity once, which is the finger error it protects against', () => {
    expect(normaliseObservation({ posture: 'standing', activities: ['phone', 'phone'] })).toEqual({
      posture: 'standing',
      activities: ['phone'],
      cell: null,
    });
  });

  it('clears a cell off the grid rather than trusting it', () => {
    expect(normaliseObservation({ posture: 'sitting', activities: ['watch'], cell: GRID.cols * GRID.rows })).toEqual({
      posture: 'sitting',
      activities: [],
      cell: null,
    });
  });
});

describe('tally', () => {
  const corner = cellIndex(3, 2);
  const farCorner = cellIndex(7, 4);

  const session = [
    { posture: 'standing', activities: ['talking', 'phone'], cell: corner },
    { posture: 'standing', activities: ['talking'], cell: corner },
    { posture: 'sitting', activities: ['resting', 'reading'], cell: null },
    { posture: 'moving', activities: ['walking', 'dog'], cell: farCorner },
  ];

  it('counts people per posture', () => {
    const counts = tally(session);
    expect(counts.total).toBe(4);
    expect(counts.byPosture.standing).toBe(2);
    expect(counts.byPosture.sitting).toBe(1);
    expect(counts.byPosture.moving).toBe(1);
    expect(counts.byPosture.lying).toBe(0);
  });

  it('counts each activity once per person who does it', () => {
    const counts = tally(session);
    expect(counts.byActivity.talking).toBe(2);
    expect(counts.byActivity.phone).toBe(1);
    expect(counts.byActivity.resting).toBe(1);
    expect(counts.byActivity.reading).toBe(1);
    expect(counts.byActivity.walking).toBe(1);
    expect(counts.byActivity.dog).toBe(1);
  });

  it('stacks people by spot, coloured by the posture that holds it', () => {
    const counts = tally(session);
    expect(counts.placed).toBe(3);
    expect(counts.byCell[corner]).toBe(2);
    expect(counts.byCell[farCorner]).toBe(1);
    expect(counts.byCellPosture[corner].standing).toBe(2);
    expect(counts.byCellPosture[farCorner].moving).toBe(1);
  });

  it('ignores nonsense and reports a clean empty sheet', () => {
    const counts = tally([null, { posture: 'nope' }, { activities: ['talking'] }]);
    expect(counts).toEqual(emptyTallies());
  });
});

describe('the grid', () => {
  it('turns a row and column into an index and back again', () => {
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
    const counts = tally([{ posture: 'standing', activities: ['talking'], cell: 0 }]);
    const text = summaryText(counts);

    expect(text).toContain('Public life tally — PLACER Sandbox');
    expect(text).toContain('1 person recorded');
    expect(text).toContain('Standing — 1');
    expect(text).toContain('- Talking: 1');
  });

  it('says people when it has to', () => {
    expect(peopleWord(1)).toBe('person');
    expect(peopleWord(2)).toBe('people');
  });
});