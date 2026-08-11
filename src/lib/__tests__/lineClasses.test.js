import { describe, it, expect } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_LINE_CLASS,
  LINE_CLASSES,
  LINE_CLASS_LIST,
  LINE_CLASS_ORDER,
  lineClass,
  sortByRenderOrder,
} from '../lineClasses';

// Parse the Python tool's constants rather than restating them here, so this
// test fails if either implementation changes a colour or stroke width
// independently. Restating the literals would just duplicate the drift.
// Resolved from the project root — under vite's test transform import.meta.url
// is an http: URL, so it cannot be used to locate files on disk.
const PY_SOURCE = readFileSync(
  resolve(process.cwd(), 'tools/streetview_lines/extract_lines.py'),
  'utf8'
);

function pyColorHex(name) {
  const match = PY_SOURCE.match(new RegExp(`^${name} = \\((\\d+), (\\d+), (\\d+)\\)`, 'm'));
  if (!match) throw new Error(`could not find ${name} in extract_lines.py`);
  const [r, g, b] = match.slice(1, 4).map(Number);
  return (
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
  );
}

function pyInt(name) {
  const match = PY_SOURCE.match(new RegExp(`^${name} = (\\d+)`, 'm'));
  if (!match) throw new Error(`could not find ${name} in extract_lines.py`);
  return Number(match[1]);
}

describe('lineClasses / extract_lines.py parity', () => {
  it('reads the Python source successfully', () => {
    // Guards the other tests in this block: a bad path would otherwise make
    // every parse throw and the failure would look like a colour mismatch.
    expect(PY_SOURCE).toContain('COLOR_ROAD_EDGE');
  });

  const COLOUR_MAP = [
    ['road_edge', 'COLOR_ROAD_EDGE'],
    ['horizontal', 'COLOR_HORIZONTAL'],
    ['vertical', 'COLOR_VERTICAL'],
    ['marking', 'COLOR_MARKING'],
    ['vegetation', 'COLOR_VEG'],
  ];

  it.each(COLOUR_MAP)('%s colour matches %s', (key, pyName) => {
    expect(LINE_CLASSES[key].color).toBe(pyColorHex(pyName));
  });

  const STROKE_MAP = [
    ['road_edge', 'STROKE_ROAD_EDGE'],
    // horizontal deliberately shares the road-edge stroke — see render_rgba,
    // which draws it with cfg.stroke_road_edge rather than its own constant.
    ['horizontal', 'STROKE_ROAD_EDGE'],
    ['vertical', 'STROKE_VERTICAL'],
    ['marking', 'STROKE_MARKING'],
    ['vegetation', 'STROKE_VEG'],
  ];

  it.each(STROKE_MAP)('%s stroke width matches %s', (key, pyName) => {
    expect(LINE_CLASSES[key].stroke).toBe(pyInt(pyName));
  });

  it('covers exactly the five classes the Python renderer emits', () => {
    expect(LINE_CLASS_ORDER).toEqual([
      'road_edge',
      'horizontal',
      'vertical',
      'marking',
      'vegetation',
    ]);
    expect(Object.keys(LINE_CLASSES).sort()).toEqual([...LINE_CLASS_ORDER].sort());
  });

  it('puts vegetation last, matching render_rgba layers_in_z_order', () => {
    // Extract the z-order list from the Python source and compare directly.
    const block = PY_SOURCE.match(/layers_in_z_order = \[([\s\S]*?)\]/)[1];
    const pyOrder = [...block.matchAll(/\((\w+)_mask,/g)].map((m) => m[1]);
    // Python names the masks road/horiz/vert/marking/veg; map to our keys.
    const asOurKeys = pyOrder.map(
      (n) => ({ road: 'road_edge', horiz: 'horizontal', vert: 'vertical', veg: 'vegetation' })[n] || n
    );
    expect(asOurKeys).toEqual(LINE_CLASS_ORDER);
  });
});

describe('lineClasses helpers', () => {
  it('exposes the classes as a list in render order', () => {
    expect(LINE_CLASS_LIST.map((c) => c.key)).toEqual(LINE_CLASS_ORDER);
  });

  it('gives every class a label and a hint for the toolbar', () => {
    for (const c of LINE_CLASS_LIST) {
      expect(c.label).toBeTruthy();
      expect(c.hint).toBeTruthy();
    }
  });

  it('defaults to road_edge', () => {
    expect(LINE_CLASSES[DEFAULT_LINE_CLASS]).toBeDefined();
    expect(DEFAULT_LINE_CLASS).toBe('road_edge');
  });

  it('falls back to the default class for an unknown key', () => {
    expect(lineClass('not_a_class')).toBe(LINE_CLASSES[DEFAULT_LINE_CLASS]);
    expect(lineClass(undefined)).toBe(LINE_CLASSES[DEFAULT_LINE_CLASS]);
  });

  it('returns the requested class for a known key', () => {
    expect(lineClass('vegetation').color).toBe('#00FF5A');
  });
});

describe('sortByRenderOrder', () => {
  it('lifts vegetation above road lines regardless of creation order', () => {
    const lines = [
      { id: 'a', cls: 'vegetation' },
      { id: 'b', cls: 'road_edge' },
      { id: 'c', cls: 'marking' },
    ];
    expect(sortByRenderOrder(lines).map((l) => l.id)).toEqual(['b', 'c', 'a']);
  });

  it('is stable within a class, preserving creation order', () => {
    const lines = [
      { id: 'first', cls: 'road_edge' },
      { id: 'second', cls: 'road_edge' },
      { id: 'third', cls: 'road_edge' },
    ];
    expect(sortByRenderOrder(lines).map((l) => l.id)).toEqual(['first', 'second', 'third']);
  });

  it('does not mutate the input array', () => {
    const lines = [{ id: 'a', cls: 'vegetation' }, { id: 'b', cls: 'road_edge' }];
    const snapshot = [...lines];
    sortByRenderOrder(lines);
    expect(lines).toEqual(snapshot);
  });
});
