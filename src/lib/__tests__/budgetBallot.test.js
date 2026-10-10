import { describe, it, expect } from 'vite-plus/test';
import {
  BUDGET,
  COUNCIL_DRAFT,
  INTERVENTIONS,
  INTERVENTION_LIST,
  MAX_POSTS,
  POST_ICONS,
  affordableQuantity,
  ballotOf,
  ballotSetupProblems,
  combineBallots,
  defaultBallotSetup,
  emptyBallot,
  formatEuros,
  newPost,
  normalise,
  pluralise,
  summaryText,
  tally,
} from '../budgetBallot';

const POSTS = [
  { key: 'post-1', label: 'Water fountain', icon: 'sparkle', unitCost: 4500 },
  { key: 'post-2', label: ' Mural ', icon: 'art', unitCost: 2000 },
];
const OWN = { budget: 20000, posts: POSTS };

describe('the catalogue', () => {
  it('prices everything, gives it a limit and an icon an organiser could pick too', () => {
    for (const item of INTERVENTION_LIST) {
      expect(item.unitCost, item.key).toBeGreaterThan(0);
      expect(item.max, item.key).toBeGreaterThan(0);
      expect(POST_ICONS, item.key).toContain(item.icon);
    }
  });

  it('carries no outcomes or who gains', () => {
    for (const item of INTERVENTION_LIST) {
      expect(item).not.toHaveProperty('effects');
      expect(item).not.toHaveProperty('groups');
    }
  });

  it('costs more in full than the budget, so there is a choice to make', () => {
    const everything = Object.fromEntries(INTERVENTION_LIST.map((item) => [item.key, item.max]));
    expect(tally(everything).spent).toBeGreaterThan(BUDGET * 2);
  });
});

describe('ballotOf', () => {
  it('is the Toolkit street with no setup', () => {
    const ballot = ballotOf(null);
    expect(ballot.budget).toBe(BUDGET);
    expect(ballot.posts.map((post) => post.key)).toEqual(Object.keys(INTERVENTIONS));
  });

  it('reads the organiser\'s posts, capped at what the budget buys', () => {
    const ballot = ballotOf(OWN);
    expect(ballot.budget).toBe(20000);
    expect(ballot.posts).toEqual([
      { key: 'post-1', label: 'Water fountain', icon: 'sparkle', unitCost: 4500, unit: 'item', max: 4 },
      { key: 'post-2', label: 'Mural', icon: 'art', unitCost: 2000, unit: 'item', max: 10 },
    ]);
  });

  it('reads a setup from before posts, as a pick from the Toolkit street', () => {
    const ballot = ballotOf({ budget: 50000, items: ['benches', 'lighting'] });
    expect(ballot.budget).toBe(50000);
    expect(ballot.posts.map((post) => post.key)).toEqual(['benches', 'lighting']);
    expect(ballot.posts[0].max).toBe(INTERVENTIONS.benches.max);
  });
});

describe('normalise', () => {
  it('drops unknown keys and clamps to what fits', () => {
    const ballot = ballotOf(OWN);
    expect(normalise({ 'post-1': 9, 'post-2': -3, trees: 4 }, ballot)).toEqual({ 'post-1': 4, 'post-2': 0 });
  });
});

describe('tally', () => {
  it('adds up what each post costs', () => {
    const result = tally({ 'post-1': 2, 'post-2': 3 }, ballotOf(OWN));
    expect(result.spent).toBe(15000);
    expect(result.remaining).toBe(5000);
    expect(result.items).toEqual([
      { key: 'post-1', label: 'Water fountain', unit: 'item', quantity: 2, cost: 9000 },
      { key: 'post-2', label: 'Mural', unit: 'item', quantity: 3, cost: 6000 },
    ]);
  });

  it('reports an overspend rather than trimming it', () => {
    const result = tally({ 'post-1': 4, 'post-2': 5 }, ballotOf(OWN));
    expect(result.over).toBe(true);
    expect(result.overBy).toBe(8000);
  });

  it('prices the council draft for the Toolkit street', () => {
    expect(tally(COUNCIL_DRAFT).remaining).toBe(65800);
  });
});

