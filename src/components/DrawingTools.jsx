/* PLACER — the pen card over Idea Visualizer's asset library.
 *
 * Colouring and doodling on the photo, Paint-style: a colour wheel (hue around it,
 * strength out from the middle) with a row of plain colours under it for black, white
 * and greys a wheel cannot give, a slider for the line's thickness and one for its
 * opacity, Draw and Eraser, and undo and clear for what has been drawn. It only
 * edits the brush; ImaginationCanvas does the drawing.
 */

import { useRef } from 'react';
import { Icon } from './Icon';

export const DEFAULT_BRUSH = { color: '#3A39FF', size: 8, opacity: 1, tool: 'pen' };
export const MIN_SIZE = 1;
export const MAX_SIZE = 60;

// The colours the wheel cannot reach (it holds full brightness), and the landing
// page's accents, which are the site's own.
const SWATCHES = ['#111111', '#6E6E6E', '#FFFFFF', '#3A39FF', '#FF5A23', '#F3BB06', '#DDD2FB', '#C6DEF8'];

const WHEEL = 168;

/** A colour as hex, from hue (degrees), saturation and value (0–1). */
export function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Hue (degrees) and saturation (0–1) of a hex colour, for placing the wheel's marker. */
export function hexToHueSat(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return { h: 0, s: 0 };
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max ? d / max : 0 };
}

/** The colour wheel: drag across it, or use the arrow keys (hue across, strength up and down). */
function ColourWheel({ color, onChange }) {
  const ref = useRef(null);
  const { h, s } = hexToHueSat(color);

  const pick = (event) => {
    const box = ref.current.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    // Clockwise from the top, as the conic gradient runs.
    const hue = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const strength = Math.min(1, Math.hypot(dx, dy) / (box.width / 2));
    onChange(hsvToHex(hue, strength, 1));
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pick(event);
  };

  const onKeyDown = (event) => {
    const steps = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(hsvToHex((h + step[0] + 360) % 360, Math.min(1, Math.max(0, s + step[1])), 1));
  };

  // The marker sits where the colour is on the wheel.
  const angle = (h * Math.PI) / 180;
  const markerX = WHEEL / 2 + Math.sin(angle) * s * (WHEEL / 2);
  const markerY = WHEEL / 2 - Math.cos(angle) * s * (WHEEL / 2);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Colour wheel"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(h)}
      aria-valuetext={color}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => { if (event.buttons) pick(event); }}
      onKeyDown={onKeyDown}
      style={{
        position: 'relative', width: WHEEL, height: WHEEL, borderRadius: '50%', cursor: 'crosshair',
        touchAction: 'none', flex: '0 0 auto', margin: '0 auto',
        background: 'radial-gradient(circle closest-side, #FFFFFF, rgba(255,255,255,0)), '
          + 'conic-gradient(#FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)',
        boxShadow: 'inset 0 0 0 1px rgba(17,17,17,0.12)',
      }}
    >
      <span aria-hidden="true" style={{
        position: 'absolute', left: markerX - 9, top: markerY - 9, width: 18, height: 18, borderRadius: '50%',
        background: color, border: '3px solid #FFFFFF', boxShadow: '0 0 0 1px rgba(17,17,17,0.5)',
        pointerEvents: 'none', boxSizing: 'border-box',
      }} />
    </div>
  );
}

function Slider({ t, id, label, value, min, max, step = 1, display, onChange }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: t.ink,
        marginBottom: 4 }}>
        <label htmlFor={id}>{label}</label>
        <span style={{ fontWeight: 500, color: t.inkDim }}>{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: '#3A39FF' }} />
    </div>
  );
}

const smallButton = (t, active = false) => ({
  flex: 1, height: 34, borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--placer-font)', fontSize: 13,
  fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  border: `1px solid ${active ? '#3A39FF' : t.lineStrong}`,
  background: active ? '#3A39FF' : t.surface, color: active ? '#FFFFFF' : t.ink,
});

/** The card itself: what the pen draws with, and what to do with what is drawn. */
export function DrawingTools({ t, brush, onBrushChange, canUndo, onUndo, onClear, onClose }) {
  const set = (patch) => onBrushChange({ ...brush, ...patch });
  const erasing = brush.tool === 'eraser';

  return (
    <section aria-label="Pen" style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
      boxShadow: t.shadow, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>Draw on the photo</div>
        <button type="button" onClick={onClose} aria-label="Close the pen"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.inkDim, padding: 4 }}>
          <Icon name="close" size={18} stroke={2} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" aria-pressed={!erasing} onClick={() => set({ tool: 'pen' })} style={smallButton(t, !erasing)}>
          <Icon name="pencil" size={15} stroke={2} />Draw
        </button>
        <button type="button" aria-pressed={erasing} onClick={() => set({ tool: 'eraser' })} style={smallButton(t, erasing)}>
          Eraser
        </button>
      </div>

      <ColourWheel color={brush.color} onChange={(color) => set({ color, tool: 'pen' })} />

      <div role="group" aria-label="Plain colours" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {SWATCHES.map((swatch) => (
          <button key={swatch} type="button" aria-label={swatch} aria-pressed={brush.color === swatch}
            onClick={() => set({ color: swatch, tool: 'pen' })}
            style={{ width: 24, height: 24, borderRadius: '50%', background: swatch, cursor: 'pointer', padding: 0,
              border: brush.color === swatch ? '2px solid #111111' : '1px solid rgba(17,17,17,0.25)',
              outline: brush.color === swatch ? '2px solid #FFFFFF' : 'none', outlineOffset: -4 }} />
        ))}
      </div>

      <Slider t={t} id="placer-brush-size" label="Thickness" value={brush.size} min={MIN_SIZE} max={MAX_SIZE}
        display={`${brush.size} px`} onChange={(size) => set({ size })} />
      <Slider t={t} id="placer-brush-opacity" label="Opacity" value={Math.round(brush.opacity * 100)} min={5} max={100}
        display={`${Math.round(brush.opacity * 100)}%`} onChange={(value) => set({ opacity: value / 100 })} />

      {/* What a line will look like. */}
      <div aria-hidden="true" style={{ height: 64, borderRadius: 10, background: t.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: Math.max(brush.size, 2), height: Math.max(brush.size, 2), borderRadius: '50%',
          background: erasing ? 'transparent' : brush.color, opacity: erasing ? 1 : brush.opacity,
          border: erasing ? '1.5px dashed #6E6E6E' : brush.color === '#FFFFFF' ? '1px solid #D6D6D6' : 'none',
          boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onUndo} disabled={!canUndo}
          style={{ ...smallButton(t), opacity: canUndo ? 1 : 0.5, cursor: canUndo ? 'pointer' : 'not-allowed' }}>
          <Icon name="undo" size={15} stroke={2} />Undo
        </button>
        <button type="button" onClick={onClear} disabled={!canUndo}
          style={{ ...smallButton(t), opacity: canUndo ? 1 : 0.5, cursor: canUndo ? 'pointer' : 'not-allowed' }}>
          Clear drawing
        </button>
      </div>
    </section>
  );
}

export default DrawingTools;
