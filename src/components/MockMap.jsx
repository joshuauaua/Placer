/* PLOT — Mock Map Interface (no Google Maps dependency) */

import { Icon } from './Icon';
import { Btn } from './UI';

export function MockMap({ t, onCaptureView }) {
  const handleCapture = () => {
    onCaptureView({
      position: { lat: 37.774900, lng: -122.419400 },
      pov: { heading: 0, pitch: 0, zoom: 1 },
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#E8E5DC', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ background: t.chrome, borderBottom: `1px solid ${t.line}`, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="pin" size={20} stroke={2} style={{ color: t.accent }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>Riverside Blvd & 8th</div>
            <div className="plot-mono" style={{ fontSize: 12, color: t.inkDim }}>Position: 37.774900, -122.419400</div>
          </div>
        </div>
        <Btn t={t} variant="accent" icon="sparkle" onClick={handleCapture}>
          Capture View for Imagination
        </Btn>
      </div>

      {/* Mock Map Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Grid Pattern Background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `
          repeating-linear-gradient(0deg, ${t.line} 0px, ${t.line} 1px, transparent 1px, transparent 40px),
          repeating-linear-gradient(90deg, ${t.line} 0px, ${t.line} 1px, transparent 1px, transparent 40px)
        ` }} />

        {/* Mock Street Layout */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1000 600">
          {/* Streets */}
          <rect x="200" y="0" width="80" height="600" fill={t.surfaceAlt} />
          <rect x="0" y="280" width="1000" height="80" fill={t.surfaceAlt} />
          <line x1="240" y1="0" x2="240" y2="600" stroke={t.line} strokeWidth="2" strokeDasharray="10 10" />
          <line x1="0" y1="320" x2="1000" y2="320" stroke={t.line} strokeWidth="2" strokeDasharray="10 10" />

          {/* Buildings */}
          <rect x="50" y="100" width="120" height="150" fill={t.surface} stroke={t.lineStrong} strokeWidth="2" rx="4" />
          <rect x="310" y="80" width="160" height="180" fill={t.surface} stroke={t.lineStrong} strokeWidth="2" rx="4" />
          <rect x="520" y="120" width="140" height="140" fill={t.surface} stroke={t.lineStrong} strokeWidth="2" rx="4" />
          <rect x="50" y="400" width="120" height="150" fill={t.surface} stroke={t.lineStrong} strokeWidth="2" rx="4" />
          <rect x="310" y="390" width="160" height="180" fill={t.surface} stroke={t.lineStrong} strokeWidth="2" rx="4" />
          <rect x="520" y="400" width="140" height="150" fill={t.surface} stroke={t.lineStrong} strokeWidth="2" rx="4" />

          {/* Green Space (Lot 7) */}
          <rect x="700" y="150" width="200" height="180" fill="#B8D5A8" stroke="#3E9D4E" strokeWidth="3" rx="6" />
          <text x="800" y="240" textAnchor="middle" fill="#2D6E2D" fontSize="14" fontWeight="700">Lot 7</text>

          {/* Location Markers */}
          <g transform="translate(800, 240)">
            <circle r="20" fill={t.accent} opacity="0.3" />
            <circle r="12" fill={t.accent} />
            <path d="M0,-6 L0,6 M-6,0 L6,0" stroke={t.accentInk} strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>

        {/* Instructions Card */}
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: t.surface, borderRadius: 12, padding: '20px 28px', boxShadow: t.shadow,
          border: `1px solid ${t.line}`, maxWidth: 500, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 10, background: t.accent, marginBottom: 12 }}>
            <Icon name="sparkle" size={24} stroke={2.2} style={{ color: t.accentInk }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
            Ready to reimagine this space?
          </div>
          <div style={{ fontSize: 14, color: t.inkDim, marginBottom: 16, lineHeight: 1.5 }}>
            This is Lot 7 - a half-empty parking lot that could become a vibrant pocket park with trees, benches, and community space.
          </div>
          <Btn t={t} variant="accent" size="lg" icon="arrowRight" full onClick={handleCapture}>
            Start placing assets
          </Btn>
        </div>

        {/* Map Controls */}
        <div style={{ position: 'absolute', right: 20, bottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ borderRadius: 11, overflow: 'hidden', boxShadow: t.shadow, border: `1px solid ${t.line}` }}>
            <button style={{ width: 42, height: 42, background: t.surface, border: 'none', borderBottom: `1px solid ${t.line}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
              <Icon name="plus" size={20} stroke={2.2} />
            </button>
            <button style={{ width: 42, height: 42, background: t.surface, border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
              <Icon name="minus" size={20} stroke={2.2} />
            </button>
          </div>
          <button style={{ width: 42, height: 42, borderRadius: 11, background: t.surface, border: `1px solid ${t.line}`,
            boxShadow: t.shadow, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.accent }}>
            <Icon name="crosshair" size={19} stroke={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
