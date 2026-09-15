/* PLACER — shared chrome for a sandbox experiment, and the small readout primitives
   the experiments build their panels from. Named after FlowLayout.jsx, which does
   the same job for the three steps of making an imagination. */

import { Icon } from './Icon';
import { Btn, Chip, CopyButton } from './UI';

/** The permanent link to an experiment, for the copy button. */
export function experimentUrl(id) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/sandbox/${id}`;
}

/**
 * An experiment's header and body. The scrolling container is the Sandbox page's,
 * not this one's, so a tool can put a sticky panel inside itself if it wants to.
 *
 * `actions` sits beside the copy-link button, for anything the page wants to offer
 * about this experiment rather than inside it — starting a room, so far. Named
 * after the same slot on FlowScreen.
 */
export function SandboxLayout({ t, experiment, onBack, actions, children }) {
  return (
    <div>
      <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onBack}
        style={{ padding: '0 12px 0 6px', marginBottom: 18, color: t.inkDim }}>
        All experiments
      </Btn>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: experiment.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name={experiment.icon} size={22} stroke={2.2} />
            </span>
            <h1 className="placer-disp" style={{ fontSize: 32, fontWeight: 900, color: t.ink, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {experiment.name}
            </h1>
          </div>
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6, maxWidth: 660 }}>{experiment.blurb}</p>
          <p className="placer-mono" style={{ marginTop: 12, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: experiment.color }}>
            Try this — {experiment.hint}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions}
          <CopyButton t={t} value={experimentUrl(experiment.id)}
            fieldLabel="Link to this experiment" fieldWidth={260}
            style={{ alignItems: 'flex-end' }} />
        </div>
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
      <div className="placer-disp" style={{ fontSize: 26, fontWeight: 900, color: tone || t.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 14, fontWeight: 700, color: t.inkDim, marginLeft: 4 }}>{unit}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <div className="placer-mono" style={{ fontSize: 11.5, marginTop: 4, color: delta === 0 ? t.inkFaint : delta > 0 ? '#2E7D32' : '#C0392B' }}>
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
      {presets.map((preset) => (
        <Chip
          key={preset.key}
          t={t}
          color={color}
          active={preset.key === active}
          ariaPressed={preset.key === active}
          title={preset.note}
          onClick={() => onPick(preset.key)}>
          {preset.label}
        </Chip>
      ))}
    </div>
  );
}
