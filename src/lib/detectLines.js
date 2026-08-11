// Browser port of tools/streetview_lines/extract_lines.py.
//
// Runs the same classical-CV pipeline (bilateral -> CLAHE -> Canny ->
// HoughLinesP, plus HSV masks for paint and vegetation) against a captured
// street view, and returns lines in the app's own data model rather than a PNG.
//
// Three things differ from the Python original, deliberately:
//
//  1. Canvas pixels arrive as RGBA, not BGR, so the colour-conversion codes are
//     RGBA2GRAY / RGB2HSV. Using the BGR codes here would swap the red and blue
//     channels and invert every hue-based mask.
//  2. Coordinates are scaled into Konva stage space before returning (see
//     detectLines' stageWidth option) because the stage is larger than the
//     captured image and stretches it to fit.
//  3. The marking pass has an adaptive guard the Python tool lacks. See
//     detectMarkings below for why.

// Explicit extension so this module also resolves under plain Node, which lets
// the pipeline be run against a real image outside the browser.
import { DEFAULT_LINE_CLASS } from './lineClasses.js';
import { mergeLines } from './mergeLines.js';
import {
  clipSegmentToRect,
  focalFor,
  projectTileSegment,
  verticalFov,
} from './panoGeometry.js';

// Adaptive marking guard — not present in the Python tool.
//
// Paint is defined as low-saturation + high-value, but so is sunlit concrete.
// On a real Malmö capture with no painted markings at all, the unguarded pass
// produced 217 segments smeared across the whole road surface.
//
// Painted markings are thin, so they should occupy only a small share of the
// road region. Measured coverage-vs-output on that capture:
//
//   vMin 175 -> 20.6% coverage -> 217 segments   (pavement)
//   vMin 195 ->  5.9%          ->  66 segments   (pavement)
//   vMin 215 ->  1.0%          ->   9 segments
//   vMin 225 ->  0.4%          ->   0 segments
//
// Hence a 2% ceiling: above that the mask is tracking pavement, not paint. The
// pass escalates the brightness floor until coverage falls under the ceiling,
// and gives up rather than blanketing the road. Erring strict is deliberate —
// a missed marking can be drawn by hand, which is the other half of this
// feature; 217 false lines cannot be cleaned up by hand.
export const MARKING_MAX_COVERAGE = 0.02;
const MARKING_V_STEP = 20;
const MARKING_V_CEILING = 245;

// Defaults mirror the module constants in extract_lines.py. The parity test in
// __tests__/detectLines.test.js parses that file and compares, so these cannot
// drift silently.
export const DETECT_DEFAULTS = {
  resizeMaxWidth: 1600,
  bilateralD: 9,
  bilateralSigmaColor: 75,
  bilateralSigmaSpace: 75,
  gaussianKsize: 5,
  useClahe: true,
  claheClip: 2.0,
  cannyLow: 50,
  cannyHigh: 150,
  houghThreshold: 60,
  houghMinLineLength: 60,
  houghMaxLineGap: 12,
  skyFraction: 0.42,
  angleHorizontalMaxDeg: 12,
  angleVerticalMinDeg: 72,
  drawVerticals: true,
  markingDetection: true,
  markingSMax: 60,
  markingVMin: 175,
  // Overridable ceiling for the adaptive guard described above.
  markingMaxCoverage: MARKING_MAX_COVERAGE,
  greenHsvLower: [30, 40, 40],
  greenHsvUpper: [90, 255, 255],
  vegMorphKernel: 7,
  vegMinAreaFrac: 0.0008,
  vegApproxEpsFrac: 0.006,
  // Hough reports one physical edge as several overlapping segments; merging
  // collapses those and bridges fragments into longer lines. Set false to see
  // the raw detector output.
  mergeSegments: true,
  // Horizontal FOV the wide capture was taken at. Only used to project tile
  // detections into the wide frame, so it must match the actual capture.
  wideFov: 90,
};

let opencvPromise = null;

