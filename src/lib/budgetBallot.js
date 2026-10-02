/* PLACER — Budget Ballot: one street, a quarter of a million euros, no way to have it all.
 *
 * Nine things a neighbourhood might ask for, with what each one costs and what each
 * one does. The interesting part is not the total — it is that some of the effects
 * point in opposite directions, so a scheme that scores well for children can score
 * badly for the shopkeepers whose support it needs.
 *
 * Costs are order-of-magnitude figures from European streetscape schemes. They are
 * here to make the trade-off honest, not to price a tender.
 */

export const BUDGET = 250000;

/** What a scheme is trying to achieve. */
export const OUTCOMES = {
  shade: { key: 'shade', label: 'Shade & cool', color: '#123F73' },
  safety: { key: 'safety', label: 'Feels safe', color: '#1D5FA8' },
  play: { key: 'play', label: 'Room to play', color: '#5B3CB8' },
  footfall: { key: 'footfall', label: 'Local trade', color: '#9E4600' },
};

/** Who ends up better or worse off. These are allowed to go negative. */
export const GROUPS = {
  children: { key: 'children', label: 'Children' },
  older: { key: 'older', label: 'Older people' },
  cycling: { key: 'cycling', label: 'People cycling' },
  driving: { key: 'driving', label: 'People driving' },
  traders: { key: 'traders', label: 'Shopkeepers' },
};

export const OUTCOME_LIST = Object.values(OUTCOMES);
export const GROUP_LIST = Object.values(GROUPS);

/**
 * `effects` and `groups` are per unit. `max` is what physically fits on the street,
 * which is usually reached well after the money runs out — that is the point.
 */
export const INTERVENTIONS = {
  trees: {
    key: 'trees', label: 'Street trees', unit: 'tree', unitCost: 1400, max: 24, icon: 'tree',
    note: 'Big canopy species in a proper pit, not a tub.',
    effects: { shade: 4, safety: 0.4, play: 0.2, footfall: 0.6 },
    groups: { children: 1, older: 2.4, cycling: 0.6, driving: 0.2, traders: 0.8 },
  },
  benches: {
    key: 'benches', label: 'Benches with backs', unit: 'bench', unitCost: 900, max: 20, icon: 'bench',
    note: 'A bench every 50 metres is what turns a route into a walkable one.',
    effects: { shade: 0, safety: 1, play: 0.6, footfall: 1.2 },
    groups: { children: 0.6, older: 4, cycling: 0.2, driving: 0, traders: 1.4 },
  },
  footway: {
    key: 'footway', label: 'Widened footway', unit: 'metre', unitCost: 2200, max: 60, icon: 'user',
    note: 'Taken from the carriageway, so two people with buggies can pass.',
    effects: { shade: 0.2, safety: 1.4, play: 1, footfall: 1.6 },
    groups: { children: 1.6, older: 2, cycling: 0.2, driving: -1.2, traders: 0.6 },
  },
  cycleTrack: {
    key: 'cycleTrack', label: 'Protected cycle track', unit: 'metre', unitCost: 1600, max: 80, icon: 'bike',
    note: 'Kerb-separated, both directions, continuous across side roads.',
    effects: { shade: 0, safety: 1.2, play: 0.2, footfall: 0.8 },
    groups: { children: 1.4, older: 0.6, cycling: 4, driving: -1, traders: 0.4 },
  },
  crossings: {
    key: 'crossings', label: 'Raised crossings', unit: 'crossing', unitCost: 18000, max: 4, icon: 'crosshair',
    note: 'Level with the footway, so the car is the one that has to climb.',
    effects: { shade: 0, safety: 9, play: 2, footfall: 3 },
    groups: { children: 8, older: 7, cycling: 2, driving: -3, traders: 2 },
  },
  play: {
    key: 'play', label: 'Play equipment', unit: 'set', unitCost: 12000, max: 4, icon: 'play',
    note: 'Loose, informal kit rather than a fenced playground.',
    effects: { shade: 0, safety: 1, play: 12, footfall: 2 },
    groups: { children: 12, older: 1, cycling: 0, driving: 0, traders: 1.5 },
  },
  parklets: {
    key: 'parklets', label: 'Parking bay → parklet', unit: 'bay', unitCost: 6000, max: 10, icon: 'planter',
    note: 'Measured trade usually goes up. The shops still ask for the parking back.',
    effects: { shade: 0.5, safety: 1.2, play: 2.5, footfall: 3 },
    groups: { children: 2.5, older: 1.5, cycling: 0.8, driving: -6, traders: -4 },
  },
  lighting: {
    key: 'lighting', label: 'Warmer street lighting', unit: 'lamp', unitCost: 3200, max: 12, icon: 'light',
    note: 'Lit at head height for people walking, not just at the road surface.',
    effects: { shade: 0, safety: 6, play: 0.5, footfall: 1.4 },
    groups: { children: 2, older: 5, cycling: 2.5, driving: 0.6, traders: 1.6 },
  },
  rainGarden: {
    key: 'rainGarden', label: 'Rain gardens', unit: 'garden', unitCost: 8000, max: 6, icon: 'planter',
    note: 'Takes the downpour the drains cannot, and looks after itself.',
    effects: { shade: 1.5, safety: 0.4, play: 1, footfall: 0.8 },
    groups: { children: 1.4, older: 1, cycling: 0.4, driving: 0, traders: 0.6 },
  },
};

