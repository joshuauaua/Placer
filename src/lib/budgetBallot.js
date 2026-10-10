/* PLACER — Co-Budget: a fixed budget, and more on the list than it will buy.
 *
 * A ballot is a budget and the posts it can be spent on, each with what one of it
 * costs. Somebody spends the budget across the posts, and the money runs out before
 * the list does — that is the choice the tool exists to make people take.
 *
 * Opened for a project, the organiser writes the ballot: the budget, and each post's
 * name, icon and cost per item (ballotSetupProblems) — and may let people add posts of
 * their own (`ownPosts`), to put an alternative budget forward. Without a setup — on
 * the Toolkit's own page — it is the Toolkit's made-up street below: €250,000 and nine
 * things a neighbourhood might ask for, at order-of-magnitude prices from European
 * streetscape schemes.
 */

export const BUDGET = 250000;

/**
 * What a ballot can be counted in, chosen with the budget (budgetProblems). A setup
 * from before there was a choice has none, and is in euros like the Toolkit's street.
 */
export const CURRENCIES = [
  { code: 'EUR', name: 'Euro' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'GBP', name: 'British pound' },
  { code: 'USD', name: 'US dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'PLN', name: 'Polish złoty' },
];
export const DEFAULT_CURRENCY = 'EUR';
const CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.code));

const currencyOf = (setup) => (CURRENCY_CODES.has(setup?.currency) ? setup.currency : DEFAULT_CURRENCY);

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

/**
 * The most posts one person can add of their own, and the longest name for one. Kept
 * small: a person's ballot is one contribution, and the database holds each to 4,000
 * characters (toolkit_contributions_state_size in supabase/rooms.sql).
 */
export const MAX_OWN_POSTS = 5;
export const MAX_OWN_POST_LABEL = 40;
const OWN_POST_ICON = 'sparkle';

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
  const currency = currencyOf(config);
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
  return { budget, currency, posts: posts.map((post) => ({ ...post, max: postMax(post, budget) })) };
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
    currency: ballot.currency ?? DEFAULT_CURRENCY,
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

/*
 * Posts people add of their own, when the organiser lets them (`ownPosts` on the
 * setup). Each person's are theirs alone: they join that person's ballot as posts
 * like any other, spent from the same budget, and go to the room with it as
 * `own: [{ label, unitCost, quantity }]` beside the quantities. They cannot be averaged
 * into the room's ballot — nobody else has them — so the room shows them apart, as
 * proposals (ownPostProposals).
 */

/** What is wrong with a post somebody wants to add of their own, as sentences. */
export function ownPostProblems({ label, unitCost }, ballot, own = []) {
  const name = typeof label === 'string' ? label.trim() : '';
  const problems = [];
  if (own.length >= MAX_OWN_POSTS) problems.push(`You can add up to ${MAX_OWN_POSTS} posts of your own.`);
  if (!name) problems.push('Give your post a name.');
  else if (name.length > MAX_OWN_POST_LABEL) problems.push(`Keep its name under ${MAX_OWN_POST_LABEL} characters.`);
  else if ([...ballot.posts, ...own].some((post) => post.label.trim().toLowerCase() === name.toLowerCase())) {
    problems.push('There is already a post with that name.');
  }
  if (!Number.isInteger(unitCost) || unitCost <= 0) problems.push('Give it a cost per item, as a whole number.');
  else if (unitCost > ballot.budget) problems.push('That costs more per item than the whole budget.');
  return problems;
}

/** A ballot with somebody's own posts added to it, each `{ key, label, unitCost }`. */
export function withOwnPosts(ballot, own) {
  if (!own?.length) return ballot;
  return {
    ...ballot,
    posts: [
      ...ballot.posts,
      ...own.map((post) => ({
        key: post.key, label: post.label.trim(), icon: OWN_POST_ICON, unitCost: post.unitCost, unit: 'item',
        max: Math.floor(ballot.budget / post.unitCost), own: true,
      })),
    ],
  };
}

/**
 * Somebody's own posts as the room gets them, from what they hold: `[{ label,
 * unitCost, quantity }]`, leaving out any they have added but not spent on.
 */
export function ownPostsState(own, quantities) {
  return own
    .map((post) => ({ label: post.label.trim(), unitCost: post.unitCost, quantity: quantities[post.key] ?? 0 }))
    .filter((post) => post.quantity > 0);
}

/**
 * What the room proposed beyond the organiser's posts: everybody's own posts, put
 * together by name (ignoring case), the most proposed first — how many people put
 * each forward, how many items in all, and what they would spend on it.
 *
 * The states come back from a database other browsers wrote to, so anything that is
 * not a well-formed post is skipped rather than thrown on.
 */