// Cached across calls so the ~4 MB module is fetched and instantiated once.
export function loadOpenCv() {
  if (!opencvPromise) {
    opencvPromise = import('@techstark/opencv-js').then((mod) => {
      // The package is an Emscripten MODULARIZE build: the export is a thenable
      // that resolves to the cv namespace once the runtime is ready. Awaiting it
      // is required — the older cv.onRuntimeInitialized callback is not set on
      // this build and waiting for it hangs forever.
      const candidate = mod?.default ?? mod;
      return Promise.resolve(candidate).then((cv) => cv?.default ?? cv);
    });
  }
  return opencvPromise;
}

// Exposed for tests, which need to reset the module-level cache between cases.
export function _resetOpenCvCache() {
  opencvPromise = null;
}

// Decode an image source (data: URL or plain URL) into ImageData, downscaling to
// resizeMaxWidth the way load_image does.
export async function loadImageData(source, { resizeMaxWidth, createImage } = {}) {
  const makeImage = createImage || (() => new Image());
  const img = makeImage();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Could not decode the captured image'));
    // Harmless for data: URLs, and keeps the canvas untainted for http sources.
    img.crossOrigin = 'anonymous';
    img.src = source;
  });

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const maxWidth = resizeMaxWidth || DETECT_DEFAULTS.resizeMaxWidth;
  const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

// Angle classification, identical to classify_line().
export function classifySegment([x1, y1, x2, y2], cfg) {
  let angle = Math.abs((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI);
  if (angle > 90) angle = 180 - angle;
  if (angle <= cfg.angleHorizontalMaxDeg) return 'horizontal';
  if (angle >= cfg.angleVerticalMinDeg) return 'vertical';
  return 'road_edge';
}

// Read HoughLinesP output into plain [x1,y1,x2,y2] tuples.
//
// The segment count must be derived from rows*cols, not rows alone: this
// OpenCV.js build returns a 1 x N, 4-channel Mat (rows=1, cols=N), whereas the
// C++/Python API returns N x 1. Trusting `rows` yields exactly one segment and
// silently discards the rest.
function readSegments(linesMat) {
  const available = Math.floor((linesMat.data32S?.length ?? 0) / 4);
  const count = Math.min(linesMat.rows * linesMat.cols, available);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * 4;
    out.push([
      linesMat.data32S[base],
      linesMat.data32S[base + 1],
      linesMat.data32S[base + 2],
      linesMat.data32S[base + 3],
    ]);
  }
  return out;
}

// Tracks every Mat so they can be released together — the WASM heap is not
// garbage collected, and a leak here compounds across repeated detections.
function createArena() {
  const mats = [];
  return {
    keep(mat) {
      mats.push(mat);
      return mat;
    },
    releaseAll() {
      for (const mat of mats) {
        try {
          if (mat && !mat.isDeleted?.()) mat.delete();
        } catch {
          // Already released; nothing to do.
        }
      }
      mats.length = 0;
    },
  };
}

function scalarMat(cv, arena, like, values) {
  return arena.keep(new cv.Mat(like.rows, like.cols, like.type(), [...values, 0]));
}

// Grey -> bilateral -> CLAHE -> Gaussian, mirroring preprocess().
function preprocess(cv, arena, rgba, cfg) {
  const grey = arena.keep(new cv.Mat());
  cv.cvtColor(rgba, grey, cv.COLOR_RGBA2GRAY);

  const denoised = arena.keep(new cv.Mat());
  cv.bilateralFilter(
    grey,
    denoised,
    cfg.bilateralD,
    cfg.bilateralSigmaColor,
    cfg.bilateralSigmaSpace,
    cv.BORDER_DEFAULT
  );

  let working = denoised;
  if (cfg.useClahe) {
    const equalized = arena.keep(new cv.Mat());
    // cv.createCLAHE (the Python-side factory) is absent from this build, but
    // the CLAHE class itself is present and behaves identically. Python relies
    // on the default 8x8 tile grid, so state it explicitly here.
    const clahe = new cv.CLAHE(cfg.claheClip, new cv.Size(8, 8));
    try {
      clahe.apply(working, equalized);
      working = equalized;
    } finally {
      clahe.delete();
    }
  }

  const blurred = arena.keep(new cv.Mat());
  const k = cfg.gaussianKsize;
  cv.GaussianBlur(working, blurred, new cv.Size(k, k), 0, 0, cv.BORDER_DEFAULT);
  return blurred;
}

