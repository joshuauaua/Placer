/* PLACER — Co-Budget: a fixed budget, and more on the list than it will buy.
 *
 * A ballot is a budget and the posts it can be spent on, each with what one of it
 * costs. Somebody spends the budget across the posts, and the money runs out before
 * the list does — that is the choice the tool exists to make people take.
 *
 * Opened for a project, the organiser writes the ballot: the budget, and each post's
 * name, icon and cost per item (ballotSetupProblems). Without one — on the Toolkit's
 * own page — it is the Toolkit's made-up street below: €250,000 and nine things a
 * neighbourhood might ask for, at order-of-magnitude prices from European streetscape
 * schemes.
 */

export const BUDGET = 250000;

/**
 * The Toolkit's own street. `max` is what physically fits on it, which is usually
 * reached well after the money runs out — that is the point.
 */
export const INTERVENTIONS = {
  trees: {
    key: 'trees', label: 'Street trees', unit: 'tree', unitCost: 1400, max: 24, icon: 'tree',
    note: 'Big canopy species in a proper pit, not a tub.',
  },
  benches: {
    key: 'benches', label: 'Benches with backs', unit: 'bench', unitCost: 900, max: 20, icon: 'bench',
    note: 'A bench every 50 metres is what turns a route into a walkable one.',
  },
  footway: {
    key: 'footway', label: 'Widened footway', unit: 'metre', unitCost: 2200, max: 60, icon: 'user',
    note: 'Taken from the carriageway, so two people with buggies can pass.',
  },
  cycleTrack: {
    key: 'cycleTrack', label: 'Protected cycle track', unit: 'metre', unitCost: 1600, max: 80, icon: 'bike',
    note: 'Kerb-separated, both directions, continuous across side roads.',
  },
  crossings: {
    key: 'crossings', label: 'Raised crossings', unit: 'crossing', unitCost: 18000, max: 4, icon: 'crosshair',
    note: 'Level with the footway, so the car is the one that has to climb.',
  },
  play: {
    key: 'play', label: 'Play equipment', unit: 'set', unitCost: 12000, max: 4, icon: 'play',
    note: 'Loose, informal kit rather than a fenced playground.',
  },
  parklets: {
    key: 'parklets', label: 'Parking bay → parklet', unit: 'bay', unitCost: 6000, max: 10, icon: 'planter',
    note: 'Measured trade usually goes up. The shops still ask for the parking back.',
  },
  lighting: {
    key: 'lighting', label: 'Warmer street lighting', unit: 'lamp', unitCost: 3200, max: 12, icon: 'light',
    note: 'Lit at head height for people walking, not just at the road surface.',
  },
  rainGarden: {
    key: 'rainGarden', label: 'Rain gardens', unit: 'garden', unitCost: 8000, max: 6, icon: 'planter',
    note: 'Takes the downpour the drains cannot, and looks after itself.',
  },
};

export const INTERVENTION_LIST = Object.values(INTERVENTIONS);

/**
 * What the council put on the table for the Toolkit's street: cautious, mostly footway
 * and crossings, and three quarters of the money already committed. Beating it means
 * taking something out, which is the argument the tool exists to have.
 */
export const COUNCIL_DRAFT = {
  trees: 8,
  benches: 6,
  footway: 40,
  crossings: 3,
  lighting: 8,
};

/** The icons an organiser can give a post. */
export const POST_ICONS = [
  'tree', 'planter', 'bench', 'light', 'play', 'art', 'bike', 'walk', 'path', 'crosshair',
  'cart', 'building', 'home', 'user', 'heart', 'camera', 'flag', 'sparkle', 'coins', 'gear',
];

/** The fewest and most posts a ballot can have, and the longest name for one. */
export const MIN_POSTS = 1;
export const MAX_POSTS = 20;
export const MAX_POST_LABEL = 60;

/** The largest budget a room can be set up with. Past this it is not a street. */
export const MAX_BUDGET = 100_000_000;

/** The most of one post a ballot can have: what fits, or failing that what the budget buys. */
function postMax(post, budget) {
  return Number.isInteger(post.max) ? post.max : Math.floor(budget / post.unitCost);
}

