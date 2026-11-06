/* PLACER — Toolkit: People Moving Count, before the count.
 *
 * Step 2, the instructions: how to count, after the protocol's field sheet, and the
 * modes people are counted by.
 *
 * Step 3, setting up the session. The count line is drawn on a map, a point per click
 * once the line tool is on (a click otherwise only moves the map), and the sheet's
 * header filled in: the observer's name, the date and time, the weather and the
 * location. Start counting stays put until everything is there (sessionProblems), and
 * says what is missing once tried.
 *
 * A project sets the line up for everybody who counts for it: on the configuration
 * page the line is drawn in the right-hand panel (CountLineStep), and the canvas shows
 * it read-only. Those two — the line and the location — are then the project's
 * (`fixed`): everybody counting for it sees the line already drawn, cannot move it,
 * and adds only their name, the date and time and the weather.
 */

import { useEffect, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn, Field, inputStyle } from '../UI';
import { PlaceSearch } from '../PlaceSearch';
import {
  DIRECTIONS, GROUPS, MAX_POINTS, WEATHER, modesIn, sessionProblems,
} from '../../lib/toolkit/peopleMoving';
import { addPin, createMap, fitPoints, onBackgroundClick, showLines, toLngLat } from '../../lib/map';

const MAP_CENTER = { lat: 55.6054, lng: 12.9854 };
const MAP_ZOOM = 16;
// Close enough on a searched-for address to draw a line across a street.
const FOUND_ZOOM = 18;

// A tool button over the map: white, square, raised off the streets.
const toolStyle = (t, on) => ({
  width: 40, padding: 0, boxShadow: t.shadow,
  ...(on ? { background: t.primaryBg, color: t.primaryFg, border: '1px solid transparent' } : null),
});

// A card inside the setup card: flat, so the two read as parts of the one around them.
const INNER = { boxShadow: 'none', minWidth: 0 };

const keyHeading = (t) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: t.inkDim, margin: '0 0 10px' });

