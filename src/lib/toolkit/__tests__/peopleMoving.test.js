import { describe, it, expect } from 'vite-plus/test';
import {
  MODES, MAX_CORNERS, MAX_POINTS, bump, clock, defaultProjectSetup, emptyCounts, emptySession, hasProjectSetup,
  modesIn, projectSetupProblems, projectSetupToSave, sessionFromSetup, sessionProblems, summaryText, timerSeconds,
  totals,
} from '../peopleMoving';

const AREA = [{ lat: 55.6, lng: 12.98 }, { lat: 55.6, lng: 12.99 }, { lat: 55.61, lng: 12.99 }];
const LINE = [{ lat: 55.6, lng: 12.98 }, { lat: 55.601, lng: 12.981 }];
const SETUP = { area: AREA, line: LINE, location: 'Södergatan', minutes: 10 };

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

describe("a slide's setup", () => {
  it('starts with no area or line, and the ten-minute timer', () => {
    expect(defaultProjectSetup()).toEqual({ area: [], line: [], location: '', minutes: 10 });
  });

  it('needs the area first, then a line on it, then a location', () => {
    expect(projectSetupProblems(defaultProjectSetup())).toEqual([
      'Outline the area on the map with the polygon tool: at least three corners.',
      'Draw the count line over the area with the line tool: at least two points.',
      'Name the location.',
    ]);
    expect(hasProjectSetup(SETUP)).toBe(true);
  });

  it('takes no timer, or one of its lengths, but not any other', () => {
    expect(projectSetupProblems({ ...SETUP, minutes: null })).toEqual([]);
    expect(projectSetupProblems({ ...SETUP, minutes: 7 })).toEqual(['Pick how long the timer runs.']);
  });

  it('runs the timer for its minutes, none, or ten without a setup', () => {
    expect(timerSeconds({ ...SETUP, minutes: 15 })).toBe(900);
    expect(timerSeconds({ ...SETUP, minutes: null })).toBeNull();
    expect(timerSeconds(null)).toBe(600);
  });

  it('is kept small: points rounded and capped, the location trimmed', () => {
    const many = (count) => Array.from({ length: count }, (_, i) => ({ lat: 55.123456789 + i, lng: 12.987654321 }));
    const saved = projectSetupToSave({ area: many(MAX_CORNERS + 3), line: many(MAX_POINTS + 3), location: '  Södergatan ', minutes: null });
    expect(saved.area).toHaveLength(MAX_CORNERS);
    expect(saved.line).toHaveLength(MAX_POINTS);
    expect(saved.line[0]).toEqual({ lat: 55.123457, lng: 12.987654 });
    expect(saved.location).toBe('Södergatan');
    expect(saved.minutes).toBeNull();
    // Within project_tools.config's 2000 characters, at the most it can hold.
    expect(JSON.stringify({ slides: [saved] }).length).toBeLessThan(2000);
  });

  it('starts every session from its area, line and location', () => {
    const session = sessionFromSetup(SETUP);
    expect(session.area).toBe(AREA);
    expect(session.line).toBe(LINE);
    expect(session.location).toBe('Södergatan');
    expect(sessionProblems(session)).toEqual(['Add your name.', 'Pick the weather.']);
  });

  it('starts from nothing when the setup is not complete', () => {
    expect(sessionFromSetup({ ...SETUP, area: [] }).line).toEqual([]);
    expect(sessionFromSetup(null).location).toBe('');
  });
});