/**
 * The ballot a room's setup describes, as { budget, posts }. A setup with `posts` is
 * the organiser's own. One with `items` was set up before posts could be written —
 * a budget and a pick from the Toolkit's street — and is read as that. No setup at
 * all is the Toolkit's street, whole.
 */
export function ballotOf(config) {
  const budget = Number.isInteger(config?.budget) && config.budget > 0 ? config.budget : BUDGET;
  let posts;
  if (Array.isArray(config?.posts)) {
    posts = config.posts.map((post) => ({
      key: post.key,
      label: post.label.trim(),
      icon: post.icon,
      unitCost: post.unitCost,
      unit: 'item',
    }));
  } else if (Array.isArray(config?.items)) {
    posts = INTERVENTION_LIST.filter((item) => config.items.includes(item.key));
  } else {
    posts = INTERVENTION_LIST;
  }
  return { budget, posts: posts.map((post) => ({ ...post, max: postMax(post, budget) })) };
}

const TOOLKIT_BALLOT = ballotOf(null);

export function emptyBallot(ballot = TOOLKIT_BALLOT) {
  return Object.fromEntries(ballot.posts.map((post) => [post.key, 0]));
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Quantities with the unknown keys dropped and the rest clamped to what fits. */
export function normalise(quantities = {}, ballot = TOOLKIT_BALLOT) {
  const result = emptyBallot(ballot);
  const byKey = new Map(ballot.posts.map((post) => [post.key, post]));
  for (const [key, value] of Object.entries(quantities ?? {})) {
    const post = byKey.get(key);
    if (!post) continue;
    result[key] = clamp(Math.round(Number(value) || 0), 0, post.max);
  }
  return result;
}

/**
 * Add up a ballot: what each post costs and what it all comes to.
 *
 * Overspending is reported rather than clamped — the caller decides whether to
 * refuse the change or show the number in red, and silently trimming somebody's
 * choice is the one thing a participatory tool must not do.
 */
export function tally(quantities, ballot = TOOLKIT_BALLOT) {
  const chosen = normalise(quantities, ballot);
  let spent = 0;
  const items = [];

  for (const post of ballot.posts) {
    const quantity = chosen[post.key];
    const cost = post.unitCost * quantity;
    spent += cost;
    if (quantity > 0) items.push({ key: post.key, label: post.label, unit: post.unit, quantity, cost });
  }

  return {
    quantities: chosen,
    items,
    spent,
    budget: ballot.budget,
    remaining: ballot.budget - spent,
    over: spent > ballot.budget,
    overBy: Math.max(0, spent - ballot.budget),
  };
}

/** The largest quantity of one post the remaining money will buy. */
export function affordableQuantity(quantities, key, ballot = TOOLKIT_BALLOT) {
  const post = ballot.posts.find((entry) => entry.key === key);
  if (!post) return 0;
  const current = normalise(quantities, ballot);
  const others = tally({ ...current, [key]: 0 }, ballot).spent;
  return clamp(Math.floor((ballot.budget - others) / post.unitCost), 0, post.max);
}

/**
 * The room's ballot is the average of everybody's, not the total.
 *
 * A ballot is one fixed budget spent one way, so adding twenty of them together gives
 * a five-million-euro wishlist and throws away the only thing the tool is about. The
 * mean is itself a ballot somebody could have cast: it says what the room would fund,
 * and it still fits the room's budget.
 */
export function combineBallots(states, config) {
  const ballot = ballotOf(config);
  if (states.length === 0) return emptyBallot(ballot);

  const total = emptyBallot(ballot);
  for (const state of states) {
    for (const key of Object.keys(total)) total[key] += Number(state?.[key]) || 0;
  }
  for (const key of Object.keys(total)) {
    total[key] = Math.round(total[key] / states.length);
  }
  return normalise(total, ballot);
}

/**
 * "3 benches", not "3 benchs". Enough of a rule for the units in this catalogue —
 * anything ending in a sibilant takes -es.
 */
export function pluralise(unit, quantity) {
  if (quantity === 1) return unit;
  return /(?:s|x|z|ch|sh)$/.test(unit) ? `${unit}es` : `${unit}s`;
}

export function formatEuros(amount) {
  return `€${Math.round(amount).toLocaleString('en-GB')}`;
}

/** A plain-text version of a ballot, for the copy button. */
export function summaryText(result) {
  const lines = [
    'My budget — PLACER Toolkit',
    `Spent ${formatEuros(result.spent)} of ${formatEuros(result.budget)}`,
    '',
  ];

  if (result.items.length === 0) {
    lines.push('Nothing chosen yet.');
  } else {
    for (const item of result.items) {
      lines.push(`- ${item.label}: ${item.quantity} ${pluralise(item.unit, item.quantity)} — ${formatEuros(item.cost)}`);
    }
  }

  return lines.join('\n');
}

/*
 * Setting a ballot up for a room.
 *
 * An organiser opening a room on a project writes the ballot — the budget, and the
 * posts it can go on — for their place, not the Toolkit's imaginary one. The setup is
 * fixed when the room opens (supabase/rooms-config.sql), so everybody in the room
 * argues over the same money.
 */

/** A post the organiser has not written yet, with a key no other post in `posts` has. */
export function newPost(posts = []) {
  const taken = new Set(posts.map((post) => post.key));
  let n = posts.length + 1;
  while (taken.has(`post-${n}`)) n += 1;
  return { key: `post-${n}`, label: '', icon: POST_ICONS[0], unitCost: NaN };
}

/** What a new room starts from: the Toolkit's €250,000, and three of its posts to rewrite. */
export function defaultBallotSetup() {
  return {
    budget: BUDGET,
    posts: ['trees', 'benches', 'lighting'].map((key) => {
      const { label, icon, unitCost } = INTERVENTIONS[key];
      return { key, label, icon, unitCost };
    }),
  };
}

/** What is wrong with the budget, as sentences: the first stage of setting a ballot up. */
export function budgetProblems(setup) {
  const budget = setup?.budget;
  if (!Number.isInteger(budget) || budget <= 0 || budget > MAX_BUDGET) {
    return [`Set a budget in whole euros, up to ${formatEuros(MAX_BUDGET)}.`];
  }
  return [];
}

/** What is wrong with the posts, as sentences: the second stage. */
export function postProblems(setup) {
  const budget = setup?.budget;
  const posts = setup?.posts;

  // Set up before posts could be written: a pick from the Toolkit's street.
  if (posts === undefined && Array.isArray(setup?.items)) {
    const { items } = setup;
    if (items.length === 0) return ['Put at least one thing on the ballot.'];
    if (items.some((key) => !INTERVENTIONS[key]) || new Set(items).size !== items.length) {
      return ['The ballot lists something that is not in the catalogue, or lists it twice.'];
    }
    return [];
  }

  if (!Array.isArray(posts) || posts.length < MIN_POSTS) return ['Add at least one post to spend the budget on.'];

  const problems = [];
  if (posts.length > MAX_POSTS) problems.push(`Keep it to ${MAX_POSTS} posts at most.`);

  const labels = posts.map((post) => (typeof post?.label === 'string' ? post.label.trim() : ''));
  if (labels.some((label) => !label)) problems.push('Give every post a name, or remove the empty ones.');
  if (labels.some((label) => label.length > MAX_POST_LABEL)) {
    problems.push(`Keep each post's name under ${MAX_POST_LABEL} characters.`);
  }
  const named = labels.filter(Boolean).map((label) => label.toLowerCase());
  if (new Set(named).size !== named.length) problems.push('Give each post a different name.');

  const keys = posts.map((post) => post?.key);
  if (keys.some((key) => typeof key !== 'string' || !key) || new Set(keys).size !== keys.length) {
    problems.push('Every post needs a key of its own.');
  }
  if (posts.some((post) => !POST_ICONS.includes(post?.icon))) problems.push('Pick an icon for every post.');

  const costs = posts.map((post) => post?.unitCost);
  if (costs.some((cost) => !Number.isInteger(cost) || cost <= 0)) {
    problems.push('Give every post a cost per item, in whole euros.');
  } else if (Number.isInteger(budget) && budget > 0 && costs.some((cost) => cost > budget)) {
    problems.push('A post costs more per item than the whole budget. Lower its cost, or raise the budget.');
  }
  return problems;
}

/** What is wrong with a setup, as sentences for the organiser. Empty when it is ready. */
export function ballotSetupProblems(setup) {
  return [...budgetProblems(setup), ...postProblems(setup)];
}
