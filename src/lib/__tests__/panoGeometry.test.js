import { describe, it, expect } from 'vite-plus/test';
import {
  clipSegmentToRect,
  focalFor,
  planTiles,
  projectTilePoint,
  projectTileSegment,
  roadBandCentreDeg,
  verticalFov,
} from '../panoGeometry';

const WIDE = { width: 640, height: 448, fov: 90 };

describe('focalFor', () => {
  it('gives a focal length where the half-width subtends half the FOV', () => {
    // At fov 90 the half-angle is 45 deg, so f equals the half-width.
    expect(focalFor(640, 90)).toBeCloseTo(320, 6);
  });

  it('grows as the field of view narrows', () => {
    expect(focalFor(640, 30)).toBeGreaterThan(focalFor(640, 90));
  });
});

describe('verticalFov', () => {
  it('equals the horizontal FOV for a square image', () => {
    expect(verticalFov(640, 640, 45)).toBeCloseTo(45, 6);
  });

  it('is smaller than the horizontal FOV for a landscape image', () => {
    expect(verticalFov(640, 448, 90)).toBeCloseTo(69.99, 1);
  });

  it('shrinks with the horizontal FOV — the reason tiles must stay square', () => {
    // A 640x448 tile at fov 30 sees only ~21 deg vertically, which would miss
    // most of the road band.
    expect(verticalFov(640, 448, 30)).toBeLessThan(22);
    expect(verticalFov(640, 640, 50)).toBeCloseTo(50, 6);
  });
});

describe('projectTilePoint', () => {
  const tile = { width: 640, height: 640, fov: 50, headingOffset: 0, pitchOffset: 0 };

  it('maps a centred tile pixel to the wide centre when there is no offset', () => {
    const p = projectTilePoint({ x: 320, y: 320 }, tile, WIDE);
    expect(p.x).toBeCloseTo(320, 6);
    expect(p.y).toBeCloseTo(224, 6);
  });

  it('maps the tile centre to the angle the tile is aimed at', () => {
    const aimed = { ...tile, headingOffset: 22.5 };
    const p = projectTilePoint({ x: 320, y: 320 }, aimed, WIDE);
    // Expected: cx + f_wide * tan(22.5 deg).
    expect(p.x).toBeCloseTo(320 + focalFor(640, 90) * Math.tan((22.5 * Math.PI) / 180), 4);
    expect(p.y).toBeCloseTo(224, 6);
  });

  it('treats positive pitch as upward, matching Street View', () => {
    const up = projectTilePoint({ x: 320, y: 320 }, { ...tile, pitchOffset: 10 }, WIDE);
    const down = projectTilePoint({ x: 320, y: 320 }, { ...tile, pitchOffset: -10 }, WIDE);
    // Image y grows downward, so aiming up must yield a smaller y.
    expect(up.y).toBeLessThan(224);
    expect(down.y).toBeGreaterThan(224);
    expect(up.y).toBeCloseTo(224 - focalFor(640, 90) * Math.tan((10 * Math.PI) / 180), 4);
  });

  it('preserves left/right ordering', () => {
    const left = projectTilePoint({ x: 100, y: 320 }, tile, WIDE);
    const right = projectTilePoint({ x: 540, y: 320 }, tile, WIDE);
    expect(left.x).toBeLessThan(right.x);
  });

  it('compresses a narrow tile into a smaller span of the wide frame', () => {
    // A fov-50 tile occupies well under the full width of a fov-90 view.
    const l = projectTilePoint({ x: 0, y: 320 }, tile, WIDE);
    const r = projectTilePoint({ x: 640, y: 320 }, tile, WIDE);
    expect(r.x - l.x).toBeLessThan(640);
    expect(r.x - l.x).toBeGreaterThan(200);
  });

  it('returns null for a ray rotated behind the camera', () => {
    const behind = { ...tile, headingOffset: 179 };
    expect(projectTilePoint({ x: 320, y: 320 }, behind, WIDE)).toBeNull();
  });

  it('round-trips consistently: two tiles agree on a shared direction', () => {
    // The same world direction seen by two differently-aimed tiles must land on
    // the same wide-frame pixel. This is what makes seam features merge rather
    // than duplicate at an offset.
    const f = focalFor(640, 50);
    const angle = 5 * (Math.PI / 180);
    // A ray 5 deg right of centre, expressed in each tile's own pixels.
    const inA = { x: 320 + f * Math.tan(angle), y: 320 };
    const tileA = { ...tile, headingOffset: 0 };
    const tileB = { ...tile, headingOffset: 5 };
    const inB = { x: 320, y: 320 };

    const pa = projectTilePoint(inA, tileA, WIDE);
    const pb = projectTilePoint(inB, tileB, WIDE);
    expect(pa.x).toBeCloseTo(pb.x, 4);
    expect(pa.y).toBeCloseTo(pb.y, 4);
  });
});

