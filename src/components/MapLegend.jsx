/* PLACER — the map's legend: what the marks drawn on it mean.
 *
 * A matte glass card (.placer-glass) in the bottom-left corner, lifted clear of
 * Google's logo and terms, which the Maps licence requires stay visible. The
 * swatches are drawn from the same constants MapContainer draws the map with, so the
 * two cannot drift apart. It folds down to its heading, for a small screen where it
 * would otherwise sit over the streets somebody is trying to look at.
 */

import { useState } from 'react';
import { Icon } from './Icon';

// Google's own red search marker, as a small teardrop.
function SearchSwatch() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
      <path d="M8 0C3.6 0 0 3.4 0 7.7 0 13.4 8 20 8 20s8-6.6 8-12.3C16 3.4 12.4 0 8 0z" fill="#EA4335" />
      <circle cx="8" cy="7.5" r="2.8" fill="#B31412" />
    </svg>
  );
}

export function MapLegend({ t, pin, area }) {
  const [open, setOpen] = useState(true);

  const rows = [
    {
      key: 'imagination',
      label: 'An imagination',
      hint: 'Click one to open it',
      swatch: (
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: pin.fill,
          border: `2px solid ${pin.ring}`, boxSizing: 'border-box' }} />
      ),
    },
    {
      key: 'project',
      label: 'A project area',
      hint: 'Click one to see the project',
      swatch: (
        <span style={{ width: 18, height: 14, borderRadius: 3, background: `${area.fill}66`,
          border: `2px solid ${area.stroke}`, boxSizing: 'border-box' }} />
      ),
    },
    { key: 'search', label: 'Your search result', swatch: <SearchSwatch /> },
  ];

  return (
    <section className="placer-glass placer-map-legend" aria-label="Map legend">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}
        className="placer-map-legend-toggle" style={{ color: t.ink }}>
        Map key
        <Icon name={open ? 'chevDown' : 'chevUp'} size={16} stroke={2.2} />
      </button>

      {open && (
        <ul className="placer-map-legend-list">
          {rows.map(({ key, label, hint, swatch }) => (
            <li key={key}>
              <span className="placer-map-legend-swatch">{swatch}</span>
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: t.ink }}>{label}</span>
                {hint && <span style={{ display: 'block', fontSize: 12, color: t.inkDim }}>{hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MapLegend;
