import { describe, it, expect } from 'vite-plus/test';
import { findTool } from '../../tools';
import { BUDGET, emptyBallot, tally } from '../../../lib/budgetBallot';

describe("the Co-Budget's room", () => {
  const { room } = findTool('budget-ballot');

  it('starts a participant from an empty ballot', () => {
    expect(room.empty()).toEqual(emptyBallot());
  });

  it('averages the ballots rather than adding them up', () => {
    // benches cost 900 each: 4 and 2 average to 3, so the room commits 2700 — not
    // the 5400 a sum would report.
    const combined = room.combine([{ benches: 4 }, { benches: 2 }]);

    expect(combined.benches).toBe(3);
    expect(tally(combined).spent).toBe(2700);
  });

  it('rounds to something somebody could actually build', () => {
    const combined = room.combine([{ benches: 1 }, { benches: 2 }]);

    expect(Number.isInteger(combined.benches)).toBe(true);
    expect(combined.benches).toBe(2);
  });

  it("keeps the room's ballot inside the budget, which is the whole point", () => {
    // Twenty people all spending the entire budget on different things must not
    // produce a combined ballot that spends twenty budgets.
    const maxed = [
      { footway: 60, benches: 20 },
      { cycleTrack: 80, trees: 24 },
      { footway: 60, cycleTrack: 80, trees: 24, benches: 20 },
    ];

    expect(tally(room.combine(maxed)).spent).toBeLessThanOrEqual(BUDGET);
  });

  it('is an empty ballot when nobody has cast one', () => {
    expect(room.combine([])).toEqual(emptyBallot());
  });

  it('ignores a contribution that is missing or malformed', () => {
    // The state comes back from a database that other browsers wrote to.
    const combined = room.combine([{ benches: 4 }, null, { benches: undefined }, { nonsense: 5 }]);

    expect(combined).toEqual(expect.objectContaining({ benches: 1 }));
    expect(combined).not.toHaveProperty('nonsense');
  });
});

describe('telling its rooms apart', () => {
  const { room } = findTool('budget-ballot');

  it('labels a room by what it was set up with', () => {
    expect(room.label({ budget: 1000, posts: [{ key: 'trees', label: 'Trees' }, { key: 'benches', label: 'Benches' }] })).toBe('Trees, Benches');
  });

  it('has no label for a room set up with nothing it can use', () => {
    for (const config of [null, {}, 'garbage', { question: 7, prompt: '  ', questions: [], posts: 'none' }]) {
      expect(room.label(config), JSON.stringify(config)).toBeNull();
    }
  });
});
