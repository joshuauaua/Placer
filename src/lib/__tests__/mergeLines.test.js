import { describe, it, expect } from 'vite-plus/test';
import {
  MERGE_DEFAULTS,
  angleDelta,
  fitThroughSegments,
  isSameEdge,
  mergeLines,
} from '../mergeLines';

const line = (id, cls, points, closed = false) => ({ id, cls, points, closed });

describe('angleDelta', () => {
  it('measures the smaller of the two arcs', () => {
    expect(angleDelta(10, 20)).toBe(10);
    expect(angleDelta(20, 10)).toBe(10);
  });

  it('treats a segment and its reverse as the same orientation', () => {
    // 179 deg and 1 deg describe near-identical edges, 2 deg apart, not 178.
    expect(angleDelta(179, 1)).toBe(2);
    expect(angleDelta(0, 180)).toBe(0);
  });
});

describe('isSameEdge', () => {
  it('accepts two collinear fragments of one edge', () => {
    expect(isSameEdge([0, 0, 100, 0], [110, 0, 200, 0])).toBe(true);
  });

  it('accepts overlapping near-duplicates', () => {
    expect(isSameEdge([0, 0, 200, 0], [20, 2, 180, 3])).toBe(true);
  });

  it('rejects parallel edges that are far apart sideways', () => {
    // Two kerbs on opposite sides of a road must not become one line.
    expect(isSameEdge([0, 0, 200, 0], [0, 90, 200, 90])).toBe(false);
  });

  it('rejects segments at clearly different angles', () => {
    expect(isSameEdge([0, 0, 200, 0], [0, 0, 200, 200])).toBe(false);
  });

  it('rejects collinear segments separated by more than the gap tolerance', () => {
    expect(isSameEdge([0, 0, 100, 0], [400, 0, 500, 0])).toBe(false);
  });

  it('honours a widened gap tolerance', () => {
    const cfg = { ...MERGE_DEFAULTS, gapTolerance: 400 };
    expect(isSameEdge([0, 0, 100, 0], [400, 0, 500, 0], cfg)).toBe(true);
  });

  it('judges separation at the midpoints, not the worst-case endpoint', () => {
    const a = [0, 0, 400, 0];
    const b = [200, 10, 398, 17];

    // Within the angle tolerance, and typical separation (13.5px at the
    // midpoint) is inside the 14px limit — so these are one edge...
    expect(angleDelta(0, (Math.atan2(7, 198) * 180) / Math.PI)).toBeLessThan(6);
    expect(isSameEdge(a, b)).toBe(true);

    // ...even though b's far endpoint sits 17px off a's line, which a
    // worst-case endpoint test would reject. Long segments are allowed to
    // diverge at their tips.
    expect(17).toBeGreaterThan(MERGE_DEFAULTS.offsetTolerance);
  });

  it('still rejects a wedge that diverges far at one end', () => {
    // Shares an origin but ends 35px apart: too much to call one edge, even
    // though the angle alone is within tolerance.
    expect(isSameEdge([0, 0, 400, 0], [0, 0, 398, 35])).toBe(false);
  });
});

