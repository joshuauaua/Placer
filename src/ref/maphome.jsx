/* PLOT — Map Home screen (themeable). Reused for the Search/Filter state and
   the three visual-direction artboards. */

function NavBar({ t, query, filterState }) {
  return (
    <div style={{ height: 66, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 20,
      padding: '0 22px', background: t.chrome, borderBottom: `1px solid ${t.line}`, position: 'relative', zIndex: 60 }}>
      <Logo t={t} size={20} />
      <div style={{ width: 1, height: 26, background: t.line }} />
      <nav style={{ display: 'flex', gap: 4 }}>
        {['Explore', 'Map', 'Leaderboard'].map((l, i) => (
          <span key={l} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
            color: i === 1 ? t.ink : t.inkDim, background: i === 1 ? t.surfaceAlt : 'transparent' }}>{l}</span>
        ))}
      </nav>
      <div style={{ flex: 1, maxWidth: 440, margin: '0 auto' }}>
        <SearchBar t={t} value={query} placeholder="Search a place, street, or idea…" />
      </div>
      <button style={{ width: 42, height: 42, borderRadius: 10, border: `1.5px solid ${t.line}`, background: 'transparent',
        color: t.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
        <Icon name="bell" size={20} stroke={2} />
        <span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#D6452F' }} />
      </button>
      <Btn t={t} variant="accent" icon="sparkle">New imagination</Btn>
      <Avatar name="You There" size={40} ring={t.line} />
    </div>
  );
}

function SortPill({ t, value }) {
  return (
    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px',
      borderRadius: 8, border: `1.5px solid ${t.line}`, background: t.surface, cursor: 'pointer',
      fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13.5, color: t.ink }}>
      <Icon name="sort" size={15} stroke={2} style={{ color: t.inkDim }} />
      {value}
      <Icon name="chevDown" size={14} stroke={2.2} style={{ color: t.inkDim }} />
    </button>
  );
}

