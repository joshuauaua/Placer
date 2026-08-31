/* PLACER — street-view diorama. Flat editorial scene; assets sit on the sidewalk.
   StreetScene({mode, placed:[{type,x,scale,selected}], showGuides}). */

const STREET_PAL = {
  light: {
    skyTop: '#BcdcEb', skyBot: '#E9F1EC', haze: '#CdDfE0',
    facades: ['#CDA079', '#B7BDAD', '#8FA39E', '#D8C49A', '#C58E6E'],
    win: '#33414A', winLit: 'rgba(255,255,255,.35)',
    sidewalk: '#D7D2C5', joint: 'rgba(40,38,30,.10)', curb: '#C2BCAD',
    road: '#3C4046', lane: '#E8C84A',
    skyline: '#A9C3CE',
  },
  dark: {
    skyTop: '#1A2030', skyBot: '#0E1320', haze: '#1C2535',
    facades: ['#2A2622', '#23282B', '#202A28', '#2B2722', '#262019'],
    win: '#0E1216', winLit: '#F2CE84',
    sidewalk: '#262A30', joint: 'rgba(255,255,255,.06)', curb: '#1D2025',
    road: '#15181C', lane: '#C9A93C',
    skyline: '#161D2A',
  },
};

// — flat asset illustrations, anchored at baseline (0,0) bottom-center —
function AssetArt({ type, p, lit }) {
  if (type === 'tree') return (
    <g>
      <rect x="-7" y="-46" width="14" height="46" rx="3" fill="#7A5236" />
      <circle cx="0" cy="-78" r="34" fill="#3E8E43" />
      <circle cx="-24" cy="-58" r="24" fill="#46994B" />
      <circle cx="24" cy="-60" r="22" fill="#357E3C" />
      <circle cx="2" cy="-96" r="22" fill="#4FA557" />
    </g>
  );
  if (type === 'bench') return (
    <g>
      <rect x="-46" y="-30" width="92" height="9" rx="3" fill="#B5723E" />
      <rect x="-46" y="-19" width="92" height="9" rx="3" fill="#C07F47" />
      <rect x="-46" y="-54" width="92" height="8" rx="3" fill="#B5723E" />
      <rect x="-46" y="-43" width="92" height="8" rx="3" fill="#C07F47" />
      <rect x="-40" y="-10" width="8" height="10" fill="#3C4248" />
      <rect x="32" y="-10" width="8" height="10" fill="#3C4248" />
      <rect x="-44" y="-56" width="7" height="56" fill="#3C4248" />
      <rect x="37" y="-56" width="7" height="56" fill="#3C4248" />
    </g>
  );
  if (type === 'planter') return (
    <g>
      <path d="M-26 0 L-20 -30 H20 L26 0 Z" fill="#B4584A" />
      <rect x="-26" y="-36" width="52" height="8" rx="2" fill="#C9685A" />
      <path d="M-12 -36 C-18 -58 -10 -64 -6 -54 C-2 -66 6 -64 4 -50 C12 -60 18 -50 10 -40" fill="none" stroke="#3E8E43" strokeWidth="5" strokeLinecap="round" />
      <circle cx="-8" cy="-58" r="5" fill="#E8B23A" />
      <circle cx="8" cy="-52" r="5" fill="#D4407E" />
      <circle cx="0" cy="-64" r="5" fill="#E8B23A" />
    </g>
  );
  if (type === 'light') return (
    <g>
      <rect x="-5" y="-120" width="10" height="120" rx="3" fill="#41464D" />
      <path d="M-3 -120 H-44 a8 8 0 00-8 8" fill="none" stroke="#41464D" strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="-52" cy="-104" rx="13" ry="9" fill="#41464D" />
      <ellipse cx="-52" cy="-99" rx="9" ry="5" fill={lit ? '#FFE69A' : '#D8DBE0'} />
      {lit && <circle cx="-52" cy="-99" r="30" fill="#FFE69A" opacity="0.22" />}
    </g>
  );
  if (type === 'bike') return (
    <g fill="none" stroke="#5A6066" strokeWidth="7" strokeLinecap="round">
      <path d="M-34 0 V-34 a10 10 0 0120 0 V0" />
      <path d="M0 0 V-34 a10 10 0 0120 0 V0" />
    </g>
  );
  if (type === 'play') return (
    <g>
      <path d="M-44 0 L-44 -54 L-6 -54" fill="none" stroke="#C0573F" strokeWidth="7" strokeLinecap="round" />
      <path d="M-44 -54 L4 0" fill="none" stroke="#E8B23A" strokeWidth="10" strokeLinecap="round" />
      <rect x="22" y="-58" width="40" height="6" rx="3" fill="#3C4248" />
      <line x1="28" y1="-56" x2="28" y2="-14" stroke="#7A52E0" strokeWidth="4" />
      <line x1="50" y1="-56" x2="50" y2="-14" stroke="#7A52E0" strokeWidth="4" />
      <rect x="26" y="-16" width="26" height="7" rx="3" fill="#2F7BD6" />
    </g>
  );
  return null;
}

