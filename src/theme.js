/* PLACER — design tokens: themes + category palette */

// Category color coding
export const CAT = {
  green:   { key: 'green',   label: 'Green space',       color: '#3E9D4E', icon: 'tree' },
  seating: { key: 'seating', label: 'Public seating',    color: '#E08A2B', icon: 'bench' },
  art:     { key: 'art',     label: 'Art & culture',     color: '#D4407E', icon: 'art' },
  play:    { key: 'play',    label: 'Play & recreation', color: '#7A52E0', icon: 'play' },
  safety:  { key: 'safety',  label: 'Safety & lighting', color: '#2F7BD6', icon: 'light' },
  food:    { key: 'food',    label: 'Food & markets',    color: '#D6452F', icon: 'cart' },
};

export const CAT_LIST = Object.values(CAT);

// Theme: Bone (default paper + lime aesthetic)
export const THEME_BONE = {
  name: 'Bone',
  accent: '#D7FB36',          // lime signal
  accentInk: '#14130E',       // text that sits ON accent
  page: '#EDE9DF',            // canvas behind panels
  chrome: '#F6F3EC',          // nav / rails
  surface: '#FFFFFF',         // cards
  surfaceAlt: '#F1EDE3',
  ink: '#16150F',
  inkDim: 'rgba(22,21,15,0.56)',
  inkFaint: 'rgba(22,21,15,0.34)',
  line: 'rgba(22,21,15,0.12)',
  lineStrong: 'rgba(22,21,15,0.22)',
  primaryBg: '#16150F',       // primary button
  primaryFg: '#F6F3EC',
  mapMode: 'light',
  shadow: '0 1px 2px rgba(22,21,15,.06), 0 8px 28px rgba(22,21,15,.08)',
};

// Theme: Ink (night mode)
export const THEME_INK = {
  name: 'Ink',
  accent: '#D7FB36',
  accentInk: '#14130E',
  page: '#0D0D10',
  chrome: '#16161B',
  surface: '#1C1C22',
  surfaceAlt: '#222229',
  ink: '#F4F2EA',
  inkDim: 'rgba(244,242,234,0.60)',
  inkFaint: 'rgba(244,242,234,0.36)',
  line: 'rgba(244,242,234,0.12)',
  lineStrong: 'rgba(244,242,234,0.22)',
  primaryBg: '#D7FB36',
  primaryFg: '#14130E',
  mapMode: 'dark',
  shadow: '0 1px 2px rgba(0,0,0,.4), 0 12px 36px rgba(0,0,0,.5)',
};

// Theme: Signal (electric blue)
export const THEME_SIGNAL = {
  name: 'Signal',
  accent: '#2D5BFF',          // electric blue signal
  accentInk: '#FFFFFF',
  page: '#ECEEF3',
  chrome: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F8',
  ink: '#11131A',
  inkDim: 'rgba(17,19,26,0.56)',
  inkFaint: 'rgba(17,19,26,0.34)',
  line: 'rgba(17,19,26,0.10)',
  lineStrong: 'rgba(17,19,26,0.20)',
  primaryBg: '#2D5BFF',
  primaryFg: '#FFFFFF',
  mapMode: 'light',
  shadow: '0 1px 2px rgba(17,19,26,.06), 0 10px 30px rgba(45,91,255,.10)',
};

// Theme: Simple (black and white)
export const THEME_SIMPLE = {
  name: 'Simple',
  accent: '#000000',          // black accent
  accentInk: '#FFFFFF',       // white text on black
  page: '#FFFFFF',            // white canvas
  chrome: '#FFFFFF',          // white nav
  surface: '#FFFFFF',         // white cards
  surfaceAlt: '#F5F5F5',      // very light gray
  ink: '#000000',             // black text
  inkDim: 'rgba(0,0,0,0.6)',
  inkFaint: 'rgba(0,0,0,0.35)',
  line: 'rgba(0,0,0,0.12)',
  lineStrong: 'rgba(0,0,0,0.25)',
  primaryBg: '#000000',       // black button
  primaryFg: '#FFFFFF',       // white text
  mapMode: 'light',
  shadow: '0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.08)',
};

// Default theme
export const THEME = THEME_SIMPLE;
