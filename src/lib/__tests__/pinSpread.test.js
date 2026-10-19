import { describe, it, expect } from 'vite-plus/test';
import { spreadPins } from '../pinSpread';

const STPLN = { lat: 55.6054, lng: 12.9854 };
// About 5 metres north, and about a kilometre east.
const NEXT_DOOR = { lat: 55.60545, lng: 12.9854 };
const FAR = { lat: 55.6054, lng: 13.0014 };

describe('spreadPins', () => {
  it('leaves a pin with nothing near it where it is', () => {
    expect(spreadPins([STPLN, FAR])).toEqual([[0, 0], [0, 0]]);
  });

  it('sets two pins at one address side by side', () => {
    expect(spreadPins([STPLN, { ...STPLN }])).toEqual([[-14, 0], [14, 0]]);
  });

  it('counts pins a few metres apart as the same spot', () => {
    const [a, b] = spreadPins([STPLN, NEXT_DOOR]);
    expect(a).not.toEqual([0, 0]);
    expect(b).not.toEqual([0, 0]);
  });

  it('puts more round a ring, each apart from the rest, and leaves the others alone', () => {
    const offsets = spreadPins([STPLN, FAR, STPLN, STPLN]);
    expect(offsets[1]).toEqual([0, 0]);
    const ring = [offsets[0], offsets[2], offsets[3]];
    for (const [x, y] of ring) expect(Math.round(Math.hypot(x, y))).toBe(14);
    expect(new Set(ring.map(String)).size).toBe(3);
  });

  it('takes the distance and the radius to use', () => {
    expect(spreadPins([STPLN, NEXT_DOOR], { metres: 1 })).toEqual([[0, 0], [0, 0]]);
    expect(spreadPins([STPLN, STPLN], { radius: 20 })).toEqual([[-20, 0], [20, 0]]);
  });
});