describe('affordableQuantity', () => {
  it('is what the money left will buy of one post', () => {
    const ballot = ballotOf(OWN);
    expect(affordableQuantity({ 'post-2': 5 }, 'post-1', ballot)).toBe(2);
    expect(affordableQuantity({}, 'nonsense', ballot)).toBe(0);
  });
});

describe('combineBallots', () => {
  it('averages the room\'s ballots against the room\'s own posts', () => {
    expect(combineBallots([{ 'post-1': 4 }, { 'post-1': 2, trees: 9 }], OWN)).toEqual({ 'post-1': 3, 'post-2': 0 });
  });

  it('is an empty ballot when nobody has cast one', () => {
    expect(combineBallots([], OWN)).toEqual(emptyBallot(ballotOf(OWN)));
  });
});

describe('summaryText', () => {
  it('says what was chosen and what it cost, and nothing about who gains', () => {
    const text = summaryText(tally({ benches: 3 }));
    expect(text).toContain('Benches with backs: 3 benches — €2,700');
    expect(text).toContain('Spent €2,700 of €250,000');
    expect(text).not.toMatch(/who gains|achieves/i);
  });
});

describe('setting a ballot up', () => {
  it('starts from a setup it accepts', () => {
    expect(ballotSetupProblems(defaultBallotSetup())).toEqual([]);
  });

  it('accepts the organiser\'s own posts', () => {
    expect(ballotSetupProblems(OWN)).toEqual([]);
  });

  it('still accepts a setup from before posts', () => {
    expect(ballotSetupProblems({ budget: 50000, items: ['benches'] })).toEqual([]);
    expect(ballotSetupProblems({ budget: 50000, items: [] })).toEqual(['Put at least one thing on the ballot.']);
  });

  it('wants a budget in whole euros', () => {
    expect(ballotSetupProblems({ ...OWN, budget: NaN })).toHaveLength(1);
    expect(ballotSetupProblems({ ...OWN, budget: 0 })).toHaveLength(1);
  });

  it('wants every post named, iconed and priced, and named differently', () => {
    const problems = (posts) => ballotSetupProblems({ budget: 20000, posts });
    expect(problems([])).toEqual(['Add at least one post to spend the budget on.']);
    expect(problems([{ ...POSTS[0], label: ' ' }])).toEqual(['Give every post a name, or remove the empty ones.']);
    expect(problems([POSTS[0], { ...POSTS[1], label: 'water fountain' }])).toEqual(['Give each post a different name.']);
    expect(problems([{ ...POSTS[0], icon: 'nonsense' }])).toEqual(['Pick an icon for every post.']);
    expect(problems([{ ...POSTS[0], unitCost: NaN }])).toEqual(['Give every post a cost per item, in whole euros.']);
    expect(problems([{ ...POSTS[0], unitCost: 25000 }])).toHaveLength(1);
    expect(problems(Array.from({ length: MAX_POSTS + 1 }, (_, i) => ({ ...POSTS[0], key: `k${i}`, label: `P${i}` }))))
      .toHaveLength(1);
  });

  it('gives a new post a key no other post has', () => {
    expect(newPost([{ key: 'post-2' }, { key: 'trees' }]).key).toBe('post-3');
    expect(newPost([{ key: 'post-2' }]).key).toBe('post-3');
  });
});

describe('formatting', () => {
  it('pluralises the catalogue\'s units', () => {
    expect(pluralise('bench', 2)).toBe('benches');
    expect(pluralise('item', 1)).toBe('item');
  });

  it('formats euros', () => {
    expect(formatEuros(250000)).toBe('€250,000');
  });
});
