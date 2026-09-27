/* PLACER — a project's public-page views, one bar per day.
 *
 * One series, so no legend: the card's heading names it. Bars in ink, the brand's
 * one data colour, with a hover tooltip per day whose hit area is the whole column,
 * not just the bar, so a day with no views can still be pointed at. The same numbers
 * are in a visually hidden table for screen readers.
 */

import { useState } from 'react';

const HEIGHT = 140;
const TOP = 8;
const BOTTOM = 22; // room for the date labels

const dateLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'short' });

export function ProjectViewsChart({ t, daily }) {
  const [hovered, setHovered] = useState(null);
  if (!daily?.length) return null;

  const max = Math.max(1, ...daily.map((d) => d.views));
  const step = 100 / daily.length;
  const barWidth = Math.min(step * 0.62, 6);
  const plot = HEIGHT - TOP - BOTTOM;
  // The first, middle and last day are labelled; the tooltip carries the rest.
  const labelled = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]);
  const active = hovered === null ? null : daily[hovered];

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
        color: t.inkFaint, marginBottom: 4 }}>
        <span>{max} {max === 1 ? 'view' : 'views'}</span>
      </div>

      <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" width="100%" height={HEIGHT}
        role="img" aria-label={`Views per day, ${dateLabel(daily[0].day)} to ${dateLabel(daily.at(-1).day)}`}
        onMouseLeave={() => setHovered(null)} style={{ display: 'block', overflow: 'visible' }}>
        {/* Recessive: a top gridline at the maximum and the baseline. */}
        <line x1="0" x2="100" y1={TOP} y2={TOP} stroke={t.line} strokeWidth="1"
          vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
        <line x1="0" x2="100" y1={TOP + plot} y2={TOP + plot} stroke={t.lineStrong}
          strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {daily.map((d, i) => {
          const h = d.views === 0 ? 0 : Math.max(2, (d.views / max) * plot);
          const x = i * step + (step - barWidth) / 2;
          return (
            <g key={d.day}>
              {h > 0 && (
                <rect x={x} y={TOP + plot - h} width={barWidth} height={h} rx="1"
                  fill={t.ink} opacity={hovered === null || hovered === i ? 1 : 0.35} />
              )}
              <rect x={i * step} y={0} width={step} height={HEIGHT} fill="transparent"
                onMouseEnter={() => setHovered(i)} />
            </g>
          );
        })}
      </svg>

      {/* Date labels in HTML rather than SVG text, which preserveAspectRatio="none" would stretch. */}
      <div aria-hidden="true" style={{ position: 'relative', height: 16, marginTop: -BOTTOM + 6 }}>
        {daily.map((d, i) => labelled.has(i) && (
          <span key={d.day} style={{ position: 'absolute', left: `${(i + 0.5) * step}%`,
            transform: i === 0 ? 'none' : i === daily.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            fontSize: 12, color: t.inkFaint, whiteSpace: 'nowrap' }}>
            {dateLabel(d.day)}
          </span>
        ))}
      </div>

      {active && (
        <div role="status" style={{ position: 'absolute', top: 0,
          left: `${(hovered + 0.5) * step}%`,
          transform: hovered > daily.length / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
          padding: '6px 10px', borderRadius: 8, background: t.surface, border: `1px solid ${t.line}`,
          boxShadow: t.shadow, fontSize: 13, color: t.ink, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <strong>{active.views}</strong> {active.views === 1 ? 'view' : 'views'}
          <span style={{ color: t.inkDim }}> · {dateLabel(active.day)}</span>
        </div>
      )}

      <table className="placer-visually-hidden">
        <caption>Views of the public page per day</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Views</th></tr></thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}><td>{dateLabel(d.day)}</td><td>{d.views}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProjectViewsChart;
