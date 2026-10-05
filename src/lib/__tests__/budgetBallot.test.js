import { describe, it, expect } from 'vite-plus/test';
import {
  BUDGET,
  COUNCIL_DRAFT,
  GROUP_LIST,
  INTERVENTIONS,
  INTERVENTION_LIST,
  OUTCOME_LIST,
  MAX_BUDGET,
  affordableQuantity,
  ballotSetupProblems,
  canAfford,
  defaultBallotSetup,
  restrictBallot,
  costOf,
  emptyBallot,
  formatEuros,
  normalise,
  pluralise,
  summaryText,
  tally,
} from '../budgetBallot';

describe('the catalogue', () => {
  it('offers nine things to spend the money on', () => {
    expect(INTERVENTION_LIST).toHaveLength(9);
  });

  it('prices everything, and caps it at what fits on the street', () => {
    for (const intervention of INTERVENTION_LIST) {
      expect(intervention.unitCost).toBeGreaterThan(0);
      expect(intervention.max).toBeGreaterThan(0);
      expect(intervention.unit).toBeTruthy();
    }
  });

  it('offers more than the budget can buy, which is the point', () => {
    const everything = Object.fromEntries(INTERVENTION_LIST.map((item) => [item.key, item.max]));
    expect(tally(everything).spent).toBeGreaterThan(BUDGET * 2);
  });

  it('scores every intervention against every outcome and every group', () => {
    for (const intervention of INTERVENTION_LIST) {
      for (const outcome of OUTCOME_LIST) {
        expect(typeof intervention.effects[outcome.key]).toBe('number');
      }
      for (const group of GROUP_LIST) {
        expect(typeof intervention.groups[group.key]).toBe('number');
      }
    }
  });
});

describe('normalise', () => {
  it('starts everything at nothing', () => {
    expect(Object.values(emptyBallot()).every((quantity) => quantity === 0)).toBe(true);
  });

  it('drops a line nobody is offering', () => {
    expect(normalise({ helicopters: 3 }).helicopters).toBeUndefined();
  });

  it('holds a quantity to what fits on the street', () => {
    expect(normalise({ trees: 999 }).trees).toBe(INTERVENTIONS.trees.max);
    expect(normalise({ trees: -4 }).trees).toBe(0);
  });

  it('rounds a half-tree away', () => {
    expect(normalise({ trees: 3.6 }).trees).toBe(4);
  });

  it('treats rubbish as nothing rather than as NaN', () => {
    expect(normalise({ trees: 'lots' }).trees).toBe(0);
  });
});

describe('costOf', () => {
  it('multiplies out the unit price', () => {
    expect(costOf('trees', 5)).toBe(INTERVENTIONS.trees.unitCost * 5);
  });

  it('charges nothing for something not on offer', () => {
    expect(costOf('helicopters', 5)).toBe(0);
  });
});

