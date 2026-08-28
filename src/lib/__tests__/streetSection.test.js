import { describe, it, expect } from 'vite-plus/test';
import {
  DEFAULT_STREET_WIDTH,
  SEGMENT_TYPES,
  addSegment,
  compare,
  distributeSlack,
  loadPreset,
  metrics,
  presetMetrics,
  removeSegment,
  resize,
  totalWidth,
} from '../streetSection';

describe('presets', () => {
  it.each(['today', 'complete', 'play'])('%s fills the default street exactly', (key) => {
    expect(totalWidth(loadPreset(key))).toBe(DEFAULT_STREET_WIDTH);
  });

  it('hands back a fresh copy each time, so editing one does not edit the preset', () => {
    const first = loadPreset('today');
    first[0].width = 99;
    expect(loadPreset('today')[0].width).not.toBe(99);
  });

  it('only ever uses widths inside each segment type its own limits', () => {
    for (const key of ['today', 'complete', 'play']) {
      for (const segment of loadPreset(key)) {
        const type = SEGMENT_TYPES[segment.type];
        expect(segment.width).toBeGreaterThanOrEqual(type.min);
        expect(segment.width).toBeLessThanOrEqual(type.max);
      }
    }
  });
});

describe('resize', () => {
  it('moves width from one segment to its neighbour, keeping the total', () => {
    const before = loadPreset('today');
    const after = resize(before, 0, 0.5);

    expect(after[0].width).toBe(before[0].width + 0.5);
    expect(after[1].width).toBe(before[1].width - 0.5);
    expect(totalWidth(after)).toBe(totalWidth(before));
  });

  it('stops at the growing segment maximum', () => {
    const segments = [{ type: 'trees', width: 3.5 }, { type: 'sidewalk', width: 6 }];
    // Trees max out at 4 m, so only half a metre can move however hard it is pushed.
    const after = resize(segments, 0, 5);

    expect(after[0].width).toBe(SEGMENT_TYPES.trees.max);
    expect(totalWidth(after)).toBe(9.5);
  });

  it('stops at the shrinking segment minimum', () => {
    const segments = [{ type: 'sidewalk', width: 4 }, { type: 'cycle', width: 1.6 }];
    // The cycle track cannot go below 1.5 m, so the sidewalk only gains 0.1 m.
    const after = resize(segments, 0, 2);

    expect(after[1].width).toBe(SEGMENT_TYPES.cycle.min);
    expect(after[0].width).toBe(4.1);
  });

  it('leaves the array alone when neither neighbour can move', () => {
    const segments = [{ type: 'cycle', width: 1.5 }, { type: 'cycle', width: 1.5 }];
    expect(resize(segments, 0, -1)).toBe(segments);
  });

  it('ignores a divider that has nothing on the other side', () => {
    const segments = [{ type: 'sidewalk', width: 3 }];
    expect(resize(segments, 0, 1)).toBe(segments);
  });

  it('does not drift off two decimal places over many small moves', () => {
    let segments = [{ type: 'sidewalk', width: 3 }, { type: 'sidewalk', width: 3 }];
    for (let i = 0; i < 12; i += 1) segments = resize(segments, 0, 0.05);

    expect(totalWidth(segments)).toBe(6);
    expect(segments[0].width).toBe(3.6);
  });
});

describe('addSegment', () => {
  it('takes unallocated width first', () => {
    const segments = [{ type: 'sidewalk', width: 3 }];
    const result = addSegment(segments, 'trees', 10);

    expect(result.added).toBe(true);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[1]).toEqual({ type: 'trees', width: SEGMENT_TYPES.trees.def });
    expect(segments).toHaveLength(1);
  });

  it('spreads the squeeze when the street is already full', () => {
    const segments = [{ type: 'sidewalk', width: 6 }, { type: 'sidewalk', width: 2 }];
    const result = addSegment(segments, 'cycle', 8);

    expect(result.added).toBe(true);
    expect(totalWidth(result.segments)).toBe(8);
    // Both give something, and the one with more room to give gives more of it.
    expect(result.segments[0].width).toBe(4.65);
    expect(result.segments[1].width).toBe(1.85);
  });

  it('does not flatten anything to its minimum to make room', () => {
    // Adding a 3 m bus lane to a full street used to take the whole 3 m out of the two
    // widest segments, which left both footways at 1.5 m — the opposite of the point.
    const result = addSegment(loadPreset('today'), 'bus', DEFAULT_STREET_WIDTH);

    expect(totalWidth(result.segments)).toBe(DEFAULT_STREET_WIDTH);
    for (const segment of result.segments) {
      if (segment.type === 'bus') continue;
      expect(segment.width).toBeGreaterThan(SEGMENT_TYPES[segment.type].min);
    }
  });

  it('refuses, with a reason, when the minimum genuinely does not fit', () => {
    const segments = [{ type: 'cycle', width: 1.5 }, { type: 'cycle', width: 1.5 }];
    const result = addSegment(segments, 'bus', 3);

    expect(result.added).toBe(false);
    expect(result.reason).toMatch(/no room/i);
    expect(result.segments).toBe(segments);
  });

  it('inserts at a given position', () => {
    const result = addSegment([{ type: 'sidewalk', width: 3 }, { type: 'sidewalk', width: 3 }], 'trees', 12, 1);
    expect(result.segments.map((segment) => segment.type)).toEqual(['sidewalk', 'trees', 'sidewalk']);
  });

  it('rejects a type it does not know', () => {
    const segments = [{ type: 'sidewalk', width: 3 }];
    expect(addSegment(segments, 'monorail', 20).added).toBe(false);
  });
});