describe('planTiles', () => {
  it('produces the requested number of tiles', () => {
    expect(planTiles({ tiles: 2 })).toHaveLength(2);
    expect(planTiles({ tiles: 3 })).toHaveLength(3);
  });

  it('centres the row on the wide view', () => {
    const plan = planTiles({ fov: 90, tiles: 2, overlapDeg: 0 });
    expect(plan[0].headingOffset).toBeCloseTo(-22.5, 6);
    expect(plan[1].headingOffset).toBeCloseTo(22.5, 6);
    // Symmetric about zero.
    const sum = plan.reduce((a, t) => a + t.headingOffset, 0);
    expect(sum).toBeCloseTo(0, 6);
  });

  it('overlaps adjacent tiles so seam features appear in both', () => {
    const plan = planTiles({ fov: 90, tiles: 2, overlapDeg: 6 });
    const [a, b] = plan;
    const aRight = a.headingOffset + a.fov / 2;
    const bLeft = b.headingOffset - b.fov / 2;
    expect(aRight).toBeGreaterThan(bLeft);
    expect(aRight - bLeft).toBeCloseTo(6, 6);
  });

  it('covers at least the full wide FOV', () => {
    const plan = planTiles({ fov: 90, tiles: 2, overlapDeg: 6 });
    const left = Math.min(...plan.map((t) => t.headingOffset - t.fov / 2));
    const right = Math.max(...plan.map((t) => t.headingOffset + t.fov / 2));
    expect(left).toBeLessThanOrEqual(-45);
    expect(right).toBeGreaterThanOrEqual(45);
  });

  it('uses square tiles, keeping the vertical FOV as large as the cap allows', () => {
    for (const t of planTiles({ tiles: 2 })) {
      expect(t.width).toBe(t.height);
      expect(t.width).toBeLessThanOrEqual(640);
    }
  });

  it('gives the default plan enough vertical reach for the road band', () => {
    // The wide shot's road region spans 40.6 deg; each tile must cover it.
    for (const t of planTiles({ tiles: 2 })) {
      expect(verticalFov(t.width, t.height, t.fov)).toBeGreaterThan(40.6);
    }
  });

  it('aims below centre by default, at road rather than sky', () => {
    expect(planTiles()[0].pitchOffset).toBeLessThan(0);
  });

  it('never exceeds the API maximum FOV of 120', () => {
    for (const t of planTiles({ fov: 120, tiles: 1, overlapDeg: 30 })) {
      expect(t.fov).toBeLessThanOrEqual(120);
    }
  });

  it('improves angular resolution over a single wide shot', () => {
    const plan = planTiles({ fov: 90, tiles: 2 });
    const widePpd = 640 / 90;
    for (const t of plan) {
      expect(t.width / t.fov).toBeGreaterThan(widePpd);
    }
  });
});

