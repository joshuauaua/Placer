import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A stand-in for the OpenCV.js namespace. Records the pipeline calls made
// against it and lets each test script what HoughLinesP / findContours return,
// so the port's control flow is testable without the 13 MB WASM module.
const cvState = {
  houghResults: [],
  contours: [],
  nonZero: 0,
  liveMats: 0,
  calls: [],
};

function makeMat(rows = 8, cols = 8) {
  cvState.liveMats += 1;
  let deleted = false;
  return {
    rows,
    cols,
    data32S: new Int32Array(64),
    type: () => 0,
    isDeleted: () => deleted,
    delete() {
      if (!deleted) {
        deleted = true;
        cvState.liveMats -= 1;
      }
    },
  };
}

const cvMock = {
  COLOR_RGBA2GRAY: 11,
  COLOR_RGBA2RGB: 2,
  COLOR_RGB2HSV: 41,
  MORPH_OPEN: 2,
  MORPH_CLOSE: 3,
  RETR_EXTERNAL: 0,
  CHAIN_APPROX_SIMPLE: 2,
  CV_8UC1: 0,
  CV_8U: 0,
  BORDER_DEFAULT: 4,
  Mat: class {
    constructor(rows = 8, cols = 8) {
      return makeMat(rows, cols);
    }
    static zeros(rows, cols) {
      return makeMat(rows, cols);
    }
    static ones(rows, cols) {
      return makeMat(rows, cols);
    }
  },
  MatVector: class {
    constructor() {
      this._items = cvState.contours.map((pts) => {
        const mat = makeMat(pts.length / 2, 1);
        mat.data32S = Int32Array.from(pts);
        return mat;
      });
    }
    size() {
      return this._items.length;
    }
    get(i) {
      return this._items[i];
    }
    delete() {}
  },
  Size: class {
    constructor(w, h) {
      this.width = w;
      this.height = h;
    }
  },
  Point: class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  },
  Scalar: class {
    constructor(...v) {
      this.v = v;
    }
  },
  CLAHE: class {
    constructor(clip, size) {
      cvState.calls.push(`CLAHE(${clip},${size.width}x${size.height})`);
    }
    apply() {
      cvState.calls.push('CLAHE.apply');
    }
    delete() {}
  },
  matFromImageData: (data) => makeMat(data.height, data.width),
  cvtColor: (src, dst, code) => cvState.calls.push(`cvtColor:${code}`),
  bilateralFilter: () => cvState.calls.push('bilateralFilter'),
  GaussianBlur: () => cvState.calls.push('GaussianBlur'),
  Canny: () => cvState.calls.push('Canny'),
  bitwise_and: () => cvState.calls.push('bitwise_and'),
  rectangle: () => cvState.calls.push('rectangle'),
  inRange: () => cvState.calls.push('inRange'),
  morphologyEx: (src, dst, op) => cvState.calls.push(`morphologyEx:${op}`),
  // An array models coverage falling as the guard raises the brightness floor;
  // a plain number keeps it constant.
  countNonZero: () =>
    Array.isArray(cvState.nonZero)
      ? cvState.nonZero.shift() ?? cvState.nonZero.at(-1) ?? 0
      : cvState.nonZero,
  contourArea: (mat) => (mat.rows >= 3 ? 10_000 : 1),
  arcLength: () => 100,
  approxPolyDP: (src, dst) => {
    dst.rows = src.rows;
    dst.data32S = src.data32S;
  },
  findContours: () => cvState.calls.push('findContours'),
  HoughLinesP: (src, dst) => {
    const result = cvState.houghResults.shift() || [];
    // Mirrors the real build's layout: a 1 x N four-channel Mat, NOT N x 1 as
    // the C++/Python API returns. Reading `rows` alone here would yield one
    // segment — a bug this mock previously hid by using N x 1.
    dst.rows = result.length ? 1 : 0;
    dst.cols = result.length;
    dst.data32S = Int32Array.from(result.flat());
    cvState.calls.push(`HoughLinesP:${result.length}`);
  },
};

