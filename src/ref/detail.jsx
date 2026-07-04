/* PLOT — Imagination detail: hero, vote/rank, discussion. */

function CommentItem({ t, c }) {
  return (
    <div style={{ display: 'flex', gap: 13, padding: '18px 0', borderTop: `1px solid ${t.line}` }}>
      <Avatar name={c.author} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{c.author}</span>
          {c.badge && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: CAT.safety.color + '1E', color: CAT.safety.color }}>{c.badge}</span>}
          <span className="plot-mono" style={{ fontSize: 12, color: t.inkFaint }}>· {c.when}</span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 14.5, color: t.ink, lineHeight: 1.55, textWrap: 'pretty' }}>{c.text}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: t.inkDim }}>
            <Icon name="arrowUp" size={15} stroke={2.4} />{c.votes}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: t.inkDim }}>
            <Icon name="comment" size={14} stroke={2} />Reply
          </span>
        </div>
      </div>
    </div>
  );
}

function RailCard({ t, children, pad = 18 }) {
  return <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.line}`, boxShadow: t.shadow, padding: pad, marginBottom: 16 }}>{children}</div>;
}

function DetailScreen({ t }) {
  const im = FEATURED;
  return (
    <div className="plot-screen" style={{ background: t.page, color: t.ink, display: 'flex', flexDirection: 'column' }}>
      <NavBar t={t} />
      <div className="plot-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '26px 40px 56px', display: 'flex', gap: 34 }}>
          {/* main column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13, color: t.inkDim, fontWeight: 600 }}>
              <span>Explore</span><Icon name="chevRight" size={13} stroke={2.2} /><span>Midtown</span><Icon name="chevRight" size={13} stroke={2.2} />
              <span style={{ color: t.ink }}>Lot 7 pocket park</span>
            </div>

            <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: t.shadow, border: `1px solid ${t.line}`, marginBottom: 22 }}>
              <div style={{ height: 460, position: 'relative' }}>
                <StreetScene mode="light" placed={PLACED_FEATURED} />
                <div style={{ position: 'absolute', top: 18, left: 18, display: 'flex', gap: 10 }}>
                  <CatTag cat={im.cat} t={t} solid />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 12px', borderRadius: 999, background: 'rgba(12,13,16,.72)', color: '#fff', fontSize: 12.5, fontWeight: 700 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent }} />Open for support
                  </span>
                </div>
                <div style={{ position: 'absolute', top: 18, right: 18, display: 'inline-flex', padding: 4, borderRadius: 10, background: t.surface, border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
                  <span style={{ padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, color: t.inkDim }}>Before</span>
                  <span style={{ padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, background: t.primaryBg, color: t.primaryFg }}>After</span>
                </div>
              </div>
            </div>

            <h1 className="plot-disp" style={{ margin: '0 0 16px', fontSize: 40, fontWeight: 800, color: t.ink, letterSpacing: '-0.025em', lineHeight: 1.05, textWrap: 'balance' }}>
              A pocket park where Lot 7 sits today
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <Avatar name={im.author} size={36} />
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.ink }}>{im.author}</span>
                  <span className="plot-mono" style={{ fontSize: 12, color: t.inkDim }}>Posted {im.when} ago</span>
                </span>
              </span>
              <span style={{ width: 1, height: 30, background: t.line }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: t.inkDim }}>
                <Icon name="pin" size={16} stroke={2} style={{ color: CAT.green.color }} />{im.loc}
              </span>
            </div>

            <p style={{ margin: '0 0 18px', fontSize: 17, color: t.ink, lineHeight: 1.6, textWrap: 'pretty', maxWidth: 680 }}>
              Lot 7 is three rows of parking that sit empty most of the week. Swapping the asphalt for trees, a small lawn, and a few benches would give the block its first real green space — and a place to actually sit on the walk to the transit stop.
            </p>
            <p style={{ margin: '0 0 26px', fontSize: 17, color: t.inkDim, lineHeight: 1.6, textWrap: 'pretty', maxWidth: 680 }}>
              The lot is city-owned, so it could be reclaimed through the parks budget without buying any land. Even a pilot — planters and moveable seating — would prove the demand.
            </p>

            {/* action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`, marginBottom: 32 }}>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 48, padding: '0 20px', borderRadius: 11, cursor: 'pointer',
                background: t.accent, color: t.accentInk, border: 'none' }}>
                <Icon name="arrowUp" size={20} stroke={2.6} />
                <span className="plot-disp" style={{ fontSize: 18, fontWeight: 800 }}>{im.votes}</span>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>Upvote</span>
              </button>
              {[['comment', `${im.comments}`], ['share', 'Share'], ['bookmark', 'Save']].map(([ic, lb]) => (
                <button key={ic} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 18px', borderRadius: 11, cursor: 'pointer',
                  background: 'transparent', color: t.ink, border: `1.5px solid ${t.line}`, fontWeight: 700, fontSize: 14.5 }}>
                  <Icon name={ic} size={18} stroke={2} />{lb}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button style={{ width: 48, height: 48, borderRadius: 11, border: `1.5px solid ${t.line}`, background: 'transparent', color: t.inkDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="flag" size={18} stroke={2} />
              </button>
            </div>

            {/* discussion */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
              <h2 className="plot-disp" style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.ink, letterSpacing: '-0.02em' }}>Discussion</h2>
              <span className="plot-mono" style={{ fontSize: 14, color: t.inkDim }}>{im.comments} comments</span>
              <div style={{ flex: 1 }} />
              <SortPill t={t} value="Top" />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <Avatar name="You There" size={38} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, height: 50, padding: '0 8px 0 16px', borderRadius: 12, border: `1.5px solid ${t.line}`, background: t.surface }}>
                <span style={{ flex: 1, fontSize: 14.5, color: t.inkFaint }}>Add to the discussion…</span>
                <Btn t={t} variant="primary" size="sm" icon="send">Comment</Btn>
              </div>
            </div>
            <div>
              {COMMENTS.map((c, i) => <CommentItem key={i} t={t} c={c} />)}
            </div>
          </div>

          {/* right rail */}
          <div style={{ width: 344, flex: '0 0 auto' }}>
            <RailCard t={t}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div className="plot-disp" style={{ fontSize: 38, fontWeight: 800, color: t.ink, lineHeight: 1, letterSpacing: '-0.02em' }}>{im.votes}</div>
                  <div style={{ fontSize: 13, color: t.inkDim, fontWeight: 600, marginTop: 4 }}>upvotes</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="plot-disp" style={{ fontSize: 22, fontWeight: 800, color: CAT.green.color, lineHeight: 1 }}>#3</div>
                  <div style={{ fontSize: 12.5, color: t.inkDim, fontWeight: 600, marginTop: 4 }}>in Midtown</div>
                </div>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: t.surfaceAlt, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{ width: '68%', height: '100%', background: t.accent === '#D7FB36' ? CAT.green.color : t.accent }} />
              </div>
              <div style={{ fontSize: 12.5, color: t.inkDim, fontWeight: 600, marginBottom: 16 }}>
                <b style={{ color: t.ink }}>158</b> more to reach the <b style={{ color: t.ink }}>city review</b> threshold
              </div>
              <Btn t={t} variant="accent" size="lg" icon="arrowUp" full>Upvote this</Btn>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 14 }}>
                {['Mara Quinn', 'Devon Park', 'Lena Cho', 'Theo Banks', 'Priya N.'].map((n, i) => (
                  <span key={n} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: `0 0 0 2px ${t.surface}` }}><Avatar name={n} size={28} /></span>
                ))}
                <span style={{ marginLeft: 10, fontSize: 13, color: t.inkDim, fontWeight: 600 }}>+337 supporters</span>
              </div>
            </RailCard>

            <RailCard t={t} pad={0}>
              <div style={{ height: 150, position: 'relative', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
                <MapCanvas mode="light" />
                <div style={{ position: 'absolute', left: '50%', top: '54%' }}>
                  <Pin cat={im.cat} x={0} y={0} theme={t} size={36} />
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, marginBottom: 3 }}>{im.loc}</div>
                <div className="plot-mono" style={{ fontSize: 12, color: t.inkDim }}>47.6105, −122.3421 · Lot 7</div>
              </div>
            </RailCard>

            <RailCard t={t}>
              <div className="plot-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: t.inkDim, textTransform: 'uppercase', marginBottom: 13 }}>Nearby imaginations</div>
              {IMAGINATIONS.slice(1, 3).map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '9px 0' }}>
                  <Thumb im={n} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.title}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: t.ink }} className="plot-disp">
                    <Icon name="arrowUp" size={14} stroke={2.4} />{n.votes}
                  </span>
                </div>
              ))}
            </RailCard>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DetailScreen, CommentItem, RailCard });
