/* PLACER — map mock. MapCanvas = SVG "tiles" (light/dark). MapView = tiles +
   pin overlay + controls. Pins are absolutely-positioned HTML over the SVG. */

const MAP_PAL = {
  light: {
    land: '#E9E6DD', block: '#E3DFD4', water: '#B9D7E3', park: '#CFE2B4',
    roadFill: '#FFFFFF', roadCase: '#D9D5C9',
    majFill: '#FCEFC6', majCase: '#E8DBA6',
    rail: '#CFC9BB', label: 'rgba(44,42,32,0.55)', wlabel: 'rgba(40,80,100,0.6)',
    blockStroke: 'rgba(44,42,32,0.05)',
  },
  dark: {
    land: '#14161B', block: '#191C22', water: '#0E2731', park: '#15281A',
    roadFill: '#2B2F38', roadCase: '#1E222A',
    majFill: '#3D434E', majCase: '#262B33',
    rail: '#33373F', label: 'rgba(228,228,216,0.42)', wlabel: 'rgba(150,200,215,0.5)',
    blockStroke: 'rgba(255,255,255,0.03)',
  },
};

function MapCanvas({ mode = 'light' }) {
  const p = MAP_PAL[mode];
  // Irregular street grid coordinates within a 1000×760 viewBox.
  const vx = [70, 150, 232, 318, 470, 560, 648, 760, 858, 940];
  const hy = [80, 150, 226, 300, 408, 500, 590, 680];
  const majV = [318, 648];        // avenues (thicker)
  const majH = [300, 500];
  return (
    <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
      <rect x="0" y="0" width="1000" height="760" fill={p.land} />

      {/* parks */}
      <path d="M720 60 H980 V250 H840 Q780 250 760 200 Q740 150 720 120 Z" fill={p.park} />
      <rect x="372" y="330" width="150" height="120" rx="4" fill={p.park} />
      <circle cx="180" cy="470" r="62" fill={p.park} />

      {/* river — runs through the lower-left corner */}
      <path d="M-20 760 L120 600 Q200 520 180 420 Q160 330 280 250 Q360 196 330 96 L300 -20 L210 -20 L250 110 Q270 200 200 250 Q90 330 110 430 Q126 520 60 590 L-20 700 Z"
        fill={p.water} />

      {/* block tints between some streets for texture */}
      {hy.slice(0, -1).map((y, r) => vx.slice(0, -1).map((x, c) => (
        ((r + c) % 3 === 0) ? (
          <rect key={`b${r}-${c}`} x={x + 4} y={y + 4} width={vx[c + 1] - x - 8}
            height={hy[r + 1] - y - 8} fill={p.block} stroke={p.blockStroke} />
        ) : null
      )))}

      {/* road casing (drawn under fill) */}
      <g stroke={p.roadCase} strokeLinecap="round">
        {vx.map((x, i) => <line key={`vc${i}`} x1={x} y1="-10" x2={x} y2="770" strokeWidth={majV.includes(x) ? 22 : 12} />)}
        {hy.map((y, i) => <line key={`hc${i}`} x1="-10" y1={y} x2="1010" y2={y} strokeWidth={majH.includes(y) ? 22 : 12} />)}
        <line x1="-20" y1="40" x2="1020" y2="640" strokeWidth={20} />
      </g>
      {/* road fill */}
      <g strokeLinecap="round">
        {vx.map((x, i) => <line key={`vf${i}`} x1={x} y1="-10" x2={x} y2="770"
          stroke={majV.includes(x) ? p.majFill : p.roadFill} strokeWidth={majV.includes(x) ? 15 : 7} />)}
        {hy.map((y, i) => <line key={`hf${i}`} x1="-10" y1={y} x2="1010" y2={y}
          stroke={majH.includes(y) ? p.majFill : p.roadFill} strokeWidth={majH.includes(y) ? 15 : 7} />)}
        <line x1="-20" y1="40" x2="1020" y2="640" stroke={p.majFill} strokeWidth={13} />
      </g>

      {/* rail line */}
      <line x1="0" y1="226" x2="1000" y2="226" stroke={p.rail} strokeWidth="2.4" strokeDasharray="2 7" />

      {/* labels */}
      <g fill={p.label} style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 0.5 }}>
        <text x="332" y="150" transform="rotate(90 332 150)">MARKET AVE</text>
        <text x="660" y="120" transform="rotate(90 660 120)">CANAL AVE</text>
        <text x="470" y="294">8TH ST</text>
        <text x="470" y="494">RIVERSIDE BLVD</text>
        <text x="800" y="155" fill={p.label} style={{ fontFamily: "'Archivo', sans-serif", fontSize: 15, fontWeight: 600 }}>HIGHLAND PARK</text>
      </g>
      <text x="62" y="640" fill={p.wlabel} transform="rotate(-44 62 640)"
        style={{ fontFamily: "'Archivo', sans-serif", fontStyle: 'italic', fontSize: 17, fontWeight: 500 }}>River Mill</text>
    </svg>
  );
}

// teardrop pin (HTML). category drives color; size scales the marker.
function Pin({ cat, x, y, count, selected, size = 36, theme, onClick, children }) {
  const c = CAT[cat] || CAT.green;
  const s = selected ? size * 1.18 : size;
  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-100%)',
      zIndex: selected ? 40 : 10, cursor: 'pointer' }} onClick={onClick}>
      {children}
      <div style={{ position: 'relative', width: s, height: s, margin: '0 auto',
        animation: 'placer-pin-pop .35s cubic-bezier(.2,.8,.3,1) both' }}>
        <div style={{ position: 'absolute', inset: 0, background: c.color,
          borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
          border: selected ? `2.5px solid ${theme.accent}` : '2px solid rgba(255,255,255,.92)',
          boxShadow: '0 4px 10px rgba(0,0,0,.28)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          {count
            ? <span className="placer-disp" style={{ fontSize: s * 0.42, fontWeight: 800, color: '#fff' }}>{count}</span>
            : <Icon name={c.icon} size={s * 0.5} stroke={2.1} />}
        </div>
      </div>
      {/* ground dot */}
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,0,0,.35)', margin: '1px auto 0' }} />
    </div>
  );
}

Object.assign(window, { MapCanvas, Pin, MAP_PAL });
