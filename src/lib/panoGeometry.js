// Camera geometry for mapping between Street View tiles and the wide capture.
//
// Detection accuracy is capped by input resolution, and the Street View Static
// API caps each image at 640px per side. That cap is per *request*, not per
// scene: several narrow-FOV tiles cover the same view at higher angular
// resolution than one wide shot.
//
//   640x448 @ fov 90  ->  7.1 px/deg horizontal, 6.4 px/deg vertical
//   640x640 @ fov 50  -> 12.8 px/deg horizontal, 12.8 px/deg vertical
//
// Narrowing the FOV shrinks the vertical field of view too (a 640x448 tile at
// fov 30 sees only 21 deg vertically, against 70 deg for the wide shot), so
// tiles must be square and not too narrow or they miss the road entirely. The
// road region of the wide shot spans 40.6 deg, which one row of fov-50 square
// tiles covers with margin.
//
// Rather than stitching tiles into one image — which needs resampling and blurs
// exactly the edges being detected — detection runs on each tile natively and
// only the resulting segment endpoints are projected back into the wide frame.

const DEG = Math.PI / 180;

// Pinhole focal length in pixels for a given image width and horizontal FOV.
export function focalFor(widthPx, fovDeg) {
  return widthPx / 2 / Math.tan((fovDeg * DEG) / 2);
}

// Vertical FOV implied by an image's aspect ratio and horizontal FOV.
export function verticalFov(widthPx, heightPx, fovDeg) {
  return (2 * Math.atan(Math.tan((fovDeg * DEG) / 2) * (heightPx / widthPx))) / DEG;
}

/**
 * Project a pixel from a tile into the wide capture's pixel frame.
 *
 * Both are rectilinear (pinhole) views from the same optical centre, differing
 * only in orientation, so the mapping is a rotation of the view ray followed by
 * re-projection — exact, with no resampling.
 *
 * @param point {x, y} in tile pixels
 * @param tile  {width, height, fov, headingOffset, pitchOffset} — offsets in
 *              degrees relative to the wide view: heading positive to the
 *              right, pitch positive upward (matching Street View's own sense).
 * @param wide  {width, height, fov}
 * @returns {x, y} in wide pixels, or null if the ray falls behind the camera
 */
export function projectTilePoint(point, tile, wide) {
  const ft = focalFor(tile.width, tile.fov);
  const fw = focalFor(wide.width, wide.fov);

  // View ray in the tile's own frame, looking down +Z.
  const rx = point.x - tile.width / 2;
  const ry = point.y - tile.height / 2;
  const rz = ft;

  // Tilt up by pitchOffset. Negated because image y grows downward, so aiming
  // the tile higher must move its content toward smaller y in the wide frame.
  const p = -(tile.pitchOffset || 0) * DEG;
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const y1 = ry * cp + rz * sp;
  const z1 = -ry * sp + rz * cp;

  // Then pan right by headingOffset.
  const h = (tile.headingOffset || 0) * DEG;
  const ch = Math.cos(h);
  const sh = Math.sin(h);
  const x2 = rx * ch + z1 * sh;
  const z2 = -rx * sh + z1 * ch;

  // Behind the camera, or exactly in its plane: not representable.
  if (z2 <= 1e-6) return null;

  return {
    x: wide.width / 2 + (fw * x2) / z2,
    y: wide.height / 2 + (fw * y1) / z2,
  };
}

/**
 * Inverse of projectTilePoint: map a wide-frame pixel back into a tile's pixels.
 *
 * Stitching tiles into one image needs this direction. Forward projection tells
 * you where a tile pixel lands, which leaves the output full of holes; going
 * backwards from each output pixel to its source is what fills every one.
 *
 * @returns {x, y} in tile pixels — possibly outside the tile's bounds, which the
 *          caller checks — or null if the direction falls behind the tile.
 */
export function unprojectWidePoint(point, tile, wide) {
  const ft = focalFor(tile.width, tile.fov);
  const fw = focalFor(wide.width, wide.fov);

  // View ray in the wide frame. Any positive multiple describes the same ray, so
  // these components can go straight into the rotations below unnormalised.
  const x2 = point.x - wide.width / 2;
  const y1 = point.y - wide.height / 2;
  const z2 = fw;

  // Undo the pan. Both steps are the transpose of the corresponding rotation in
  // projectTilePoint, applied in the opposite order. Note y1 survives the pan
  // untouched, exactly as the forward direction leaves it alone.
  const h = (tile.headingOffset || 0) * DEG;
  const ch = Math.cos(h);
  const sh = Math.sin(h);
  const rx = x2 * ch - z2 * sh;
  const z1 = x2 * sh + z2 * ch;

  // Undo the tilt.
  const p = -(tile.pitchOffset || 0) * DEG;
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const ry = y1 * cp - z1 * sp;
  const rz = y1 * sp + z1 * cp;

  // Behind the tile's camera, or exactly in its plane: not representable.
  if (rz <= 1e-6) return null;

  return {
    x: tile.width / 2 + (ft * rx) / rz,
    y: tile.height / 2 + (ft * ry) / rz,
  };
}

/**
 * Vertical angle, relative to a wide view's centre, of the middle of its road
 * region — the part below the skyFraction cut. Aiming tiles here centres them on
 * the road instead of wasting half their pixels on sky or on ground below the
 * wide frame entirely.
 */
export function roadBandCentreDeg(wide, skyFraction) {
  const v = verticalFov(wide.width, wide.height, wide.fov);
  const top = v / 2 - skyFraction * v;
  const bottom = -v / 2;
  return (top + bottom) / 2;
}