describe('fitThroughSegments', () => {
  it('returns a single segment spanning all contributors', () => {
    const fitted = fitThroughSegments([
      [0, 0, 100, 0],
      [110, 0, 200, 0],
    ]);
    expect(fitted[0]).toBeCloseTo(0, 0);
    expect(fitted[2]).toBeCloseTo(200, 0);
    expect(Math.abs(fitted[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(fitted[3])).toBeLessThanOrEqual(1);
  });

  it('produces a line at least as long as the longest contributor', () => {
    const fitted = fitThroughSegments([
      [0, 0, 240, 0],
      [10, 1, 90, 1],
    ]);
    const length = Math.hypot(fitted[2] - fitted[0], fitted[3] - fitted[1]);
    expect(length).toBeGreaterThanOrEqual(240);
  });

  it('weights the fit by segment length, so a long edge dominates', () => {
    // One long horizontal edge plus a short one offset in angle. The result must
    // track the long one.
    const fitted = fitThroughSegments([
      [0, 0, 400, 0],
      [100, 8, 140, 12],
    ]);
    const angle = Math.abs((Math.atan2(fitted[3] - fitted[1], fitted[2] - fitted[0]) * 180) / Math.PI);
    expect(angle).toBeLessThan(3);
  });

  it('handles a vertical group without dividing by zero', () => {
    const fitted = fitThroughSegments([
      [10, 0, 10, 100],
      [11, 110, 11, 200],
    ]);
    expect(Number.isFinite(fitted[0])).toBe(true);
    const length = Math.hypot(fitted[2] - fitted[0], fitted[3] - fitted[1]);
    expect(length).toBeGreaterThan(190);
  });
});

describe('mergeLines', () => {
  it('collapses duplicates of one edge into a single line', () => {
    const { lines, stats } = mergeLines([
      line('a', 'road_edge', [0, 0, 200, 0]),
      line('b', 'road_edge', [10, 2, 190, 3]),
      line('c', 'road_edge', [20, 1, 210, 2]),
    ]);

    expect(lines).toHaveLength(1);
    expect(stats).toEqual({ before: 3, after: 1, merged: 2 });
  });

  it('bridges fragments into one longer line', () => {
    const { lines } = mergeLines([
      line('a', 'road_edge', [0, 0, 100, 0]),
      line('b', 'road_edge', [120, 0, 220, 0]),
      line('c', 'road_edge', [240, 0, 340, 0]),
    ]);

    expect(lines).toHaveLength(1);
    const [x1, , x2] = lines[0].points;
    expect(Math.abs(x2 - x1)).toBeGreaterThan(330);
  });

  it('never merges across classes', () => {
    // Same geometry, different class: a kerb must not be absorbed into a road edge.
    const { lines } = mergeLines([
      line('a', 'road_edge', [0, 0, 200, 0]),
      line('b', 'horizontal', [0, 1, 200, 1]),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.cls).sort()).toEqual(['horizontal', 'road_edge']);
  });

  it('leaves closed vegetation polygons untouched', () => {
    const polygon = line('veg', 'vegetation', [0, 0, 10, 0, 10, 10, 0, 10], true);
    const { lines } = mergeLines([polygon, line('a', 'road_edge', [0, 0, 200, 0])]);

    expect(lines).toContainEqual(polygon);
    expect(lines).toHaveLength(2);
  });

  it('leaves genuinely distinct edges alone', () => {
    const input = [
      line('a', 'road_edge', [0, 0, 200, 0]),
      line('b', 'road_edge', [0, 100, 200, 100]),
      line('c', 'road_edge', [0, 0, 0, 200]),
    ];
    const { lines, stats } = mergeLines(input);

    expect(lines).toHaveLength(3);
    expect(stats.merged).toBe(0);
  });

  it('is idempotent — merging an already-merged set changes nothing', () => {
    const once = mergeLines([
      line('a', 'road_edge', [0, 0, 200, 0]),
      line('b', 'road_edge', [10, 2, 190, 3]),
    ]);
    const twice = mergeLines(once.lines);

    expect(twice.stats.merged).toBe(0);
    expect(twice.lines).toEqual(once.lines);
  });

  it('does not chain a gentle curve into one straight line', () => {
    // Each step turns 5 deg — within tolerance pairwise, but the fitted angle
    // shifts as the group grows, which is what stops runaway chaining.
    const curve = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < 8; i += 1) {
      const rad = (i * 5 * Math.PI) / 180;
      const nx = x + Math.cos(rad) * 60;
      const ny = y + Math.sin(rad) * 60;
      curve.push(line(`c${i}`, 'road_edge', [Math.round(x), Math.round(y), Math.round(nx), Math.round(ny)]));
      x = nx;
      y = ny;
    }
    const { lines } = mergeLines(curve);

    // Must not become a single line, and must still simplify somewhat.
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThan(curve.length);
  });

  it('handles an empty input', () => {
    expect(mergeLines([])).toEqual({ lines: [], stats: { before: 0, after: 0, merged: 0 } });
  });

  it('gives every output line a stable unique id', () => {
    const { lines } = mergeLines([
      line('a', 'road_edge', [0, 0, 200, 0]),
      line('b', 'road_edge', [10, 2, 190, 3]),
      line('c', 'road_edge', [0, 300, 200, 300]),
    ]);
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
