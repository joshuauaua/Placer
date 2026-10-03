/* PLACER — icon set */

const ICON_ELEMENTS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevDown: <path d="M5 9l7 7 7-7" />,
  chevUp: <path d="M5 15l7-7 7 7" />,
  chevLeft: <path d="M15 5l-7 7 7 7" />,
  chevRight: <path d="M9 5l7 7-7 7" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  heart: (
    <path d="M12 20s-7-4.6-9.2-9C1.4 8.2 2.6 5 6 5c2 0 3.2 1.3 4 2.5C10.8 6.3 12 5 14 5c3.4 0 4.6 3.2 3.2 6-2.2 4.4-9.2 9-9.2 9z" />
  ),
  comment: <path d="M4 5h16v11H9l-4 4V5z" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="17" cy="6" r="2.4" />
      <circle cx="17" cy="18" r="2.4" />
      <path d="M8.1 11l6.8-3.6M8.1 13l6.8 3.6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 6.5" />,
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  filter: <path d="M3 5h18M6 12h12M10 19h4" />,
  sort: <path d="M7 5v14M7 19l-3-3M7 5l3 3M17 19V5M17 5l3 3M17 19l-3-3" />,
  pin: (
    <>
      <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 010 10h-1" />
    </>
  ),
  redo: (
    <>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 000 10h1" />
    </>
  ),
  move: <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
  rotate: (
    <>
      <path d="M20 7a8 8 0 10.5 6" />
      <path d="M20 3v4h-4" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
    </>
  ),
  // Home: a house with a door.
  home: (
    <>
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M5.5 9.5v11h13v-11" />
      <path d="M10 20.5v-5h4v5" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" />,
  camera: (
    <>
      <path d="M3 9a2 2 0 012-2h2l1.4-2.2h7.2L17 7h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  loader: <path d="M12 3a9 9 0 109 9" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M5 18l5-5 4 3 3-2.5 4 4" />
    </>
  ),
  bookmark: <path d="M6 4h12v17l-6-4-6 4V4z" />,
  flag: <path d="M6 3v18M6 4h12l-2.5 4L18 12H6" />,
  bug: (
    <>
      <path d="M9 7.5V6a3 3 0 016 0v1.5" />
      <rect x="7" y="7.5" width="10" height="12" rx="5" />
      <path d="M12 11v8.5M3.5 13H7M17 13h3.5M4.5 8.5L7 10M19.5 8.5L17 10M4.5 18.5L7.3 16.5M19.5 18.5l-2.8-2" />
    </>
  ),
  pencil: <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" />,
  send: <path d="M4 12l16-7-7 16-2.5-6.5L4 12z" />,
  dot3: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V10a6 6 0 1112 0v6l2 2H4l2-2z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
  tree: (
    <>
      <path d="M12 21v-5" />
      <path d="M12 16c-3 0-5-1.8-5-4.5 0-1.4.7-2.6 1.7-3.3C8.4 5.7 10 4 12 4s3.6 1.7 3.3 4.2c1 .7 1.7 1.9 1.7 3.3C17 14.2 15 16 12 16z" />
    </>
  ),
  bench: <path d="M3 10h18M4 10v6M20 10v6M4 13h16M6 16v3M18 16v3M5 10l1.5-3h11L19 10" />,
  art: (
    <>
      <path d="M12 3a9 9 0 100 18c1.4 0 2-1 2-2 0-1.3-1-1.6-1-2.6 0-.8.7-1.4 1.6-1.4H17a4 4 0 004-4c0-4.4-4-8-9-8z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="11" cy="7.5" r="1" />
      <circle cx="15.5" cy="8.5" r="1" />
    </>
  ),
  play: <path d="M5 4l4 8m6-8l-4 8M4 12h16M9 12l-1 8M15 12l1 8" />,
  light: <path d="M12 3v2M9 5h6l1 5a4 4 0 01-8 0l1-5zM12 14v7M9 21h6" />,
  cart: (
    <>
      <path d="M4 5h2l1.5 9h10L20 7H7" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </>
  ),
  planter: (
    <path d="M12 11c0-3 1.5-5 4-6-0.5 2.5-2 4-4 4.5M12 11c0-2.5-1.2-4-3-4.8C9.3 8 10.3 9.6 12 10M7 11h10l-1.2 8H8.2L7 11z" />
  ),
  bike: (
    <>
      <circle cx="6.5" cy="16" r="3" />
      <circle cx="17.5" cy="16" r="3" />
      <path d="M6.5 16l4-7h5l-2.5 7M10.5 9h5.5M9 9h3" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v5L5.2 17.8A2 2 0 007 21h10a2 2 0 001.8-3.2L14 8V3" />
      <path d="M7.4 15h9.2" />
    </>
  ),
  section: (
    <>
      <path d="M2 17h20" />
      <path d="M5 17v-3M8.5 17V6M14 17V9.5M19 17v-5" />
    </>
  ),
  path: (
    <>
      <path d="M5.5 18.5c5 .5 4-5 7-8s5-3.5 6.5-4.5" />
      <circle cx="5" cy="19" r="1.5" />
      <circle cx="19.5" cy="5.5" r="1.5" />
    </>
  ),
  walk: (
    <>
      <circle cx="13.5" cy="4.5" r="2" />
      <path d="M13.5 7l-2.2 5.2L14 15l1 5M11.3 12.2L8 14M14.6 9.4L17.5 11" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.8" />
      <path d="M5 6.5v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5" />
      <path d="M5 11.5v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5l5-5" />
      <path d="M13.5 6.8l1-1a3.6 3.6 0 015.1 5.1l-2.6 2.6" />
      <path d="M10.5 17.2l-1 1a3.6 3.6 0 01-5.1-5.1l2.6-2.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 2.1" />
    </>
  ),
  // A hub with eight teeth, rather than a single gear silhouette: at the 17px the
  // account menu renders it, an outline gear turns to mush.
  gear: (
    <>
      <circle cx="12" cy="12" r="4.4" />
      <path d="M16.4 12h3.5M12 7.6V4.1M7.6 12H4.1M12 16.4v3.5" />
      <path d="M15.1 8.9l2.5-2.5M8.9 8.9L6.4 6.4M8.9 15.1l-2.5 2.5M15.1 15.1l2.5 2.5" />
    </>
  ),
  // A password: a padlock.
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 017 0v3" />
    </>
  ),
  // Analytics: three bars rising from a baseline.
  chart: <path d="M4 20.5h16M7 17v-5M12 17V7M17 17v-8" />,
  // An organisation: a building with a door and two rows of windows.
  building: (
    <>
      <path d="M4.5 20.5V5.5l7.5-2.5 7.5 2.5v15" />
      <path d="M3 20.5h18M10 20.5v-4h4v4" />
      <path d="M8.5 8.5h.01M12 8.5h.01M15.5 8.5h.01M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 19.5H6.5a2 2 0 01-2-2v-11a2 2 0 012-2h3" />
      <path d="M9.5 12h9M15 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  // Social marks, drawn as outlines so they sit with the rest of the set rather
  // than as the networks' filled logos.
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <path d="M17 7h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.7 6.5L12 12.5l8.3-6" />
    </>
  ),
  facebook: <path d="M17 3.5h-2.8a4.2 4.2 0 00-4.2 4.2v2.8H7.2v3.8H10v6.2h3.8v-6.2h2.8l.9-3.8h-3.7V8a.9.9 0 01.9-.9H17V3.5z" />,
  x: <path d="M4.5 4.5h4.2l10.8 15h-4.2L4.5 4.5zM19.3 4.5l-6.1 6.6M4.7 19.5l6.1-6.6" />,
  linkedin: (
    <>
      <rect x="3.5" y="9.5" width="3.8" height="11" />
      <circle cx="5.4" cy="5.4" r="1.9" />
      <path d="M11 20.5v-11h3.6v1.6a4 4 0 016.9 2.8v6.6h-3.8v-6a1.9 1.9 0 00-3.8 0v6" />
    </>
  ),
};

export function Icon({ name, size = 22, stroke = 1.7, fill = 'none', style, color }) {
  const elements = ICON_ELEMENTS[name] || null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', color, flex: '0 0 auto', ...style }}
    >
      {elements}
    </svg>
  );
}
