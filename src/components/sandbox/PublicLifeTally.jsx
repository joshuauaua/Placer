/* PLACER — Sandbox: Public Life Tally.
 *
 * A field sheet for watching how a public space is actually used. Each observation
 * is one person: pick their posture first, then one or more activities that fit it,
 * then — if there is time before the next person walks past — which spot of the
 * square they were in. The tally table and the map build themselves up from that,
 * one person at a time.
 *
 * The taxonomy and the counting live in src/lib/sandbox/observationTally.js.
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
  peopleWord,
  summaryText,
  tally,
} from '../../lib/sandbox/observationTally';

const NO_SPOT = null;

/** "column 3, row 2" — the same phrasing the other grid tool uses, one-based. */
function cellLabel(cell) {
  const { x, y } = cellCoords(cell);
  return `column ${x + 1}, row ${y + 1}`;
}

/** The posture with the most people on one spot, for the colour of its dot. */
function dominantPosture(byPosture) {
  let best = null;
  let bestCount = 0;
  for (const item of POSTURE_LIST) {
    if (byPosture[item.key] > bestCount) {
      best = item.key;
      bestCount = byPosture[item.key];
    }
  }
  return best;
}

export function PublicLifeTally({ t, experiment }) {
  const [observations, setObservations] = useState([]);
  const [posture, setPosture] = useState(null);
  const [activities, setActivities] = useState([]);
  const [cell, setCell] = useState(NO_SPOT);
  const [cursor, setCursor] = useState(cellIndex(3, 2));
  const [last, setLast] = useState(null);
  const nextId = useRef(1);

  const counts = useMemo(() => tally(observations), [observations]);

  const activityList = posture ? ACTIVITIES_BY_POSTURE[posture] : [];

  function pickPosture(key) {
    // Re-picking the active posture is a change of mind: clear the activities so
    // nothing from the old posture is carried into the new one.
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1 · Recording card */}
      <Panel t={t} title="Record a person" aside={
        <span style={{ fontFamily: 'var(--placer-font)', fontSize: 11, color: t.inkFaint }}>
          one person at a time
        </span>
      }>
        <div role="group" aria-label="Posture — pick one" style={{ marginBottom: 18 }}>
          <StepLabel t={t} step="1" label="Posture — pick one" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {POSTURE_LIST.map((item) => (
              <Chip
                key={item.key}
                t={t}
                color={item.color}
                active={posture === item.key}
                ariaPressed={posture === item.key}
                onClick={() => pickPosture(item.key)}>
                {item.label}
              </Chip>
            ))}
          </div>
        </div>

        <div role="group" aria-label="Activity — pick one or more" style={{ marginBottom: 18 }}>
          <StepLabel t={t} step="2" label="What are they doing?" />
          {posture ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {activityList.map((item) => (
                <Chip
                  key={item.key}
                  t={t}
                  color={experiment.color}
                  active={activities.includes(item.key)}
                  ariaPressed={activities.includes(item.key)}
                  onClick={() => toggleActivity(item.key)}>
                  {item.label}
                </Chip>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13.5, color: t.inkFaint, lineHeight: 1.6 }}>
              Choose a posture first — the activities that go with it will appear here.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <SpanLabel t={t} label="3 · Spot on the square" />
          <div style={{ flex: 1 }} />
          {cell !== NO_SPOT ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>{cellLabel(cell)}</span>
              <Icon name="pin" size={15} stroke={2} style={{ color: experiment.color }} />
              <Btn t={t} variant="ghost" size="sm" onClick={() => toggleCell(cell)}>Clear</Btn>
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: t.inkFaint }}>optional — tap the square below, or record without one</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn t={t} variant="primary" size="lg" icon="plus" disabled={recordDisabled} onClick={record}>
            Record person
          </Btn>
          <Btn t={t} variant="ghost" icon="undo" disabled={observations.length === 0} onClick={undo}>
            Undo last
          </Btn>
          <div style={{ flex: 1 }} />
          <div role="status" aria-live="polite" style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5 }}>
            {last ? (
              <>
                Last: {POSTURES[last.posture].label},{' '}
                {last.activities.map((key) => ACTIVITY_BY_KEY[key].label).join(' and ')} —{' '}
                {counts.total} {peopleWord(counts.total)} recorded
              </>
            ) : observations.length > 0 ? (
              `${counts.total} ${peopleWord(counts.total)} recorded this session`
            ) : (
              'Nothing recorded yet — pick a posture to start.'
            )}
          </div>
        </div>
      </Panel>

      {/* 2 · Tally table card */}
      <Panel t={t} title="Tally" aside={
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--placer-font)', fontSize: 11, color: t.inkFaint }}>
            {counts.total} {peopleWord(counts.total)} · {counts.placed} placed
          </span>
          <Btn t={t} variant="ghost" size="sm" icon="trash" disabled={observations.length === 0} onClick={clearAll}>
            Clear tally
          </Btn>
        </div>
      }>
        <Readout t={t} label="People recorded" value={counts.total} />
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.lineStrong}` }}>
              <HeadCell t={t} align="left" pad="10px 10px 10px 0">Posture</HeadCell>
              <HeadCell t={t} align="right" pad="10px">People</HeadCell>
              <HeadCell t={t} align="left" pad="10px 0 10px 10px">Activities</HeadCell>
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
                  <td style={{ padding: '10px 10px 10px 0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: t.ink }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: item.color }} />
                      {item.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <span className="placer-disp" style={{ fontSize: 16, fontWeight: 800, color: people > 0 ? item.color : t.inkFaint }}>
                      {people}
                    </span>
                  </td>
                  <td style={{ padding: '10px 0 10px 10px' }}>
                    {present.length === 0 ? (
                      <span style={{ fontSize: 13, color: t.inkFaint }}>—</span>
                    ) : (
                      <span style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.5 }}>
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
              <td style={{ fontFamily: 'var(--placer-font)', padding: '10px 10px 0 0', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
                Total
              </td>
              <td className="placer-disp" style={{ padding: '10px', textAlign: 'right', fontSize: 16, fontWeight: 800, color: t.ink }}>
                {counts.total}
              </td>
              <td style={{ padding: '10px 0 0 10px' }} />
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: 18 }}>
          <CopyButton
            t={t}
            value={summaryText(counts)}
            variant="primary"
            size="sm"
            icon="send"
            label="Copy tally"
            copiedLabel="Copied"
            fieldLabel="Your tally as text"
            multiline
            disabled={observations.length === 0}
            style={{ alignItems: 'flex-start' }}
          />
        </div>
      </Panel>

      {/* 3 · Map card */}
      <Panel t={t} title="The square" aside={
        <span style={{ fontFamily: 'var(--placer-font)', fontSize: 11, color: t.inkFaint }}>
          each spot is a {SPOT_METRES} m square
        </span>
      }>
        <div
          tabIndex={0}
          role="group"
          aria-label={`The square as a grid, ${GRID.cols} spots across and ${GRID.rows} down. Arrow keys move the cursor, Enter marks the spot for the next person.`}
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
            style={{ width: '100%', display: 'block', borderRadius: 10, background: t.surfaceAlt,
              border: `1px solid ${t.line}`, cursor: 'pointer' }}>
            {cells.map((index) => {
              const { x, y } = cellCoords(index);
              const total = counts.byCell[index];
              const dominant = dominantPosture(counts.byCellPosture[index]);
              return (
                <g key={`spot-${index}`}>
                  <rect x={x} y={y} width={1} height={1} fill="transparent" stroke={t.line} strokeWidth={0.02} />
                  {total > 0 && dominant && (
                    <>
                      <circle cx={x + 0.5} cy={y + 0.5} r={0.22 + Math.min(total, 4) * 0.03}
                        fill={POSTURES[dominant].color} stroke={t.surface} strokeWidth={0.06} />
                      <text x={x + 0.5} y={y + 0.59} textAnchor="middle" fontSize={0.4} fontWeight={800}
                        style={{ fontFamily: 'var(--placer-font)' }} fill="#fff">
                        {total}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            <rect x={cursorCoords.x} y={cursorCoords.y} width={1} height={1}
              fill="none" stroke={t.ink} strokeWidth={0.1} />

            {cell !== NO_SPOT && (() => {
              const { x, y } = cellCoords(cell);
              return (
                <rect x={x + 0.06} y={y + 0.06} width={0.88} height={0.88}
                  fill="none" stroke={experiment.color} strokeWidth={0.12} strokeDasharray="0.16 0.08" />
              );
            })()}
          </svg>
        </div>

        <div role="status" aria-live="polite" style={{ marginTop: 10, fontSize: 13, color: t.inkDim, minHeight: 20 }}>
          Spot {cellLabel(cursor)} — {cursorCount} {peopleWord(cursorCount)} here
          {cell === cursor ? ', marked for the next person' : ' · Enter to mark'}
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
          {POSTURE_LIST.map((item) => (
            <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.inkDim }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: item.color }} />
              {item.label}
              <span style={{ color: t.ink, fontWeight: 700 }}>{counts.byPosture[item.key]}</span>
            </span>
          ))}
          <span style={{ fontSize: 12, color: t.inkFaint, marginLeft: 'auto' }}>
            {counts.total - counts.placed} not placed
          </span>
        </div>

        <p style={{ marginTop: 12, fontSize: 12.5, color: t.inkDim, lineHeight: 1.6 }}>
          Tap a spot to mark where the next person is, or record without one — the count still
          goes into the tally. Each dot is a spot, printed with how many people it holds, in the
          colour of the posture that most of them hold.
        </p>
      </Panel>
    </div>
  );
}

function StepLabel({ t, step, label }) {
  return (
    <div style={{ fontFamily: 'var(--placer-font)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: t.inkDim, marginBottom: 8, marginLeft: 2 }}>
      {step} · {label}
    </div>
  );
}

function SpanLabel({ t, label }) {
  return (
    <span style={{ fontFamily: 'var(--placer-font)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: t.inkDim }}>
      {label}
    </span>
  );
}

function HeadCell({ t, children, align, pad }) {
  return (
    <th scope="col" style={{ fontFamily: 'var(--placer-font)', textAlign: align, padding: pad,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
      {children}
    </th>
  );
}

export default PublicLifeTally;