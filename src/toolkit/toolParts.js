/* PLACER — what more than one tool's register entry (src/toolkit/tools/) shares. */

// Each tool wears one of the three theme colours: `color` is the 700,
// for text, icons and outlines on white, and `tint` the 100, for fills with ink
// on them, `hover` the 300 a tinted button turns on hover. The brand kit has no other colours to give.
export const tone = (colour) => ({ color: colour.c700, tint: colour.c100, hover: colour.c300, wash: colour.c50 });

/**
 * A room's label (`room.label` in a register entry) from text in its setup: trimmed,
 * or null when there is none to give — a setup comes back from the database, written
 * by whatever opened the room.
 */
export const roomText = (text) => (typeof text === 'string' && text.trim() ? text.trim() : null);

// "1 walk", "3 walks": a count for a saved inquiry's summary (`inquiry.summary`).
export const counted = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// The Gehl tools are built on the Public Life Data Protocol, and say whose it is.
export const PUBLIC_LIFE_PROTOCOL_CREDIT = 'The Public Life Data Protocol was jointly developed by Gehl Institute, '
  + 'Gehl, the City of Copenhagen, The City of San Francisco, and Seattle Department of Transportation.';
