/* PLACER — Birds Eye View's plan: the place from above, with its pieces on it.
 *
 * One SVG drawn in metres (lib/birdsEye.js), fitted to its box, with the length of
 * each side of the outline written along it. What can be done on it depends on `mode`:
 *
 *   'edit'      the organiser's (BirdsEyeEditor): drag a corner of the outline, drag a
 *               piece, pull its corner handle to size it or its top handle to turn it;
 *               a click on the plan is `onPlanClick`, for drawing a new outline
 *   'arrange'   somebody answering: drag a piece, and turn it by its top handle
 *   'view'      nothing to do: the plan, and `overlays` — other layouts — faintly on it
 *               (with `showPieces` false, those alone, without the pieces where they began)
 *
 * Moves are reported in metres, rounded to ten centimetres.
 */

import { useRef, useState } from 'react';
import { bounds, formatLength, placed, sides } from '../../lib/birdsEye';

const snap = (value) => Math.round(value * 10) / 10;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** A point on the screen, in the plan's metres. */
function planPoint(svg, event) {
  const matrix = svg?.getScreenCTM?.();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const at = point.matrixTransform(matrix.inverse());
  return { x: at.x, y: at.y };
}

function Piece({ asset, unit, selected, active, faint = false, onDown, onResize, onRotate }) {
  const { w, d, x, y, r, shape, title } = asset;
  const fill = faint ? 'rgba(29, 95, 168, 0.10)' : selected ? '#DDD2FA' : '#EEF5FE';
  const stroke = faint ? 'rgba(29, 95, 168, 0.35)' : selected ? '#5B3CB8' : '#1D5FA8';
  const fontSize = Math.max(unit * 0.9, Math.min(w, d) * 0.22);
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} style={{ cursor: active ? 'grab' : 'default' }}
      onPointerDown={active ? onDown : undefined} data-piece={asset.id}>
      {shape === 'circle' ? (
        <ellipse rx={w / 2} ry={d / 2} fill={fill} stroke={stroke} strokeWidth={selected ? 2.5 : 1.5}
          vectorEffect="non-scaling-stroke" />
      ) : (
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={Math.min(w, d) * 0.06} fill={fill} stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
      )}
      {!faint && title && (
        <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={700} fill="#123F73"
          style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'var(--placer-font)' }}>
          {title}
        </text>
      )}
      {selected && onResize && (
        <rect aria-label={`Size ${title}`} x={w / 2 - unit * 0.6} y={d / 2 - unit * 0.6} width={unit * 1.2} height={unit * 1.2}
          fill="#FFFFFF" stroke="#5B3CB8" strokeWidth={2} vectorEffect="non-scaling-stroke"
          style={{ cursor: 'nwse-resize' }} onPointerDown={onResize} />
      )}
      {selected && onRotate && (
        <>
          <line x1={0} y1={-d / 2} x2={0} y2={-d / 2 - unit * 2} stroke="#5B3CB8" strokeWidth={1.5}
            vectorEffect="non-scaling-stroke" />
          <circle aria-label={`Turn ${title}`} cx={0} cy={-d / 2 - unit * 2} r={unit * 0.7} fill="#FFFFFF" stroke="#5B3CB8"
            strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }} onPointerDown={onRotate} />
        </>
      )}
    </g>
  );
}