function StreetScene({ mode = 'light', placed = [], showGuides = false, style }) {
  const p = STREET_PAL[mode];
  const facadeW = 168;
  const facades = [60, 60 + facadeW, 60 + facadeW * 2, 60 + facadeW * 3, 60 + facadeW * 4, 60 + facadeW * 5];
  return (
    <svg viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block', width: '100%', height: '100%', ...style }}>
      <defs>
        <linearGradient id={`sky-${mode}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset="1" stopColor={p.skyBot} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1000" height="430" fill={`url(#sky-${mode})`} />
      {/* far skyline */}
      <path d="M0 250 H80 V190 H150 V230 H230 V160 H300 V210 H380 V180 H470 V150 H560 V200 H640 V170 H740 V210 H840 V175 H940 V215 H1000 V300 H0 Z" fill={p.skyline} opacity="0.6" />

      {/* building facades */}
      {facades.map((x, i) => (
        <g key={i}>
          <rect x={x} y={196} width={facadeW - 8} height={234} fill={p.facades[i % p.facades.length]} />
          {[0, 1, 2].map((row) => [0, 1, 2].map((col) => {
            const lit = (i + row + col) % 4 === 0;
            return <rect key={`${row}-${col}`} x={x + 20 + col * 46} y={216 + row * 56} width={32} height={38}
              fill={lit && mode === 'dark' ? p.winLit : p.win} opacity={mode === 'dark' ? (lit ? 0.9 : 0.5) : 0.82} rx="1" />;
          }))}
          <rect x={x + 8} y={194} width={facadeW - 24} height={6} fill="rgba(0,0,0,.12)" />
        </g>
      ))}

      {/* sidewalk */}
      <rect x="0" y="430" width="1000" height="70" fill={p.sidewalk} />
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={i} x1={i * 66} y1="430" x2={i * 66 - 26} y2="500" stroke={p.joint} strokeWidth="2" />
      ))}
      <rect x="0" y="430" width="1000" height="4" fill="rgba(0,0,0,.08)" />
      {/* curb + road */}
      <rect x="0" y="496" width="1000" height="10" fill={p.curb} />
      <rect x="0" y="506" width="1000" height="114" fill={p.road} />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={40 + i * 150} y="556" width="70" height="9" rx="2" fill={p.lane} opacity="0.85" />
      ))}

      {/* placement guides */}
      {showGuides && Array.from({ length: 6 }).map((_, i) => (
        <g key={i} opacity="0.5">
          <line x1={120 + i * 150} y1="430" x2={120 + i * 150} y2="492" stroke="#2D5BFF" strokeWidth="1.5" strokeDasharray="3 5" />
          <circle cx={120 + i * 150} cy="486" r="4" fill="none" stroke="#2D5BFF" strokeWidth="1.5" />
        </g>
      ))}

      {/* placed assets */}
      {placed.map((a, i) => (
        <g key={i} transform={`translate(${a.x}, 488) scale(${a.scale || 1})`}>
          <ellipse cx="0" cy="2" rx={a.shadow || 40} ry="7" fill="rgba(0,0,0,.16)" />
          <AssetArt type={a.type} p={p} lit={a.lit !== false && mode === 'dark'} />
          {a.selected && (
            <rect x={-(a.boxW || 56)} y={-(a.boxH || 130)} width={(a.boxW || 56) * 2} height={(a.boxH || 130) + 8}
              fill="none" stroke="#2D5BFF" strokeWidth="2" strokeDasharray="6 5" rx="6" />
          )}
        </g>
      ))}
    </svg>
  );
}

Object.assign(window, { StreetScene, AssetArt, STREET_PAL });
