/* PLACER — Create: describe & post the imagination. */

function Field({ t, label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{label}</span>
        {hint && <span className="placer-mono" style={{ fontSize: 11.5, color: t.inkFaint }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function CreateScreen({ t }) {
  const im = FEATURED;
  const used = [
    { type: 'tree', label: 'Tree', n: 2 },
    { type: 'bench', label: 'Bench', n: 1 },
    { type: 'planter', label: 'Planter', n: 1 },
    { type: 'light', label: 'Lighting', n: 1 },
  ];
  return (
    <div className="placer-screen" style={{ background: t.page, color: t.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 60, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
        background: t.chrome, borderBottom: `1px solid ${t.line}`, zIndex: 30 }}>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px 0 8px', borderRadius: 9,
          border: 'none', background: 'transparent', cursor: 'pointer', color: t.ink, fontWeight: 700, fontSize: 14 }}>
          <Icon name="chevLeft" size={19} stroke={2.2} />Back to placing
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><StepBar t={t} step={2} /></div>
        <Btn t={t} variant="ghost" size="sm" style={{ color: t.inkDim }}>Save draft</Btn>
        <Btn t={t} variant="accent" size="sm" icon="send">Post imagination</Btn>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* preview */}
        <div className="placer-scroll" style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: t.shadow, border: `1px solid ${t.line}`, background: t.surface }}>
            <div style={{ height: 392, position: 'relative' }}>
              <StreetScene mode="light" placed={PLACED_FEATURED} />
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'inline-flex', padding: 4, borderRadius: 10, background: t.surface, border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
                <span style={{ padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, color: t.inkDim }}>Before</span>
                <span style={{ padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, background: t.primaryBg, color: t.primaryFg }}>After</span>
              </div>
              <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'inline-flex', alignItems: 'center', gap: 9, height: 38, padding: '0 14px', borderRadius: 999,
                background: 'rgba(12,13,16,.8)', backdropFilter: 'blur(6px)', color: '#fff' }}>
                <Icon name="pin" size={16} stroke={2} style={{ color: t.accent }} />
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>Lot 7</span>
                <span className="placer-mono" style={{ fontSize: 12, opacity: 0.7 }}>Riverside Blvd & 8th</span>
              </div>
            </div>
          </div>
          <div>
            <div className="placer-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: t.inkDim, textTransform: 'uppercase', marginBottom: 10 }}>Assets used · 5</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {used.map((u) => (
                <span key={u.type} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 13px 0 8px', borderRadius: 999, border: `1px solid ${t.line}`, background: t.surface }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: t.surfaceAlt, overflow: 'hidden', position: 'relative' }}>
                    <svg viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}><g transform="translate(30,54) scale(0.4)"><AssetArt type={u.type} p={STREET_PAL.light} /></g></svg>
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{u.label}</span>
                  {u.n > 1 && <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>×{u.n}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* form */}
        <div className="placer-scroll" style={{ width: 460, flex: '0 0 auto', background: t.chrome, borderLeft: `1px solid ${t.line}`, overflowY: 'auto', padding: '28px 30px 32px' }}>
          <h2 className="placer-disp" style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: t.ink, letterSpacing: '-0.02em' }}>Describe your imagination</h2>
          <p style={{ margin: '0 0 26px', fontSize: 14.5, color: t.inkDim, lineHeight: 1.5 }}>A clear title and a short why help neighbors understand and back your idea.</p>

          <Field t={t} label="Title" hint="46 / 70">
            <div style={{ minHeight: 52, padding: '13px 15px', borderRadius: 11, border: `1.5px solid ${t.accent}`, background: t.surface,
              fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>
              A pocket park where Lot 7 sits today
            </div>
          </Field>

          <Field t={t} label="Description" hint="recommended">
            <div style={{ minHeight: 120, padding: '13px 15px', borderRadius: 11, border: `1.5px solid ${t.line}`, background: t.surface,
              fontSize: 14.5, color: t.ink, lineHeight: 1.55 }}>
              Lot 7 is three rows of parking that sit empty most of the week. Swapping the asphalt for trees, a small lawn, and a few benches would give the block its first real green space — and a place to actually sit on the walk to the transit stop.
            </div>
          </Field>

          <Field t={t} label="Category">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CAT_LIST.map((c) => <Chip key={c.key} t={t} color={c.color} icon="dot" active={c.key === 'green'}>{c.label}</Chip>)}
            </div>
          </Field>

          <Field t={t} label="Location">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, height: 52, padding: '0 15px', borderRadius: 11, border: `1.5px solid ${t.line}`, background: t.surface }}>
              <Icon name="pin" size={19} stroke={2} style={{ color: CAT.green.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>Lot 7 · Riverside Blvd & 8th</div>
                <div className="placer-mono" style={{ fontSize: 11.5, color: t.inkDim }}>47.6105, −122.3421</div>
              </div>
              <Icon name="pencil" size={17} stroke={2} style={{ color: t.inkDim }} />
            </div>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px', borderRadius: 11, background: t.surfaceAlt, marginBottom: 22 }}>
            <Icon name="layers" size={19} stroke={2} style={{ color: t.inkDim }} />
            <span style={{ flex: 1, fontSize: 13.5, color: t.inkDim, fontWeight: 600 }}>Posts publicly to the <b style={{ color: t.ink }}>Midtown</b> map</span>
            <div style={{ width: 42, height: 24, borderRadius: 12, background: t.accent === '#D7FB36' ? t.ink : t.accent, position: 'relative' }}>
              <span style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
            </div>
          </div>

          <Btn t={t} variant="accent" size="lg" icon="send" full>Post imagination</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CreateScreen, Field });
