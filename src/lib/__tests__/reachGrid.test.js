import { describe, it, expect } from 'vite-plus/test';
import {
  AMENITY_LIST,
  BRIDGE_COLS,
  GRID,
  POPULATION,
  RAIL_ROW,
  REACH_MINUTES,
  TOTAL_POPULATION,
  cellCoords,
  cellIndex,
  coverage,
  isPassable,
  loadPreset,
  populationShare,
  walkMinutes,
} from '../reachGrid';

/** One of everything, all in the same place. */
const allAt = (x, y) => AMENITY_LIST.map((amenity, i) => ({ id: `a${i}`, type: amenity.key, cell: cellIndex(x, y) }));

describe('the grid', () => {
  it('maps a cell to coordinates and back', () => {
    const index = cellIndex(5, 9);
    expect(cellCoords(index)).toEqual({ x: 5, y: 9 });
  });

  it('blocks the railway everywhere but the bridges', () => {
    expect(isPassable(cellIndex(0, RAIL_ROW))).toBe(false);
    expect(isPassable(cellIndex(7, RAIL_ROW))).toBe(false);
    for (const bridge of BRIDGE_COLS) {
      expect(isPassable(cellIndex(bridge, RAIL_ROW))).toBe(true);
    }
  });

  it('leaves the rest of the neighbourhood walkable', () => {
    expect(isPassable(cellIndex(0, 0))).toBe(true);
    expect(isPassable(cellIndex(15, 15))).toBe(true);
  });
});

describe('population', () => {
  it('houses nobody on the tracks', () => {
    expect(POPULATION[cellIndex(7, RAIL_ROW)]).toBe(0);
  });

  it('houses somebody everywhere else', () => {
    expect(POPULATION[cellIndex(0, 0)]).toBeGreaterThan(0);
    expect(POPULATION[cellIndex(15, 15)]).toBeGreaterThan(0);
  });

  it('is denser in the housing clusters than at the edge', () => {
    expect(POPULATION[cellIndex(4, 3)]).toBeGreaterThan(POPULATION[cellIndex(15, 0)]);
  });

  it('adds up to the total the shares are measured against', () => {
    expect(TOTAL_POPULATION).toBeCloseTo(POPULATION.reduce((sum, value) => sum + value, 0), 10);
    expect(populationShare(cellIndex(4, 3))).toBeGreaterThan(0);
    expect(populationShare(cellIndex(7, RAIL_ROW))).toBe(0);
  });
});

describe('walkMinutes', () => {
  it('is nothing at all at the amenity itself', () => {
    const minutes = walkMinutes([{ type: 'park', cell: cellIndex(4, 4) }]);
    expect(minutes.park[cellIndex(4, 4)]).toBe(0);
  });

  it('costs a 100-metre cell a minute and a quarter at walking pace', () => {
    const minutes = walkMinutes([{ type: 'park', cell: cellIndex(4, 4) }]);
    expect(minutes.park[cellIndex(5, 4)]).toBeCloseTo(1.25, 6);
  });

  it('leaves every category unreachable when nothing is placed', () => {
    const minutes = walkMinutes([]);
    for (const amenity of AMENITY_LIST) {
      expect(minutes[amenity.key][cellIndex(4, 4)]).toBe(Infinity);
    }
  });

  it('sends a walk across the tracks round by the bridge', () => {
    // Directly opposite, one row apart — but the railway is in between.
    const minutes = walkMinutes([{ type: 'park', cell: cellIndex(7, RAIL_ROW - 1) }]);
    const across = minutes.park[cellIndex(7, RAIL_ROW + 1)];

    expect(across).toBeGreaterThan(6 * 1.25);
    expect(Number.isFinite(across)).toBe(true);
  });

  it('reports the same walk as short when it stays on one side', () => {
    const minutes = walkMinutes([{ type: 'park', cell: cellIndex(7, RAIL_ROW - 1) }]);
    expect(minutes.park[cellIndex(7, RAIL_ROW - 3)]).toBeCloseTo(2.5, 6);
  });

  it('takes the nearest of several of the same kind', () => {
    const minutes = walkMinutes([
      { type: 'park', cell: cellIndex(1, 1) },
      { type: 'park', cell: cellIndex(14, 1) },
    ]);
    expect(minutes.park[cellIndex(13, 1)]).toBeCloseTo(1.25, 6);
  });
});

describe('coverage', () => {
  it('serves nobody with an empty neighbourhood', () => {
    const result = coverage([]);
    expect(result.share).toBe(0);
    expect(result.strandedShare).toBe(1);
    expect([...result.inReach].every((count) => count === 0)).toBe(true);
  });

  it('counts how many kinds each cell can reach', () => {
    const result = coverage([{ type: 'park', cell: cellIndex(4, 4) }]);
    expect(result.inReach[cellIndex(4, 4)]).toBe(1);
    expect(result.byCategory.park).toBeGreaterThan(0);
    expect(result.byCategory.school).toBe(0);
  });

  it('needs all five kinds before a cell counts as served', () => {
    const four = AMENITY_LIST.slice(0, 4).map((amenity) => ({ type: amenity.key, cell: cellIndex(4, 4) }));
    expect(coverage(four).share).toBe(0);
    expect(coverage(allAt(4, 4)).share).toBeGreaterThan(0);
  });

  it('serves nearly everybody once both sides of the tracks are provided for', () => {
    const result = coverage([...allAt(5, 4), ...allAt(9, 12)]);
    expect(result.share).toBeGreaterThan(0.9);
    expect(result.strandedShare).toBe(0);
  });

  it('strands the far side of the railway when everything sits on one side', () => {
    const result = coverage(loadPreset('draft'));

    expect(result.share).toBeLessThan(0.7);
    expect(result.share).toBeGreaterThan(0);
    // Somebody south of the tracks can reach nothing within the walk.
    expect(result.strandedShare).toBeGreaterThan(0);
  });

  it('measures a 15-minute walk as 15 minutes', () => {
    const minutes = walkMinutes([{ type: 'park', cell: cellIndex(0, 0) }]);
    const twelveCellsOut = minutes.park[cellIndex(12, 0)];

    expect(twelveCellsOut).toBe(REACH_MINUTES);
    expect(coverage([{ type: 'park', cell: cellIndex(0, 0) }]).inReach[cellIndex(12, 0)]).toBe(1);
    expect(coverage([{ type: 'park', cell: cellIndex(0, 0) }]).inReach[cellIndex(13, 0)]).toBe(0);
  });

  it('has a category count that matches the palette', () => {
    expect(coverage([]).categoryCount).toBe(AMENITY_LIST.length);
    expect(AMENITY_LIST).toHaveLength(5);
  });
});

describe('presets', () => {
  it('starts empty, or from the council draft', () => {
    expect(loadPreset('empty')).toEqual([]);
    expect(loadPreset('draft')).toHaveLength(5);
  });

  it('gives every placement an id, so the grid can key on it', () => {
    const ids = loadPreset('draft').map((placement) => placement.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places the draft on the grid, north of the tracks', () => {
    for (const placement of loadPreset('draft')) {
      const { y } = cellCoords(placement.cell);
      expect(y).toBeLessThan(RAIL_ROW);
      expect(placement.cell).toBeLessThan(GRID.cols * GRID.rows);
    }
  });

  it('shrugs off a preset that does not exist', () => {
    expect(loadPreset('nonsense')).toEqual([]);
  });
});
