import { describe, it, expect } from 'vite-plus/test';
import { cellAt, cellCentre, distanceField } from '../gridPath';

const OPEN = { cols: 5, rows: 5, passable: () => true };

describe('distanceField', () => {
  it('counts one step per cell along a row', () => {
    const dist = distanceField({ ...OPEN, sources: [0] });
    expect(dist[0]).toBe(0);
    expect(dist[1]).toBe(1);
    expect(dist[4]).toBe(4);
  });

  it('costs a diagonal step at root two', () => {
    const dist = distanceField({ ...OPEN, sources: [0] });
    expect(dist[6]).toBeCloseTo(Math.SQRT2, 10);
  });

  it('can be held to the four cardinal directions', () => {
    const dist = distanceField({ ...OPEN, sources: [0], diagonal: false });
    expect(dist[6]).toBe(2);
  });

  it('takes the nearest of several starting points', () => {
    const dist = distanceField({ ...OPEN, sources: [0, 4] });
    expect(dist[3]).toBe(1);
  });

  it('returns nothing but Infinity when there is nowhere to start', () => {
    const dist = distanceField({ ...OPEN, sources: [] });
    expect([...dist].every((value) => value === Infinity)).toBe(true);
  });

  it('ignores a starting point that is inside a wall', () => {
    const dist = distanceField({ cols: 3, rows: 1, passable: (i) => i !== 1, sources: [1] });
    expect(dist[0]).toBe(Infinity);
  });

  it('walks around a wall rather than through it', () => {
    // A wall down the middle column, open at the bottom row only.
    const wall = new Set([1, 4, 7]);
    const dist = distanceField({
      cols: 3,
      rows: 4,
      passable: (index) => !wall.has(index),
      sources: [0],
    });

    // Straight across would be one step; the way round is much longer.
    expect(dist[2]).toBeGreaterThan(3);
    expect(Number.isFinite(dist[2])).toBe(true);
  });

  it('leaves a walled-off cell unreachable', () => {
    const wall = new Set([1, 4, 7, 10]);
    const dist = distanceField({
      cols: 3,
      rows: 4,
      passable: (index) => !wall.has(index),
      sources: [0],
    });
    expect(dist[2]).toBe(Infinity);
  });

  it('does not squeeze diagonally between two blocked corners', () => {
    // Blocked: the cell right of the start and the cell below it. The diagonal
    // between them must not count as a step.
    const wall = new Set([1, 3]);
    const dist = distanceField({
      cols: 3,
      rows: 3,
      passable: (index) => !wall.has(index),
      sources: [0],
    });
    expect(dist[4]).toBe(Infinity);
  });
});

describe('cellAt', () => {
  it('finds the cell a point falls in', () => {
    expect(cellAt({ cols: 4, rows: 4 }, 250, 150, 100)).toBe(6);
  });

  it('clamps a point outside the grid to its edge', () => {
    expect(cellAt({ cols: 4, rows: 4 }, -50, 9999, 100)).toBe(12);
  });
});

describe('cellCentre', () => {
  it('sits half a cell in from the corner', () => {
    expect(cellCentre({ cols: 4 }, 0, 100)).toEqual({ x: 50, y: 50 });
    expect(cellCentre({ cols: 4 }, 5, 100)).toEqual({ x: 150, y: 150 });
  });
});
