/* PLACER — Toolkit: People Moving Count, before the count.
 *
 * Step 2, the instructions: how to count, after the protocol's field sheet, and the
 * modes people are counted by.
 *
 * Step 3, setting up the session. The count site is drawn on a map in two goes, in this
 * order: first the area, a corner per click with the polygon tool; then the count line,
 * a point per click with the line tool, on top of the area. The line tool stays off
 * until the area has its three corners. A click with neither tool on only moves the map.
 * Then the sheet's header: the observer's name, the date and time, the weather and the
 * location. Start counting stays put until everything is there (sessionProblems), and
 * says what is missing once tried.
 *
 * A project sets the site up for everybody who counts for it, a slide each: on the
 * configuration page the map is the canvas (CountSiteCanvas), under the location typed
 * in as the slide's title, and the panel holds the timer (TimerStep) and what is still
 * missing (CountSiteStep, compact). In ConfigureToolDialog, which has no canvas,
 * CountSiteStep is the map and the location together. The area, line and location are
 * then the project's (`fixed`): everybody counting for it sees them already drawn,
 * cannot change them, and adds only their name, the date and time and the weather.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn, Field, inputStyle } from '../UI';
import { PlaceSearch } from '../PlaceSearch';
import {
  DIRECTIONS, GROUPS, MAX_CORNERS, MAX_POINTS, TIMER_MINUTES, WEATHER, modesIn, sessionProblems,
} from '../../lib/toolkit/peopleMoving';
import { addPin, createMap, fitPoints, onBackgroundClick, showAreas, showLines, toLngLat } from '../../lib/map';

const MAP_CENTER = { lat: 55.6054, lng: 12.9854 };
const MAP_ZOOM = 16;
// Close enough on a searched-for address to outline a square or a street around it.
const FOUND_ZOOM = 17;
// The line is drawn in ink over the area's colour, so the two read apart.
const LINE_COLOUR = '#111111';

// A tool button over the map: white, square, raised off the streets.
const toolStyle = (t, on) => ({
  width: 40, padding: 0, boxShadow: t.shadow,
  ...(on ? { background: t.primaryBg, color: t.primaryFg, border: '1px solid transparent' } : null),
});

// A card inside the setup card: flat, so the two read as parts of the one around them.
const INNER = { boxShadow: 'none', minWidth: 0 };

const keyHeading = (t) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: t.inkDim, margin: '0 0 10px' });

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

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
 * The count site on a map: the area, and the count line on top of it. `site` is
 * { area, line }, and `onChange` is given the next one. With the polygon tool on each
 * click adds a corner to the area (up to MAX_CORNERS); with the line tool, which waits
 * for the area, a point to the line (up to MAX_POINTS). `readOnly` is a project's site,
 * shown but not changed: no tools, and the map itself does not move.
 */