// Zeros above skyFraction * H, 255 below — mirrors road_roi_mask().
function roadRoiMask(cv, arena, width, height, cfg) {
  const roi = arena.keep(cv.Mat.zeros(height, width, cv.CV_8UC1));
  const skyRows = Math.trunc(height * cfg.skyFraction);
  if (skyRows < height) {
    cv.rectangle(
      roi,
      new cv.Point(0, skyRows),
      new cv.Point(width, height),
      new cv.Scalar(255),
      -1
    );
  }
  return { roi, skyRows };
}

function houghOn(cv, arena, binary, cfg, maxLineGap) {
  const linesMat = arena.keep(new cv.Mat());
  cv.HoughLinesP(
    binary,
    linesMat,
    1,
    Math.PI / 180,
    cfg.houghThreshold,
    cfg.houghMinLineLength,
    maxLineGap
  );
  return readSegments(linesMat);
}

function detectStructural(cv, arena, grey, roi, cfg) {
  const edges = arena.keep(new cv.Mat());
  cv.Canny(grey, edges, cfg.cannyLow, cfg.cannyHigh);
  const masked = arena.keep(new cv.Mat());
  cv.bitwise_and(edges, edges, masked, roi);
  return houghOn(cv, arena, masked, cfg, cfg.houghMaxLineGap);
}

// HSV bright-paint mask + Hough, with the adaptive coverage guard.
function detectMarkings(cv, arena, hsv, roi, cfg, roiArea) {
  if (!cfg.markingDetection) {
    return { segments: [], skipped: false, vMinUsed: cfg.markingVMin, coverage: 0 };
  }

  let vMin = cfg.markingVMin;
  let coverage = 1;
  let mask = null;

  while (vMin <= MARKING_V_CEILING) {
    const candidate = arena.keep(new cv.Mat());
    const low = scalarMat(cv, arena, hsv, [0, 0, vMin]);
    const high = scalarMat(cv, arena, hsv, [179, cfg.markingSMax, 255]);
    cv.inRange(hsv, low, high, candidate);

    const confined = arena.keep(new cv.Mat());
    cv.bitwise_and(candidate, candidate, confined, roi);

    coverage = roiArea > 0 ? cv.countNonZero(confined) / roiArea : 0;
    mask = confined;

    if (coverage <= cfg.markingMaxCoverage) break;
    vMin += MARKING_V_STEP;
  }

  // Still saturated at the brightest usable threshold: this frame has bright
  // pavement rather than paint, so report the skip instead of drawing it.
  if (coverage > cfg.markingMaxCoverage) {
    return { segments: [], skipped: true, vMinUsed: vMin, coverage };
  }

  const closed = arena.keep(new cv.Mat());
  const kernel = arena.keep(cv.Mat.ones(3, 3, cv.CV_8U));
  cv.morphologyEx(mask, closed, cv.MORPH_CLOSE, kernel);

  return {
    // Python doubles the gap for the marking pass, to bridge dashes.
    segments: houghOn(cv, arena, closed, cfg, cfg.houghMaxLineGap * 2),
    skipped: false,
    vMinUsed: vMin,
    coverage,
  };
}

// HSV green mask -> morphology -> contours -> approxPolyDP. Runs on the full
// frame, not the road ROI, since canopies sit above the horizon.
function detectVegetation(cv, arena, hsv, cfg, width, height) {
  const mask = arena.keep(new cv.Mat());
  const low = scalarMat(cv, arena, hsv, cfg.greenHsvLower);
  const high = scalarMat(cv, arena, hsv, cfg.greenHsvUpper);
  cv.inRange(hsv, low, high, mask);

  const kSize = cfg.vegMorphKernel;
  const kernel = arena.keep(cv.Mat.ones(kSize, kSize, cv.CV_8U));
  const opened = arena.keep(new cv.Mat());
  cv.morphologyEx(mask, opened, cv.MORPH_OPEN, kernel);
  const shut = arena.keep(new cv.Mat());
  cv.morphologyEx(opened, shut, cv.MORPH_CLOSE, kernel);

  const contours = new cv.MatVector();
  const hierarchy = arena.keep(new cv.Mat());
  const polygons = [];
  try {
    cv.findContours(shut, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const minArea = cfg.vegMinAreaFrac * width * height;

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      try {
        if (cv.contourArea(contour) < minArea) continue;
        const approx = new cv.Mat();
        try {
          const eps = cfg.vegApproxEpsFrac * cv.arcLength(contour, true);
          cv.approxPolyDP(contour, approx, eps, true);
          const points = [];
          for (let p = 0; p < approx.rows; p += 1) {
            points.push(approx.data32S[p * 2], approx.data32S[p * 2 + 1]);
          }
          if (points.length >= 6) polygons.push(points);
        } finally {
          approx.delete();
        }
      } finally {
        contour.delete();
      }
    }
  } finally {
    contours.delete();
  }
  return polygons;
}

