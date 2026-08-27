import { describe, it, expect } from 'vite-plus/test';
import {
  DESTINATIONS,
  PLAZA,
  distance,
  isPaved,
  journeyStats,
  nearestPavedCell,
  neighbourJourneys,
  offPavedShare,
  pavedDistance,
  rasterize,
  samplePoints,
  suggestPaving,
} from '../desireLines';

const metro = DESTINATIONS.find((destination) => destination.id === 'metro');
const tram = DESTINATIONS.find((destination) => destination.id === 'tram');
const cafe = DESTINATIONS.find((destination) => destination.id === 'cafe');

// The diagonal nobody designed for: metro in one corner, tram stop in the other.
const shortcut = { id: 'a', from: metro, to: tram };

describe('the plaza', () => {
  it('covers the grid it says it does', () => {
    expect(PLAZA.cols * PLAZA.cell).toBe(PLAZA.width);
    expect(PLAZA.rows * PLAZA.cell).toBe(PLAZA.height);
  });

  it('paves the ring and the cross, and nothing in between', () => {
    expect(isPaved(50, 5.5)).toBe(true);    // north side
    expect(isPaved(50, 30)).toBe(true);     // middle of the cross
    expect(isPaved(25, 15)).toBe(false);    // the grass a shortcut crosses
  });

  it('puts every destination inside the plaza', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.x).toBeGreaterThan(0);
      expect(destination.x).toBeLessThan(PLAZA.width);
      expect(destination.y).toBeGreaterThan(0);
      expect(destination.y).toBeLessThan(PLAZA.height);
    }
  });
});

describe('samplePoints', () => {
  it('includes both ends', () => {
    const points = samplePoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 10, y: 0 });
  });

  it('spaces points no further apart than the step', () => {
    const points = samplePoints({ x: 0, y: 0 }, { x: 9.5, y: 0 }, 2);
    for (let i = 1; i < points.length; i += 1) {
      expect(distance(points[i - 1], points[i])).toBeLessThanOrEqual(2 + 1e-9);
    }
  });

  it('survives a walk that goes nowhere', () => {
    expect(samplePoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 1)).toHaveLength(2);
  });
});

describe('offPavedShare', () => {
  it('is nothing for a walk along the paving', () => {
    expect(offPavedShare({ from: { x: 10, y: 5.5 }, to: { x: 80, y: 5.5 } })).toBe(0);
  });

  it('is most of the way for the corner-to-corner diagonal', () => {
    expect(offPavedShare(shortcut)).toBeGreaterThan(0.7);
  });
});

describe('pavedDistance', () => {
  it('is never shorter than the walk as the crow flies', () => {
    expect(pavedDistance(metro, tram)).toBeGreaterThan(distance(metro, tram));
  });

  it('is within a few per cent of the straight line when the paving goes that way', () => {
    const from = { x: 10, y: 5.5 };
    const to = { x: 80, y: 5.5 };
    const direct = distance(from, to);
    // Measured on a 2-metre grid, so it rounds up a little; it must not round up much.
    expect(pavedDistance(from, to)).toBeLessThan(direct * 1.05);
    expect(pavedDistance(from, to)).toBeGreaterThanOrEqual(direct);
  });

  it('is the same walk in either direction', () => {
    expect(pavedDistance(metro, cafe)).toBeCloseTo(pavedDistance(cafe, metro), 6);
  });

  it('joins a point on the grass to the paving instead of giving up', () => {
    const onGrass = { x: 25, y: 15 };
    expect(Number.isFinite(pavedDistance(onGrass, cafe))).toBe(true);
  });
});

describe('nearestPavedCell', () => {
  it('keeps a point that is already on the paving', () => {
    const index = nearestPavedCell({ x: 50, y: 30 });
    expect(index).toBeGreaterThanOrEqual(0);
  });

  it('finds the paving from the middle of the grass', () => {
    expect(nearestPavedCell({ x: 25, y: 15 })).toBeGreaterThanOrEqual(0);
  });
});