/** How to count, and the modes people are counted by. */
export function PeopleMovingInstructions({ t }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8,
        fontSize: 14, lineHeight: 1.55, color: t.ink }}>
        {DIRECTIONS.map((direction) => <li key={direction}>{direction}</li>)}
      </ul>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {GROUPS.map((group) => (
          <div key={group.key}>
            <h3 className="placer-mono" style={keyHeading(t)}>{group.label}</h3>
            <ul aria-label={group.label} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex',
              flexDirection: 'column', gap: 8, fontSize: 14, color: t.ink, lineHeight: 1.35 }}>
              {modesIn(group.key).map((mode) => (
                <li key={mode.key}>
                  {mode.label}
                  {mode.example && <span style={{ color: t.inkDim }}> ({mode.example})</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The count line on a map. While the line tool is on, each click adds a point, up to
 * MAX_POINTS, unless it is `readOnly` — a project's line, shown but not changed: no
 * tools, and the map itself does not move.
 */
export function CountLineMap({ t, tool, line, onChange, readOnly = false, height = 420, intro = true }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [failed, setFailed] = useState(false);
  // Off until the line tool is picked, so clicking about the map does not drop points.
  const [drawing, setDrawing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Read through refs, so the listener added once always sees the tool's state and
  // extends the latest line.
  const latest = useRef(line);
  latest.current = line;
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;
  useEffect(() => {
    if (!mapRef.current) return undefined;
    let made;
    try {
      made = createMap(mapRef.current, {
        center: latest.current[0] ?? MAP_CENTER, zoom: MAP_ZOOM,
        ...(readOnly ? { interactive: false, controls: false } : null),
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      setFailed(true);
      return undefined;
    }
    if (latest.current.length > 0) fitPoints(made, latest.current, { padding: 60, maxZoom: 18 });
    if (!readOnly) {
      onBackgroundClick(made, (point) => {
        if (drawingRef.current && latest.current.length < MAX_POINTS) onChange([...latest.current, point]);
      });
    }
    setMap(made);
    return () => made.remove();
    // The map is made once; the line is drawn onto it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A read-only map keeps the whole line in view as it changes (the canvas's preview).
  useEffect(() => {
    if (map && readOnly && line.length > 0) fitPoints(map, line, { padding: 60, maxZoom: 18 });
  }, [map, readOnly, line]);

  useEffect(() => {
    if (!map) return undefined;
    // Each point while it is being drawn; only the ends once it is fixed.
    const shown = readOnly ? (line.length >= 2 ? [line[0], line[line.length - 1]] : []) : line;
    const points = shown.map((point, index) => addPin(map, point, {
      size: 12, fill: tool.color, ring: '#FFFFFF', ringWidth: 2, zIndex: 2,
      title: readOnly ? (index === 0 ? 'Start of the line' : 'End of the line') : `Point ${index + 1}`,
    }));
    const removeLine = showLines(map, 'count-line', [{ path: line, stroke: tool.color }]);
    return () => {
      points.forEach((marker) => marker.remove());
      removeLine();
    };
  }, [map, line, tool.color, readOnly]);

  // A crosshair while drawing, MapLibre's own hand otherwise.
  useEffect(() => {
    if (!map || readOnly) return;
    map.getCanvas().style.cursor = drawing ? 'crosshair' : '';
  }, [map, drawing, readOnly]);

  // Opened, the search field takes the typing straight away.
  const searchRef = useRef(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const findPlace = (place) => {
    map?.jumpTo({ center: toLngLat(place.point), zoom: FOUND_ZOOM });
  };

  return (
    <>
      {intro && (
        <p style={{ margin: '0 0 12px', fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>
          {readOnly
            ? 'Count everybody who crosses this line, in either direction.'
            : 'Draw the line people will be counted crossing: pick the line tool, then click the map where it starts and where it ends.'}
        </p>
      )}
      <div style={{ position: 'relative' }}>
        <div ref={mapRef} role="region" aria-label="Count line map"
          style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden', background: t.surfaceAlt }} />
        {!readOnly && (
          <div style={{ position: 'absolute', top: 10, left: 10, right: 56, zIndex: 2,
            display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Btn t={t} type="button" variant="outline" size="sm" icon={searchOpen ? 'close' : 'search'}
              ariaLabel={searchOpen ? 'Close address search' : 'Search for an address'}
              ariaPressed={searchOpen} onClick={() => setSearchOpen((open) => !open)}
              style={toolStyle(t, false)} />
            <Btn t={t} type="button" variant="outline" size="sm" icon="path"
              ariaLabel={drawing ? 'Stop drawing the line' : 'Draw the line'}
              ariaPressed={drawing} onClick={() => setDrawing((on) => !on)}
              style={toolStyle(t, drawing)} />
            {searchOpen && (
              <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 360 }}>
                <PlaceSearch id="people-moving-search" value={query} onChange={setQuery} onPick={findPlace}
                  inputRef={searchRef} ariaLabel="Address" placeholder="Search for an address…"
                  near={map ? map.getCenter() : null} t={t}
                  style={{ ...inputStyle(t), height: 40, padding: '0 14px', fontSize: 14, boxShadow: t.shadow }} />
              </div>
            )}
          </div>
        )}
      </div>
      {failed && (
        <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: '#B3261E' }}>
          The map could not load. Try reloading the page.
        </p>
      )}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn t={t} type="button" variant="ghost" size="sm" icon="undo" disabled={line.length === 0}
            onClick={() => onChange(line.slice(0, -1))}>
            Undo point
          </Btn>
          <Btn t={t} type="button" variant="ghost" size="sm" icon="trash" disabled={line.length === 0}
            onClick={() => onChange([])}>
            Clear line
          </Btn>
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint, marginLeft: 'auto' }}>
            {line.length} {line.length === 1 ? 'point' : 'points'}
            {drawing ? ' · click the map to add one' : ''}
          </span>
        </div>
      )}
    </>
  );
}

/** Configuring for a project, stage 1: the instructions, as the tool's own step 2. */
export function InstructionsStep({ t }) {
  return <PeopleMovingInstructions t={t} />;
}

/**
 * Configuring for a project, stage 2: the line and the location, which everybody
 * counting then shares and cannot change. Drawn here, in the panel; the canvas shows
 * the line as counters will see it.
 */
export function CountLineStep({ t, tool, setup, onChange, compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CountLineMap t={t} tool={tool} line={setup.line} height={compact ? 300 : 340}
        onChange={(line) => onChange({ ...setup, line })} />
      <Field t={t} spacing={0} label="Location" htmlFor="people-moving-project-location">
        <input id="people-moving-project-location" type="text" maxLength={120} placeholder="e.g. Södergatan, Malmö"
          value={setup.location} onChange={(event) => onChange({ ...setup, location: event.target.value })}
          style={inputStyle(t)} />
      </Field>
    </div>
  );
}

/** Step 3: the line (drawn, or the project's) and the sheet's header. */
export function PeopleMovingSessionSetup({ t, tool, session, fixed = false, onChange, onBack, onStart }) {
  const [tried, setTried] = useState(false);
  const problems = sessionProblems(session);
  const set = (field) => (event) => onChange({ ...session, [field]: event.target.value });

  const start = (event) => {
    event.preventDefault();
    setTried(true);
    if (problems.length === 0) onStart();
  };

  return (
    <form onSubmit={start} noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--placer-font)' }}>
      <div>
        <Btn t={t} type="button" variant="ghost" size="sm" icon="chevLeft" onClick={onBack}>Instructions</Btn>
      </div>

      {/* One card holding two: the line on the left, the sheet's header on the right.
          On a narrow screen they stack. */}
      <Panel t={t} title="Set up the count">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
          <Panel t={t} style={{ ...INNER, flex: '3 1 420px' }} title="Count line">
            <CountLineMap t={t} tool={tool} line={session.line} readOnly={fixed}
              onChange={(line) => onChange({ ...session, line })} />
          </Panel>

          <Panel t={t} style={{ ...INNER, flex: '2 1 260px' }} title="Session">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field t={t} spacing={0} label="Name" htmlFor="people-moving-name">
                <input id="people-moving-name" type="text" maxLength={80} autoComplete="name"
                  value={session.name} onChange={set('name')} style={inputStyle(t)} />
              </Field>
              <Field t={t} spacing={0} label="Location" htmlFor="people-moving-location">
                <input id="people-moving-location" type="text" maxLength={120} placeholder="e.g. Södergatan, Malmö"
                  value={session.location} onChange={set('location')} readOnly={fixed}
                  style={{ ...inputStyle(t), ...(fixed ? { background: t.surfaceAlt, color: t.inkDim } : null) }} />
              </Field>
              <Field t={t} spacing={0} label="Date" htmlFor="people-moving-date">
                <input id="people-moving-date" type="date" value={session.date} onChange={set('date')} style={inputStyle(t)} />
              </Field>
              <Field t={t} spacing={0} label="Time" htmlFor="people-moving-time">
                <input id="people-moving-time" type="time" value={session.time} onChange={set('time')} style={inputStyle(t)} />
              </Field>
              <Field t={t} spacing={0} label="Weather" htmlFor="people-moving-weather">
                <select id="people-moving-weather" value={session.weather} onChange={set('weather')} style={inputStyle(t)}>
                  <option value="">Pick the weather</option>
                  {WEATHER.map((weather) => <option key={weather} value={weather}>{weather}</option>)}
                </select>
              </Field>
            </div>
          </Panel>
        </div>

        {tried && problems.length > 0 && (
          <ul role="alert" style={{ margin: '20px 0 0', paddingLeft: 18, fontSize: 14, color: '#B3261E', lineHeight: 1.6 }}>
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn t={t} type="submit">Start counting</Btn>
        </div>
      </Panel>
    </form>
  );
}

export default PeopleMovingSessionSetup;