/**
 * Clip a two-point segment to a rectangle, Liang-Barsky style.
 *
 * Tiles can see beyond the wide view's edges, and those detections are real but
 * have nowhere to be drawn — the canvas only shows the wide image. Clipping
 * keeps the visible part of such a line instead of discarding it whole (which
 * loses a real road edge) or clamping its endpoint (which bends the line).
 *
 * @returns clipped [x1,y1,x2,y2], or null if wholly outside
 */
export function clipSegmentToRect(points, width, height) {
  let [x1, y1, x2, y2] = points;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  // Each edge gives an inequality p*t <= q; narrow [t0,t1] to satisfy all four.
  const edges = [
    [-dx, x1 - 0],
    [dx, width - x1],
    [-dy, y1 - 0],
    [dy, height - y1],
  ];

  for (const [p, q] of edges) {
    if (p === 0) {
      // Parallel to this edge and starting outside it: nothing survives.
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }

  return [
    Math.round(x1 + t0 * dx),
    Math.round(y1 + t0 * dy),
    Math.round(x1 + t1 * dx),
    Math.round(y1 + t1 * dy),
  ];
}

/**
 * Plan a row of tiles covering a wide view's horizontal FOV.
 *
 * @param options.fov         wide view's horizontal FOV
 * @param options.tiles       how many tiles across
 * @param options.overlapDeg  extra FOV per tile so features on a seam appear in
 *                            both tiles; the merger then dedupes them
 * @param options.pitchOffset degrees to aim the row below the wide centre. Omit
 *                            to centre it on the road band, which adapts to the
 *                            wide view's own FOV — a fixed offset that suits a
 *                            90 deg capture aims a 45 deg one below its frame.
 * @param options.wide        {width, height, fov} of the wide view, with
 *                            skyFraction, used only to derive pitchOffset
 * @param options.size        per-tile pixel size (square, to keep the vertical
 *                            FOV as large as the cap allows)
 */
export function planTiles({
  fov = 90,
  tiles = 2,
  overlapDeg = 6,
  pitchOffset,
  wide,
  skyFraction = 0.42,
  size = 640,
} = {}) {
  const aim = Number.isFinite(pitchOffset)
    ? pitchOffset
    : roadBandCentreDeg(wide || { width: size, height: Math.round(size * 0.7), fov }, skyFraction);
  const span = fov / tiles;
  const out = [];
  for (let i = 0; i < tiles; i += 1) {
    // Centre of this tile's slice, measured from the wide view's centre.
    const headingOffset = -fov / 2 + span * (i + 0.5);
    out.push({
      width: size,
      height: size,
      fov: Math.min(120, span + overlapDeg),
      headingOffset,
      pitchOffset: aim,
    });
  }
  return out;
}

/**
 * Plan a grid of tiles covering a wide view's *whole* frame.
 *
 * planTiles above covers only the road band, because that is all detection
 * looks at. A background has to cover everything the user can see, sky
 * included, so this walks both axes.
 *
 * @param options.fov        wide view's horizontal FOV
 * @param options.cols       tiles across
 * @param options.rows       tiles down
 * @param options.overlapDeg extra FOV per tile, so the seams sit inside both
 *                           neighbours rather than exactly on their edges
 * @param options.wide       {width, height, fov} of the wide view, for the
 *                           aspect ratio that sets its vertical FOV
 * @param options.size       per-tile pixel size (square, to keep the vertical
 *                           FOV as large as the 640px cap allows)
 */
export function planGridTiles({
  fov = 90,
  cols = 2,
  rows = 2,
  overlapDeg = 6,
  wide,
  size = 640,
} = {}) {
  const frame = wide || { width: size, height: Math.round(size * 0.7), fov };
  const vFov = verticalFov(frame.width, frame.height, fov);
  const hSpan = fov / cols;
  const vSpan = vFov / rows;
  // Square tiles have one FOV serving both axes, so it must cover the wider of
  // the two spans. Sizing to the narrower one would leave gaps along the other.
  const tileFov = Math.min(120, Math.max(hSpan, vSpan) + overlapDeg);

  const out = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      out.push({
        width: size,
        height: size,
        fov: tileFov,
        headingOffset: -fov / 2 + hSpan * (col + 0.5),
        // Row 0 is the top of the frame, and pitch grows upward.
        pitchOffset: vFov / 2 - vSpan * (row + 0.5),
      });
    }
  }
  return out;
}

/**
 * How much finer a plan resolves the scene than the single wide capture, as a
 * ratio of pixels per degree.
 *
 * Worth checking before paying for the extra requests: the gain comes from
 * spending a whole 640px tile on a slice of the view, so it shrinks as the wide
 * FOV narrows, and below roughly fov 25 (at two columns) a tile is no finer than
 * the wide shot it would replace.
 */
export function tilingGain(plan, wide) {
  if (!plan || plan.length === 0) return 1;
  const tile = plan[0];
  return tile.width / tile.fov / (wide.width / wide.fov);
}

/**
 * Map a detected segment's endpoints from tile pixels into wide pixels.
 * Returns null when either endpoint is not representable in the wide view.
 */
export function projectTileSegment(points, tile, wide) {
  const mapped = [];
  for (let i = 0; i < points.length; i += 2) {
    const p = projectTilePoint({ x: points[i], y: points[i + 1] }, tile, wide);
    if (!p) return null;
    mapped.push(p.x, p.y);
  }
  return mapped;
}