// Run the structural and marking passes (and optionally vegetation) over one
// decoded frame. Each call owns its own arena so peak WASM memory stays bounded
// when several tiles are processed in sequence.
function runFrameDetection(cv, imageData, cfg, { withVegetation = false } = {}) {
  const arena = createArena();
  try {
    const rgba = arena.keep(cv.matFromImageData(imageData));
    const width = rgba.cols;
    const height = rgba.rows;

    const rgb = arena.keep(new cv.Mat());
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    const hsv = arena.keep(new cv.Mat());
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);

    const grey = preprocess(cv, arena, rgba, cfg);
    const { roi, skyRows } = roadRoiMask(cv, arena, width, height, cfg);
    const roiArea = width * Math.max(0, height - skyRows);

    return {
      width,
      height,
      structural: detectStructural(cv, arena, grey, roi, cfg),
      marking: detectMarkings(cv, arena, hsv, roi, cfg, roiArea),
      vegetation: withVegetation ? detectVegetation(cv, arena, hsv, cfg, width, height) : [],
    };
  } finally {
    arena.releaseAll();
  }
}

// A tile is aimed below the horizon, so the wide view's skyFraction would cut
// away road rather than sky. Convert that same horizon *angle* into the tile's
// own row fraction, so both paths ignore the same part of the world.
function skyFractionForTile(tile, wide, cfg) {
  const wideV = verticalFov(wide.width, wide.height, wide.fov);
  // Angle above the wide view's centre at which its road region begins.
  const roadTopAngle = wideV / 2 - cfg.skyFraction * wideV;
  // Same angle expressed relative to the tile's own optical axis.
  const relative = (roadTopAngle - (tile.pitchOffset || 0)) * (Math.PI / 180);
  const cutRow = tile.height / 2 - focalFor(tile.width, tile.fov) * Math.tan(relative);
  return Math.min(0.95, Math.max(0, cutRow / tile.height));
}

/**
 * Detect road/marking/vegetation lines in a captured street view.
 *
 * @param source data: URL or image URL of the wide capture
 * @param options.stageWidth  Konva stage width the result will be drawn on
 * @param options.stageHeight Konva stage height
 * @param options.wideFov     horizontal FOV the wide capture was taken at,
 *                            needed to project tile detections into its frame
 * @param options.tileSources optional [{ tile, source | imageData }] of
 *                            higher-resolution tiles covering the same view.
 *                            When present, road/kerb/marking lines come from the
 *                            tiles instead of the wide shot; vegetation always
 *                            comes from the wide shot, whose framing includes the
 *                            canopy above the tiles' band.
 * @returns { lines, stats } — lines use the same shape as hand-drawn ones
 */
