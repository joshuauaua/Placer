/* PLACER — layout primitives shared by the three imagination steps
   (place assets, describe, post) */

import { Icon } from './Icon';

const STEPS = ['Place assets', 'Describe', 'Post'];

export function StepBar({ t, step = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {STEPS.map((s, i) => {
        const on = i + 1 === step, done = i + 1 < step;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: on || done ? 1 : 0.5 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? t.primaryBg : done ? t.accent : 'transparent', color: on ? t.primaryFg : done ? t.accentInk : t.inkDim,
                border: on || done ? 'none' : `1.5px solid ${t.lineStrong}`, fontWeight: 800, fontSize: 12.5 }} className="placer-mono">
                {done ? <Icon name="check" size={14} stroke={2.6} /> : i + 1}
              </span>
              <span style={{ fontSize: 14, fontWeight: on ? 800 : 600, color: on ? t.ink : t.inkDim }}>{s}</span>
            </div>
            {i < 2 && <span style={{ width: 26, height: 1.5, background: t.line }} />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Full-bleed step screen: back button, centred StepBar, caller-supplied actions on
 * the right, and the step's own content filling the rest. These screens sit outside
 * MainApp's nav bar and footer, so the top bar is all the chrome they get.
 */
export function FlowScreen({ t, step, onBack, backLabel = 'Back to map', actions, children }) {
  return (
    <div className="placer-screen" style={{ background: t.page, color: t.ink, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 60, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
        background: t.chrome, borderBottom: `1px solid ${t.line}`, zIndex: 30 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px 0 8px', borderRadius: 9,
          border: 'none', background: 'transparent', cursor: 'pointer', color: t.ink, fontWeight: 700, fontSize: 14 }}>
          <Icon name="chevLeft" size={19} stroke={2.2} />{backLabel}
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><StepBar t={t} step={step} /></div>
        {actions}
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
