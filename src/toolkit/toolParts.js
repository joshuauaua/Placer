/* PLACER — what more than one tool's register entry (src/toolkit/tools/) shares. */

// Each tool wears one of the three character colours: `color` is the 700,
// for text, icons and outlines on white, and `tint` the 100, for fills with ink
// on them, `hover` the 300 a character button turns on hover. The brand kit has no other colours to give.
export const tone = (character) => ({ color: character.c700, tint: character.c100, hover: character.c300, wash: character.c50 });

/**
 * A room's label (`room.label` in a register entry) from text in its setup: trimmed,
 * or null when there is none to give — a setup comes back from the database, written
 * by whatever opened the room.
 */
export const roomText = (text) => (typeof text === 'string' && text.trim() ? text.trim() : null);

// The Gehl tools are built on the Public Life Data Protocol, and say whose it is.
export const PUBLIC_LIFE_PROTOCOL_CREDIT = 'The Public Life Data Protocol was jointly developed by Gehl Institute, '
  + 'Gehl, the City of Copenhagen, The City of San Francisco, and Seattle Department of Transportation.';