vi.mock('@techstark/opencv-js', () => ({ default: Promise.resolve(cvMock) }));

const { detectLines, classifySegment, DETECT_DEFAULTS, MARKING_MAX_COVERAGE, _resetOpenCvCache } =
  await import('../detectLines');

// A stub image that reports a fixed intrinsic size and fires onload immediately.
function stubImage(width = 640, height = 448) {
  return () => {
    const img = {
      naturalWidth: width,
      naturalHeight: height,
      set src(_v) {
        setTimeout(() => this.onload?.(), 0);
      },
    };
    return img;
  };
}

beforeEach(() => {
  cvState.houghResults = [];
  cvState.contours = [];
  cvState.nonZero = 0;
  cvState.liveMats = 0;
  cvState.calls = [];
  _resetOpenCvCache();

  // jsdom canvas: getImageData is not implemented, so stub the 2d context.
  HTMLCanvasElement.prototype.getContext = () => ({
    drawImage: () => {},
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const run = (opts = {}) =>
  detectLines('data:image/png;base64,AAAA', {
    stageWidth: 1000,
    stageHeight: 700,
    createImage: stubImage(),
    ...opts,
  });

describe('classifySegment', () => {
  it('classifies a near-horizontal segment as horizontal', () => {
    expect(classifySegment([0, 0, 100, 5], DETECT_DEFAULTS)).toBe('horizontal');
  });

  it('classifies a near-vertical segment as vertical', () => {
    expect(classifySegment([0, 0, 5, 100], DETECT_DEFAULTS)).toBe('vertical');
  });

  it('classifies a diagonal segment as a road edge', () => {
    expect(classifySegment([0, 0, 100, 100], DETECT_DEFAULTS)).toBe('road_edge');
  });

  it('treats direction as irrelevant — a mirrored diagonal classifies the same', () => {
    expect(classifySegment([100, 0, 0, 100], DETECT_DEFAULTS)).toBe('road_edge');
  });
});

describe('detectLines coordinate scaling', () => {
  it('scales detected coordinates from image space into stage space', async () => {
    // 640x448 image on a 1000x700 stage -> uniform 1.5625x.
    cvState.houghResults = [[[0, 0, 320, 224]], []];
    const { lines } = await run();

    expect(lines).toHaveLength(1);
    expect(lines[0].points).toEqual([0, 0, 500, 350]);
  });

  it('leaves coordinates untouched when no stage size is given', async () => {
    cvState.houghResults = [[[10, 20, 30, 40]], []];
    const { lines } = await run({ stageWidth: undefined, stageHeight: undefined });

    expect(lines[0].points).toEqual([10, 20, 30, 40]);
  });

  it('reports the resolution detection actually ran at', async () => {
    cvState.houghResults = [[], []];
    const { stats } = await run();
    expect(stats.imageWidth).toBe(640);
    expect(stats.imageHeight).toBe(448);
  });
});

describe('detectLines classification and output shape', () => {
  it('classifies structural segments and counts them per class', async () => {
    cvState.houghResults = [
      [
        [0, 0, 100, 100], // road_edge
        [0, 0, 100, 2], // horizontal
        [0, 0, 2, 100], // vertical
      ],
      [],
    ];
    const { lines, stats } = await run();

    expect(stats.road_edge).toBe(1);
    expect(stats.horizontal).toBe(1);
    expect(stats.vertical).toBe(1);
    expect(lines.map((l) => l.cls)).toEqual(['road_edge', 'horizontal', 'vertical']);
  });

  it('counts verticals but omits them from output when drawVerticals is false', async () => {
    cvState.houghResults = [[[0, 0, 2, 100]], []];
    const { lines, stats } = await run({ drawVerticals: false });

    expect(stats.vertical).toBe(1);
    expect(lines).toHaveLength(0);
  });

  it('emits open two-point segments and closed vegetation polygons', async () => {
    cvState.houghResults = [[[0, 0, 100, 100]], []];
    cvState.contours = [[0, 0, 10, 0, 10, 10, 0, 10]];
    const { lines } = await run();

    const segment = lines.find((l) => l.cls === 'road_edge');
    expect(segment.closed).toBe(false);
    expect(segment.points).toHaveLength(4);

    const veg = lines.find((l) => l.cls === 'vegetation');
    expect(veg.closed).toBe(true);
    expect(veg.points.length).toBeGreaterThan(4);
  });

  it('drops vegetation contours below the minimum area', async () => {
    cvState.houghResults = [[], []];
    // A 2-point contour: contourArea stub returns 1, below minArea.
    cvState.contours = [[0, 0, 1, 1]];
    const { lines, stats } = await run();

    expect(stats.vegetation).toBe(0);
    expect(lines).toHaveLength(0);
  });

  it('reads every segment from a 1 x N Hough result, not just the first', async () => {
    // Regression guard: the real OpenCV.js build returns rows=1, cols=N. An
    // implementation that loops over `rows` returns 1 line and drops the rest.
    const many = Array.from({ length: 12 }, (_, i) => [i, i, i + 50, i + 50]);
    cvState.houghResults = [many, []];
    // Merging off: these 12 are deliberately near-identical, so the merger would
    // legitimately collapse them and mask what this test is checking.
    const { lines, stats } = await run({ mergeSegments: false });

    expect(stats.road_edge).toBe(12);
    expect(stats.rawLines).toBe(12);
    expect(lines).toHaveLength(12);
  });

  it('merges duplicate segments by default and reports what it collapsed', async () => {
    // Three near-identical detections of one edge.
    cvState.houghResults = [
      [
        [0, 0, 200, 0],
        [10, 1, 190, 2],
        [20, 0, 210, 1],
      ],
      [],
    ];
    const { lines, stats } = await run({ stageWidth: undefined, stageHeight: undefined });

    expect(stats.rawLines).toBe(3);
    expect(stats.mergedAway).toBe(2);
    expect(lines).toHaveLength(1);
  });

  it('leaves the raw detections alone when merging is disabled', async () => {
    cvState.houghResults = [
      [
        [0, 0, 200, 0],
        [10, 1, 190, 2],
      ],
      [],
    ];
    const { lines, stats } = await run({
      stageWidth: undefined,
      stageHeight: undefined,
      mergeSegments: false,
    });

    expect(lines).toHaveLength(2);
    expect(stats.mergedAway).toBe(0);
  });

  it('does not merge vegetation polygons into each other', async () => {
    cvState.houghResults = [[], []];
    cvState.contours = [
      [0, 0, 10, 0, 10, 10],
      [0, 1, 10, 1, 10, 11],
    ];
    const { lines } = await run();

    expect(lines.filter((l) => l.cls === 'vegetation')).toHaveLength(2);
  });

  it('returns no lines for an empty Hough result', async () => {
    cvState.houghResults = [[], []];
    const { lines } = await run();
    expect(lines).toHaveLength(0);
  });

  it('gives every line a unique id', async () => {
    cvState.houghResults = [[[0, 0, 100, 100], [0, 0, 90, 90]], [[5, 5, 80, 80]]];
    cvState.contours = [[0, 0, 10, 0, 10, 10]];
    const { lines } = await run();

    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('adaptive marking guard', () => {
  it('keeps markings when mask coverage is reasonable', async () => {
    cvState.nonZero = 100; // tiny coverage
    cvState.houghResults = [[], [[0, 0, 50, 50]]];
    const { stats, lines } = await run();

    expect(stats.markingSkipped).toBe(false);
    expect(stats.markingVMin).toBe(DETECT_DEFAULTS.markingVMin);
    expect(lines.filter((l) => l.cls === 'marking')).toHaveLength(1);
  });

  it('skips the marking pass when the mask stays saturated', async () => {
    // countNonZero always returns the full ROI, so coverage never drops.
    cvState.nonZero = 640 * 448;
    cvState.houghResults = [[], [[0, 0, 50, 50]]];
    const { stats, lines } = await run();

    expect(stats.markingSkipped).toBe(true);
    expect(stats.markingCoverage).toBeGreaterThan(MARKING_MAX_COVERAGE);
    expect(lines.filter((l) => l.cls === 'marking')).toHaveLength(0);
  });

  it('escalates the brightness floor and keeps the markings once coverage settles', async () => {
    const roiArea = 640 * (448 - Math.trunc(448 * 0.42));
    // Mirrors the measured curve: 20.6% -> 5.9% -> 1.0%, settling under the 2%
    // ceiling on the third attempt (vMin 175 -> 195 -> 215).
    cvState.nonZero = [
      Math.round(roiArea * 0.206),
      Math.round(roiArea * 0.059),
      Math.round(roiArea * 0.010),
    ];
    cvState.houghResults = [[], [[0, 0, 50, 50]]];
    const { stats, lines } = await run();

    expect(stats.markingSkipped).toBe(false);
    expect(stats.markingVMin).toBe(215);
    expect(stats.markingCoverage).toBeLessThanOrEqual(MARKING_MAX_COVERAGE);
    expect(lines.filter((l) => l.cls === 'marking')).toHaveLength(1);
  });

  it('honours an overridden coverage ceiling', async () => {
    const roiArea = 640 * (448 - Math.trunc(448 * 0.42));
    cvState.nonZero = Math.round(roiArea * 0.1);
    cvState.houghResults = [[], [[0, 0, 50, 50]]];

    // 10% coverage passes a 25% ceiling but fails the 2% default.
    const loose = await run({ markingMaxCoverage: 0.25 });
    expect(loose.stats.markingSkipped).toBe(false);
    expect(loose.stats.markingVMin).toBe(DETECT_DEFAULTS.markingVMin);
  });

  it('raises the brightness floor before giving up', async () => {
    cvState.nonZero = 640 * 448;
    cvState.houghResults = [[], []];
    const { stats } = await run();

    // Escalated past the starting threshold rather than bailing immediately.
    expect(stats.markingVMin).toBeGreaterThan(DETECT_DEFAULTS.markingVMin);
  });

  it('does not run the marking pass at all when markingDetection is false', async () => {
    cvState.houghResults = [[], [[0, 0, 50, 50]]];
    const { stats, lines } = await run({ markingDetection: false });

    expect(stats.marking).toBe(0);
    expect(stats.markingSkipped).toBe(false);
    expect(lines.filter((l) => l.cls === 'marking')).toHaveLength(0);
  });
});

describe('pipeline fidelity', () => {
  it('runs the same stage order as the Python pipeline', async () => {
    cvState.nonZero = 10;
    cvState.houghResults = [[], []];
    await run();

    const order = cvState.calls.join(' ');
    expect(order).toContain('bilateralFilter');
    expect(order).toContain('CLAHE.apply');
    expect(order).toContain('GaussianBlur');
    expect(order).toContain('Canny');
    expect(order).toContain('findContours');
    // bilateral must precede the blur, and the blur must precede Canny.
    expect(cvState.calls.indexOf('bilateralFilter')).toBeLessThan(cvState.calls.indexOf('GaussianBlur'));
    expect(cvState.calls.indexOf('GaussianBlur')).toBeLessThan(cvState.calls.indexOf('Canny'));
  });

  it('uses the RGBA colour codes, not the BGR ones the Python source uses', async () => {
    cvState.houghResults = [[], []];
    await run();

    // Getting this wrong swaps red and blue and inverts every hue-based mask.
    expect(cvState.calls).toContain(`cvtColor:${cvMock.COLOR_RGBA2GRAY}`);
    expect(cvState.calls).toContain(`cvtColor:${cvMock.COLOR_RGB2HSV}`);
  });

  it('constructs CLAHE with the Python clip limit and default 8x8 tile grid', async () => {
    cvState.houghResults = [[], []];
    await run();
    expect(cvState.calls).toContain('CLAHE(2,8x8)');
  });

  it('skips CLAHE when disabled', async () => {
    cvState.houghResults = [[], []];
    await run({ useClahe: false });
    expect(cvState.calls).not.toContain('CLAHE.apply');
  });

  it('releases every Mat it allocates', async () => {
    cvState.houghResults = [[[0, 0, 100, 100]], [[0, 0, 50, 50]]];
    cvState.contours = [[0, 0, 10, 0, 10, 10]];
    await run();

    // The WASM heap is not garbage collected; a leak compounds per detection.
    expect(cvState.liveMats).toBe(0);
  });

  it('releases Mats even when a stage throws', async () => {
    cvState.houghResults = [[], []];
    const boom = new Error('canny exploded');
    const original = cvMock.Canny;
    cvMock.Canny = () => {
      throw boom;
    };

    await expect(run()).rejects.toThrow('canny exploded');
    expect(cvState.liveMats).toBe(0);

    cvMock.Canny = original;
  });
});

describe('detectLines / extract_lines.py default parity', () => {
  const PY_SOURCE = readFileSync(
    resolve(process.cwd(), 'tools/streetview_lines/extract_lines.py'),
    'utf8'
  );

  const pyNumber = (name) => {
    const m = PY_SOURCE.match(new RegExp(`^${name} = ([0-9.]+)`, 'm'));
    if (!m) throw new Error(`could not find ${name}`);
    return Number(m[1]);
  };

  const NUMERIC = [
    ['resizeMaxWidth', 'RESIZE_MAX_WIDTH'],
    ['bilateralD', 'BILATERAL_D'],
    ['bilateralSigmaColor', 'BILATERAL_SIGMA_COLOR'],
    ['bilateralSigmaSpace', 'BILATERAL_SIGMA_SPACE'],
    ['claheClip', 'CLAHE_CLIP'],
    ['cannyLow', 'CANNY_LOW'],
    ['cannyHigh', 'CANNY_HIGH'],
    ['houghThreshold', 'HOUGH_THRESHOLD'],
    ['houghMinLineLength', 'HOUGH_MIN_LINE_LENGTH'],
    ['houghMaxLineGap', 'HOUGH_MAX_LINE_GAP'],
    ['skyFraction', 'SKY_FRACTION'],
    ['angleHorizontalMaxDeg', 'ANGLE_HORIZONTAL_MAX_DEG'],
    ['angleVerticalMinDeg', 'ANGLE_VERTICAL_MIN_DEG'],
    ['markingSMax', 'MARKING_S_MAX'],
    ['markingVMin', 'MARKING_V_MIN'],
    ['vegMinAreaFrac', 'VEG_MIN_AREA_FRAC'],
    ['vegApproxEpsFrac', 'VEG_APPROX_EPS_FRAC'],
  ];

  it.each(NUMERIC)('%s matches %s', (jsKey, pyName) => {
    expect(DETECT_DEFAULTS[jsKey]).toBe(pyNumber(pyName));
  });

  it('matches the Python green HSV bounds', () => {
    const bounds = (name) => {
      const m = PY_SOURCE.match(new RegExp(`^${name} = \\((\\d+), (\\d+), (\\d+)\\)`, 'm'));
      return m.slice(1, 4).map(Number);
    };
    expect(DETECT_DEFAULTS.greenHsvLower).toEqual(bounds('GREEN_HSV_LOWER'));
    expect(DETECT_DEFAULTS.greenHsvUpper).toEqual(bounds('GREEN_HSV_UPPER'));
  });

  it('matches the Python square kernel sizes', () => {
    const tuple = (name) => {
      const m = PY_SOURCE.match(new RegExp(`^${name} = \\((\\d+), (\\d+)\\)`, 'm'));
      return m.slice(1, 3).map(Number);
    };
    expect(tuple('GAUSSIAN_KSIZE')).toEqual([
      DETECT_DEFAULTS.gaussianKsize,
      DETECT_DEFAULTS.gaussianKsize,
    ]);
    expect(tuple('VEG_MORPH_KERNEL')).toEqual([
      DETECT_DEFAULTS.vegMorphKernel,
      DETECT_DEFAULTS.vegMorphKernel,
    ]);
  });
});
