/* PLACER — shared chrome for a sandbox experiment, and the small readout primitives
   the experiments build their panels from. Named after FlowLayout.jsx, which does
   the same job for the three steps of making an imagination. */

import { useState } from 'react';
import { Icon } from './Icon';
import { copyText } from '../lib/clipboard';

/** The permanent link to an experiment, for the copy button. */
export function experimentUrl(id) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/sandbox/${id}`;
}

function CopyLink({ t, experiment }) {
  // null → untouched, true → copied, false → the browser refused, so show the URL.
  const [copied, setCopied] = useState(null);
  const url = experimentUrl(experiment.id);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {copied === false && (
        <input
          readOnly
          value={url}
          aria-label="Link to this experiment"
          onFocus={(event) => event.target.select()}
          style={{ width: 260, height: 36, padding: '0 10px', borderRadius: 12, border: `1.5px solid ${t.line}`,
            background: t.chrome, color: t.inkDim, fontFamily: 'var(--placer-font)', fontSize: 12 }}
        />
      )}
      <button
        onClick={async () => setCopied(await copyText(url))}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px', borderRadius: 12,
          border: `1.5px solid ${t.line}`, background: 'transparent', cursor: 'pointer', color: t.inkDim,
          fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: 13.5 }}>
        <Icon name={copied ? 'check' : 'link'} size={16} stroke={2.2} />
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}

/**
 * An experiment's header and body. The scrolling container is the Sandbox page's,
 * not this one's, so a tool can put a sticky panel inside itself if it wants to.
 */
export function SandboxLayout({ t, experiment, onBack, children }) {
  return (
    <div>
      <button
        onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px 0 6px',
          marginBottom: 18, borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer',
          color: t.inkDim, fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: 13.5 }}>
        <Icon name="chevLeft" size={18} stroke={2.2} />
        All experiments
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: experiment.tint, color: t.ink,
              boxShadow: `inset 0 0 0 1px ${experiment.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name={experiment.icon} size={22} stroke={2.2} />
            </span>
            <h1 className="placer-disp" style={{ fontSize: 32, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {experiment.name}
            </h1>
          </div>
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6, maxWidth: 660 }}>{experiment.blurb}</p>
          <p className="placer-mono" style={{ marginTop: 12, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: experiment.color }}>
            Try this — {experiment.hint}
          </p>
        </div>
        <CopyLink t={t} experiment={experiment} />
      </div>

      {children}
    </div>
  );
}

/** A card with a small mono label, matching the "how it works" card on the welcome view. */
export function Panel({ t, title, aside, children, style }) {
  return (
    <section style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, padding: 20,
      boxShadow: t.shadow, minWidth: 0, ...style }}>
      {(title || aside) && (
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          {title && (
            <h2 className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: t.inkDim }}>
              {title}
            </h2>
          )}
          <div style={{ flex: 1 }} />
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

/** One headline number, with its units and an optional change against a baseline. */
export function Readout({ t, label, value, unit, delta, deltaLabel, tone }) {
  const sign = delta > 0 ? '+' : '';
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim, marginBottom: 4 }}>{label}</div>
      <div className="placer-disp" style={{ fontSize: 26, fontWeight: 700, color: tone || t.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 14, fontWeight: 700, color: t.inkDim, marginLeft: 4 }}>{unit}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <div className="placer-mono" style={{ fontSize: 11.5, marginTop: 4, color: delta === 0 ? t.inkFaint : delta > 0 ? '#1E7B3A' : '#B3261E' }}>
          {delta === 0 ? 'no change' : `${sign}${delta}`} {deltaLabel}
        </div>
      )}
    </div>
  );
}

/** A labelled bar. `value` is 0–1; a negative value draws left of centre. */
export function Meter({ t, label, value, color, caption, signed }) {
  const magnitude = Math.min(1, Math.abs(value));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{label}</span>
        <div style={{ flex: 1 }} />
        <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>{caption}</span>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 999, background: t.surfaceAlt, overflow: 'hidden' }}>
        {signed && <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: t.line }} />}
        <span style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 999, background: color,
          left: signed ? (value < 0 ? `${50 - magnitude * 50}%` : '50%') : 0,
          width: signed ? `${magnitude * 50}%` : `${magnitude * 100}%` }} />
      </div>
    </div>
  );
}

/** The row of preset buttons every experiment opens with. */
export function PresetRow({ t, presets, active, onPick, color, label = 'Presets' }) {
  return (
    // Grouped and named, because a preset can share a name with something in the
    // experiment's own palette — "Play street" is both a preset and a segment type.
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {presets.map((preset) => {
        const on = preset.key === active;
        return (
          <button
            key={preset.key}
            onClick={() => onPick(preset.key)}
            aria-pressed={on}
            title={preset.note}
            style={{ height: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: 13.5,
              border: `1.5px solid ${on ? color : t.line}`,
              background: on ? `${color}18` : 'transparent',
              color: on ? color : t.inkDim }}>
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
