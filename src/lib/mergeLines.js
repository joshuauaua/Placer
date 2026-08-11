// Collapse fragmented, duplicated line segments into single longer lines.
//
// HoughLinesP reports one physical edge as several overlapping segments: on a
// real Malmö capture, 27 structural segments corresponded to only 13 distinct
// edges — 52% were near-duplicates — and the tram rail crossing the whole frame
// came back as ~136px pieces on a 1000px stage.
//
// Deliberately dependency-free (a weighted principal-axis fit rather than
// cv.fitLine) so it runs without OpenCV loaded. That keeps it testable in
// isolation and usable on hand-drawn lines, not just detected ones.

export const MERGE_DEFAULTS = {
  // Maximum angle between two segments for them to describe the same edge.
  angleToleranceDeg: 6,
  // Maximum sideways separation, measured perpendicular to the shared
  // direction. This is what keeps two parallel kerbs from becoming one line.
  offsetTolerance: 14,
  // Maximum gap along the shared direction to bridge. Fragments of one edge sit
  // within this; genuinely separate features further apart stay separate.
  gapTolerance: 40,
  // Merging changes the fitted angle, which can make a further merge valid, so
  // passes repeat until stable. Bounded to stop a gentle curve from chaining
  // itself into one long straight line.
  maxPasses: 8,
};

// Segment orientation as a bare direction in [0, 180) — a segment and its
// reverse describe the same edge, so 179° and 1° are 2° apart, not 178°.
function geometry([x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180;
  return { dx, dy, length, angle, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
}

export function angleDelta(a, b) {
  const raw = Math.abs(a - b) % 180;
  return Math.min(raw, 180 - raw);
}

// Unit vector for an angle in [0, 180).
function unitFor(angle) {
  const rad = (angle * Math.PI) / 180;
  return { ux: Math.cos(rad), uy: Math.sin(rad) };
}

// Interval covered by a segment when projected onto a direction.
function projectInterval([x1, y1, x2, y2], ux, uy) {
  const t1 = x1 * ux + y1 * uy;
  const t2 = x2 * ux + y2 * uy;
  return t1 <= t2 ? [t1, t2] : [t2, t1];
}

function intervalGap([a0, a1], [b0, b1]) {
  return Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));
}

// Do two segments describe the same physical edge?
export function isSameEdge(a, b, cfg = MERGE_DEFAULTS) {
  const ga = geometry(a);
  const gb = geometry(b);

  if (angleDelta(ga.angle, gb.angle) > cfg.angleToleranceDeg) return false;

  // Average direction, and the normal to it. Sideways separation is measured
  // between midpoints: comparing endpoint distances instead would reject long
  // segments outright, since the angle tolerance alone lets their ends diverge
  // further than the offset tolerance allows.
  const mean = (ga.angle + gb.angle) / 2;
  const { ux, uy } = unitFor(mean);
  const sideways = Math.abs((gb.midX - ga.midX) * -uy + (gb.midY - ga.midY) * ux);
  if (sideways > cfg.offsetTolerance) return false;

  const gap = intervalGap(projectInterval(a, ux, uy), projectInterval(b, ux, uy));
  return gap <= cfg.gapTolerance;
}

// Fit one segment through a group, weighting each contributor by its length so a
// long confident edge outweighs a short fragment.
export function fitThroughSegments(segments) {
  const points = [];
  let totalWeight = 0;
  for (const seg of segments) {
    const weight = Math.max(geometry(seg).length, 1e-6);
    points.push({ x: seg[0], y: seg[1], w: weight }, { x: seg[2], y: seg[3], w: weight });
    totalWeight += weight * 2;
  }

  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x * p.w;
    cy += p.y * p.w;
  }
  cx /= totalWeight;
  cy /= totalWeight;

  // Weighted covariance; its principal axis is the total-least-squares
  // direction through the point cloud.
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    const px = p.x - cx;
    const py = p.y - cy;
    sxx += p.w * px * px;
    sxy += p.w * px * py;
    syy += p.w * py * py;
  }

  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  // Extend the fitted line to cover every contributing endpoint.
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const p of points) {
    const t = (p.x - cx) * ux + (p.y - cy) * uy;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }

  return [
    Math.round(cx + ux * tMin),
    Math.round(cy + uy * tMin),
    Math.round(cx + ux * tMax),
    Math.round(cy + uy * tMax),
  ];
}

// One merge pass over a single class. Returns the merged segments plus how many
// merges happened, so the caller can iterate to a fixed point.
function mergePass(segments, cfg) {
  // Longest first, so short fragments attach to confident edges rather than
  // seeding groups of their own.
  const ordered = [...segments].sort((a, b) => geometry(b).length - geometry(a).length);
  const groups = [];

  for (const seg of ordered) {
    const target = groups.find((group) => isSameEdge(group.fitted, seg, cfg));
    if (target) {
      target.members.push(seg);
      target.fitted = fitThroughSegments(target.members);
    } else {
      groups.push({ members: [seg], fitted: seg });
    }
  }

  return {
    segments: groups.map((g) => (g.members.length === 1 ? g.members[0] : g.fitted)),
    merged: segments.length - groups.length,
  };
}

/**
 * Merge collinear duplicates and fragments among line objects.
 *
 * Only open segments merge, and only within their own class: closed polygons
 * (imported vegetation contours) pass through untouched, and a road edge never
 * absorbs a kerb even when the two happen to be near-collinear.
 *
 * @param lines array of { id, cls, points, closed }
 * @returns { lines, stats: { before, after, merged } }
 */
export function mergeLines(lines, options = {}) {
  const cfg = { ...MERGE_DEFAULTS, ...options };

  const passthrough = [];
  const byClass = new Map();
  for (const line of lines) {
    if (line.closed || line.points.length !== 4) {
      passthrough.push(line);
      continue;
    }
    if (!byClass.has(line.cls)) byClass.set(line.cls, []);
    byClass.get(line.cls).push(line);
  }

  const merged = [];
  for (const [cls, group] of byClass) {
    let segments = group.map((l) => l.points);

    for (let pass = 0; pass < cfg.maxPasses; pass += 1) {
      const result = mergePass(segments, cfg);
      segments = result.segments;
      if (result.merged === 0) break;
    }

    // Reuse the original ids where the count allows, so selection survives a
    // merge where nothing actually combined.
    segments.forEach((points, i) => {
      merged.push({
        id: group[i]?.id ?? `${cls}-merged-${i}`,
        cls,
        points,
        closed: false,
      });
    });
  }

  const out = [...merged, ...passthrough];
  return {
    lines: out,
    stats: {
      before: lines.length,
      after: out.length,
      merged: lines.length - out.length,
    },
  };
}

export default mergeLines;