export async function detectLines(source, options = {}) {
  const {
    stageWidth,
    stageHeight,
    createImage,
    // Pre-decoded pixels, bypassing the canvas decode path. Lets the pipeline
    // run outside a browser (see scripts in the verification notes) so the real
    // OpenCV.js call signatures can be exercised without a DOM.
    imageData: providedImageData,
    tileSources,
    ...overrides
  } = options;
  const cfg = { ...DETECT_DEFAULTS, ...overrides };

  const decode = (src, data) =>
    data || loadImageData(src, { resizeMaxWidth: cfg.resizeMaxWidth, createImage });

  const [cv, imageData, decodedTiles] = await Promise.all([
    loadOpenCv(),
    decode(source, providedImageData),
    Promise.all(
      (tileSources || []).map(async (t) => ({
        tile: t.tile,
        imageData: await decode(t.source, t.imageData),
      }))
    ),
  ]);

  // The wide frame supplies vegetation always, and the structural/marking passes
  // when no tiles were provided.
  const useTiles = decodedTiles.length > 0;
  const wideResult = runFrameDetection(cv, imageData, cfg, { withVegetation: true });
  const { width, height } = wideResult;
  const wide = { width, height, fov: cfg.wideFov };

  // Detection happens at image resolution but the result is drawn on the stage,
  // which stretches the image to fill it. Without this the whole overlay is
  // offset toward the top-left.
  const scaleX = stageWidth ? stageWidth / width : 1;
  const scaleY = stageHeight ? stageHeight / height : 1;
  const toStage = (points) =>
    points.map((v, i) => Math.round(i % 2 === 0 ? v * scaleX : v * scaleY));

  const counts = { road_edge: 0, horizontal: 0, vertical: 0 };
  const lines = [];
  let seq = 0;
  const push = (cls, points, closed = false) => {
    seq += 1;
    lines.push({ id: `detected-${seq}`, cls, points: toStage(points), closed });
  };

  // Project a tile-space segment into wide pixels, then trim it to the wide
  // frame. Tiles deliberately see a little past the wide view's edges, and those
  // detections are real but have nowhere to be drawn — the canvas shows only the
  // wide image. Clipping keeps the visible portion instead of dropping the line.
  const intoWideFrame = (segment, tile) => {
    if (!tile) return segment;
    const projected = projectTileSegment(segment, tile, wide);
    if (!projected) return null;
    return clipSegmentToRect(projected, width, height);
  };

  // Segments detected in a tile are classified in the tile's own frame — the
  // tile shares the wide view's roll, so angles are directly comparable.
  const addSegments = (segments, tile) => {
    for (const segment of segments) {
      const cls = classifySegment(segment, cfg);
      counts[cls] += 1;
      if (cls === 'vertical' && !cfg.drawVerticals) continue;
      const points = intoWideFrame(segment, tile);
      if (points) push(cls, points);
    }
  };

  let markingSegments = 0;
  let markingSkipped = false;
  let markingVMin = cfg.markingVMin;
  let markingCoverage = 0;

  const absorbMarkings = (marking, tile) => {
    markingSegments += marking.segments.length;
    markingSkipped = markingSkipped || marking.skipped;
    markingVMin = Math.max(markingVMin, marking.vMinUsed);
    markingCoverage = Math.max(markingCoverage, marking.coverage);
    for (const segment of marking.segments) {
      const points = intoWideFrame(segment, tile);
      if (points) push('marking', points);
    }
  };

  if (useTiles) {
    for (const { tile, imageData: tileData } of decodedTiles) {
      const tileCfg = { ...cfg, skyFraction: skyFractionForTile(tile, wide, cfg) };
      const result = runFrameDetection(cv, tileData, tileCfg, { withVegetation: false });
      addSegments(result.structural, tile);
      absorbMarkings(result.marking, tile);
    }
  } else {
    addSegments(wideResult.structural, null);
    absorbMarkings(wideResult.marking, null);
  }

  for (const polygon of wideResult.vegetation) {
    push('vegetation', polygon, true);
  }

  // Merge in stage space, so the tolerances are in the same units as the
  // rendered result. With tiles this also reconciles the overlap at each seam,
  // where one edge is legitimately detected twice.
  const mergeResult = cfg.mergeSegments
    ? mergeLines(lines, cfg.mergeOptions)
    : { lines, stats: { before: lines.length, after: lines.length, merged: 0 } };

  return {
    lines: mergeResult.lines,
    stats: {
      ...counts,
      marking: markingSegments,
      vegetation: wideResult.vegetation.length,
      markingSkipped,
      markingVMin,
      markingCoverage,
      imageWidth: width,
      imageHeight: height,
      tiles: decodedTiles.length,
      rawLines: mergeResult.stats.before,
      mergedAway: mergeResult.stats.merged,
    },
  };
}

export default detectLines;
export { DEFAULT_LINE_CLASS };