/**
 * The own posts in one ballot as the room got it, well-formed ones only: `[{ label,
 * unitCost, quantity }]`. The state comes back from a database other browsers wrote to.
 */
function ownPostsIn(state) {
  const own = Array.isArray(state?.own) ? state.own.slice(0, MAX_OWN_POSTS) : [];
  return own.flatMap((post) => {
    const label = typeof post?.label === 'string' ? post.label.trim().slice(0, MAX_OWN_POST_LABEL) : '';
    const { unitCost, quantity } = post ?? {};
    if (!label || !Number.isInteger(unitCost) || unitCost <= 0 || !Number.isInteger(quantity) || quantity <= 0) return [];
    return [{ label, unitCost, quantity }];
  });
}

/**
 * One ballot from the room, read against its setup: each post bought — the organiser's,
 * then the person's own, marked `own` — with how many and what it cost, and the total.
 */
export function readBallot(state, config) {
  const ballot = ballotOf(config);
  const result = tally(state, ballot);
  const own = config?.ownPosts ? ownPostsIn(state) : [];
  const items = [
    ...result.items,
    ...own.map((post) => ({ key: `own:${post.label}`, label: post.label, unit: 'item', quantity: post.quantity,
      cost: post.unitCost * post.quantity, own: true })),
  ];
  return { items, spent: items.reduce((sum, item) => sum + item.cost, 0) };
}

export function ownPostProposals(states) {
  const byName = new Map();
  for (const state of states ?? []) {
    const seen = new Set();
    for (const { label, unitCost, quantity } of ownPostsIn(state)) {
      const name = label.toLowerCase();
      const entry = byName.get(name) ?? { label, people: 0, quantity: 0, spent: 0 };
      if (!seen.has(name)) entry.people += 1;
      seen.add(name);
      entry.quantity += quantity;
      entry.spent += unitCost * quantity;
      byName.set(name, entry);
    }
  }
  return [...byName.values()].sort((a, b) => b.people - a.people || b.spent - a.spent);
}

/**
 * "3 benches", not "3 benchs". Enough of a rule for the units in this catalogue —
 * anything ending in a sibilant takes -es.
 */
export function pluralise(unit, quantity) {
  if (quantity === 1) return unit;
  return /(?:s|x|z|ch|sh)$/.test(unit) ? `${unit}es` : `${unit}s`;
}

/** An amount in a ballot's currency, to the whole unit: "€250,000", "SEK 250,000". */
export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatEuros(amount) {
  return formatMoney(amount, 'EUR');
}

/** The currency's own mark, for beside a field: "€", "£", "SEK". */
export function currencySymbol(currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency })
    .formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency;
}

/** A plain-text version of a ballot, for the copy button. */
export function summaryText(result) {
  const lines = [
    'My budget — PLACER Toolkit',
    `Spent ${formatMoney(result.spent, result.currency)} of ${formatMoney(result.budget, result.currency)}`,
    '',
  ];

  if (result.items.length === 0) {
    lines.push('Nothing chosen yet.');
  } else {
    for (const item of result.items) {
      lines.push(`- ${item.label}: ${item.quantity} ${pluralise(item.unit, item.quantity)} — ${formatMoney(item.cost, result.currency)}`);
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
    currency: DEFAULT_CURRENCY,
    budget: BUDGET,
    posts: ['trees', 'benches', 'lighting'].map((key) => {
      const { label, icon, unitCost } = INTERVENTIONS[key];
      return { key, label, icon, unitCost };
    }),
  };
}

/** What is wrong with the budget and its currency, as sentences: the first stage. */
export function budgetProblems(setup) {
  const problems = [];
  if (setup?.currency !== undefined && !CURRENCY_CODES.has(setup.currency)) {
    problems.push('Pick a currency from the list.');
  }
  const budget = setup?.budget;
  if (!Number.isInteger(budget) || budget <= 0 || budget > MAX_BUDGET) {
    problems.push(`Set a budget as a whole number, up to ${formatMoney(MAX_BUDGET, currencyOf(setup))}.`);
  }
  return problems;
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

  if (setup.ownPosts !== undefined && typeof setup.ownPosts !== 'boolean') {
    problems.push('Say whether people may add posts of their own.');
  }

  const costs = posts.map((post) => post?.unitCost);
  if (costs.some((cost) => !Number.isInteger(cost) || cost <= 0)) {
    problems.push('Give every post a cost per item, as a whole number.');
  } else if (Number.isInteger(budget) && budget > 0 && costs.some((cost) => cost > budget)) {
    problems.push('A post costs more per item than the whole budget. Lower its cost, or raise the budget.');
  }
  return problems;
}

/** What is wrong with a setup, as sentences for the organiser. Empty when it is ready. */
export function ballotSetupProblems(setup) {
  return [...budgetProblems(setup), ...postProblems(setup)];
}
