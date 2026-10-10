import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
const order = (a, b) => (a <= b ? [a, b] : [b, a]);

const VIEW_HEIGHT = 340; // the scrolling window, a little over five weeks
const EDGE = 56; // how close to the top or bottom a drag has to be to start scrolling
const MAX_SPEED = 8; // px per frame at the very edge
const HOLD_MS = 220; // a finger has to rest this long before it drags a range instead of scrolling

function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? { y: +match[1], m: +match[2] - 1, d: +match[3] } : null;
}

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

const monthTitle = (y, m) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

// A day's full name, for its button: "15 November 2026".
const dayName = (y, m, d) => new Date(y, m, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// One month of days. It only redraws when its own slice of the shaded range changes,
// which keeps a drag smooth with dozens of months in the list. Days before `min` or
// after `max` are shown but cannot be picked; `onDayClick` is the single-date picker's.
const Month = memo(function Month({ t, y, m, lo, hi, todayIso, min, max, onDayDown, onDayKey, onDayClick }) {
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return (
    <section data-month={monthKey(y, m)} style={{ paddingBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, padding: '10px 2px 8px' }}>{monthTitle(y, m)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4 }}>
        {cells.map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} />;
          const iso = toIso(y, m, day);
          const column = (firstWeekday + day - 1) % 7;
          const isEdge = iso === lo || iso === hi;
          const inRange = lo && hi && iso >= lo && iso <= hi;
          const isToday = iso === todayIso;
          // The shading runs edge to edge across a week and rounds off at its ends.
          const roundLeft = iso === lo || column === 0;
          const roundRight = iso === hi || column === 6;
          const outside = (min && iso < min) || (max && iso > max);
          return (
            <button key={iso} type="button" data-iso={iso} disabled={outside}
              aria-label={dayName(y, m, day)}
              onPointerDown={onDayDown ? (e) => onDayDown(e, iso) : undefined}
              onKeyDown={onDayKey ? (e) => onDayKey(e, iso) : undefined}
              onClick={onDayClick ? () => onDayClick(iso) : undefined}
              aria-pressed={isEdge}
              style={{
                height: 42, padding: 0, fontSize: 15, fontFamily: 'inherit', cursor: outside ? 'default' : 'pointer',
                fontWeight: isEdge || isToday ? 700 : 500,
                border: 'none', outline: 'none',
                borderRadius: `${roundLeft ? 10 : 0}px ${roundRight ? 10 : 0}px ${roundRight ? 10 : 0}px ${roundLeft ? 10 : 0}px`,
                background: isEdge ? t.primaryBg : inRange ? t.surfaceAlt : 'transparent',
                color: isEdge ? t.primaryFg : outside ? t.inkFaint : t.ink,
                opacity: outside ? 0.45 : 1,
                boxShadow: isToday && !isEdge ? `inset 0 0 0 1.5px ${t.lineStrong}` : 'none',
              }}>
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
});

// One calendar for a start and an end date, in place of two <input type="date"> whose
// popups the browser draws and CSS can't size or style. The months scroll as one
// continuous list. Tap a start and then an end, or press on the start and drag to the
// end (a finger rests a moment first, so a swipe still scrolls); dragging to the top or
// bottom edge scrolls on. Values are ISO yyyy-mm-dd strings; onChange(start, end) is
// called with '' for a date that is not set.
export function DateRangePicker({ t, id, start, end, onChange, style }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // a tapped start, still waiting for its end
  const [dragFrom, setDragFrom] = useState(null);
  const [hover, setHover] = useState(null);
  const [title, setTitle] = useState('');
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const live = useRef({});
  const armed = useRef(false); // a drag is selecting; for a finger, only once it has held
  const holdTimer = useRef(null);
  const point = useRef(null);
  live.current = { anchor, dragFrom, hover, onChange };

  const today = new Date();
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
  const first = parseIso(start);
  // The months on offer are fixed while the popup is open, so a tapped date can't shift
  // the list under the pointer: from well before the earliest date in play to well after.
  const monthsList = useMemo(() => {
    const now = { y: today.getFullYear(), m: today.getMonth() };
    const a = parseIso(start);
    const b = parseIso(end) ?? a;
    const earliest = a && (a.y * 12 + a.m) < (now.y * 12 + now.m) ? a : now;
    const latest = b && (b.y * 12 + b.m) > (now.y * 12 + now.m) ? b : now;
    const span = (latest.y - earliest.y) * 12 + (latest.m - earliest.m);
    return Array.from({ length: span + 43 }, (_, i) => {
      const d = new Date(earliest.y, earliest.m + i - 6, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const settle = useCallback(() => {
    clearTimeout(holdTimer.current);
    armed.current = false;
    setAnchor(null); setDragFrom(null); setHover(null);
  }, []);

  const close = useCallback(() => { setOpen(false); settle(); }, [settle]);

  const sections = () => [...(scrollRef.current?.querySelectorAll('[data-month]') ?? [])];

  const scrollToMonth = (key, smooth) => {
    const el = sections().find((s) => s.dataset.month === key);
    if (el && scrollRef.current) scrollRef.current.scrollTo?.({ top: el.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
  };

  // The month heading follows whichever month is at the top of the window.
  const syncTitle = () => {
    const box = scrollRef.current;
    if (!box) return;
    const here = sections().filter((s) => s.offsetTop <= box.scrollTop + 24).pop();
    if (here) {
      const [y, m] = here.dataset.month.split('-').map(Number);
      setTitle(monthTitle(y, m - 1));
    }
  };

  // Open on the month of the start date, else this one.
  useLayoutEffect(() => {
    if (!open) return;
    const target = first ?? { y: today.getFullYear(), m: today.getMonth() };
    scrollToMonth(monthKey(target.y, target.m), false);
    syncTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hoverAt = (x, y) => {
    const cell = document.elementFromPoint(x, y)?.closest('[data-iso]');
    if (cell) setHover(cell.dataset.iso);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!rootRef.current?.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onMove = (e) => {
      point.current = { x: e.clientX, y: e.clientY };
      if (live.current.dragFrom && armed.current) hoverAt(e.clientX, e.clientY);
    };
    // A drag can end anywhere, so the release is heard on the whole page.
    const onUp = () => {
      const { anchor: a, dragFrom: f, hover: over, onChange: emit } = live.current;
      clearTimeout(holdTimer.current);
      if (!f) return;
      armed.current = false;
      if (over && over !== f) {
        const [lo, hi] = order(f, over);
        emit(lo, hi);
        close();
      } else if (a) {
        const [lo, hi] = order(a, f);
        emit(lo, hi);
        close();
      } else {
        setAnchor(f);
        setDragFrom(null);
        emit(f, '');
      }
    };
    // The browser took the gesture to scroll the list: abandon the drag.
    const onCancel = () => { if (live.current.dragFrom) { clearTimeout(holdTimer.current); armed.current = false; setDragFrom(null); setHover(null); } };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [open, close]);

  // While a range is being dragged, the list scrolls under a pointer held near its top or
  // bottom edge, faster the closer it gets. It is a continuous scroll, not a jump.
  useEffect(() => {
    if (!dragFrom) return undefined;
    let frame;
    const tick = () => {
      const box = scrollRef.current;
      const p = point.current;
      if (box && p && armed.current) {
        const rect = box.getBoundingClientRect();
        const intoTop = rect.top + EDGE - p.y;
        const intoBottom = p.y - (rect.bottom - EDGE);
        const speed = intoTop > 0 ? -Math.min(1, intoTop / EDGE) : intoBottom > 0 ? Math.min(1, intoBottom / EDGE) : 0;
        if (speed) {
          box.scrollTop += speed * MAX_SPEED;
          hoverAt(p.x, Math.min(Math.max(p.y, rect.top + 1), rect.bottom - 1));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragFrom]);

  // A finger that has held to drag a range must not also scroll the list.
  useEffect(() => {
    const box = scrollRef.current;
    if (!open || !box) return undefined;
    const block = (e) => { if (armed.current) e.preventDefault(); };
    box.addEventListener('touchmove', block, { passive: false });
    return () => box.removeEventListener('touchmove', block);
  }, [open]);

  const onDayDown = useCallback((e, iso) => {
    point.current = { x: e.clientX, y: e.clientY };
    setDragFrom(iso);
    setHover(iso);
    clearTimeout(holdTimer.current);
    if (e.pointerType === 'touch') {
      armed.current = false;
      holdTimer.current = setTimeout(() => { armed.current = true; }, HOLD_MS);
    } else {
      e.preventDefault();
      armed.current = true;
    }
  }, []);

  const onDayKey = useCallback((e, iso) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const { anchor: a, onChange: emit } = live.current;
    if (a) { const [lo, hi] = order(a, iso); emit(lo, hi); close(); }
    else { setAnchor(iso); emit(iso, ''); }
  }, [close]);

  const toggle = () => {
    if (open) close();
    else { settle(); setOpen(true); }
  };

  const step = (direction) => {
    const box = scrollRef.current;
    if (!box) return;
    const tops = sections().map((s) => s.offsetTop);
    const target = direction > 0
      ? tops.find((top) => top > box.scrollTop + 2)
      : [...tops].reverse().find((top) => top < box.scrollTop - 2);
    if (target !== undefined) box.scrollTo?.({ top: target, behavior: 'smooth' });
  };

  // What is shaded: a drag in progress, else a tapped start following the pointer, else the saved range.
  let lo = start || null;
  let hi = end || start || null;
  if (dragFrom && hover) [lo, hi] = order(dragFrom, hover);
  else if (anchor) [lo, hi] = order(anchor, hover || anchor);

  const navBtn = {
    width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${t.line}`, background: t.surface,
    color: t.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  const textBtn = (enabled) => ({
    background: 'none', border: 'none', padding: '6px 4px', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
    color: enabled ? t.ink : t.inkFaint, cursor: enabled ? 'pointer' : 'default',
  });

  const hint = anchor ? 'Now tap an end date' : 'Tap a start date, then an end date — or drag across a range, holding at the edge to keep scrolling';

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button type="button" onClick={() => step(-1)} aria-label="Previous month" style={navBtn}>
              <Icon name="chevUp" size={18} />
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink }}>{title}</div>
            <button type="button" onClick={() => step(1)} aria-label="Next month" style={navBtn}>
              <Icon name="chevDown" size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', paddingBottom: 4 }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: t.inkFaint, padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          <div ref={scrollRef} onScroll={syncTitle}
            onPointerLeave={() => { if (!dragFrom) setHover(null); }}
            onPointerMove={(e) => { if (!dragFrom) hoverAt(e.clientX, e.clientY); }}
            style={{
              height: VIEW_HEIGHT, overflowY: 'auto', overscrollBehavior: 'contain',
              touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
              scrollbarWidth: 'thin',
            }}>
            {monthsList.map(({ y, m }) => {
              const key = monthKey(y, m);
              const startKey = `${key}-01`;
              const endKey = `${key}-31`;
              const touches = lo && hi && hi >= startKey && lo <= endKey;
              return (
                <Month key={key} t={t} y={y} m={m}
                  lo={touches ? lo : null} hi={touches ? hi : null}
                  todayIso={todayIso} onDayDown={onDayDown} onDayKey={onDayKey} />
              );
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: t.inkDim, lineHeight: 1.4 }}>{hint}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <button type="button" onClick={() => { onChange('', ''); settle(); }} disabled={!start}
              style={textBtn(!!start)}>
              Clear
            </button>
            <button type="button" onClick={() => scrollToMonth(monthKey(today.getFullYear(), today.getMonth()), true)}
              style={textBtn(true)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One date, on the same calendar as DateRangePicker — the same button, popup, scrolling
 * months and footer — so every date in the app is picked the same way. A tap or Enter
 * on a day picks it and closes. `min` and `max` (yyyy-mm-dd, optional) bound what can
 * be picked, and the months on offer; onChange(value) is called with '' when cleared.
 */
export function DatePicker({
  t, id, value, min = null, max = null, onChange, style, placeholder = 'Select a date',
  label = 'Choose a date', clearable = true, disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const rootRef = useRef(null);
  const scrollRef = useRef(null);

  const today = new Date();
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
  const picked = parseIso(value);

  // Bounded by min and max when there are any; otherwise from half a year before the
  // date (or today) to three years after.
  const monthsList = useMemo(() => {
    const now = { y: today.getFullYear(), m: today.getMonth() };
    const from = parseIso(min) ?? (() => {
      const base = picked && (picked.y * 12 + picked.m) < (now.y * 12 + now.m) ? picked : now;
      const d = new Date(base.y, base.m - 6, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    })();
    const to = parseIso(max) ?? (() => {
      const base = picked && (picked.y * 12 + picked.m) > (now.y * 12 + now.m) ? picked : now;
      const d = new Date(base.y, base.m + 36, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    })();
    const span = Math.max(0, (to.y - from.y) * 12 + (to.m - from.m));
    return Array.from({ length: span + 1 }, (_, i) => {
      const d = new Date(from.y, from.m + i, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, min, max]);

  const close = useCallback(() => setOpen(false), []);
  const sections = () => [...(scrollRef.current?.querySelectorAll('[data-month]') ?? [])];

  const scrollToMonth = (key, smooth) => {
    const el = sections().find((section) => section.dataset.month === key);
    if (el && scrollRef.current) scrollRef.current.scrollTo?.({ top: el.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
  };

  const syncTitle = () => {
    const box = scrollRef.current;
    if (!box) return;
    const here = sections().filter((section) => section.offsetTop <= box.scrollTop + 24).pop();
    if (here) {
      const [y, m] = here.dataset.month.split('-').map(Number);
      setTitle(monthTitle(y, m - 1));
    }
  };

  // Open on the picked date's month, else this one, else the first that can be picked.
  useLayoutEffect(() => {
    if (!open) return;
    const first = monthsList[0];
    const wanted = picked ?? { y: today.getFullYear(), m: today.getMonth() };
    const inList = monthsList.some(({ y, m }) => y === wanted.y && m === wanted.m);
    const target = inList ? wanted : first;
    if (target) scrollToMonth(monthKey(target.y, target.m), false);
    syncTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!rootRef.current?.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const pick = useCallback((iso) => { onChange(iso); setOpen(false); }, [onChange]);

  const step = (direction) => {
    const box = scrollRef.current;
    if (!box) return;
    const tops = sections().map((section) => section.offsetTop);
    const target = direction > 0
      ? tops.find((top) => top > box.scrollTop + 2)
      : [...tops].reverse().find((top) => top < box.scrollTop - 2);
    if (target !== undefined) box.scrollTo?.({ top: target, behavior: 'smooth' });
  };

  const navBtn = {
    width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${t.line}`, background: t.surface,
    color: t.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  const textBtn = (enabled) => ({
    background: 'none', border: 'none', padding: '6px 4px', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
    color: enabled ? t.ink : t.inkFaint, cursor: enabled ? 'pointer' : 'default',
  });
  const todayPickable = (!min || todayIso >= min) && (!max || todayIso <= max);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button id={id} type="button" onClick={() => setOpen((was) => !was)} aria-haspopup="dialog"
        aria-expanded={open} disabled={disabled}
        style={{
          ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          textAlign: 'left', cursor: disabled ? 'default' : 'pointer', color: value ? t.ink : t.inkFaint,
        }}>
        <span>{value ? formatDay(value, true) : placeholder}</span>
        <Icon name="calendar" size={18} color={t.inkDim} />
      </button>

      {open && (
        <div role="dialog" aria-label={label}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
            width: 'min(360px, calc(100vw - 32px))', padding: 18, boxSizing: 'border-box',
            background: t.surface, border: `1.5px solid ${t.line}`, borderRadius: 16,
            boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button type="button" onClick={() => step(-1)} aria-label="Previous month" style={navBtn}>
              <Icon name="chevUp" size={18} />
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink }}>{title}</div>
            <button type="button" onClick={() => step(1)} aria-label="Next month" style={navBtn}>
              <Icon name="chevDown" size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', paddingBottom: 4 }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: t.inkFaint, padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          <div ref={scrollRef} onScroll={syncTitle}
            style={{ height: VIEW_HEIGHT, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}>
            {monthsList.map(({ y, m }) => {
              const key = monthKey(y, m);
              const here = value && value.startsWith(key) ? value : null;
              return (
                <Month key={key} t={t} y={y} m={m} lo={here} hi={here} todayIso={todayIso}
                  min={min} max={max} onDayClick={pick} />
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            {clearable ? (
              <button type="button" onClick={() => { onChange(''); close(); }} disabled={!value}
                style={textBtn(!!value)}>
                Clear
              </button>
            ) : <span />}
            <button type="button" disabled={!todayPickable}
              onClick={() => scrollToMonth(monthKey(today.getFullYear(), today.getMonth()), true)}
              style={textBtn(todayPickable)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
