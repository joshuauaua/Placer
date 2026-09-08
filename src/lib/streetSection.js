/* PLACER — Street Section Mixer: the arithmetic of a street's cross-section.
 *
 * A street is a fixed number of metres wide, and that is the whole point of the
 * experiment: every metre given to one thing is taken from another. Everything
 * here is pure so the component only has to hold the current segment list.
 *
 * The throughput and canopy figures are deliberately rough — they are calibrated
 * to make the trade-offs feel right, not to size a real scheme.
 */

/**
 * throughput — people moved past a point per hour, per metre of width.
 * canopy     — shade cast, as a multiple of the segment's own width.
 * cars       — counts as space handed to private motor vehicles.
 */
export const SEGMENT_TYPES = {
  sidewalk: { key: 'sidewalk', label: 'Sidewalk',      color: '#8C93A0', min: 1.5, max: 8,  def: 2.5, throughput: 1200, canopy: 0,   cars: false },
  trees:    { key: 'trees',    label: 'Street trees',  color: '#3E9D4E', min: 1,   max: 4,  def: 1.5, throughput: 0,    canopy: 1.8, cars: false },
  cafe:     { key: 'cafe',     label: 'Café seating',  color: '#E08A2B', min: 1.5, max: 6,  def: 2,   throughput: 0,    canopy: 0.2, cars: false },
  cycle:    { key: 'cycle',    label: 'Cycle track',   color: '#D4407E', min: 1.5, max: 4,  def: 2,   throughput: 1000, canopy: 0,   cars: false },
  bus:      { key: 'bus',      label: 'Bus lane',      color: '#7A52E0', min: 3,   max: 4,  def: 3.2, throughput: 2500, canopy: 0,   cars: false },
  play:     { key: 'play',     label: 'Play street',   color: '#2F7BD6', min: 3,   max: 12, def: 5,   throughput: 400,  canopy: 0,   cars: false },
  traffic:  { key: 'traffic',  label: 'Traffic lane',  color: '#55595F', min: 2.7, max: 3.6, def: 3.2, throughput: 250, canopy: 0,   cars: true },
  parking:  { key: 'parking',  label: 'Parking',       color: '#A8814C', min: 2,   max: 2.6, def: 2.2, throughput: 0,    canopy: 0,   cars: true },
};

export const SEGMENT_LIST = Object.values(SEGMENT_TYPES);

export const MIN_STREET_WIDTH = 12;
export const MAX_STREET_WIDTH = 32;
export const DEFAULT_STREET_WIDTH = 20;

// Every preset fills exactly DEFAULT_STREET_WIDTH metres, so switching between
// them is a pure reallocation rather than a change of street.
const PRESET_DEFS = {
  today: {
    label: 'Today',
    note: 'What most 20-metre high streets already are: five lanes of car, two thin footways.',
    segments: [
      ['sidewalk', 2.5], ['parking', 2.5], ['traffic', 3.5], ['traffic', 3],
      ['traffic', 3.5], ['parking', 2.5], ['sidewalk', 2.5],
    ],
  },
  complete: {
    label: 'Complete street',
    note: 'Everything gets a place: walking, cycling, a bus that is not stuck, and one general lane.',
    segments: [
      ['sidewalk', 3.5], ['trees', 1.5], ['cycle', 2], ['bus', 3.2],
      ['traffic', 3], ['cycle', 2], ['trees', 1.5], ['sidewalk', 3.3],
    ],
  },
  play: {
    label: 'Play street',
    note: 'The street as a place to be rather than to pass through. Deliveries only, at walking pace.',
    segments: [
      ['sidewalk', 3.5], ['trees', 1.5], ['cafe', 2.5], ['play', 5],
      ['cafe', 2], ['trees', 1.5], ['sidewalk', 4],
    ],
  },
};

export const PRESET_LIST = Object.entries(PRESET_DEFS).map(([key, preset]) => ({
  key,
  label: preset.label,
  note: preset.note,
}));

/** A fresh, mutable copy of a preset's segments. */
export function loadPreset(key) {
  const preset = PRESET_DEFS[key];
  if (!preset) return [];
  return preset.segments.map(([type, width]) => ({ type, width }));
}