describe('tally', () => {
  it('adds the money up and says what is left', () => {
    const result = tally({ trees: 10 });
    expect(result.spent).toBe(14000);
    expect(result.remaining).toBe(BUDGET - 14000);
    expect(result.over).toBe(false);
  });

  it('lists only what was actually chosen', () => {
    const result = tally({ trees: 3, benches: 0 });
    expect(result.items.map((item) => item.key)).toEqual(['trees']);
    expect(result.items[0]).toMatchObject({ quantity: 3, cost: 4200 });
  });

  it('reports an overspend rather than quietly trimming somebody choice', () => {
    const result = tally({ footway: 60, crossings: 4, play: 4 });

    expect(result.over).toBe(true);
    expect(result.overBy).toBe(result.spent - BUDGET);
    expect(result.quantities.footway).toBe(60);
    expect(result.remaining).toBeLessThan(0);
  });

  it('scores the outcomes on one 0-100 axis', () => {
    const result = tally({ trees: 20 });
    expect(result.outcomes.shade).toBeGreaterThan(50);
    expect(result.outcomes.play).toBeLessThan(10);
    for (const outcome of OUTCOME_LIST) {
      expect(result.outcomes[outcome.key]).toBeGreaterThanOrEqual(0);
      expect(result.outcomes[outcome.key]).toBeLessThanOrEqual(100);
    }
  });

  it('never scores past 100, however much is bought', () => {
    const everything = Object.fromEntries(INTERVENTION_LIST.map((item) => [item.key, item.max]));
    for (const outcome of OUTCOME_LIST) {
      expect(tally(everything).outcomes[outcome.key]).toBe(100);
    }
  });

  it('scores nothing for an empty ballot', () => {
    const result = tally({});
    expect(result.spent).toBe(0);
    expect(result.items).toEqual([]);
    expect(Object.values(result.outcomes).every((score) => score === 0)).toBe(true);
    expect(Object.values(result.groups).every((score) => score === 0)).toBe(true);
  });

  it('splits the room: a parklet gains children and costs the shops and the drivers', () => {
    const result = tally({ parklets: 8 });

    expect(result.groups.children).toBeGreaterThan(0);
    expect(result.groups.traders).toBeLessThan(0);
    expect(result.groups.driving).toBeLessThan(0);
    // Measured trade still goes up, which is the argument the tool is making.
    expect(result.outcomes.footfall).toBeGreaterThan(0);
  });

  it('serves older people best with benches and lighting', () => {
    const benches = tally({ benches: 12 }).groups;
    const cycleTrack = tally({ cycleTrack: 60 }).groups;

    expect(benches.older).toBeGreaterThan(benches.cycling);
    expect(cycleTrack.cycling).toBeGreaterThan(cycleTrack.older);
  });

  it('keeps every group score inside the axis it is drawn on', () => {
    const everything = Object.fromEntries(INTERVENTION_LIST.map((item) => [item.key, item.max]));
    for (const group of GROUP_LIST) {
      const score = tally(everything).groups[group.key];
      expect(score).toBeGreaterThanOrEqual(-100);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe('the council draft', () => {
  it('commits most of the budget without going over it', () => {
    const result = tally(COUNCIL_DRAFT);
    expect(result.over).toBe(false);
    expect(result.spent).toBeGreaterThan(BUDGET * 0.7);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('leaves children and play with less than a scheme aimed at them', () => {
    const draft = tally(COUNCIL_DRAFT);
    const forChildren = tally({ play: 4, parklets: 8, cycleTrack: 40 });

    expect(forChildren.outcomes.play).toBeGreaterThan(draft.outcomes.play);
    expect(forChildren.groups.children).toBeGreaterThan(draft.groups.children);
  });
});

describe('canAfford and affordableQuantity', () => {
  it('says yes while there is money left', () => {
    expect(canAfford({}, 'trees', 10)).toBe(true);
  });

  it('says no once there is not', () => {
    expect(canAfford({ footway: 60, crossings: 4 }, 'play', 4)).toBe(false);
  });

  it('works out how many the rest of the budget will buy', () => {
    expect(affordableQuantity({}, 'crossings')).toBe(4);
    expect(affordableQuantity({ footway: 60 }, 'crossings')).toBe(4);
    expect(affordableQuantity({ footway: 60, play: 4, benches: 20 }, 'crossings')).toBeLessThan(4);
  });

  it('ignores the quantity already chosen for the line being asked about', () => {
    expect(affordableQuantity({ trees: 24 }, 'trees')).toBe(INTERVENTIONS.trees.max);
  });

  it('offers none of something not on the list', () => {
    expect(affordableQuantity({}, 'helicopters')).toBe(0);
  });
});

describe('summaryText', () => {
  it('says what was chosen, what it cost, and who it is for', () => {
    const text = summaryText(tally({ trees: 6, benches: 1 }));

    expect(text).toContain('Street trees: 6 trees');
    expect(text).toContain('Benches with backs: 1 bench —');
    expect(summaryText(tally({ benches: 3 }))).toContain('3 benches');
    expect(text).toContain('Shade & cool');
    expect(text).toContain('Older people');
  });

  it('signs the positive group scores', () => {
    expect(summaryText(tally({ trees: 6 }))).toMatch(/Children: \+\d+/);
  });

  it('is honest about an empty ballot', () => {
    expect(summaryText(tally({}))).toContain('Nothing chosen yet');
  });
});

describe('pluralise', () => {
  it('leaves one of anything alone', () => {
    expect(pluralise('bench', 1)).toBe('bench');
  });

  it('adds -es after a sibilant, and -s otherwise', () => {
    expect(pluralise('bench', 3)).toBe('benches');
    expect(pluralise('tree', 3)).toBe('trees');
    expect(pluralise('crossing', 0)).toBe('crossings');
  });

  it('handles every unit in the catalogue', () => {
    for (const item of INTERVENTION_LIST) {
      const plural = pluralise(item.unit, 2);
      expect(plural.endsWith('s')).toBe(true);
      // No unit ends up as "benchs" or "boxs".
      expect(plural).not.toMatch(/(?:ch|sh|s|x|z)s$/);
    }
  });
});

describe('formatEuros', () => {
  it('groups the thousands', () => {
    expect(formatEuros(250000)).toBe('€250,000');
    expect(formatEuros(0)).toBe('€0');
  });
});

describe("a budget of the room's own", () => {
  it('is what tally measures against when it is given', () => {
    const result = tally({ trees: 10 }, 10000);
    expect(result).toMatchObject({ spent: 14000, budget: 10000, remaining: -4000, over: true, overBy: 4000 });
  });

  it('is still €250,000 when it is not', () => {
    expect(tally({}).budget).toBe(BUDGET);
  });

  it('caps what the sliders can reach', () => {
    expect(affordableQuantity({}, 'trees', 10000)).toBe(7);
    expect(canAfford({}, 'trees', 8, 10000)).toBe(false);
  });

  it('is the one the summary quotes', () => {
    expect(summaryText(tally({ benches: 1 }, 50000))).toContain('Spent €900 of €50,000');
  });
});

describe('setting a ballot up', () => {
  it("starts from the Toolkit's own street, which is a setup it accepts", () => {
    expect(defaultBallotSetup()).toEqual({ budget: BUDGET, items: Object.keys(INTERVENTIONS) });
    expect(ballotSetupProblems(defaultBallotSetup())).toEqual([]);
  });

  it('wants a budget in whole euros, and not an absurd one', () => {
    for (const budget of [0, -1, 1.5, '50000', NaN, MAX_BUDGET + 1]) {
      expect(ballotSetupProblems({ budget, items: ['trees'] }), String(budget)).toHaveLength(1);
    }
  });

  it('wants something on the ballot, from the catalogue, once', () => {
    expect(ballotSetupProblems({ budget: 10000, items: [] })).toEqual(['Put at least one thing on the ballot.']);
    expect(ballotSetupProblems({ budget: 10000, items: ['ponies'] })).toHaveLength(1);
    expect(ballotSetupProblems({ budget: 10000, items: ['trees', 'trees'] })).toHaveLength(1);
  });

  it('wants the money to buy one of something', () => {
    expect(ballotSetupProblems({ budget: 1000, items: ['footway'] }))
      .toEqual(['The budget does not buy one of anything on the ballot.']);
  });

  it('survives being handed nothing at all', () => {
    expect(ballotSetupProblems(null)).toHaveLength(2);
  });

  it('takes off a ballot whatever the setup left out', () => {
    expect(restrictBallot({ trees: 3, benches: 2 }, ['benches'])).toMatchObject({ trees: 0, benches: 2 });
  });
});
