import { describe, it, expect } from 'vite-plus/test';
import {
  MODES, MAX_POINTS, bump, clock, emptyCounts, emptySession, hasProjectSetup, modesIn, projectSetupProblems,
  projectSetupToSave, sessionFromSetup, sessionProblems, summaryText, totals,
} from '../peopleMoving';

const LINE = [{ lat: 55.6, lng: 12.98 }, { lat: 55.601, lng: 12.981 }];

describe('the modes', () => {
  it('counts five kinds of pedestrian, and people on bicycles apart', () => {
    expect(modesIn('pedestrian').map((mode) => mode.key))
      .toEqual(['walking', 'running', 'supported', 'carried', 'rolling']);
    expect(modesIn('bicycle').map((mode) => mode.key)).toEqual(['bicycle']);
    expect(MODES).toHaveLength(6);
  });
});

describe('the count', () => {
  it('adds up by group and in all', () => {
    let counts = emptyCounts();
    counts = bump(bump(bump(counts, 'walking'), 'walking'), 'carried');
    counts = bump(counts, 'bicycle');
    expect(totals(counts)).toEqual({ pedestrian: 3, bicycle: 1, total: 4 });
  });

  it('never goes below none, and ignores a mode it does not know', () => {
    const counts = emptyCounts();
    expect(bump(counts, 'walking', -1).walking).toBe(0);
    expect(bump(counts, 'unicycle')).toBe(counts);
  });

  it('reads the time as a clock', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(67.9)).toBe('1:07');
    expect(clock(600)).toBe('10:00');
    expect(clock(3729)).toBe('1:02:09');
  });

  it('writes the count out, group by group', () => {
    const counts = { ...emptyCounts(), walking: 2, rolling: 1, bicycle: 3 };
    const text = summaryText(counts, { ...emptySession(), name: 'Ada', location: 'Södergatan', weather: 'Sunny' }, 600);
    expect(text).toContain('Observer: Ada');
    expect(text).toContain('Counted for: 10:00');
    expect(text).toContain('6 people crossed the line');
    expect(text).toContain('Pedestrians — 3');
    expect(text).toContain('  - Walking: 2');
    expect(text).toContain('People on bicycles — 3');
  });
});

describe("a project's setup", () => {
  it('needs a line of two points or more and a location', () => {
    expect(projectSetupProblems({ line: [LINE[0]], location: '' })).toEqual([
      'Draw the count line on the map: at least two points.',
      'Name the location.',
    ]);
    expect(hasProjectSetup({ line: LINE, location: 'Södergatan' })).toBe(true);
  });

  it('is kept small: points rounded and capped, the location trimmed', () => {
    const many = Array.from({ length: MAX_POINTS + 3 }, (_, i) => ({ lat: 55.123456789 + i, lng: 12.987654321 }));
    const saved = projectSetupToSave({ line: many, location: '  Södergatan ' });
    expect(saved.line).toHaveLength(MAX_POINTS);
    expect(saved.line[0]).toEqual({ lat: 55.123457, lng: 12.987654 });
    expect(saved.location).toBe('Södergatan');
  });

  it('starts every session from its line and location', () => {
    const session = sessionFromSetup({ line: LINE, location: 'Södergatan' });
    expect(session.line).toBe(LINE);
    expect(session.location).toBe('Södergatan');
    expect(sessionProblems(session)).toEqual(['Add your name.', 'Pick the weather.']);
  });

  it('starts from nothing when the setup is not complete', () => {
    expect(sessionFromSetup({ line: [], location: 'Somewhere' }).line).toEqual([]);
    expect(sessionFromSetup(null).location).toBe('');
  });
});