function Thumb({ im, size = 58 }) {
  const c = CAT[im.cat];
  return (
    <div style={{ width: size, height: size, borderRadius: 9, overflow: 'hidden', flex: '0 0 auto', position: 'relative',
      background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
        <StreetScene mode="light" placed={[{ type: c.icon === 'tree' ? 'tree' : c.icon === 'bench' ? 'bench' : c.icon === 'cart' ? 'planter' : c.icon === 'light' ? 'light' : c.icon === 'play' ? 'play' : 'tree', x: 500, scale: 2.4 }]} />
      </div>
      <div style={{ position: 'absolute', bottom: 5, left: 5, width: 22, height: 22, borderRadius: 6, background: c.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <Icon name={c.icon} size={13} stroke={2.2} />
      </div>
    </div>
  );
}

function ImCard({ t, im, active }) {
  return (
    <div style={{ display: 'flex', gap: 13, padding: 13, borderRadius: 12, cursor: 'pointer',
      background: active ? t.surface : 'transparent',
      boxShadow: active ? t.shadow : 'none',
      border: active ? `1.5px solid ${t.accent}` : `1px solid transparent` }}>
      <Vote t={t} count={im.votes} voted={active} size="sm" />
      <Thumb im={im} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: t.ink, lineHeight: 1.2, letterSpacing: '-0.01em',
          marginBottom: 5, textWrap: 'pretty' }}>{im.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <Avatar name={im.author} size={18} />
          <span style={{ fontSize: 12.5, color: t.inkDim, fontWeight: 500 }}>{im.author}</span>
          <span className="plot-mono" style={{ fontSize: 11.5, color: t.inkFaint }}>· {im.when}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CatTag cat={im.cat} t={t} size="sm" />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: t.inkFaint, fontWeight: 600 }}>
            <Icon name="comment" size={13} stroke={2} />{im.comments}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeftRail({ t, sort, activeCat, filterState }) {
  const list = filterState ? IMAGINATIONS.filter((i) => i.cat === 'green' || i.cat === 'seating') : IMAGINATIONS;
  return (
    <div style={{ width: 376, flex: '0 0 auto', background: t.chrome, borderRight: `1px solid ${t.line}`,
      display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '18px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="plot-disp" style={{ fontSize: 22, fontWeight: 800, color: t.ink, letterSpacing: '-0.02em' }}>
              {filterState ? 'Results' : 'Imaginations'}
            </span>
            <span className="plot-mono" style={{ fontSize: 13, color: t.inkDim }}>{filterState ? '24' : '312'} nearby</span>
          </div>
          <SortPill t={t} value={sort || 'Trending'} />
        </div>
        {/* category filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Chip t={t} active={!activeCat && !filterState} onClick={() => {}}>All</Chip>
          {CAT_LIST.map((c) => (
            <Chip key={c.key} t={t} color={c.color} icon="dot"
              active={filterState ? (c.key === 'green' || c.key === 'seating') : c.key === activeCat}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>
      <div style={{ height: 1, background: t.line, margin: '4px 0' }} />
      <div className="plot-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 18px' }}>
        {list.map((im, i) => <ImCard key={im.id} t={t} im={im} active={i === 0} />)}
      </div>
    </div>
  );
}

function MapControls({ t }) {
  const ibtn = { width: 42, height: 42, background: t.surface, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink };
  return (
    <div style={{ position: 'absolute', right: 22, bottom: 24, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 50 }}>
      <div style={{ borderRadius: 11, overflow: 'hidden', boxShadow: t.shadow, border: `1px solid ${t.line}` }}>
        <button style={{ ...ibtn, borderBottom: `1px solid ${t.line}` }}><Icon name="plus" size={20} stroke={2.2} /></button>
        <button style={ibtn}><Icon name="minus" size={20} stroke={2.2} /></button>
      </div>
      <button style={{ ...ibtn, borderRadius: 11, boxShadow: t.shadow, border: `1px solid ${t.line}` }}><Icon name="layers" size={19} stroke={2} /></button>
      <button style={{ ...ibtn, borderRadius: 11, boxShadow: t.shadow, border: `1px solid ${t.line}`, color: t.accent === '#D7FB36' ? t.ink : t.accent }}>
        <Icon name="crosshair" size={19} stroke={2} />
      </button>
    </div>
  );
}

// popover preview floating above the selected pin
function PinPopover({ t, im }) {
  const c = CAT[im.cat];
  return (
    <div style={{ position: 'absolute', left: 0, bottom: '112%', transform: 'translateX(-50%)', width: 244,
      background: t.surface, borderRadius: 13, boxShadow: t.shadow, border: `1px solid ${t.line}`, overflow: 'hidden' }}>
      <div style={{ height: 96, position: 'relative', overflow: 'hidden' }}>
        <StreetScene mode="light" placed={PLACED_FEATURED.slice(0, 3).map((p) => ({ ...p, x: p.x * 0.9 + 60, scale: (p.scale || 1) * 1.15 }))} />
        <div style={{ position: 'absolute', top: 9, left: 9 }}><CatTag cat={im.cat} t={t} size="sm" solid /></div>
      </div>
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, lineHeight: 1.2, marginBottom: 7, letterSpacing: '-0.01em' }}>{im.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Avatar name={im.author} size={20} />
            <span style={{ fontSize: 12.5, color: t.inkDim, fontWeight: 600 }}>{im.author}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: t.ink }} className="plot-disp">
            <Icon name="arrowUp" size={15} stroke={2.6} style={{ color: t.mapMode === 'dark' ? t.accent : t.ink }} />{im.votes}
          </span>
        </div>
      </div>
      <div style={{ width: 12, height: 12, background: t.surface, position: 'absolute', left: '50%', bottom: -6,
        transform: 'translateX(-50%) rotate(45deg)', borderRight: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }} />
    </div>
  );
}

function MapArea({ t, filterState }) {
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: t.page }}>
      <MapCanvas mode={t.mapMode} />

      {/* in-view count pill */}
      <div style={{ position: 'absolute', top: 18, left: 18, display: 'flex', gap: 10, zIndex: 50 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 999,
          background: t.surface, border: `1px solid ${t.line}`, boxShadow: t.shadow, fontSize: 13.5, fontWeight: 700, color: t.ink }}>
          <Icon name="pin" size={16} stroke={2} style={{ color: t.accent === '#D7FB36' ? CAT.green.color : t.accent }} />
          {filterState ? '24 results in view' : '312 imaginations'}
        </span>
      </div>

      {/* pins */}
      {IMAGINATIONS.map((im, i) => (
        <Pin key={im.id} cat={im.cat} x={im.x} y={im.y} theme={t} selected={i === 0} size={i === 0 ? 42 : 34}>
          {i === 0 && <PinPopover t={t} im={im} />}
        </Pin>
      ))}
      <Pin cat="play" x={88} y={48} count={12} theme={t} size={40} />

      <MapControls t={t} />

      {/* click-to-imagine hint */}
      <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 50,
        display: 'inline-flex', alignItems: 'center', gap: 9, height: 46, padding: '0 18px 0 16px', borderRadius: 999,
        background: t.primaryBg, color: t.primaryFg, boxShadow: t.shadow, fontWeight: 700, fontSize: 14.5 }}>
        <Icon name="crosshair" size={18} stroke={2.2} />
        Click anywhere on the map to imagine it differently
      </div>
    </div>
  );
}

function MapHome({ t, query, sort, activeCat, filterState }) {
  return (
    <div className="plot-screen" style={{ background: t.page, color: t.ink, display: 'flex', flexDirection: 'column' }}>
      <NavBar t={t} query={query} filterState={filterState} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <LeftRail t={t} sort={sort} activeCat={activeCat} filterState={filterState} />
        <MapArea t={t} filterState={filterState} />
      </div>
    </div>
  );
}

// — Search & Filter screen: MapHome + an open advanced-filter panel —
function FilterRow({ t, label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="plot-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: t.inkDim, textTransform: 'uppercase', marginBottom: 9 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
}

function FilterPanel({ t }) {
  return (
    <div style={{ position: 'absolute', top: 18, left: 18, width: 320, zIndex: 55,
      background: t.surface, borderRadius: 14, boxShadow: t.shadow, border: `1px solid ${t.line}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px 13px', borderBottom: `1px solid ${t.line}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 16, color: t.ink }} className="plot-disp">
          <Icon name="filter" size={18} stroke={2.2} />Filters
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.accent === '#D7FB36' ? t.ink : t.accent }}>Reset</span>
      </div>
      <div style={{ padding: '15px 16px 18px' }}>
        <FilterRow t={t} label="Category">
          {CAT_LIST.map((c) => (
            <Chip key={c.key} t={t} color={c.color} icon="dot" active={c.key === 'green' || c.key === 'seating'}>{c.label}</Chip>
          ))}
        </FilterRow>
        <FilterRow t={t} label="Status">
          <Chip t={t} active>Open</Chip>
          <Chip t={t}>In review</Chip>
          <Chip t={t}>Built</Chip>
        </FilterRow>
        <FilterRow t={t} label="Sort by">
          <Chip t={t} active>Top voted</Chip>
          <Chip t={t}>Newest</Chip>
          <Chip t={t}>Nearest</Chip>
        </FilterRow>
        <FilterRow t={t} label="Distance — within 1.2 mi">
          <div style={{ width: '100%', height: 6, borderRadius: 3, background: t.surfaceAlt, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '46%', borderRadius: 3, background: t.accent === '#D7FB36' ? t.ink : t.accent }} />
            <div style={{ position: 'absolute', left: '46%', top: '50%', transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: t.surface, border: `2px solid ${t.ink}`, boxShadow: t.shadow }} />
          </div>
        </FilterRow>
        <Btn t={t} variant="primary" full style={{ marginTop: 6 }}>Show 24 results</Btn>
      </div>
    </div>
  );
}

function SearchFilterScreen({ t }) {
  return (
    <div className="plot-screen" style={{ background: t.page, color: t.ink, display: 'flex', flexDirection: 'column' }}>
      <NavBar t={t} query="benches & shade near Riverside" filterState />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <LeftRail t={t} sort="Top voted" filterState />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: t.page }}>
          <MapCanvas mode={t.mapMode} />
          <FilterPanel t={t} />
          {/* dim non-matching pins, highlight green + seating */}
          {IMAGINATIONS.map((im, i) => {
            const match = im.cat === 'green' || im.cat === 'seating';
            return (
              <div key={im.id} style={{ opacity: match ? 1 : 0.28, filter: match ? 'none' : 'grayscale(0.6)' }}>
                <Pin cat={im.cat} x={im.x} y={im.y} theme={t} selected={match && i === 1} size={match ? 38 : 30}>
                  {i === 1 && <PinPopover t={t} im={IMAGINATIONS[1]} />}
                </Pin>
              </div>
            );
          })}
          <div style={{ position: 'absolute', top: 18, right: 18, display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 999, zIndex: 50,
            background: t.surface, border: `1px solid ${t.line}`, boxShadow: t.shadow, fontSize: 13.5, fontWeight: 700, color: t.ink }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: CAT.green.color }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: CAT.seating.color }} />
            2 categories · 24 matches
          </div>
          <MapControls t={t} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MapHome, SearchFilterScreen, FilterPanel, NavBar, LeftRail, MapArea, ImCard, Thumb, MapControls, PinPopover, SortPill });
