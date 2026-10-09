import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? { y: +match[1], m: +match[2] - 1, d: +match[3] } : null;
}

const formatLabel = (value) => {
  const p = parseIso(value);
  if (!p) return '';
  return new Date(p.y, p.m, p.d).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
  });
};

// A calendar popup in place of <input type="date">, whose popup is drawn by the
// browser and can't be sized or styled. Value is an ISO yyyy-mm-dd string.
export function DatePicker({ t, id, value, onChange, style }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = parseIso(value);
  const today = new Date();
  const [view, setView] = useState(() => ({
    y: selected?.y ?? today.getFullYear(),
    m: selected?.m ?? today.getMonth(),
  }));

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setView({ y: selected?.y ?? today.getFullYear(), m: selected?.m ?? today.getMonth() });
    setOpen(!open);
  };

  const shiftMonth = (delta) => setView(({ y, m }) => {
    const next = new Date(y, m + delta, 1);
    return { y: next.getFullYear(), m: next.getMonth() };
  });

  const pick = (iso) => { onChange(iso); setOpen(false); };

  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const navBtn = {
    width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${t.line}`, background: t.surface,
    color: t.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button id={id} type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open}
        style={{
          ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          textAlign: 'left', cursor: 'pointer',
          color: value ? t.ink : t.inkFaint,
        }}>
        <span>{value ? formatLabel(value) : 'Select a date'}</span>
        <Icon name="calendar" size={18} color={t.inkDim} />
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date"
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: t.inkFaint, padding: '4px 0' }}>
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;
              const iso = toIso(view.y, view.m, day);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button key={iso} type="button" onClick={() => pick(iso)} aria-pressed={isSelected}
                  style={{
                    height: 42, borderRadius: 10, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    border: isToday && !isSelected ? `1.5px solid ${t.lineStrong}` : '1.5px solid transparent',
                    background: isSelected ? t.primaryBg : 'transparent',
                    color: isSelected ? t.primaryFg : t.ink,
                  }}>
                  {day}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button type="button" onClick={() => pick('')} disabled={!value}
              style={{ background: 'none', border: 'none', padding: '6px 4px', fontSize: 14, fontFamily: 'inherit',
                fontWeight: 600, color: value ? t.inkDim : t.inkFaint, cursor: value ? 'pointer' : 'default' }}>
              Clear
            </button>
            <button type="button" onClick={() => pick(todayIso)}
              style={{ background: 'none', border: 'none', padding: '6px 4px', fontSize: 14, fontFamily: 'inherit',
                fontWeight: 600, color: t.ink, cursor: 'pointer' }}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