describe('removeSegment', () => {
  it('drops the segment and leaves its width unallocated', () => {
    const segments = loadPreset('today');
    const after = removeSegment(segments, 1);

    expect(after).toHaveLength(segments.length - 1);
    expect(totalWidth(after)).toBe(DEFAULT_STREET_WIDTH - segments[1].width);
  });

  it('ignores an index that is not there', () => {
    const segments = loadPreset('today');
    expect(removeSegment(segments, 99)).toBe(segments);
  });
});

describe('distributeSlack', () => {
  it('gives the leftover metres back to the street', () => {
    const segments = removeSegment(loadPreset('today'), 2);
    const filled = distributeSlack(segments, DEFAULT_STREET_WIDTH);

    expect(totalWidth(filled)).toBe(DEFAULT_STREET_WIDTH);
  });

  it('respects maximum widths, even when that leaves the street short', () => {
    const filled = distributeSlack([{ type: 'trees', width: 3.9 }], 20);
    expect(totalWidth(filled)).toBe(SEGMENT_TYPES.trees.max);
  });

  it('does nothing when the street is already full', () => {
    const segments = loadPreset('complete');
    expect(distributeSlack(segments, DEFAULT_STREET_WIDTH)).toBe(segments);
  });
});

describe('metrics', () => {
  it('reports what is still unspoken for', () => {
    const result = metrics([{ type: 'sidewalk', width: 3 }], 20);
    expect(result.used).toBe(3);
    expect(result.unallocated).toBe(17);
    expect(result.overAllocated).toBe(false);
  });

  it('flags a cross-section wider than its street', () => {
    expect(metrics([{ type: 'sidewalk', width: 8 }, { type: 'sidewalk', width: 8 }], 12).overAllocated).toBe(true);
  });

  it('counts throughput per metre of width', () => {
    // 2.5 m of footway at 1200 people per hour per metre.
    expect(metrics([{ type: 'sidewalk', width: 2.5 }], 20).peoplePerHour).toBe(3000);
  });

  it('counts parking and traffic lanes as space given to cars', () => {
    const result = metrics([{ type: 'traffic', width: 3 }, { type: 'parking', width: 2 }, { type: 'sidewalk', width: 5 }], 20);
    expect(result.carShare).toBeCloseTo(0.25, 6);
    expect(result.peopleShare).toBeCloseTo(0.25, 6);
  });

  it('lets trees shade more than their own width, but never more than the street', () => {
    expect(metrics([{ type: 'trees', width: 2 }], 20).canopyShare).toBeCloseTo(0.18, 6);
    expect(metrics([{ type: 'trees', width: 4 }], 4).canopyShare).toBe(1);
  });

  it('is unfazed by a segment type that has gone missing', () => {
    expect(metrics([{ type: 'monorail', width: 4 }], 20).peoplePerHour).toBe(0);
  });
});

describe('the presets against each other', () => {
  const today = presetMetrics('today');
  const complete = presetMetrics('complete');
  const play = presetMetrics('play');

  it('hands most of today street to cars', () => {
    expect(today.carShare).toBeGreaterThan(0.5);
  });

  it('moves more than twice as many people once the space is shared out', () => {
    expect(complete.peoplePerHour).toBeGreaterThan(today.peoplePerHour * 2);
  });

  it('shades the play street and not the one that exists', () => {
    expect(today.canopyShare).toBe(0);
    expect(play.canopyShare).toBeGreaterThan(0.25);
  });

  it('reports the change against today with a sign', () => {
    const delta = compare(complete, today);
    expect(delta.peoplePerHour).toBeGreaterThan(0);
    expect(delta.carShare).toBeLessThan(0);
  });
});
