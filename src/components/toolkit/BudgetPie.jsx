/* PLACER — a Co-Budget ballot as a pie of its budget.
 *
 * Part-to-whole at a glance: each post bought, then what is left unspent, from
 * pieSlices (src/lib/budgetBallot.js), which keeps it to six slices at most. The
 * colours are the data-viz reference palette's categorical order, validated for colour
 * blindness in both themes, given out in the ballot's own order so a post keeps its
 * colour; Other and Unspent are greys. Three of the light steps are under 3:1 on white,
 * so the legend beside the pie carries every slice's name, amount and share as text —
 * the pie is never read by colour alone. Hovering or focusing a slice or its legend row
 * picks both out.
 */

import { useState } from 'react';

const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
};
const GREYS = { light: { other: '#8a8984', unspent: '#e2e1dc' }, dark: { other: '#8a8984', unspent: '#3a3936' } };

const SIZE = 180;
const R = SIZE / 2;

// The path of one slice, from one fraction of the way round to another, starting at
// twelve o'clock and going clockwise.
function slicePath(from, to) {
  const point = (fraction) => {
    const angle = fraction * 2 * Math.PI - Math.PI / 2;
    return [R + R * Math.cos(angle), R + R * Math.sin(angle)];
  };
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function BudgetPie({ t, slices, money, label }) {
  const [active, setActive] = useState(null);
  const mode = t.mapMode === 'dark' ? 'dark' : 'light';
  let next = 0;
  const coloured = slices.map((slice) => {
    const color = slice.unspent ? GREYS[mode].unspent : slice.other ? GREYS[mode].other : SERIES[mode][next++];
    return { ...slice, color };
  });
  const percent = (share) => `${Math.round(share * 100)}%`;
  const drawn = coloured.filter((slice) => slice.share > 0);

  let at = 0;
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}
        style={{ flex: '0 0 auto', overflow: 'visible' }}>
        {drawn.length === 1 ? (
          <circle cx={R} cy={R} r={R} fill={drawn[0].color} />
        ) : drawn.map((slice) => {
          const from = at;
          at += slice.share;
          const lit = active === slice.key;
          return (
            <path key={slice.key} d={slicePath(from, at)} fill={slice.color}
              // A 2px gap in the surface's colour between slices, and the hovered one lifted.
              stroke={t.surface} strokeWidth={2} strokeLinejoin="round"
              opacity={active && !lit ? 0.45 : 1}
              onMouseEnter={() => setActive(slice.key)} onMouseLeave={() => setActive(null)}
              style={{ cursor: 'default', transition: 'opacity 120ms' }}>
              <title>{`${slice.label}: ${money(slice.cost)}, ${percent(slice.share)}`}</title>
            </path>
          );
        })}
      </svg>

      <ul aria-label="Legend" style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 200px', minWidth: 0,
        display: 'flex', flexDirection: 'column', gap: 6 }}>
        {coloured.map((slice) => (
          <li key={slice.key} tabIndex={0}
            onMouseEnter={() => setActive(slice.key)} onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(slice.key)} onBlur={() => setActive(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, padding: '2px 4px', borderRadius: 6,
              background: active === slice.key ? t.surfaceAlt : 'transparent', outlineOffset: 2 }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: slice.color,
              flex: '0 0 auto', boxShadow: slice.unspent ? `inset 0 0 0 1px ${t.lineStrong}` : 'none' }} />
            <span style={{ flex: 1, minWidth: 0, color: slice.unspent ? t.inkDim : t.ink }}>
              {slice.label}{slice.quantity ? ` × ${slice.quantity}` : ''}
            </span>
            <span className="placer-mono" style={{ color: t.inkDim, whiteSpace: 'nowrap' }}>
              {money(slice.cost)} · {percent(slice.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default BudgetPie;
