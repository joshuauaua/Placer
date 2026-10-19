/* PLACER — pins that would sit on top of each other, set slightly apart.
 *
 * A project and the organisation running it often share an address, and then their
 * pins are drawn on the same spot and only the top one can be seen or clicked. Pins
 * within `metres` of each other are gathered into a group, and each pin in a group is
 * given an offset in pixels round a small circle about their spot: side by side for
 * two, a ring for more. The pins stay at their real positions — the offset is only how
 * they are drawn — so they are apart at every zoom, and centring on one still centres
 * on its address.
 */

const EARTH_RADIUS = 6371000;

/** Roughly how far apart two { lat, lng } are, in metres; fine at these distances. */
function metresApart(a, b) {
  const toRad = Math.PI / 180;
  const x = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  const y = (b.lat - a.lat) * toRad;
  return Math.hypot(x, y) * EARTH_RADIUS;
}

/**
 * The pixel offset, [x, y], to draw each of `positions` at, in the same order: [0, 0]
 * for a pin with nothing near it. Each group is gathered round the first position in
 * it.
 */
export function spreadPins(positions, { metres = 15, radius = 14 } = {}) {
  const groups = [];
  const groupOf = positions.map((position) => {
    let group = groups.find((each) => metresApart(each.anchor, position) <= metres);
    if (!group) {
      group = { anchor: position, size: 0 };
      groups.push(group);
    }
    const index = group.size;
    group.size += 1;
    return { group, index };
  });

  return groupOf.map(({ group, index }) => {
    if (group.size === 1) return [0, 0];
    // Starting from the left, so two are side by side.
    const angle = Math.PI + (2 * Math.PI * index) / group.size;
    // `|| 0` turns a rounded -0 into 0.
    return [Math.round(Math.cos(angle) * radius) || 0, Math.round(Math.sin(angle) * radius) || 0];
  });
}