describe('roadBandCentreDeg', () => {
  it('sits below the optical centre', () => {
    expect(roadBandCentreDeg(WIDE, 0.42)).toBeLessThan(0);
  });

  it('adapts to the wide view FOV, rather than being a fixed offset', () => {
    // A fixed -10 deg suits a 90 deg capture but aims a 45 deg one below its own
    // frame; the derived value scales with the view.
    const at90 = roadBandCentreDeg({ width: 640, height: 448, fov: 90 }, 0.42);
    const at45 = roadBandCentreDeg({ width: 640, height: 448, fov: 45 }, 0.42);
    expect(Math.abs(at45)).toBeLessThan(Math.abs(at90));
  });

  it('stays inside the wide view vertical range', () => {
    for (const fov of [30, 45, 90, 120]) {
      const wide = { width: 640, height: 448, fov };
      const half = verticalFov(640, 448, fov) / 2;
      expect(roadBandCentreDeg(wide, 0.42)).toBeGreaterThan(-half);
      expect(roadBandCentreDeg(wide, 0.42)).toBeLessThan(half);
    }
  });

  it('moves down as more of the top is treated as sky', () => {
    expect(roadBandCentreDeg(WIDE, 0.6)).toBeLessThan(roadBandCentreDeg(WIDE, 0.2));
  });
});

describe('clipSegmentToRect', () => {
  it('leaves a fully inside segment unchanged', () => {
    expect(clipSegmentToRect([10, 10, 100, 100], 640, 448)).toEqual([10, 10, 100, 100]);
  });

  it('trims a segment that runs off the bottom edge', () => {
    const clipped = clipSegmentToRect([100, 400, 100, 800], 640, 448);
    expect(clipped[1]).toBe(400);
    expect(clipped[3]).toBe(448);
  });

  it('trims a segment that starts outside and ends inside', () => {
    const clipped = clipSegmentToRect([-100, 200, 300, 200], 640, 448);
    expect(clipped).toEqual([0, 200, 300, 200]);
  });

  it('returns null for a segment wholly outside', () => {
    expect(clipSegmentToRect([700, 500, 900, 600], 640, 448)).toBeNull();
    expect(clipSegmentToRect([-50, -50, -10, -10], 640, 448)).toBeNull();
  });

  it('preserves the direction of a clipped diagonal', () => {
    const clipped = clipSegmentToRect([-100, -100, 500, 500], 640, 448);
    // Still on the same line y = x.
    expect(clipped[0]).toBeCloseTo(clipped[1], 0);
    expect(clipped[2]).toBeCloseTo(clipped[3], 0);
    expect(clipped[3]).toBeLessThanOrEqual(448);
  });

  it('handles a degenerate zero-length segment inside the rect', () => {
    expect(clipSegmentToRect([10, 10, 10, 10], 640, 448)).toEqual([10, 10, 10, 10]);
  });

  it('rejects a zero-length segment outside the rect', () => {
    expect(clipSegmentToRect([700, 10, 700, 10], 640, 448)).toBeNull();
  });
});

describe('projectTileSegment', () => {
  const tile = { width: 640, height: 640, fov: 50, headingOffset: 0, pitchOffset: 0 };

  it('maps both endpoints of a segment', () => {
    const mapped = projectTileSegment([320, 320, 320, 320], tile, WIDE);
    expect(mapped).toHaveLength(4);
    expect(mapped[0]).toBeCloseTo(320, 6);
    expect(mapped[1]).toBeCloseTo(224, 6);
  });

  it('maps a multi-point polygon', () => {
    const mapped = projectTileSegment([320, 320, 340, 320, 340, 340], tile, WIDE);
    expect(mapped).toHaveLength(6);
  });

  it('returns null if any endpoint is unrepresentable', () => {
    const behind = { ...tile, headingOffset: 179 };
    expect(projectTileSegment([320, 320, 340, 340], behind, WIDE)).toBeNull();
  });
});
