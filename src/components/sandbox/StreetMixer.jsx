/* PLACER — Sandbox: Street Section Mixer.
 *
 * The street is a fixed number of metres wide and every metre is already spoken for,
 * so nothing can be added without something else giving way. Dragging a divider makes
 * the two neighbours trade width; the readout says what the trade bought.
 *
 * All the arithmetic is in src/lib/streetSection.js — this file is the handles.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Meter, Panel, PresetRow, Readout } from '../SandboxLayout';
import {
  DEFAULT_STREET_WIDTH,
  MAX_STREET_WIDTH,
  MIN_STREET_WIDTH,
  PRESET_LIST,
  SEGMENT_LIST,
  SEGMENT_TYPES,
  addSegment,
  compare,
  distributeSlack,
  loadPreset,
  metrics,
  presetMetrics,
  removeSegment,
  resize,
} from '../../lib/streetSection';

const NUDGE = 0.25;

/** Today's street, for the "vs today" column. Always a 20-metre street, as built. */
const BASELINE = presetMetrics('today');

function formatMetres(value) {
  return `${value.toFixed(2).replace(/\.?0+$/, '')} m`;
}

function formatPeople(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
}

export function StreetMixer({ t, experiment }) {
  const [streetWidth, setStreetWidth] = useState(DEFAULT_STREET_WIDTH);
  const [segments, setSegments] = useState(() => loadPreset('today'));
  const [preset, setPreset] = useState('today');
  const [notice, setNotice] = useState(null);
  const [dragging, setDragging] = useState(null);
  const stripRef = useRef(null);
  const dragRef = useRef(null);

  const current = useMemo(() => metrics(segments, streetWidth), [segments, streetWidth]);
  const delta = compare(current, BASELINE);

  // The street can never be narrower than what is already on it: to narrow it you
  // have to take something out first, which is the lesson rather than a limitation.
  const widthFloor = Math.max(MIN_STREET_WIDTH, current.used);

  function apply(next, { keepPreset = false } = {}) {
    setSegments(next);
    setNotice(null);
    if (!keepPreset) setPreset(null);
  }

  function pickPreset(key) {
    setSegments(loadPreset(key));
    setStreetWidth(DEFAULT_STREET_WIDTH);
    setPreset(key);
    setNotice(null);
  }

  /** Widen or narrow one segment, taking the difference from whichever neighbour it has. */
  function nudge(index, amount) {
    const next = index < segments.length - 1
      ? resize(segments, index, amount)
      : resize(segments, index - 1, -amount);
    if (next === segments) return;
    apply(next);
  }

  function add(type) {
    const result = addSegment(segments, type, streetWidth);
    if (!result.added) {
      setNotice(result.reason);
      return;
    }
    apply(result.segments);
  }

  useEffect(() => {
    if (dragging === null) return undefined;

    const onMove = (event) => {
      const drag = dragRef.current;
      const strip = stripRef.current;
      if (!drag || !strip) return;
      const pixels = strip.getBoundingClientRect().width;
      if (!pixels) return;

      // Measured from where the drag started, so the section cannot creep as the
      // pointer wobbles, and snapped to 5 cm so the readout stays readable.
      const moved = ((event.clientX - drag.startX) * streetWidth) / pixels;
      setSegments(resize(drag.segments, drag.index, Math.round(moved * 20) / 20));
      setPreset(null);
    };

    const stop = () => {
      dragRef.current = null;
      setDragging(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [dragging, streetWidth]);

  const tallest = Math.max(...segments.map((segment) => SEGMENT_TYPES[segment.type]?.max ?? 1), 1);
  let cumulative = 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title="The street" aside={
          <span className="placer-mono" style={{ fontSize: 12, color: current.unallocated > 0 ? '#C0392B' : t.inkDim }}>
            {formatMetres(current.used)} of {formatMetres(streetWidth)}
            {current.unallocated > 0 && ` — ${formatMetres(current.unallocated)} spare`}
          </span>
        }>
          <PresetRow t={t} presets={PRESET_LIST} active={preset} onPick={pickPreset} color={experiment.color} />

          {/* The cross-section. Widths are percentages of the street, so it scales. */}
          <div
            ref={stripRef}
            style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', height: 170, marginTop: 18,
              borderRadius: 10, background: t.surfaceAlt, overflow: 'hidden', touchAction: 'none' }}>
            {segments.map((segment, index) => {
              const type = SEGMENT_TYPES[segment.type];
              if (!type) return null;
              const share = (segment.width / streetWidth) * 100;
              // Something tall gets a tall glyph, so the section reads as a section.
              const glyph = 26 + (type.max / tallest) * 54;

              return (
                <div
                  key={`${segment.type}-${index}`}
                  title={`${type.label} — ${formatMetres(segment.width)}`}
                  style={{ width: `${share}%`, height: '100%', flex: '0 0 auto', display: 'flex',
                    flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }}>
                  <span style={{ color: type.color, marginBottom: 6, opacity: 0.9 }}>
                    <Icon name={iconFor(type.key)} size={Math.min(glyph, 34)} stroke={1.9} />
                  </span>
                  <span style={{ width: '100%', height: 30, background: type.color, opacity: 0.9,
                    borderLeft: `1px solid ${t.surface}` }} />
                </div>
              );
            })}

            {/* Whatever is left over, drawn as the hole it is. */}
            {current.unallocated > 0 && (
              <div
                aria-hidden="true"
                style={{ width: `${(current.unallocated / streetWidth) * 100}%`, height: '100%', flex: '0 0 auto',
                  background: `repeating-linear-gradient(45deg, ${t.line} 0 6px, transparent 6px 12px)` }}
              />
            )}

            {segments.slice(0, -1).map((segment, index) => {
              cumulative += segment.width;
              const left = (cumulative / streetWidth) * 100;
              const right = segments[index + 1];
              const leftType = SEGMENT_TYPES[segment.type];
              const rightType = SEGMENT_TYPES[right.type];
              if (!leftType || !rightType) return null;

              return (
                <div
                  key={`divider-${index}`}
                  role="separator"
                  aria-orientation="vertical"
                  tabIndex={0}
                  aria-label={`Divider between ${leftType.label} and ${rightType.label}`}
                  aria-valuenow={segment.width}
                  aria-valuemin={leftType.min}
                  aria-valuemax={leftType.max}
                  aria-valuetext={`${leftType.label} ${formatMetres(segment.width)}`}
                  onPointerDown={(event) => {
                    dragRef.current = { index, startX: event.clientX, segments };
                    setDragging(index);
                  }}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 1 : NUDGE;
                    if (event.key === 'ArrowLeft') apply(resize(segments, index, -step));
                    else if (event.key === 'ArrowRight') apply(resize(segments, index, step));
                    else return;
                    event.preventDefault();
                  }}
                  style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: 16, marginLeft: -8,
                    cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: dragging === index ? `${experiment.color}22` : 'transparent' }}>
                  <span style={{ width: 3, height: 42, borderRadius: 999, background: dragging === index ? experiment.color : t.lineStrong }} />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label htmlFor="street-width" style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>
              Street width
            </label>
            <input
              id="street-width"
              type="range"
              min={MIN_STREET_WIDTH}
              max={MAX_STREET_WIDTH}
              step={0.5}
              value={streetWidth}
              onChange={(event) => setStreetWidth(Math.max(widthFloor, Number(event.target.value)))}
              style={{ flex: '1 1 200px', accentColor: experiment.color }}
            />
            <span className="placer-mono" style={{ fontSize: 13, color: t.inkDim, minWidth: 58 }}>{formatMetres(streetWidth)}</span>
            {current.unallocated > 0 && (
              <button
                onClick={() => apply(distributeSlack(segments, streetWidth))}
                style={buttonStyle(t)}>
                Fill the street
              </button>
            )}
          </div>
          {streetWidth <= widthFloor && streetWidth > MIN_STREET_WIDTH && (
            <p style={{ marginTop: 8, fontSize: 12.5, color: t.inkDim }}>
              Take something out before the street can be narrower than this.
            </p>
          )}
        </Panel>

        <Panel t={t} title="What is in it">
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {segments.map((segment, index) => {
              const type = SEGMENT_TYPES[segment.type];
              if (!type) return null;
              return (
                <li key={`row-${segment.type}-${index}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                    borderBottom: index === segments.length - 1 ? 'none' : `1px solid ${t.line}` }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: type.color, flex: '0 0 auto' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.ink, flex: 1, minWidth: 0 }}>{type.label}</span>
                  <span className="placer-mono" style={{ fontSize: 13, color: t.inkDim, minWidth: 56, textAlign: 'right' }}>
                    {formatMetres(segment.width)}
                  </span>
                  <button onClick={() => nudge(index, -NUDGE)} aria-label={`Narrow ${type.label}`} style={stepStyle(t)}>
                    <Icon name="minus" size={15} stroke={2.4} />
                  </button>
                  <button onClick={() => nudge(index, NUDGE)} aria-label={`Widen ${type.label}`} style={stepStyle(t)}>
                    <Icon name="plus" size={15} stroke={2.4} />
                  </button>
                  <button
                    onClick={() => apply(removeSegment(segments, index))}
                    aria-label={`Remove ${type.label}`}
                    disabled={segments.length <= 1}
                    style={{ ...stepStyle(t), opacity: segments.length <= 1 ? 0.4 : 1 }}>
                    <Icon name="trash" size={15} stroke={2.1} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.line}` }}>
            <div className="placer-mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: t.inkDim, marginBottom: 10 }}>
              Add to the street
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SEGMENT_LIST.map((type) => (
                <button key={type.key} onClick={() => add(type.key)} style={{ ...buttonStyle(t), borderColor: `${type.color}66`, color: type.color }}>
                  <Icon name={iconFor(type.key)} size={15} stroke={2.1} />
                  {type.label}
                </button>
              ))}
            </div>
            {notice && (
              <p role="status" style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: '#C0392B' }}>{notice}</p>
            )}
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title="What this street does">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
            <Readout
              t={t}
              label="People moved / hour"
              value={formatPeople(current.peoplePerHour)}
              delta={delta.peoplePerHour === 0 ? 0 : Math.round(delta.peoplePerHour)}
              deltaLabel="vs today"
            />
            <Readout
              t={t}
              label="Street in shade"
              value={Math.round(current.canopyShare * 100)}
              unit="%"
              delta={Math.round(delta.canopyShare * 100)}
              deltaLabel="pts vs today"
            />
          </div>

          <Meter t={t} label="Space for people" value={current.peopleShare} color={experiment.color}
            caption={`${Math.round(current.peopleShare * 100)}%`} />
          <Meter t={t} label="Space for cars" value={current.carShare} color="#55595F"
            caption={`${Math.round(current.carShare * 100)}%`} />
          {current.unallocated > 0 && (
            <Meter t={t} label="Still unallocated" value={current.unallocated / streetWidth} color={t.lineStrong}
              caption={formatMetres(current.unallocated)} />
          )}
        </Panel>

        <Panel t={t} title="Why the numbers move">
          <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
            A metre of footway moves around 1,200 people an hour and a metre of traffic lane
            about 250, so handing a lane to walking, cycling or a bus is what changes the
            headline figure — not widening the street.
          </p>
          <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, marginTop: 10 }}>
            Trees shade about twice their own width, which is why a 1.5-metre planting strip
            does more for summer heat than the same width of anything else.
          </p>
          <p className="placer-mono" style={{ fontSize: 11.5, color: t.inkFaint, lineHeight: 1.6, marginTop: 14 }}>
            Figures are rough, and calibrated to make the trade-offs feel right rather than to
            size a real scheme.
          </p>
        </Panel>
      </div>
    </div>
  );
}

/** The icon each segment type is drawn with; the palette has no icon field of its own. */
function iconFor(key) {
  return {
    sidewalk: 'user',
    trees: 'tree',
    cafe: 'bench',
    cycle: 'bike',
    bus: 'move',
    play: 'play',
    traffic: 'move',
    parking: 'grid',
  }[key] ?? 'layers';
}

function buttonStyle(t) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 11px', borderRadius: 8,
    border: `1.5px solid ${t.line}`, background: 'transparent', cursor: 'pointer', color: t.inkDim,
    fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13,
  };
}

function stepStyle(t) {
  return {
    width: 28, height: 28, borderRadius: 7, border: `1.5px solid ${t.line}`, background: 'transparent',
    cursor: 'pointer', color: t.inkDim, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flex: '0 0 auto',
  };
}

export default StreetMixer;
