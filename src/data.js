/* PLACER — sample content */

export const COMMENTS = [
  { author: 'Devon Park',  when: '2d',  votes: 18, text: 'Yes. I bike past Lot 7 every day and it is always half-empty. This would change the whole block.' },
  { author: 'City Desk',   when: '1d',  votes: 9,  text: 'Worth noting the lot is city-owned, so this is actually actionable through the parks budget.', badge: 'Verified' },
  { author: 'Lena Cho',    when: '22h', votes: 31, text: 'Could we keep a few accessible spots near the corner? Otherwise fully behind the trees + lawn.' },
];

export const PLACED_FEATURED = [
  { type: 'tree',    x: 150, scale: 1.0, boxW: 60, boxH: 132 },
  { type: 'bench',   x: 330, scale: 1.0, boxW: 54, boxH: 64 },
  { type: 'planter', x: 470, scale: 1.0, boxW: 36, boxH: 50 },
  { type: 'tree',    x: 660, scale: 0.92, boxW: 60, boxH: 132 },
  { type: 'light',   x: 850, scale: 0.9, boxW: 64, boxH: 130 },
];

export const ASSET_LIB = [
  { type: 'bench',   label: 'Bench',      cat: 'seating' },
  { type: 'planter', label: 'Planter',    cat: 'green' },
  { type: 'tree',    label: 'Tree',       cat: 'green' },
  { type: 'bike',    label: 'Bike rack',  cat: 'seating' },
  { type: 'light',   label: 'Lighting',   cat: 'safety' },
  { type: 'play',    label: 'Play',       cat: 'play' },
];
