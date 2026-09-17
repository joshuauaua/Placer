/* PLACER — Sandbox: Stationary Activity Mapping.
 *
 * A map-based field observation tool. The map is the dominant visual element;
 * the recording card floats over its left half and the tally sits below it.
 * Each observation is one person: a posture, one or more activities, and the
 * spot of the square where they were.
 */

import { useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Panel, Readout } from '../SandboxLayout';
import { Btn, Chip, CopyButton } from '../UI';
import {
  ACTIVITIES_BY_POSTURE,
  ACTIVITY_BY_KEY,
  GRID,
  POSTURES,
  POSTURE_LIST,
  SPOT_METRES,
  cellCoords,
  cellIndex,
  cellInGrid,
  normaliseObservation,
  emptyTallies,
  tally,
  peopleWord,
  summaryText,
} from '../../lib/sandbox/stationaryActivity';

const NO_SPOT = null;

function cellLabel(cell) {
  const { x, y } = cellCoords(cell);
  return `column ${x + 1}, row ${y + 1}`;
}

export function StationaryActivityMap({ t, experiment }) {
  const [observations, setObservations] = useState([]);
  const [posture, setPosture] = useState(null);
  const [activities, setActivities] = useState([]);
  const [cell, setCell] = useState(NO_SPOT);
  const [cursor, setCursor] = useState(cellIndex(0, 0));
  const [last, setLast] = useState(null);
  const nextId = useRef(1);

  const counts = useMemo(() => tally(observations), [observations]);
  const activityList = posture ? ACTIVITIES_BY_POSTURE[posture] : [];

  function pickPosture(key) {
    setPosture((current) => (current === key ? null : key));
    setActivities([]);
  }

  function toggleActivity(key) {
    setActivities((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

  function toggleCell(target) {
    setCell((current) => (current === target ? NO_SPOT : target));
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

  function record() {
    if (!posture || activities.length === 0) return;
    const person = { id: nextId.current, posture, activities: [...activities], cell };
    nextId.current += 1;
    setObservations((current) => [...current, person]);
    setLast(person);
    setPosture(null);
    setActivities([]);
  }

  function undo() {
    setObservations((current) => current.slice(0, -1));
    setLast(null);
  }

  function clearAll() {
    setObservations([]);
    setLast(null);
    setCell(NO_SPOT);
    setPosture(null);
    setActivities([]);
  }

  const cursorCoords = cellCoords(cursor);
  const cursorCount = counts.byCell[cursor];
  const cells = [];
  for (let index = 0; index < GRID.cols * GRID.rows; index += 1) cells.push(index);

  const recordDisabled = !posture || activities.length === 0;

  const STREET_COLOR = t.inkFaint;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1 · Map card — dominant background */}
      <Panel t={t} title="Observation Map" aside={
        <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
          {counts.total} {peopleWord(counts.total)} recorded · each spot is {SPOT_METRES} m
        </span>
      }>
        <div style={{ position: 'relative' }}>
          {/* Recording card overlaid on the left half of the map */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '48%', zIndex: 2,
            padding: 12,
          }}>
            <div style={{
              background: t.surface, border: `1px solid ${t.line}`, borderRadius: 10,
              padding: 16, boxShadow: t.shadow,
            }}>
              <div className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: experiment.color, marginBottom: 12 }}>
                Record Observation
              </div>

              <div role="group" aria-label="Posture — pick one" style={{ marginBottom: 10 }}>
                <div className="placer-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', color: t.inkFaint, marginBottom: 6 }}>1 · Posture</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {POSTURE_LIST.map((item) => (
                    <Chip
                      key={item.key} t={t} color={item.color}
                      active={posture === item.key} ariaPressed={posture === item.key}
                      onClick={() => pickPosture(item.key)} style={{ fontSize: 11, height: 28, padding: '0 8px' }}>
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div role="group" aria-label="Activity — pick one or more" style={{ marginBottom: 10 }}>
                <div className="placer-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', color: t.inkFaint, marginBottom: 6 }}>2 · Activity</div>
                {posture ? (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {activityList.map((item) => (
                      <Chip
                        key={item.key} t={t} color={experiment.color}
                        active={activities.includes(item.key)} ariaPressed={activities.includes(item.key)}
                        onClick={() => toggleActivity(item.key)} style={{ fontSize: 11, height: 28, padding: '0 8px' }}>
                        {item.label}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11.5, color: t.inkFaint, margin: 0 }}>Choose a posture first.</p>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span className="placer-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', color: t.inkFaint }}>3 · Spot</span>
                <div style={{ flex: 1 }} />
                {cell !== NO_SPOT ? (
                  <span style={{ fontSize: 11, color: t.ink, fontWeight: 600 }}>{cellLabel(cell)}</span>
                ) : (
                  <span style={{ fontSize: 10.5, color: t.inkFaint }}>optional</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn t={t} variant="primary" size="sm" icon="plus" disabled={recordDisabled} onClick={record}>
                  Record
                </Btn>
                <Btn t={t} variant="ghost" size="sm" icon="undo" disabled={observations.length === 0} onClick={undo}>
                  Undo
                </Btn>
                <div style={{ flex: 1 }} />
                <div role="status" aria-live="polite" style={{ fontSize: 11, color: t.inkDim }}>
                  {last ? (
                    <>Last: {POSTURES[last.posture].label} · {counts.total} recorded</>
                  ) : counts.total > 0 ? (
                    `${counts.total} recorded`
                  ) : 'Nothing yet'}
                </div>
              </div>
            </div>
          </div>

          {/* The map SVG — fills the panel behind the recording card */}
          <div
            tabIndex={0}
            role="group"
            aria-label={`The square as a map, ${GRID.cols} spots across and ${GRID.rows} down. Arrow keys move the cursor, Enter marks the spot.`}
            onKeyDown={onKeyDown}
            style={{ borderRadius: 10, outlineOffset: 3 }}>
            <svg
              viewBox={`0 0 ${GRID.cols} ${GRID.rows}`}
              aria-hidden="true"
              onClick={(event) => {
                const target = cellFromPointer(event);
                if (target === null) return;
                setCursor(target);
                toggleCell(target);
              }}
              style={{ width: '100%', display: 'block', borderRadius: 10, background: '#F5F3EF',
                border: `1px solid ${t.line}`, cursor: 'pointer' }}>
              {/* Streets as cross-hatched lines */}
              <line x1={2.5} y1={0} x2={2.5} y2={GRID.rows} stroke={STREET_COLOR} strokeWidth={0.06} strokeDasharray="0.04 0.06" />
              <line x1={5.5} y1={0} x2={5.5} y2={GRID.rows} stroke={STREET_COLOR} strokeWidth={0.06} strokeDasharray="0.04 0.06" />
              <line x1={0} y1={2} x2={GRID.cols} y2={2} stroke={STREET_COLOR} strokeWidth={0.06} strokeDasharray="0.04 0.06" />
              <line x1={0} y1={4} x2={GRID.cols} y2={4} stroke={STREET_COLOR} strokeWidth={0.06} strokeDasharray="0.04 0.06" />
              {/* Main roads */}
              <line x1={0} y1={GRID.rows / 2} x2={GRID.cols} y2={GRID.rows / 2} stroke={STREET_COLOR} strokeWidth={0.1} strokeDasharray="0.2 0.1" />

              {/* Grid cells */}
              {cells.map((index) => {
                const { x, y } = cellCoords(index);
                const total = counts.byCell[index];
                return (
                  <rect key={`cell-${index}`} x={x} y={y} width={1} height={1}
                    fill="transparent" stroke={t.line} strokeWidth={0.01} />
                );
              })}

              {/* Observation dots */}
              {observations.map((obs) => {
                const person = normaliseObservation(obs);
                if (!person || person.cell === null) return null;
                const { x, y } = cellCoords(person.cell);
                const pc = POSTURES[person.posture].color;
                const dotR = 0.18 + Math.min((counts.byCell[person.cell] || 0), 5) * 0.02;
                return (
                  <circle key={`obs-${obs.id}`} cx={x + 0.5} cy={y + 0.5} r={Math.max(dotR, 0.15)}
                    fill={pc} stroke={t.surface} strokeWidth={0.05} opacity={0.85} />
                );
              })}

              {/* Cursor */}
              <rect x={cursorCoords.x} y={cursorCoords.y} width={1} height={1}
                fill="none" stroke={t.ink} strokeWidth={0.12} />

              {/* Marked cell */}
              {cell !== NO_SPOT && (() => {
                const { x, y } = cellCoords(cell);
                return (
                  <rect x={x + 0.06} y={y + 0.06} width={0.88} height={0.88}
                    fill="none" stroke={experiment.color} strokeWidth={0.12} strokeDasharray="0.16 0.08" />
                );
              })()}
            </svg>
          </div>

          <div role="status" aria-live="polite" style={{ marginTop: 8, fontSize: 12, color: t.inkDim, minHeight: 18 }}>
            Spot {cellLabel(cursor)} — {cursorCount} {peopleWord(cursorCount)} here
            {cell === cursor ? ', marked for the next person' : ' · Enter to mark'}
          </div>
        </div>
      </Panel>

      {/* 2 · Tally card — below the map */}
      <Panel t={t} title="Observation Tally" aside={
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
            {counts.total} {peopleWord(counts.total)} · {counts.placed} placed
          </span>
          <Btn t={t} variant="ghost" size="sm" icon="trash" disabled={observations.length === 0} onClick={clearAll}>
            Clear
          </Btn>
        </div>
      }>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.lineStrong}` }}>
              <HeadCell t={t} align="left" pad="8px 10px 8px 0">Posture</HeadCell>
              <HeadCell t={t} align="right" pad="8px">Tally</HeadCell>
              <HeadCell t={t} align="left" pad="8px 0 8px 10px">Activities</HeadCell>
            </tr>
          </thead>
          <tbody>
            {POSTURE_LIST.map((item) => {
              const people = counts.byPosture[item.key];
              const present = ACTIVITIES_BY_POSTURE[item.key].filter(
                (activity) => counts.byActivity[activity.key] > 0
              );
              return (
                <tr key={item.key} style={{ borderBottom: `1px solid ${t.line}` }}>
                  <td style={{ padding: '8px 10px 8px 0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: t.ink }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      {item.label}
                    </span>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <span className="placer-disp" style={{ fontSize: 16, fontWeight: 800, color: people > 0 ? item.color : t.inkFaint }}>
                      {people}
                    </span>
                  </td>
                  <td style={{ padding: '8px 0 8px 10px' }}>
                    {present.length === 0 ? (
                      <span style={{ fontSize: 12.5, color: t.inkFaint }}>—</span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>
                        {present.map((activity, index) => (
                          <span key={activity.key}>
                            {index > 0 && <span style={{ color: t.inkFaint }}> · </span>}
                            {activity.label}{' '}
                            <span style={{ fontWeight: 700, color: t.ink }}>{counts.byActivity[activity.key]}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="placer-mono" style={{ padding: '8px 10px 0 0', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>Total</td>
              <td className="placer-disp" style={{ padding: '8px', textAlign: 'right', fontSize: 16, fontWeight: 800, color: t.ink }}>{counts.total}</td>
              <td style={{ padding: '8px 0 0 10px' }} />
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: 14 }}>
          <CopyButton
            t={t} value={summaryText(counts)} variant="primary" size="sm" icon="send"
            label="Copy tally" copiedLabel="Copied" fieldLabel="Your tally as text"
            multiline disabled={observations.length === 0}
            style={{ alignItems: 'flex-start' }} />
        </div>
      </Panel>
    </div>
  );
}

function HeadCell({ t, children, align, pad }) {
  return (
    <th scope="col" className="placer-mono" style={{ textAlign: align, padding: pad,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
      {children}
    </th>
  );
}

export default StationaryActivityMap;
