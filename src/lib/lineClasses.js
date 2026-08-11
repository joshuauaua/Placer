// Feature classes for line overlays on a captured street view.
//
// These mirror the constants in tools/streetview_lines/extract_lines.py so that
// a hand-drawn line and one imported from the CV pipeline are visually
// identical. Keep the two in sync — src/lib/__tests__/lineClasses.test.js
// asserts the colours and strokes match, and will fail if either side drifts.

// Python-side names, for traceability when comparing the two implementations:
//   road_edge  -> COLOR_ROAD_EDGE  / STROKE_ROAD_EDGE
//   horizontal -> COLOR_HORIZONTAL / STROKE_ROAD_EDGE (shares the road stroke)
//   vertical   -> COLOR_VERTICAL   / STROKE_VERTICAL
//   marking    -> COLOR_MARKING    / STROKE_MARKING
//   vegetation -> COLOR_VEG        / STROKE_VEG
export const LINE_CLASSES = {
  road_edge: {
    key: 'road_edge',
    label: 'Road edge',
    hint: 'Kerb line running with the road',
    color: '#00FFFF',
    stroke: 3,
  },
  horizontal: {
    key: 'horizontal',
    label: 'Kerb / crossing',
    hint: 'Cross-scene edge — crossings, far kerbs',
    color: '#FF00C8',
    stroke: 3,
  },
  vertical: {
    key: 'vertical',
    label: 'Pole',
    hint: 'Upright structure — poles, posts',
    color: '#8CA0FF',
    stroke: 2,
  },
  marking: {
    key: 'marking',
    label: 'Lane marking',
    hint: 'Painted road marking',
    color: '#FFEB00',
    stroke: 3,
  },
  vegetation: {
    key: 'vegetation',
    label: 'Vegetation',
    hint: 'Tree canopy or planting outline',
    color: '#00FF5A',
    stroke: 3,
  },
};

// Z-order from render_rgba() in extract_lines.py: vegetation is drawn last so
// canopy outlines sit above any road or pole lines passing behind them.
export const LINE_CLASS_ORDER = [
  'road_edge',
  'horizontal',
  'vertical',
  'marking',
  'vegetation',
];

// Toolbar order — same as the render order, so the palette reads the same way
// the canvas stacks.
export const LINE_CLASS_LIST = LINE_CLASS_ORDER.map((key) => LINE_CLASSES[key]);

export const DEFAULT_LINE_CLASS = 'road_edge';

export function lineClass(key) {
  return LINE_CLASSES[key] || LINE_CLASSES[DEFAULT_LINE_CLASS];
}

// Sort lines into render order so vegetation outlines stay on top regardless of
// the order they were drawn or imported in. Stable within a class, so lines of
// the same type keep their relative creation order.
export function sortByRenderOrder(lines) {
  return [...lines].sort(
    (a, b) => LINE_CLASS_ORDER.indexOf(a.cls) - LINE_CLASS_ORDER.indexOf(b.cls)
  );
}