export const INTERVENTION_LIST = Object.values(INTERVENTIONS);

// Full marks is what a scheme that spends the whole budget on this one thing gets.
// Calibrated against what €250,000 actually buys, so a single-minded scheme pins the
// bar and a balanced one lands in the middle — rather than everything reading 100.
const OUTCOME_SCALE = { shade: 100, safety: 180, play: 100, footfall: 140 };
const GROUP_SCALE = 150;

/**
 * What the council put on the table: cautious, mostly footway and crossings, and
 * three quarters of the money already committed. Beating it means taking something
 * out, which is the argument the tool exists to have.
 */
export const COUNCIL_DRAFT = {
  trees: 8,
  benches: 6,
  footway: 40,
  crossings: 3,
  lighting: 8,
};

export function emptyBallot() {
  return Object.fromEntries(Object.keys(INTERVENTIONS).map((key) => [key, 0]));
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Quantities with the unknown keys dropped and the rest clamped to what fits. */
export function normalise(quantities = {}) {
  const result = emptyBallot();
  for (const [key, value] of Object.entries(quantities)) {
    const intervention = INTERVENTIONS[key];
    if (!intervention) continue;
    const quantity = Math.round(Number(value) || 0);
    result[key] = clamp(quantity, 0, intervention.max);
  }
  return result;
}

export function costOf(key, quantity) {
  const intervention = INTERVENTIONS[key];
  if (!intervention) return 0;
  return intervention.unitCost * clamp(Math.round(quantity) || 0, 0, intervention.max);
}

/**
 * Add up a ballot: what it costs, what it achieves, and who it is for.
 *
 * Overspending is reported rather than clamped — the caller decides whether to
 * refuse the change or show the number in red, and silently trimming somebody's
 * choice is the one thing a participatory tool must not do.
 */
export function tally(quantities) {
  const chosen = normalise(quantities);
  const rawOutcomes = Object.fromEntries(Object.keys(OUTCOMES).map((key) => [key, 0]));
  const rawGroups = Object.fromEntries(Object.keys(GROUPS).map((key) => [key, 0]));

  let spent = 0;
  const items = [];

  for (const [key, quantity] of Object.entries(chosen)) {
    const intervention = INTERVENTIONS[key];
    const cost = intervention.unitCost * quantity;
    spent += cost;
    if (quantity > 0) items.push({ key, label: intervention.label, unit: intervention.unit, quantity, cost });

    for (const outcome of Object.keys(rawOutcomes)) {
      rawOutcomes[outcome] += (intervention.effects[outcome] ?? 0) * quantity;
    }
    for (const group of Object.keys(rawGroups)) {
      rawGroups[group] += (intervention.groups[group] ?? 0) * quantity;
    }
  }

  return {
    quantities: chosen,
    items,
    spent,
    remaining: BUDGET - spent,
    over: spent > BUDGET,
    overBy: Math.max(0, spent - BUDGET),
    outcomes: Object.fromEntries(
      Object.keys(rawOutcomes).map((key) => [key, clamp(Math.round((rawOutcomes[key] / OUTCOME_SCALE[key]) * 100), 0, 100)])
    ),
    groups: Object.fromEntries(
      Object.keys(rawGroups).map((key) => [key, clamp(Math.round((rawGroups[key] / GROUP_SCALE) * 100), -100, 100)])
    ),
    rawOutcomes,
    rawGroups,
  };
}

/** Whether a change fits the budget, for disabling a control before it misleads. */
export function canAfford(quantities, key, quantity) {
  const next = { ...normalise(quantities), [key]: quantity };
  return tally(next).spent <= BUDGET;
}

/** The largest quantity of one thing the remaining money will buy. */
export function affordableQuantity(quantities, key) {
  const intervention = INTERVENTIONS[key];
  if (!intervention) return 0;
  const current = normalise(quantities);
  const others = tally({ ...current, [key]: 0 }).spent;
  return clamp(Math.floor((BUDGET - others) / intervention.unitCost), 0, intervention.max);
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
    'My street budget — PLACER Toolkit',
    `Spent ${formatEuros(result.spent)} of ${formatEuros(BUDGET)}`,
    '',
  ];

  if (result.items.length === 0) {
    lines.push('Nothing chosen yet.');
  } else {
    for (const item of result.items) {
      lines.push(`- ${item.label}: ${item.quantity} ${pluralise(item.unit, item.quantity)} — ${formatEuros(item.cost)}`);
    }
  }

  lines.push('', 'What it achieves');
  for (const outcome of OUTCOME_LIST) {
    lines.push(`- ${outcome.label}: ${result.outcomes[outcome.key]}/100`);
  }

  lines.push('', 'Who gains');
  for (const group of GROUP_LIST) {
    const score = result.groups[group.key];
    lines.push(`- ${group.label}: ${score > 0 ? '+' : ''}${score}`);
  }

  return lines.join('\n');
}