/** Guard against float drift: widths only ever exist at two decimal places. */
function round2(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function totalWidth(segments) {
  return round2(segments.reduce((sum, segment) => sum + segment.width, 0));
}

/**
 * Move the divider between segment `index` and the one after it by `delta` metres.
 * The two neighbours trade width, so the street's total never changes — which is
 * the honest bit. Returns the same array if neither can give any more.
 */
export function resize(segments, index, delta) {
  const left = segments[index];
  const right = segments[index + 1];
  if (!left || !right) return segments;

  const leftType = SEGMENT_TYPES[left.type];
  const rightType = SEGMENT_TYPES[right.type];
  const room = {
    grow: Math.min(leftType.max - left.width, right.width - rightType.min),
    shrink: Math.min(left.width - leftType.min, rightType.max - right.width),
  };

  const moved = round2(clamp(delta, -room.shrink, room.grow));
  if (moved === 0) return segments;

  return segments.map((segment, i) => {
    if (i === index) return { ...segment, width: round2(segment.width + moved) };
    if (i === index + 1) return { ...segment, width: round2(segment.width - moved) };
    return segment;
  });
}

/**
 * Add a segment of `type`. Unallocated width is used first; beyond that every segment
 * with room to give gives up a share in proportion to how much room it has. Spreading
 * it matters: taking the lot from whichever segment is widest flattens the footways to
 * their minimum the first time a bus lane is added, which is the opposite of the point.
 *
 * If the street genuinely cannot fit the type's minimum, nothing changes and `added`
 * is false, with a reason to show.
 *
 * @returns {{segments: object[], added: boolean, reason: string|null}}
 */
export function addSegment(segments, type, streetWidth, atIndex = segments.length) {
  const segmentType = SEGMENT_TYPES[type];
  if (!segmentType) return { segments, added: false, reason: 'Unknown segment type.' };

  const slack = round2(streetWidth - totalWidth(segments));
  let width = Math.min(segmentType.def, Math.max(0, slack));
  const next = segments.map((segment) => ({ ...segment }));

  if (width < segmentType.min) {
    let needed = round2(segmentType.min - width);
    const order = next
      .map((segment, i) => ({ i, room: round2(segment.width - SEGMENT_TYPES[segment.type].min) }))
      .filter((entry) => entry.room > 0)
      .sort((a, b) => b.room - a.room);

    const available = round2(order.reduce((sum, entry) => sum + entry.room, 0));
    if (available < needed) {
      return { segments, added: false, reason: `No room for a ${segmentType.label.toLowerCase()} — widen the street or remove something first.` };
    }

    const take = (entry, amount) => {
      const taken = Math.min(entry.room, amount, needed);
      if (taken <= 0) return;
      next[entry.i].width = round2(next[entry.i].width - taken);
      entry.room = round2(entry.room - taken);
      needed = round2(needed - taken);
    };

    const factor = needed / available;
    for (const entry of order) take(entry, round2(entry.room * factor));
    // Rounding leaves a few centimetres over; they come off whatever still has the
    // most room, so the total always lands exactly.
    for (const entry of order) take(entry, entry.room);

    width = segmentType.min;
  }

  next.splice(clamp(atIndex, 0, next.length), 0, { type, width: round2(width) });
  return { segments: next, added: true, reason: null };
}

/** Remove a segment. Its width becomes unallocated rather than silently absorbed. */
export function removeSegment(segments, index) {
  if (index < 0 || index >= segments.length) return segments;
  return segments.filter((_, i) => i !== index);
}

/**
 * Give every metre of the street to something, growing each segment in proportion.
 * Used by the "fill the street" control after a removal.
 */
export function distributeSlack(segments, streetWidth) {
  const slack = round2(streetWidth - totalWidth(segments));
  if (slack <= 0 || segments.length === 0) return segments;

  const growable = segments.filter((segment) => SEGMENT_TYPES[segment.type].max > segment.width);
  if (growable.length === 0) return segments;

  const share = slack / growable.length;
  let given = 0;
  const next = segments.map((segment) => {
    const type = SEGMENT_TYPES[segment.type];
    if (type.max <= segment.width) return segment;
    const width = round2(Math.min(type.max, segment.width + share));
    given = round2(given + (width - segment.width));
    return { ...segment, width };
  });

  // A second pass mops up what the max-width clamps refused, so the readout does
  // not sit at 19.9 of 20 metres.
  const left = round2(slack - given);
  if (left > 0) {
    const target = next.findIndex((segment) => SEGMENT_TYPES[segment.type].max > segment.width);
    if (target >= 0) {
      const type = SEGMENT_TYPES[next[target].type];
      next[target] = { ...next[target], width: round2(Math.min(type.max, next[target].width + left)) };
    }
  }

  return next;
}

/**
 * What this cross-section does.
 *
 * peoplePerHour — everyone the street can move past a point in an hour.
 * canopyShare   — how much of the street's plan area falls in shade.
 * peopleShare / carShare — the split of the street's full width, so the two do not
 *   add up to 1 while any of it is still unallocated. That gap is the point.
 */
export function metrics(segments, streetWidth) {
  let peoplePerHour = 0;
  let canopy = 0;
  let peopleWidth = 0;
  let carWidth = 0;

  for (const segment of segments) {
    const type = SEGMENT_TYPES[segment.type];
    if (!type) continue;
    peoplePerHour += segment.width * type.throughput;
    canopy += segment.width * type.canopy;
    if (type.cars) carWidth += segment.width;
    else peopleWidth += segment.width;
  }

  const used = totalWidth(segments);
  return {
    used,
    streetWidth,
    unallocated: round2(streetWidth - used),
    overAllocated: used > streetWidth,
    peoplePerHour: Math.round(peoplePerHour),
    canopyShare: streetWidth > 0 ? Math.min(1, canopy / streetWidth) : 0,
    peopleShare: streetWidth > 0 ? peopleWidth / streetWidth : 0,
    carShare: streetWidth > 0 ? carWidth / streetWidth : 0,
  };
}

/** The same numbers for a preset, for use as a comparison baseline. */
export function presetMetrics(key, streetWidth = DEFAULT_STREET_WIDTH) {
  return metrics(loadPreset(key), streetWidth);
}

/** Signed change from a baseline, for the "vs today" readout. */
export function compare(current, baseline) {
  return {
    peoplePerHour: current.peoplePerHour - baseline.peoplePerHour,
    canopyShare: current.canopyShare - baseline.canopyShare,
    peopleShare: current.peopleShare - baseline.peopleShare,
    carShare: current.carShare - baseline.carShare,
  };
}
