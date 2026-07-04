/* PLOT — sample content */

export const IMAGINATIONS = [
  { id: 'i1', cat: 'green',   title: 'Pocket park on the old Lot 7 parking', author: 'Mara Quinn',   when: '2d', votes: 342, comments: 28, x: 31, y: 57, loc: 'Riverside Blvd & 8th', blurb: 'Three rows of parking nobody uses. Swap the asphalt for trees, a lawn, and a few benches.' },
  { id: 'i2', cat: 'seating', title: 'Shade + seating along 8th Street',      author: 'Devon Park',   when: '5h', votes: 218, comments: 14, x: 47, y: 39, loc: '8th St, Midtown',     blurb: 'The walk to the transit stop is brutal in summer. Street trees and benches every block.' },
  { id: 'i3', cat: 'art',     title: 'Mural wall under the rail bridge',       author: 'Lena Cho',     when: '1d', votes: 287, comments: 41, x: 18, y: 70, loc: 'Canal underpass',     blurb: 'The underpass is grim and unlit. Commission local artists for a rotating mural program.' },
  { id: 'i4', cat: 'food',    title: 'Friday night market on Canal Ave',       author: 'Theo Banks',   when: '3d', votes: 401, comments: 63, x: 63, y: 31, loc: 'Canal Ave',           blurb: 'Close two blocks on Friday evenings for food carts, makers, and live music.' },
  { id: 'i5', cat: 'safety',  title: 'Brighter, safer crossing at Market',     author: 'Priya N.',     when: '8h', votes: 176, comments: 9,  x: 54, y: 63, loc: 'Market Ave & 11th',   blurb: 'Add pedestrian lighting and a raised crosswalk where the avenue meets the school route.' },
  { id: 'i6', cat: 'play',    title: 'Playground for the Highland corner',     author: 'Sam Ortiz',    when: '6d', votes: 153, comments: 22, x: 79, y: 21, loc: 'Highland Park',       blurb: 'The northeast corner of the park is empty. Kids in the area have nowhere close to play.' },
  { id: 'i7', cat: 'green',   title: 'Rain garden + planters on River Mill',   author: 'Iris Wong',    when: '4d', votes: 129, comments: 11, x: 73, y: 69, loc: 'River Mill Walk',     blurb: 'Soak up runoff and soften the waterfront path with planters and a small rain garden.' },
];

export const FEATURED = IMAGINATIONS[0];

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
