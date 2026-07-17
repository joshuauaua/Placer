/* PLOT — Street View: place assets screen */

import { useState, lazy, Suspense } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ASSET_LIB } from '../data';

const ImaginationCanvas = lazy(() => import('./ImaginationCanvas'));

function StepBar({ t, step = 1 }) {
  const steps = ['Place assets', 'Describe', 'Post'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {steps.map((s, i) => {
        const on = i + 1 === step, done = i + 1 < step;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: on || done ? 1 : 0.5 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? t.primaryBg : done ? t.accent : 'transparent', color: on ? t.primaryFg : done ? t.accentInk : t.inkDim,
                border: on || done ? 'none' : `1.5px solid ${t.lineStrong}`, fontWeight: 800, fontSize: 12.5 }} className="plot-mono">
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

export function StreetScreen({ t, onBack, onNext, capturedView }) {
  const [canvasAssets, setCanvasAssets] = useState([]);

  return (
    <div className="plot-screen" style={{ background: t.page, color: t.ink, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{ height: 60, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
        background: t.chrome, borderBottom: `1px solid ${t.line}`, zIndex: 30 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px 0 8px', borderRadius: 9,
          border: 'none', background: 'transparent', cursor: 'pointer', color: t.ink, fontWeight: 700, fontSize: 14 }}>
          <Icon name="chevLeft" size={19} stroke={2.2} />Back to map
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><StepBar t={t} step={1} /></div>
        <Btn t={t} variant="ghost" size="sm" style={{ color: t.inkDim }}>Save draft</Btn>
        <Btn t={t} variant="primary" size="sm" icon="arrowRight" onClick={onNext}>Next: Describe</Btn>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ImaginationCanvas with built-in asset library */}
        <Suspense fallback={
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkDim }}>
            Loading canvas…
          </div>
        }>
          <ImaginationCanvas
            capturedView={capturedView || {}}
            availableAssets={ASSET_LIB}
            canvasAssets={canvasAssets}
            onCanvasAssetsChange={setCanvasAssets}
            width={1000}
            height={700}
            backgroundImage={capturedView?.screenshot || null}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default StreetScreen;
