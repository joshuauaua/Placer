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
  budgetProblems,
  combineBallots,
  formatMoney,
  ownPostProblems,
  ownPostProposals,
  ownPostsState,
  pieSlices,
  readBallot,
  withOwnPosts,
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
    expect(problems([{ ...POSTS[0], unitCost: NaN }])).toEqual(['Give every post a cost per item, as a whole number.']);
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

describe('currency', () => {
  it('is euros for a setup that never chose one', () => {
    expect(ballotOf(OWN).currency).toBe('EUR');
    expect(ballotOf(null).currency).toBe('EUR');
  });

  it('counts a ballot in the currency it was set up with', () => {
    const ballot = ballotOf({ ...OWN, currency: 'SEK' });
    const result = tally({ 'post-1': 2 }, ballot);
    expect(result.currency).toBe('SEK');
    expect(summaryText(result)).toContain(`Spent ${formatMoney(9000, 'SEK')} of ${formatMoney(20000, 'SEK')}`);
  });

  it('formats to the whole unit in each currency', () => {
    expect(formatMoney(250000, 'EUR')).toBe('€250,000');
    expect(formatMoney(1999.6, 'GBP')).toBe('£2,000');
    expect(formatMoney(250000, 'SEK')).toMatch(/250,000/);
  });

  it('wants a currency from the list', () => {
    expect(budgetProblems({ budget: 1000, currency: 'SEK' })).toEqual([]);
    expect(budgetProblems({ budget: 1000, currency: 'XYZ' })).toEqual(['Pick a currency from the list.']);
  });
});

describe('posts people add of their own', () => {
  const ballot = ballotOf({ ...OWN, ownPosts: true });

  it('is a choice the setup makes, yes or no', () => {
    expect(ballotSetupProblems({ ...OWN, ownPosts: true })).toEqual([]);
    expect(ballotSetupProblems({ ...OWN, ownPosts: 'yes' })).toEqual(['Say whether people may add posts of their own.']);
  });

  it('wants a new name and a cost the budget can buy', () => {
    expect(ownPostProblems({ label: 'Bike racks', unitCost: 800 }, ballot)).toEqual([]);
    expect(ownPostProblems({ label: ' ', unitCost: 800 }, ballot)).toEqual(['Give your post a name.']);
    expect(ownPostProblems({ label: 'mural', unitCost: 800 }, ballot)).toEqual(['There is already a post with that name.']);
    expect(ownPostProblems({ label: 'Bike racks', unitCost: NaN }, ballot))
      .toEqual(['Give it a cost per item, as a whole number.']);
    expect(ownPostProblems({ label: 'Bike racks', unitCost: 30000 }, ballot))
      .toEqual(['That costs more per item than the whole budget.']);
  });

  it('caps how many one person can add', () => {
    const own = Array.from({ length: 5 }, (_, i) => ({ key: `own-${i}`, label: `Mine ${i}`, unitCost: 100 }));
    expect(ownPostProblems({ label: 'One more', unitCost: 100 }, ballot, own)).toContain('You can add up to 5 posts of your own.');
  });

  it('joins the person\'s ballot and is spent from the same budget', () => {
    const mine = withOwnPosts(ballot, [{ key: 'own-1', label: 'Bike racks', unitCost: 800 }]);
    expect(mine.posts.at(-1)).toMatchObject({ key: 'own-1', label: 'Bike racks', unitCost: 800, max: 25, own: true });
    expect(tally({ 'post-1': 4, 'own-1': 3 }, mine).spent).toBe(20400);
    expect(affordableQuantity({ 'post-1': 4 }, 'own-1', mine)).toBe(2);
  });

  it('goes to the room as what was spent on it, and stays out of the room\'s average', () => {
    const own = [{ key: 'own-1', label: 'Bike racks ', unitCost: 800 }, { key: 'own-2', label: 'Unspent', unitCost: 50 }];
    const state = { 'post-1': 1, own: ownPostsState(own, { 'own-1': 3 }) };
    expect(state.own).toEqual([{ label: 'Bike racks', unitCost: 800, quantity: 3 }]);
    expect(combineBallots([state], OWN)).toEqual({ 'post-1': 1, 'post-2': 0 });
  });

  it('is gathered by name across the room, the most proposed first', () => {
    const proposals = ownPostProposals([
      { own: [{ label: 'Bike racks', unitCost: 800, quantity: 3 }] },
      { own: [{ label: 'bike racks', unitCost: 1000, quantity: 1 }, { label: 'Pond', unitCost: 5000, quantity: 1 }] },
      { own: [{ label: 'Nonsense', unitCost: -1, quantity: 1 }, null] },
      { 'post-1': 2 },
    ]);
    expect(proposals).toEqual([
      { label: 'Bike racks', people: 2, quantity: 4, spent: 3400 },
      { label: 'Pond', people: 1, quantity: 1, spent: 5000 },
    ]);
  });
});

describe('readBallot', () => {
  it('lists what one ballot bought, the person\'s own posts after the organiser\'s', () => {
    const config = { ...OWN, ownPosts: true };
    const read = readBallot({ 'post-1': 1, own: [{ label: 'Bike racks', unitCost: 500, quantity: 2 }, { label: 'Bad' }] }, config);
    expect(read.items.map((item) => [item.label, item.quantity, item.cost, Boolean(item.own)])).toEqual([
      ['Water fountain', 1, 4500, false],
      ['Bike racks', 2, 1000, true],
    ]);
    expect(read.spent).toBe(5500);
  });

  it('leaves own posts out of a room that did not allow them', () => {
    expect(readBallot({ 'post-2': 1, own: [{ label: 'X', unitCost: 1, quantity: 1 }] }, OWN).items).toHaveLength(1);
  });
});

describe('pieSlices', () => {
  it('is each post bought in the ballot\'s order, then what is left unspent', () => {
    const slices = pieSlices(tally({ 'post-1': 2, 'post-2': 3 }, ballotOf(OWN)));
    expect(slices.map((slice) => [slice.label, slice.cost])).toEqual([
      ['Water fountain', 9000], ['Mural', 6000], ['Unspent', 5000],
    ]);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1);
  });

  it('has no unspent slice when the budget is all spent', () => {
    expect(pieSlices(tally({ 'post-2': 10 }, ballotOf(OWN))).map((slice) => slice.key)).toEqual(['post-2']);
  });

  it('folds the smallest into Other past five posts, so there are never more than six slices', () => {
    const slices = pieSlices(tally({ trees: 1, benches: 1, footway: 1, cycleTrack: 1, crossings: 1, play: 1, lighting: 1 }));
    expect(slices).toHaveLength(6);
    expect(slices.map((slice) => slice.key)).toEqual(['footway', 'crossings', 'play', 'lighting', 'other', 'unspent']);
    expect(slices[4]).toMatchObject({ label: 'Other (3 posts)', cost: 1400 + 900 + 1600 });
  });
});