export function CountSiteMap({ t, tool, site, onChange, readOnly = false, height = 420, intro = true }) {
  const { area, line } = site;
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [failed, setFailed] = useState(false);
  // Which tool is on: 'area', 'line' or null. Neither until one is picked, so clicking
  // about the map does not drop points. A new site starts on the polygon tool.
  const [drawing, setDrawing] = useState(() => (readOnly || area.length > 0 ? null : 'area'));
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const areaDone = area.length >= 3;

  // Read through refs, so the listener added once always sees the tool's state and
  // extends the latest site.
  const latest = useRef(site);
  latest.current = site;
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => {
    if (!mapRef.current) return undefined;
    let made;
    const start = [...latest.current.area, ...latest.current.line];
    try {
      made = createMap(mapRef.current, {
        center: start[0] ?? MAP_CENTER, zoom: MAP_ZOOM,
        ...(readOnly ? { interactive: false, controls: false } : null),
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      setFailed(true);
      return undefined;
    }
    if (start.length > 0) fitPoints(made, start, { padding: 50, maxZoom: 18 });
    if (!readOnly) {
      onBackgroundClick(made, (point) => {
        const now = latest.current;
        if (drawingRef.current === 'area' && now.area.length < MAX_CORNERS) {
          changeRef.current({ ...now, area: [...now.area, point] });
        } else if (drawingRef.current === 'line' && now.area.length >= 3 && now.line.length < MAX_POINTS) {
          changeRef.current({ ...now, line: [...now.line, point] });
        }
      });
    }
    setMap(made);
    return () => made.remove();
    // The map is made once; the site is drawn onto it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A read-only map keeps the whole site in view, as it changes from slide to slide.
  useEffect(() => {
    const all = [...area, ...line];
    if (map && readOnly && all.length > 0) fitPoints(map, all, { padding: 50, maxZoom: 18 });
  }, [map, readOnly, area, line]);

  useEffect(() => {
    if (!map) return undefined;
    // While being drawn, every corner and point; once fixed, only the line's two ends.
    const corners = readOnly ? [] : area.map((point, index) => addPin(map, point, {
      size: 10, fill: tool.color, ring: '#FFFFFF', ringWidth: 2, zIndex: 2, title: `Corner ${index + 1}`,
    }));
    const ends = readOnly ? (line.length >= 2 ? [line[0], line[line.length - 1]] : []) : line;
    const points = ends.map((point, index) => addPin(map, point, {
      size: 12, fill: LINE_COLOUR, ring: '#FFFFFF', ringWidth: 2, zIndex: 3,
      title: readOnly ? (index === 0 ? 'Start of the line' : 'End of the line') : `Line point ${index + 1}`,
    }));
    const removeArea = showAreas(map, 'count-area', [{ path: area, fill: tool.color, stroke: tool.color }],
      { fillOpacity: 0.15 });
    const removeLine = showLines(map, 'count-line', [{ path: line, stroke: LINE_COLOUR }]);
    return () => {
      [...corners, ...points].forEach((marker) => marker.remove());
      removeLine();
      removeArea();
    };
  }, [map, area, line, tool.color, readOnly]);

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
  const pick = (which) => setDrawing((on) => (on === which ? null : which));
  // One undo for both: the line is drawn on top of the area, so its points come off
  // first, then the area's corners. Back below three corners, the polygon tool is on again.
  const undo = () => {
    if (line.length > 0) {
      onChange({ ...site, line: line.slice(0, -1) });
    } else if (area.length > 0) {
      onChange({ ...site, area: area.slice(0, -1) });
      if (area.length - 1 < 3) setDrawing('area');
    }
  };

  // What to do next, in the order the site is drawn.
  let hint;
  if (readOnly) hint = 'Count everybody who crosses the black line, in either direction.';
  else if (!areaDone) hint = 'Step 1 — pick the polygon tool and click the corners of the area you are counting in, in order around its edge.';
  else if (line.length < 2) hint = 'Step 2 — pick the line tool and click where the count line starts and where it ends, across the way people move.';
  else hint = 'The area and the count line are drawn. Undo takes back the last point.';

  return (
    <>
      {intro && (
        <p role={readOnly ? undefined : 'status'} style={{ margin: '0 0 12px', fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      <div style={{ position: 'relative' }}>
        <div ref={mapRef} role="region" aria-label="Count site map"
          style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden', background: t.surfaceAlt }} />
        {!readOnly && (
          <div style={{ position: 'absolute', top: 10, left: 10, right: 56, zIndex: 2,
            display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Btn t={t} type="button" variant="outline" size="sm" icon={searchOpen ? 'close' : 'search'}
              ariaLabel={searchOpen ? 'Close address search' : 'Search for an address'}
              ariaPressed={searchOpen} onClick={() => setSearchOpen((open) => !open)}
              style={toolStyle(t, false)} />
            <Btn t={t} type="button" variant="outline" size="sm" icon="polygon"
              ariaLabel={drawing === 'area' ? 'Stop drawing the area' : 'Draw the area'}
              ariaPressed={drawing === 'area'} onClick={() => pick('area')}
              style={toolStyle(t, drawing === 'area')} />
            <Btn t={t} type="button" variant="outline" size="sm" icon="path" disabled={!areaDone}
              ariaLabel={drawing === 'line' ? 'Stop drawing the line' : 'Draw the line'}
              title={areaDone ? undefined : 'Outline the area first'}
              ariaPressed={drawing === 'line'} onClick={() => pick('line')}
              style={{ ...toolStyle(t, drawing === 'line'), ...(areaDone ? null : { boxShadow: 'none' }) }} />
            <Btn t={t} type="button" variant="outline" size="sm" icon="undo"
              disabled={area.length === 0 && line.length === 0}
              ariaLabel={line.length > 0 ? 'Undo the last line point' : 'Undo the last corner'}
              onClick={undo}
              style={{ ...toolStyle(t, false), ...(area.length === 0 && line.length === 0 ? { boxShadow: 'none' } : null) }} />
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
    </>
  );
}

/** Configuring for a project, stage 1: the instructions, as the tool's own step 2. */
export function InstructionsStep({ t }) {
  return <PeopleMovingInstructions t={t} />;
}

/**
 * The count site for a project: its area and line, and the location. On the
 * configuration page (`compact`) the map is the canvas and the location the slide's
 * title, so the panel says only how far the drawing has got.
 */
export function CountSiteStep({ t, tool, setup, onChange, compact = false }) {
  if (compact) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: t.inkDim, lineHeight: 1.5 }}>
        Drawn on the map: {plural(setup.area.length, 'corner', 'corners')} of the area,{' '}
        {plural(setup.line.length, 'point', 'points')} of the count line.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CountSiteMap t={t} tool={tool} site={setup} height={340} onChange={onChange} />
      <Field t={t} spacing={0} label="Location" htmlFor="people-moving-project-location">
        <input id="people-moving-project-location" type="text" maxLength={120} placeholder="e.g. Södergatan, Malmö"
          value={setup.location} onChange={(event) => onChange({ ...setup, location: event.target.value })}
          style={inputStyle(t)} />
      </Field>
    </div>
  );
}

/** The timer: none, or how long the count runs. */
export function TimerStep({ t, setup, onChange, compact = false }) {
  const id = useId();
  const value = setup.minutes === null ? 'none' : String(setup.minutes ?? 10);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-timer`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Timer</label>
      <select id={`${id}-timer`} value={value} style={inputStyle(t)}
        onChange={(event) => onChange({ ...setup, minutes: event.target.value === 'none' ? null : Number(event.target.value) })}>
        <option value="none">No timer</option>
        {TIMER_MINUTES.map((minutes) => (
          <option key={minutes} value={minutes}>{minutes} minutes{minutes === 10 ? ' (the protocol’s)' : ''}</option>
        ))}
      </select>
      <span style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>
        {compact
          ? 'How long people count for at this line.'
          : 'How long people count for at this line. The timer starts on their first tap and stops itself at the end.'}
      </span>
    </div>
  );
}

/** The configuration page's canvas: the count site's map, to draw the area and line on. */
export function CountSiteCanvas({ t, tool, setup, onChange }) {
  return <CountSiteMap t={t} tool={tool} site={setup} height={520} onChange={onChange} />;
}

/** Step 3: the site (drawn, or the project's) and the sheet's header. */
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

      {/* One card holding two: the site on the left, the sheet's header on the right.
          On a narrow screen they stack. */}
      <Panel t={t} title="Set up the count">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
          <Panel t={t} style={{ ...INNER, flex: '3 1 420px' }} title="Count site">
            <CountSiteMap t={t} tool={tool} site={session} readOnly={fixed}
              onChange={(site) => onChange({ ...session, area: site.area, line: site.line })} />
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