export function BirdsEyePlan({
  outline, assets, layout = {}, overlays = [], showPieces = true, mode = 'view', selectedId = null, onSelect,
  onMoveCorner, onChangeAsset, onPlanClick, drawing = null, label = 'Plan of the place', height = 420,
}) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  // A drag ends in a click on the plan too, which is not a click on nothing.
  const dragged = useRef(false);
  const box = bounds(drawing?.length ? [...outline, ...drawing] : outline);
  const size = Math.max(box.width, box.depth, 1);
  // One "unit": how big handles and labels are, in metres, for a plan this size.
  const unit = size / 40;
  const margin = unit * 4;
  const viewBox = `${box.minX - margin} ${box.minY - margin} ${box.width + margin * 2} ${box.depth + margin * 2}`;
  const pieces = placed(assets, layout);
  const editing = mode === 'edit';
  const active = mode === 'edit' || mode === 'arrange';

  const start = (kind, id, event, extra = {}) => {
    event.stopPropagation();
    const at = planPoint(svgRef.current, event);
    if (!at) return;
    svgRef.current.setPointerCapture?.(event.pointerId);
    dragged.current = true;
    if (id && kind !== 'corner') onSelect?.(id);
    setDrag({ kind, id, from: at, ...extra });
  };

  const move = (event) => {
    if (!drag) return;
    const at = planPoint(svgRef.current, event);
    if (!at) return;
    if (drag.kind === 'corner') {
      onMoveCorner?.(drag.index, { x: snap(at.x), y: snap(at.y) });
      return;
    }
    const piece = pieces.find((candidate) => candidate.id === drag.id);
    if (!piece) return;
    if (drag.kind === 'move') {
      onChangeAsset?.(piece.id, { x: snap(drag.start.x + at.x - drag.from.x), y: snap(drag.start.y + at.y - drag.from.y) });
    } else if (drag.kind === 'resize') {
      // The pointer in the piece's own turned frame: its corner is at (w/2, d/2).
      const dx = at.x - piece.x;
      const dy = at.y - piece.y;
      const angle = toRadians(-piece.r);
      const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
      onChangeAsset?.(piece.id, { w: Math.max(0.2, snap(Math.abs(lx) * 2)), d: Math.max(0.2, snap(Math.abs(ly) * 2)) });
    } else if (drag.kind === 'rotate') {
      const degrees = (Math.atan2(at.y - piece.y, at.x - piece.x) * 180) / Math.PI + 90;
      // To the nearest 15 degrees, so square is easy to find.
      onChangeAsset?.(piece.id, { r: ((Math.round(degrees / 15) * 15) % 360 + 360) % 360 });
    }
  };

  const end = (event) => {
    if (drag) svgRef.current?.releasePointerCapture?.(event.pointerId);
    setDrag(null);
  };

  const click = (event) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (onPlanClick) {
      const at = planPoint(svgRef.current, event);
      if (at) onPlanClick({ x: snap(at.x), y: snap(at.y) });
      return;
    }
    if (active) onSelect?.(null);
  };

  const outlinePath = outline.map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <svg ref={svgRef} role="img" aria-label={label} viewBox={viewBox} preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height, touchAction: active ? 'none' : 'auto', userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: onPlanClick ? 'crosshair' : 'default', background: '#FAFAFA', borderRadius: 12 }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClick={click}>
      <defs>
        <pattern id="placer-plan-grid" width={1} height={1} patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#E6E6E6" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      {outline.length >= 3 && (
        <>
          <polygon points={outlinePath} fill="url(#placer-plan-grid)" />
          <polygon points={outlinePath} fill="rgba(255,255,255,0.55)" stroke="#111111" strokeWidth={2.5}
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {sides(outline).map((side, index) => (
            <text key={index} x={side.mid.x} y={side.mid.y} textAnchor="middle" dominantBaseline="central"
              fontSize={unit * 1.1} fontWeight={700} fill="#444444" stroke="#FAFAFA" strokeWidth={unit * 0.35}
              paintOrder="stroke" style={{ pointerEvents: 'none', fontFamily: 'var(--placer-font)' }}>
              {formatLength(side.length)}
            </text>
          ))}
        </>
      )}
      {overlays.map((overlay, index) => placed(assets, overlay).map((asset) => (
        <Piece key={`${index}-${asset.id}`} asset={asset} unit={unit} faint />
      )))}
      {showPieces && pieces.map((asset) => (
        <Piece key={asset.id} asset={asset} unit={unit} active={active} selected={active && asset.id === selectedId}
          onDown={(event) => start('move', asset.id, event, { start: { x: asset.x, y: asset.y } })}
          onResize={editing ? (event) => start('resize', asset.id, event) : null}
          onRotate={active ? (event) => start('rotate', asset.id, event) : null} />
      ))}
      {editing && !drawing && outline.map((point, index) => (
        <circle key={index} aria-label={`Corner ${index + 1}`} cx={point.x} cy={point.y} r={unit * 0.7} fill="#111111"
          stroke="#FFFFFF" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }}
          onPointerDown={(event) => start('corner', null, event, { index })} />
      ))}
      {drawing?.length > 0 && (
        <>
          <polyline points={drawing.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#5B3CB8"
            strokeWidth={2.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          {drawing.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={unit * (index === 0 ? 0.9 : 0.6)}
              fill={index === 0 ? '#5B3CB8' : '#FFFFFF'} stroke="#5B3CB8" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ))}
        </>
      )}
    </svg>
  );
}

export default BirdsEyePlan;
