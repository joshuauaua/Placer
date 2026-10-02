import { describe, it, expect } from 'vite-plus/test';
import { CATEGORIES, ORGANISATIONS, TOOLS, filterTools, findCategory, findTool } from '../tools';
import { BUDGET, emptyBallot, tally } from '../../lib/budgetBallot';
import { emptyVote } from '../../lib/openVote';

describe('the register', () => {
  it('finds a tool by the id in its URL', () => {
    expect(findTool('budget-ballot')).toMatchObject({ id: 'budget-ballot' });
  });

  it('is null for an id that is not one, rather than throwing', () => {
    expect(findTool('not-a-tool')).toBeNull();
  });

  it('puts every tool in one of the categories', () => {
    for (const tool of TOOLS) {
      expect(findCategory(tool.category), tool.id).not.toBeNull();
    }
  });

  it('says which organisation created every tool', () => {
    for (const tool of TOOLS) {
      expect(typeof tool.createdBy, tool.id).toBe('string');
      expect(tool.createdBy.length, tool.id).toBeGreaterThan(0);
    }
  });

  it('lists the categories as Understand, Imagine and Plan', () => {
    expect(CATEGORIES.map((category) => category.name)).toEqual(['Understand', 'Imagine', 'Plan']);
  });

  it('gives every room-capable tool both halves of the contract', () => {
    // A `room` with only one of these would fail at runtime, in a room, in front of
    // people — so it is checked here instead.
    for (const tool of TOOLS.filter((entry) => entry.room)) {
      expect(typeof tool.room.empty).toBe('function');
      expect(typeof tool.room.combine).toBe('function');
    }
  });
});

describe('filterTools', () => {
  const ids = (filters) => filterTools(TOOLS, filters).map((tool) => tool.id);

  it('returns every tool with no filters', () => {
    expect(ids({})).toHaveLength(TOOLS.length);
  });

  it('searches names, taglines, descriptions and organisations, ignoring case', () => {
    expect(ids({ query: 'BUDGET' })).toEqual(['budget-ballot']);
    expect(ids({ query: 'gehl' })).toEqual(['social-space-survey']);
    expect(ids({ query: 'cycle track' })).toContain('street-mixer');
  });

  it('ignores accents, so a plain query finds an accented word', () => {
    const accented = [{ ...TOOLS[0], id: 'accented', name: 'Malmö mapping' }];
    expect(filterTools(accented, { query: 'malmo' }).map((tool) => tool.id)).toEqual(['accented']);
  });

  it('needs every word of the query to match somewhere', () => {
    expect(ids({ query: 'vote room-free-nonsense' })).toEqual([]);
  });

  it('filters by category', () => {
    expect(ids({ category: 'plan' })).toEqual(['budget-ballot', 'open-vote']);
    expect(ids({ category: 'imagine' })).toEqual(['street-mixer']);
  });

  it('filters by the organisation that made the tool', () => {
    expect(ids({ organisation: 'Gehl Institute' })).toEqual(['social-space-survey']);
  });

  it('keeps only the tools that can run in a room when asked', () => {
    expect(ids({ groupOnly: true })).toEqual(['budget-ballot', 'open-vote']);
  });

  it('combines filters', () => {
    expect(ids({ category: 'understand', query: 'map' })).toEqual(
      expect.arrayContaining(['site-spatial-mapping', 'stationary-activity-mapping']),
    );
    expect(ids({ category: 'imagine', groupOnly: true })).toEqual([]);
  });

  it('lists each organisation once, alphabetically', () => {
    expect(ORGANISATIONS).toEqual(['Gehl Institute', 'PLACER']);
  });
});

describe("the Budget Ballot's room", () => {
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

describe("the Open Vote's room", () => {
  const { room } = findTool('open-vote');

  it('starts a participant with no choice made', () => {
    expect(room.empty()).toEqual(emptyVote());
  });

  it('counts every vote by its choice', () => {
    const combined = room.combine([{ choice: 'yes' }, { choice: 'yes' }, { choice: 'no' }]);

    expect(combined.counts).toEqual({ yes: 2, no: 1, undecided: 0 });
    expect(combined.total).toBe(3);
  });

  it('is an empty tally when nobody has voted', () => {
    expect(room.combine([])).toEqual({
      counts: { yes: 0, no: 0, undecided: 0 },
      shares: { yes: 0, no: 0, undecided: 0 },
      total: 0,
    });
  });

  it('ignores a contribution that is missing or malformed', () => {
    // The state comes back from a database that other browsers wrote to.
    const combined = room.combine([{ choice: 'yes' }, null, { choice: undefined }, { choice: 'maybe' }]);

    expect(combined.counts).toEqual({ yes: 1, no: 0, undecided: 0 });
    expect(combined.total).toBe(1);
  });
});