describe('rasterize', () => {
  it('counts a journey once per cell, however many times it is sampled', () => {
    const { counts, max } = rasterize([{ from: { x: 1, y: 1 }, to: { x: 1, y: 1.5 } }]);
    expect(max).toBe(1);
    expect([...counts].filter((count) => count > 0)).toHaveLength(1);
  });

  it('stacks separate journeys along the same line', () => {
    const { max } = rasterize([shortcut, { ...shortcut, id: 'b' }, { ...shortcut, id: 'c' }]);
    expect(max).toBe(3);
  });

  it('is empty with nothing drawn', () => {
    expect(rasterize([]).max).toBe(0);
  });
});

describe('suggestPaving', () => {
  it('suggests nothing until enough people have walked the same way', () => {
    expect(suggestPaving([shortcut], { minJourneys: 3 })).toEqual([]);
  });

  it('picks up the corridor once they have', () => {
    const lines = [shortcut, { ...shortcut, id: 'b' }, { ...shortcut, id: 'c' }];
    const suggestions = suggestPaving(lines, { minJourneys: 3 });

    expect(suggestions.length).toBeGreaterThan(5);
    expect(suggestions[0].journeys).toBe(3);
  });

  it('never suggests paving what is already paved', () => {
    const alongTheCross = { from: { x: 10, y: 30 }, to: { x: 90, y: 30 } };
    const lines = [alongTheCross, { ...alongTheCross }, { ...alongTheCross }, { ...alongTheCross }];

    expect(suggestPaving(lines, { minJourneys: 2 })).toEqual([]);
  });

  it('puts the busiest corridor first', () => {
    const lines = [
      shortcut, { ...shortcut }, { ...shortcut }, { ...shortcut },
      { from: metro, to: cafe }, { from: metro, to: cafe }, { from: metro, to: cafe },
    ];
    const suggestions = suggestPaving(lines, { minJourneys: 3 });

    expect(suggestions[0].journeys).toBeGreaterThanOrEqual(suggestions.at(-1).journeys);
  });

  it('has nothing to say about an empty plaza', () => {
    expect(suggestPaving([])).toEqual([]);
  });
});

describe('journeyStats', () => {
  it('reports zeroes before anyone has walked', () => {
    expect(journeyStats([])).toMatchObject({ count: 0, cutting: 0, metresSaved: 0 });
  });

  it('counts the walk along the paving as staying on it, and as saving nothing', () => {
    const stats = journeyStats([{ from: { x: 10, y: 5.5 }, to: { x: 80, y: 5.5 } }]);
    expect(stats.cutting).toBe(0);
    expect(stats.cuttingShare).toBe(0);
    expect(stats.metresSaved).toBe(0);
  });

  it('counts the diagonal as a shortcut, and says what it saves', () => {
    const stats = journeyStats([shortcut]);
    expect(stats.cutting).toBe(1);
    expect(stats.metresSaved).toBeGreaterThan(20);
    expect(stats.averageSaved).toBe(stats.metresSaved);
  });

  it('averages over every journey, not only the ones that cut', () => {
    const stats = journeyStats([shortcut, { from: { x: 10, y: 5.5 }, to: { x: 80, y: 5.5 } }]);
    expect(stats.count).toBe(2);
    expect(stats.cuttingShare).toBe(0.5);
    expect(stats.averageSaved).toBeLessThan(stats.longestSaved);
  });
});

describe('neighbourJourneys', () => {
  it('makes as many journeys as asked for', () => {
    expect(neighbourJourneys(10)).toHaveLength(10);
  });

  it('gives the same neighbours every run, for the same seed', () => {
    expect(neighbourJourneys(6, 42)).toEqual(neighbourJourneys(6, 42));
  });

  it('gives different ones for a different seed', () => {
    expect(neighbourJourneys(6, 42)).not.toEqual(neighbourJourneys(6, 43));
  });

  it('never walks from a place to itself', () => {
    for (const line of neighbourJourneys(30, 7)) {
      expect(distance(line.from, line.to)).toBeGreaterThan(0);
    }
  });

  it('keeps everybody inside the plaza', () => {
    for (const line of neighbourJourneys(30, 9)) {
      for (const point of [line.from, line.to]) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(PLAZA.width);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(PLAZA.height);
      }
    }
  });
});
