import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? { y: +match[1], m: +match[2] - 1, d: +match[3] } : null;
}

const order = (a, b) => (a <= b ? [a, b] : [b, a]);

const formatDay = (value, withYear) => {
  const p = parseIso(value);
  if (!p) return '';
  return new Date(p.y, p.m, p.d).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  });
};

function rangeLabel(start, end) {
  if (!start) return '';
  if (!end || end === start) return formatDay(start, true);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`;
}

// One calendar for a start and an end date, in place of two <input type="date">
// whose popups the browser draws and CSS can't size or style. Tap a start and then
// an end, or press on the start and drag to the end. Values are ISO yyyy-mm-dd
// strings; onChange(start, end) is called with '' for a date that is not set.
export function DateRangePicker({ t, id, start, end, onChange, style }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // a tapped start, still waiting for its end
  const [dragFrom, setDragFrom] = useState(null);
  const [hover, setHover] = useState(null);
  const rootRef = useRef(null);
  const live = useRef({});
  live.current = { anchor, dragFrom, hover, onChange };
  const first = parseIso(start);
  const today = new Date();
  const [view, setView] = useState(() => ({
    y: first?.y ?? today.getFullYear(),
    m: first?.m ?? today.getMonth(),
  }));

  const settle = () => { setAnchor(null); setDragFrom(null); setHover(null); };

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!rootRef.current?.contains(e.target)) { setOpen(false); settle(); } };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); settle(); } };
    // A drag can end anywhere, so the release is heard on the whole page.
    const onUp = () => {
      const { anchor: a, dragFrom: from, hover: over, onChange: emit } = live.current;
      if (!from) return;
      if (over && over !== from) {
        const [lo, hi] = order(from, over);
        emit(lo, hi);
        setOpen(false);
        settle();
      } else if (a) {
        const [lo, hi] = order(a, from);
        emit(lo, hi);
        setOpen(false);
        settle();
      } else {
        setAnchor(from);
        setDragFrom(null);
        emit(from, '');
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', onUp);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setView({ y: first?.y ?? today.getFullYear(), m: first?.m ?? today.getMonth() });
    settle();
    setOpen(!open);
  };

  const shiftMonth = (delta) => setView(({ y, m }) => {
    const next = new Date(y, m + delta, 1);
    return { y: next.getFullYear(), m: next.getMonth() };
  });

  // Touch keeps sending events to the cell it started on, so find the cell under the finger.
  const trackPointer = (e) => {
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-iso]');
    if (cell) setHover(cell.dataset.iso);
  };

  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // What is shaded: a drag in progress, else a tapped start following the pointer, else the saved range.
  let lo = start || null;
  let hi = end || start || null;
  if (dragFrom) [lo, hi] = order(dragFrom, hover || dragFrom);
  else if (anchor) [lo, hi] = order(anchor, hover || anchor);

  const navBtn = {
    width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${t.line}`, background: t.surface,
    color: t.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  const textBtn = (enabled) => ({
    background: 'none', border: 'none', padding: '6px 4px', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
    color: enabled ? t.ink : t.inkFaint, cursor: enabled ? 'pointer' : 'default',
  });

  const hint = anchor ? 'Now tap an end date' : 'Tap a start date, then an end date — or drag across a range';

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button id={id} type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open}
        style={{
          ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          textAlign: 'left', cursor: 'pointer', color: start ? t.ink : t.inkFaint,
        }}>
        <span>{start ? rangeLabel(start, end) : 'Select start and end dates'}</span>
        <Icon name="calendar" size={18} color={t.inkDim} />
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date range"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
            width: 'min(360px, calc(100vw - 32px))', padding: 18, boxSizing: 'border-box',
            background: t.surface, border: `1.5px solid ${t.line}`, borderRadius: 16,
            boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" style={navBtn}>
              <Icon name="chevLeft" size={18} />
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink }}>{monthLabel}</div>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" style={navBtn}>
              <Icon name="chevRight" size={18} />
            </button>
          </div>

          <div onPointerMove={trackPointer} onPointerLeave={() => { if (!dragFrom) setHover(null); }}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4,
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
            }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: t.inkFaint, padding: '4px 0' }}>
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;
              const iso = toIso(view.y, view.m, day);
              const column = (firstWeekday + day - 1) % 7;
              const isEdge = iso === lo || iso === hi;
              const inRange = lo && hi && iso >= lo && iso <= hi;
              const isToday = iso === todayIso;
              // The shading runs edge to edge across a week and rounds off at its ends.
              const roundLeft = iso === lo || column === 0;
              const roundRight = iso === hi || column === 6;
              return (
                <button key={iso} type="button" data-iso={iso}
                  onPointerDown={(e) => { e.preventDefault(); setDragFrom(iso); setHover(iso); }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    if (anchor) { const [a, b] = order(anchor, iso); onChange(a, b); setOpen(false); settle(); }
                    else { setAnchor(iso); onChange(iso, ''); }
                  }}
                  aria-pressed={isEdge}
                  style={{
                    height: 42, padding: 0, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', touchAction: 'none',
                    fontWeight: isEdge || isToday ? 700 : 500,
                    border: 'none', outline: 'none',
                    borderRadius: `${roundLeft ? 10 : 0}px ${roundRight ? 10 : 0}px ${roundRight ? 10 : 0}px ${roundLeft ? 10 : 0}px`,
                    background: isEdge ? t.primaryBg : inRange ? t.surfaceAlt : 'transparent',
                    color: isEdge ? t.primaryFg : t.ink,
                    boxShadow: isToday && !isEdge ? `inset 0 0 0 1.5px ${t.lineStrong}` : 'none',
                  }}>
                  {day}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 14, fontSize: 13, color: t.inkDim, lineHeight: 1.4 }}>{hint}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <button type="button" onClick={() => { onChange('', ''); settle(); }} disabled={!start}
              style={textBtn(!!start)}>
              Clear
            </button>
            <button type="button" onClick={() => setView({ y: today.getFullYear(), m: today.getMonth() })}
              style={textBtn(true)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
