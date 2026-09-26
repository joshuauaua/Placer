/* PLACER — design tokens, from the brand kit (design.md).
 *
 * The platform is black and white. The only colours are the three character
 * colours: blue for the city worker, orange for the citizen and purple for the
 * design practitioner. Each comes in five steps with fixed jobs:
 *
 *   50  hover / selected backgrounds, comment highlight
 *   100 chips, avatars, pins, character buttons — only ink text on it, never white
 *   300 map areas, chart fills, button hover — never text
 *   700 text, icons and outlines on white
 *   900 text on a 50 / 100 tint
 */

export const NEUTRAL = {
  ink: '#111111',
  grey700: '#3D3D3D',
  grey500: '#6E6E6E',
  grey300: '#D6D6D6',
  grey200: '#E6E6E6',
  grey100: '#F5F5F5',
  white: '#FFFFFF',
  // The page behind everything: a warm off-white, so white cards read as cards.
  cream: '#FAF7F0',
  error: '#B3261E',
  success: '#1E7B3A',
};

export const CHARACTER = {
  cityWorker: { key: 'cityWorker', label: 'City worker', c50: '#EEF5FE', c100: '#C6DEF8', c300: '#8DBBEF', c700: '#1D5FA8', c900: '#123F73' },
  citizen: { key: 'citizen', label: 'Citizen', c50: '#FFF3E8', c100: '#FFD9B8', c300: '#FDB27A', c700: '#9E4600', c900: '#6B2E00' },
  practitioner: { key: 'practitioner', label: 'Design practitioner', c50: '#F4F0FE', c100: '#DDD2FA', c300: '#B39DF2', c700: '#5B3CB8', c900: '#3A2480' },
};

export const CHARACTER_LIST = Object.values(CHARACTER);

// The one shadow the kit allows: glass, the sidebar, dropdowns, modals, card hover.
export const SHADOW = '0 8px 24px rgba(0,0,0,0.10)';

// Category coding. The brand has no category colours — the three hues belong to the
// characters — so a category is told apart by its icon and label, and drawn in ink.
export const CAT = {
  green:   { key: 'green',   label: 'Green space',       color: NEUTRAL.ink, icon: 'tree' },
  seating: { key: 'seating', label: 'Public seating',    color: NEUTRAL.ink, icon: 'bench' },
  art:     { key: 'art',     label: 'Art & culture',     color: NEUTRAL.ink, icon: 'art' },
  play:    { key: 'play',    label: 'Play & recreation', color: NEUTRAL.ink, icon: 'play' },
  safety:  { key: 'safety',  label: 'Safety & lighting', color: NEUTRAL.ink, icon: 'light' },
  food:    { key: 'food',    label: 'Food & markets',    color: NEUTRAL.ink, icon: 'cart' },
};

export const CAT_LIST = Object.values(CAT);

// The site theme. The field names predate the brand kit and are read all over the
// app, so they stay; only the values follow it.
export const THEME_SIMPLE = {
  name: 'Simple',
  accent: NEUTRAL.ink,
  accentInk: NEUTRAL.white,
  page: NEUTRAL.cream,
  chrome: NEUTRAL.white,
  surface: NEUTRAL.white,
  surfaceAlt: NEUTRAL.grey100,
  ink: NEUTRAL.ink,
  inkDim: NEUTRAL.grey700,
  inkFaint: NEUTRAL.grey500,
  line: NEUTRAL.grey200,
  lineStrong: NEUTRAL.grey300,
  primaryBg: NEUTRAL.ink,
  primaryHover: NEUTRAL.grey700,
  primaryFg: NEUTRAL.white,
  error: NEUTRAL.error,
  success: NEUTRAL.success,
  mapMode: 'light',
  shadow: SHADOW,
};

// Dark surfaces — only the footer uses these now.
export const THEME_INK = {
  ...THEME_SIMPLE,
  name: 'Ink',
  page: NEUTRAL.ink,
  chrome: NEUTRAL.ink,
  surface: NEUTRAL.ink,
  surfaceAlt: NEUTRAL.grey700,
  ink: NEUTRAL.white,
  inkDim: NEUTRAL.grey300,
  inkFaint: NEUTRAL.grey500,
  line: NEUTRAL.grey700,
  lineStrong: NEUTRAL.grey500,
  primaryBg: NEUTRAL.white,
  primaryFg: NEUTRAL.ink,
  mapMode: 'dark',
};

// Default theme
export const THEME = THEME_SIMPLE;
