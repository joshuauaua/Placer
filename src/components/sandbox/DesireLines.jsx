/* PLACER — Sandbox: Desire Lines.
 *
 * The plaza is paved the way plazas are paved — a ring and a cross — and the things
 * people walk between are in the corners. Draw the walks you would actually make and
 * the worn line appears where the paving is not.
 *
 * The geometry, the raster and the paving suggestions are in src/lib/desireLines.js.
 */

import { useMemo, useRef, useState } from 'react';
import { Meter, Panel, Readout } from '../SandboxLayout';
import { Btn } from '../UI';
import {
  DESTINATIONS,
  PAVING,
  PLAZA,
  distance,
  journeyStats,
  neighbourJourneys,
  suggestPaving,
} from '../../lib/desireLines';

const MIN_JOURNEYS_TO_PAVE = 3;

export function DesireLines({ t, experiment }) {
  const [lines, setLines] = useState([]);
  const [pending, setPending] = useState(null);
  const [dragTo, setDragTo] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [batches, setBatches] = useState(0);
  const svgRef = useRef(null);
  const nextId = useRef(0);

  const stats = useMemo(() => journeyStats(lines), [lines]);
  const suggestions = useMemo(
    () => (showSuggestions ? suggestPaving(lines, { minJourneys: MIN_JOURNEYS_TO_PAVE }) : []),
    [lines, showSuggestions]
  );

  function addLine(from, to) {
    if (distance(from, to) < 4) return;
    nextId.current += 1;
    setLines((current) => [...current, { id: `mine-${nextId.current}`, walker: 'you', from, to }]);
  }

  /** Two clicks on the markers is the accessible way to draw a walk. */
  function tapDestination(destination) {
    const point = { x: destination.x, y: destination.y };
    if (!pending) {
      setPending({ ...point, label: destination.label });
      return;
    }
    if (pending.label === destination.label) {
      setPending(null);
      return;
    }
    addLine({ x: pending.x, y: pending.y }, point);
    setPending(null);
  }

  /** Plaza coordinates from a pointer event, in metres. */
  function pointFrom(event) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * PLAZA.width,
      y: ((event.clientY - rect.top) / rect.height) * PLAZA.height,
    };
  }

  function startDrag(event) {
    const point = pointFrom(event);
    if (!point) return;
    setPending(point);
    setDragTo(point);
  }

  function moveDrag(event) {
    if (!pending || !dragTo) return;
    const point = pointFrom(event);
    if (point) setDragTo(point);
  }

  function endDrag(event) {
    if (!pending || !dragTo) return;
    const point = pointFrom(event) ?? dragTo;
    addLine({ x: pending.x, y: pending.y }, point);
    setPending(null);
    setDragTo(null);
  }

  function addNeighbours() {
    // A new seed each time, so a second batch is ten different people.
    const seed = 20260827 + batches * 977;
    setBatches((count) => count + 1);
    setLines((current) => [...current, ...neighbourJourneys(10, seed)]);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
      <Panel t={t} title="The plaza" aside={
        <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
          {pending && !dragTo
            ? `From ${pending.label} — now pick where you are going`
            : `${lines.length} ${lines.length === 1 ? 'journey' : 'journeys'} drawn`}
        </span>
      }>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PLAZA.width} ${PLAZA.height}`}
          role="img"
          aria-label="Plaza with paved paths, destinations, and the walks drawn across it"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          style={{ width: '100%', display: 'block', borderRadius: 10, background: '#E7EDE3',
            border: `1px solid ${t.line}`, touchAction: 'none', cursor: 'crosshair' }}>
          {/* The paving, as designed */}
          {PAVING.map((rect, index) => (
            <rect key={`paving-${index}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="#D5D2CA" />
          ))}

          {/* Where enough people have walked to be worth paving */}
          {suggestions.map((cell) => (
            <rect
              key={`suggest-${cell.index}`}
              x={cell.x - PLAZA.cell / 2}
              y={cell.y - PLAZA.cell / 2}
              width={PLAZA.cell}
              height={PLAZA.cell}
              fill={experiment.color}
              opacity={0.18 + Math.min(0.32, cell.journeys * 0.04)}
            />
          ))}

          {/* Every walk drawn so far. They overlap, so the common line darkens. */}
          {lines.map((line) => (
            <line
              key={line.id}
              x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}
              stroke={line.walker === 'you' ? experiment.color : '#6B6F76'}
              strokeWidth={line.walker === 'you' ? 0.9 : 0.6}
              strokeLinecap="round"
              opacity={line.walker === 'you' ? 0.55 : 0.32}
            />
          ))}

          {/* The walk being dragged out right now */}
          {pending && dragTo && (
            <line x1={pending.x} y1={pending.y} x2={dragTo.x} y2={dragTo.y}
              stroke={experiment.color} strokeWidth={1} strokeDasharray="2 1.5" strokeLinecap="round" />
          )}

          {DESTINATIONS.map((destination) => {
            const waiting = pending?.label === destination.label;
            return (
              <g
                key={destination.id}
                role="button"
                tabIndex={0}
                aria-label={waiting ? `Walking from ${destination.label} — pick a destination` : `Walk from ${destination.label}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  tapDestination(destination);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  tapDestination(destination);
                }}
                style={{ cursor: 'pointer' }}>
                <circle cx={destination.x} cy={destination.y} r={2.6}
                  fill={waiting ? experiment.color : t.surface} stroke={experiment.color} strokeWidth={0.8} />
                <text
                  x={destination.x < PLAZA.width / 2 ? destination.x + 4 : destination.x - 4}
                  y={destination.y + 1.2}
                  textAnchor={destination.x < PLAZA.width / 2 ? 'start' : 'end'}
                  fontSize={3.2}
                  style={{ fontFamily: 'var(--placer-font)' }}
                  fontWeight={700}
                  fill={t.ink}>
                  {destination.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn t={t} variant="quiet" size="sm" icon="user" onClick={addNeighbours}>
            Add ten neighbours
          </Btn>
          <Btn
            t={t}
            variant="quiet"
            size="sm"
            icon={showSuggestions ? 'check' : 'grid'}
            ariaPressed={showSuggestions}
            onClick={() => setShowSuggestions((shown) => !shown)}
            style={showSuggestions ? { borderColor: experiment.color, color: experiment.color } : undefined}>
            Show where to pave
          </Btn>
          <div style={{ flex: 1 }} />
          <Btn
            t={t}
            variant="quiet"
            size="sm"
            icon="rotate"
            disabled={lines.length === 0}
            onClick={() => { setLines([]); setPending(null); setDragTo(null); }}>
            Clear
          </Btn>
        </div>
        <p style={{ marginTop: 10, fontSize: 12.5, color: t.inkDim, lineHeight: 1.6 }}>
          Drag anywhere across the plaza to draw a walk, or click one marker and then another.
        </p>
      </Panel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title="What the walking says">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <Readout t={t} label="Journeys drawn" value={stats.count} />
            <Readout t={t} label="Leaving the paving" value={Math.round(stats.cuttingShare * 100)} unit="%"
              tone={stats.cuttingShare > 0.5 ? experiment.color : undefined} />
          </div>

          <Meter t={t} label="Walks that cut across" value={stats.cuttingShare} color={experiment.color}
            caption={`${stats.cutting} of ${stats.count || 0}`} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
            <Readout t={t} label="Saved by cutting" value={stats.averageSaved} unit="m avg" />
            <Readout t={t} label="Longest detour dodged" value={stats.longestSaved} unit="m" />
          </div>
        </Panel>

        <Panel t={t} title="Pave here">
          {suggestions.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
              {showSuggestions
                ? `Nothing yet. A route needs ${MIN_JOURNEYS_TO_PAVE} separate journeys before it counts as a line rather than a whim.`
                : 'Suggestions are hidden.'}
            </p>
          ) : (
            <>
              <Readout t={t} label="Unpaved ground worth paving"
                value={Math.round(suggestions.length * PLAZA.cell * PLAZA.cell)} unit="m²" />
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, marginTop: 12 }}>
                The busiest patch has been crossed {suggestions[0].journeys} times. Paving what people
                have already chosen costs less than fencing off what they have not.
              </p>
            </>
          )}
        </Panel>

        <Panel t={t} title="Why this matters">
          <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
            A desire line is the cheapest survey there is: the ground records the route people
            preferred before anyone was asked. Consultations that start from the worn path tend to
            get shorter arguments than the ones that start from the drawing.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default DesireLines;
