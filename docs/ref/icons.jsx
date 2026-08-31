/* PLACER — icon set. <Icon name size stroke fill/> renders a 24-grid SVG.
   Line icons use currentColor stroke; pass via style/color on parent. */

const ICON_PATHS = {
  // — UI —
  search:   '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  chevDown: '<path d="M5 9l7 7 7-7"/>',
  chevUp:   '<path d="M5 15l7-7 7 7"/>',
  chevLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevRight:'<path d="M9 5l7 7-7 7"/>',
  arrowUp:  '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowRight:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  heart:    '<path d="M12 20s-7-4.6-9.2-9C1.4 8.2 2.6 5 6 5c2 0 3.2 1.3 4 2.5C10.8 6.3 12 5 14 5c3.4 0 4.6 3.2 3.2 6-2.2 4.4-9.2 9-9.2 9z"/>',
  comment:  '<path d="M4 5h16v11H9l-4 4V5z"/>',
  share:    '<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="M8.1 11l6.8-3.6M8.1 13l6.8 3.6"/>',
  check:    '<path d="M5 12.5l4.5 4.5L19 6.5"/>',
  layers:   '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  filter:   '<path d="M3 5h18M6 12h12M10 19h4"/>',
  sort:     '<path d="M7 5v14M7 19l-3-3M7 5l3 3M17 19V5M17 5l3 3M17 19l-3-3"/>',
  pin:      '<path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  crosshair:'<circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  undo:     '<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 010 10h-1"/>',
  redo:     '<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 000 10h1"/>',
  move:     '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  rotate:   '<path d="M20 7a8 8 0 10.5 6"/><path d="M20 3v4h-4"/>',
  trash:    '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  user:     '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5"/>',
  sparkle:  '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z"/>',
  grid:     '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  image:    '<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="8.5" cy="10" r="1.6"/><path d="M5 18l5-5 4 3 3-2.5 4 4"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4V4z"/>',
  flag:     '<path d="M6 3v18M6 4h12l-2.5 4L18 12H6"/>',
  pencil:   '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/>',
  send:     '<path d="M4 12l16-7-7 16-2.5-6.5L4 12z"/>',
  dot3:     '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  bell:     '<path d="M6 16V10a6 6 0 1112 0v6l2 2H4l2-2z"/><path d="M10 20a2 2 0 004 0"/>',
  // — assets / categories —
  tree:     '<path d="M12 21v-5"/><path d="M12 16c-3 0-5-1.8-5-4.5 0-1.4.7-2.6 1.7-3.3C8.4 5.7 10 4 12 4s3.6 1.7 3.3 4.2c1 .7 1.7 1.9 1.7 3.3C17 14.2 15 16 12 16z"/>',
  bench:    '<path d="M3 10h18M4 10v6M20 10v6M4 13h16M6 16v3M18 16v3M5 10l1.5-3h11L19 10"/>',
  art:      '<path d="M12 3a9 9 0 100 18c1.4 0 2-1 2-2 0-1.3-1-1.6-1-2.6 0-.8.7-1.4 1.6-1.4H17a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>',
  play:     '<path d="M5 4l4 8m6-8l-4 8M4 12h16M9 12l-1 8M15 12l1 8"/>',
  light:    '<path d="M12 3v2M9 5h6l1 5a4 4 0 01-8 0l1-5zM12 14v7M9 21h6"/>',
  cart:     '<path d="M4 5h2l1.5 9h10L20 7H7"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  planter:  '<path d="M12 11c0-3 1.5-5 4-6-0.5 2.5-2 4-4 4.5M12 11c0-2.5-1.2-4-3-4.8C9.3 8 10.3 9.6 12 10M7 11h10l-1.2 8H8.2L7 11z"/>',
  bike:     '<circle cx="6.5" cy="16" r="3"/><circle cx="17.5" cy="16" r="3"/><path d="M6.5 16l4-7h5l-2.5 7M10.5 9h5.5M9 9h3"/>',
};

function Icon({ name, size = 22, stroke = 1.7, fill = 'none', style, color }) {
  const inner = ICON_PATHS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke={fill === 'none' ? 'currentColor' : 'none'} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', color, flex: '0 0 auto', ...style }}
      dangerouslySetInnerHTML={{ __html: inner }} />
  );
}

Object.assign(window, { Icon, ICON_PATHS });
