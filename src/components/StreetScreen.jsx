/* PLOT — Street View: place assets screen */

import { useState } from 'react';
import { Icon } from './Icon';
import { Btn, SearchBar, Chip } from './UI';
import ImaginationCanvas from './ImaginationCanvas';
import { ASSET_LIB } from '../data';
import { CAT } from '../theme';

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

function AssetTile({ t, a, active, onClick }) {
  const c = CAT[a.cat];
  return (
    <div onClick={onClick} style={{ borderRadius: 12, border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.line}`,
      background: active ? (t.mapMode === 'dark' ? 'rgba(215,251,54,.08)' : t.accent + '14') : t.surface,
      padding: 11, cursor: 'pointer', position: 'relative' }}>
      <div style={{ height: 76, borderRadius: 8, background: t.surfaceAlt, marginBottom: 9, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={a.type} size={42} stroke={2} style={{ color: c.color }} />
        <span style={{ position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: '50%', background: c.color }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{a.label}</span>
        <Icon name="plus" size={16} stroke={2.4} style={{ color: t.inkDim }} />
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function AssetLibrary({ t, onAddAsset, placedCount }) {
  const tabs = ['All', 'Greenery', 'Seating', 'Lighting', 'Play'];
  const [activeTab, setActiveTab] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const handleAssetClick = (asset) => {
    setSelectedAsset(asset);
    onAddAsset(asset);
  };

  return (
    <div style={{ width: 340, flex: '0 0 auto', background: t.chrome, borderLeft: `1px solid ${t.line}`,
      display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <Icon name="grid" size={19} stroke={2} style={{ color: t.ink }} />
          <span className="plot-disp" style={{ fontSize: 19, fontWeight: 800, color: t.ink, letterSpacing: '-0.02em' }}>Asset library</span>
        </div>
        <SearchBar t={t} placeholder="Search assets…" />
        <div className="plot-scroll" style={{ display: 'flex', gap: 7, marginTop: 13, overflowX: 'auto', paddingBottom: 2 }}>
          {tabs.map((tb, i) => <Chip key={tb} t={t} active={i === activeTab} onClick={() => setActiveTab(i)}>{tb}</Chip>)}
        </div>
      </div>
      <div style={{ height: 1, background: t.line, margin: '14px 0 0' }} />
      <div className="plot-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div className="plot-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: t.inkDim, textTransform: 'uppercase', marginBottom: 11 }}>Suggested for this block</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          {ASSET_LIB.map((a) => <AssetTile key={a.type} t={t} a={a} active={selectedAsset?.type === a.type} onClick={() => handleAssetClick(a)} />)}
        </div>
      </div>
      <div style={{ padding: 16, borderTop: `1px solid ${t.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13.5, color: t.inkDim, fontWeight: 600 }}>
          <b style={{ color: t.ink }} className="plot-disp">{placedCount}</b> assets placed
        </span>
        <Btn t={t} variant="primary" size="sm" icon="arrowRight">Next: Describe</Btn>
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function SceneToolbar({ t, onDelete }) {
  const b = { width: 38, height: 38, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 5, borderRadius: 12,
      background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.line}` }}>
      <button style={b} title="Move"><Icon name="move" size={19} stroke={2} /></button>
      <button style={b} title="Rotate"><Icon name="rotate" size={19} stroke={2} /></button>
      <button style={b} title="Duplicate"><Icon name="layers" size={18} stroke={2} /></button>
      <span style={{ width: 1, height: 22, background: t.line, margin: '0 3px' }} />
      <button onClick={onDelete} style={{ ...b, color: '#D6452F' }} title="Delete"><Icon name="trash" size={18} stroke={2} /></button>
    </div>
  );
}

export function StreetScreen({ t, onBack, onNext, capturedView }) {
  const [canvasAssets, setCanvasAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  // eslint-disable-next-line no-unused-vars
  const handleAddAsset = (libraryAsset) => {
    const newAsset = {
      id: `asset-${canvasAssets.length + 1}`,
      type: libraryAsset.type,
      label: libraryAsset.label,
      cat: libraryAsset.cat,
      x: 500,
      y: 350,
      scale: 1,
      rotation: 0
    };
    setCanvasAssets([...canvasAssets, newAsset]);
    setSelectedAssetId(newAsset.id);
  };

  // eslint-disable-next-line no-unused-vars
  const handleDeleteSelected = () => {
    if (selectedAssetId) {
      setCanvasAssets(canvasAssets.filter(a => a.id !== selectedAssetId));
      setSelectedAssetId(null);
    }
  };

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
        <ImaginationCanvas
          capturedView={capturedView || {}}
          availableAssets={ASSET_LIB}
          canvasAssets={canvasAssets}
          onCanvasAssetsChange={setCanvasAssets}
          width={1000}
          height={700}
          backgroundImage={capturedView?.screenshot || null}
        />
      </div>
    </div>
  );
}
