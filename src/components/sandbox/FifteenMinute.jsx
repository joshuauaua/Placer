/* PLOT — Sandbox: 15-Minute Reach.
 *
 * Sixteen hundred metres square, four housing clusters, and a railway that can only be
 * crossed in two places. Place a food shop, a school, a clinic, a park and a transit
 * stop, and the grid says how much of the neighbourhood can walk to all five in a
 * quarter of an hour.
 *
 * The walking is measured properly — around the railway, not through it — in
 * src/lib/reachGrid.js.
 */

import { useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { Meter, Panel, PresetRow, Readout } from '../SandboxLayout';
import {
  AMENITY_LIST,
  AMENITY_TYPES,
  BRIDGE_COLS,
  GRID,
  POPULATION,
  RAIL_ROW,
  REACH_MINUTES,
  cellCoords,
  cellIndex,
  coverage,
  isPassable,
  loadPreset,
  populationShare,
} from '../../lib/reachGrid';

const PRESETS = [
  { key: 'empty', label: 'Empty', note: 'Nothing placed yet.' },
  { key: 'draft', label: "The council's draft", note: 'Five amenities, all of them north of the railway.' },
];

export function FifteenMinute({ t, experiment }) {
  const [placements, setPlacements] = useState([]);
  const [selected, setSelected] = useState('groceries');
  const [preset, setPreset] = useState('empty');
  const [cursor, setCursor] = useState(cellIndex(4, 3));

  const result = useMemo(() => coverage(placements), [placements]);
  const placedByCell = useMemo(
    () => new Map(placements.map((placement) => [placement.cell, placement])),
    [placements]
  );

  const cursorPlacement = placedByCell.get(cursor);
  const cursorCoords = cellCoords(cursor);

  /** One amenity to a cell: the same kind again takes it away, a different kind replaces it. */
  function toggleCell(cell) {
    if (!isPassable(cell)) return;
    setPreset(null);
    setPlacements((current) => {
      const existing = current.find((placement) => placement.cell === cell);
      if (existing && existing.type === selected) {
        return current.filter((placement) => placement.cell !== cell);
      }
      const cleared = current.filter((placement) => placement.cell !== cell);
      return [...cleared, { id: `${selected}-${cell}`, type: selected, cell }];
    });
  }

  function pickPreset(key) {
    setPlacements(loadPreset(key));
    setPreset(key);
  }

  function onKeyDown(event) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (step) {
      const { x, y } = cellCoords(cursor);
      const nx = Math.min(GRID.cols - 1, Math.max(0, x + step[0]));
      const ny = Math.min(GRID.rows - 1, Math.max(0, y + step[1]));
      setCursor(cellIndex(nx, ny));
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      toggleCell(cursor);
      event.preventDefault();
    }
  }

  function cellFromPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * GRID.cols);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * GRID.rows);
    if (x < 0 || y < 0 || x >= GRID.cols || y >= GRID.rows) return null;
    return cellIndex(x, y);
  }

  const cells = [];
  for (let index = 0; index < GRID.cols * GRID.rows; index += 1) cells.push(index);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
      <Panel t={t} title="The neighbourhood" aside={
        <span className="plot-mono" style={{ fontSize: 12, color: t.inkDim }}>
          {placements.length} placed · 100 m cells
        </span>
      }>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {AMENITY_LIST.map((amenity) => {
            const on = amenity.key === selected;
            return (
              <button
                key={amenity.key}
                onClick={() => setSelected(amenity.key)}
                aria-pressed={on}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px',
                  borderRadius: 999, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13.5,
                  border: `1.5px solid ${on ? amenity.color : t.line}`,
                  background: on ? `${amenity.color}18` : 'transparent',
                  color: on ? amenity.color : t.inkDim }}>
                <Icon name={amenity.icon} size={15} stroke={2.1} />
                {amenity.label}
              </button>
            );
          })}
        </div>

        {/* Roving cursor rather than 256 tab stops: arrows move, Enter places. */}
        <div
          tabIndex={0}
          role="group"
          aria-label={`Neighbourhood grid, ${GRID.cols} by ${GRID.rows}. Arrow keys move the cursor, Enter places the selected amenity.`}
          onKeyDown={onKeyDown}
          style={{ borderRadius: 10, outlineOffset: 3 }}>
          <svg
            viewBox={`0 0 ${GRID.cols} ${GRID.rows}`}
            aria-hidden="true"
            onClick={(event) => {
              const cell = cellFromPointer(event);
              if (cell === null) return;
              setCursor(cell);
              toggleCell(cell);
            }}
            style={{ width: '100%', display: 'block', borderRadius: 10, background: t.surfaceAlt,
              border: `1px solid ${t.line}`, cursor: 'pointer' }}>
            {cells.map((index) => {
              const { x, y } = cellCoords(index);
              const reach = result.inReach[index];
              const passable = isPassable(index);
              return (
                <rect
                  key={`cell-${index}`}
                  x={x} y={y} width={1} height={1}
                  fill={passable ? experiment.color : '#3C3F44'}
                  fillOpacity={passable ? (reach / result.categoryCount) * 0.8 : 1}
                  stroke={t.line}
                  strokeWidth={0.02}
                />
              );
            })}

            {/* The bridges: the only way over the tracks. */}
            {BRIDGE_COLS.map((column) => (
              <rect key={`bridge-${column}`} x={column} y={RAIL_ROW} width={1} height={1}
                fill={t.surface} stroke="#3C3F44" strokeWidth={0.06} />
            ))}

            {/* Where people live, as dots. Bigger dot, more homes. */}
            {cells.map((index) => {
              if (POPULATION[index] <= 0) return null;
              const { x, y } = cellCoords(index);
              return (
                <circle key={`people-${index}`} cx={x + 0.5} cy={y + 0.5}
                  r={0.07 + POPULATION[index] * 0.15} fill={t.ink} opacity={0.22} />
              );
            })}

            {placements.map((placement) => {
              const amenity = AMENITY_TYPES[placement.type];
              const { x, y } = cellCoords(placement.cell);
              return (
                <g key={placement.id}>
                  <circle cx={x + 0.5} cy={y + 0.5} r={0.42} fill={amenity.color} stroke={t.surface} strokeWidth={0.1} />
                  <text x={x + 0.5} y={y + 0.68} textAnchor="middle" fontSize={0.55} fontWeight={800}
                    fontFamily="'Archivo', sans-serif" fill="#fff">
                    {amenity.label[0]}
                  </text>
                </g>
              );
            })}

            <rect x={cursorCoords.x} y={cursorCoords.y} width={1} height={1}
              fill="none" stroke={t.ink} strokeWidth={0.12} />
          </svg>
        </div>

        <div role="status" aria-live="polite" style={{ marginTop: 10, fontSize: 13, color: t.inkDim, minHeight: 20 }}>
          Cursor at column {cursorCoords.x + 1}, row {cursorCoords.y + 1} —{' '}
          {isPassable(cursor)
            ? `${result.inReach[cursor]} of ${result.categoryCount} kinds within ${REACH_MINUTES} minutes${cursorPlacement ? `, ${AMENITY_TYPES[cursorPlacement.type].label} here` : ''}`
            : 'the railway'}
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <PresetRow t={t} presets={PRESETS} active={preset} onPick={pickPreset} color={experiment.color} />
        </div>

        <p style={{ marginTop: 12, fontSize: 12.5, color: t.inkDim, lineHeight: 1.6 }}>
          Click a cell to place the selected amenity, or click it again to take it away. The dark row is
          a railway — it can only be crossed at the two bridges.
        </p>
      </Panel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title={`Within a ${REACH_MINUTES}-minute walk`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
            <Readout t={t} label="Served by all five" value={Math.round(result.share * 100)} unit="%"
              tone={result.share > 0.6 ? '#2E7D32' : result.share > 0.2 ? undefined : '#C0392B'} />
            <Readout t={t} label="Can reach nothing" value={Math.round(result.strandedShare * 100)} unit="%"
              tone={result.strandedShare > 0.2 ? '#C0392B' : undefined} />
          </div>

          {AMENITY_LIST.map((amenity) => (
            <Meter
              key={amenity.key}
              t={t}
              label={amenity.label}
              value={result.byCategory[amenity.key]}
              color={amenity.color}
              caption={`${Math.round(result.byCategory[amenity.key] * 100)}% of people`}
            />
          ))}

          <p style={{ fontSize: 12.5, color: t.inkFaint, lineHeight: 1.6, marginTop: 12 }}>
            Measured by population, not by area — the empty corner of the map counts for as much as
            it houses, which is very little.
          </p>
        </Panel>

        <Panel t={t} title="The railway">
          <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
            Try the council's draft, then look south. Every amenity is inside fifteen minutes as the
            crow flies, and the cluster below the tracks can reach almost none of it, because the walk
            goes out to a bridge and back.
          </p>
          <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, marginTop: 10 }}>
            {Math.round(populationShare(cellIndex(5, 12)) * 100 * 100) / 100}% of the neighbourhood lives in the
            one cell at the centre of that southern cluster.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default FifteenMinute;
