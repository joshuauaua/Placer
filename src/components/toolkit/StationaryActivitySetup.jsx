/* PLACER — Toolkit: Stationary Activity Mapping, before the map.
 *
 * Step 2, the instructions: the field sheet's directions and its key.
 *
 * Step 3, setting up the session. The observer outlines the area they will map, a
 * corner per click on the map, and fills in the sheet's header: their name, the date
 * and time, the weather and the location. Start mapping stays put until everything is
 * there (sessionProblems), and says what is missing once tried.
 *
 * A project sets the same tool up from its dashboard, in ConfigureToolDialog, in the
 * same order: the instructions (InstructionsStep), then the area and the location
 * (SurveyAreaStep). Those two are then the project's (`fixed`): everybody mapping for
 * it sees them already there, and adds only their name, the date and time and the
 * weather.
 */

import { useEffect, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { PostureSymbol } from './PostureSymbol';
import {
  ACTIVITIES, DIRECTIONS, HANDING_IN, MAX_CORNERS, POSTURE_LIST, WEATHER, sessionProblems,
} from '../../lib/toolkit/stationaryActivity';
import { addPin, createMap, fitPoints, onBackgroundClick, showAreas } from '../../lib/map';

const MAP_CENTER = { lat: 55.6054, lng: 12.9854 };
const MAP_ZOOM = 16;

const inputStyle = (t) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 16px',
  fontSize: 15,
  border: `1.5px solid ${t.line}`,
  borderRadius: 12,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

// A card inside the setup card: flat, so the two read as parts of the one around them.
const INNER = { boxShadow: 'none', minWidth: 0 };

const keyHeading = (t) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: t.inkDim, margin: '0 0 10px' });

function Field({ t, label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** The field sheet's directions, and its key to the symbols and activities. */
export function StationaryInstructions({ t }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
      <div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8,
          fontSize: 14, lineHeight: 1.55, color: t.ink }}>
          {DIRECTIONS.map((direction) => <li key={direction}>{direction}</li>)}
        </ul>
        <p style={{ margin: '16px 0 0', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
          textTransform: 'uppercase', color: t.ink, lineHeight: 1.5 }}>
          {HANDING_IN}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignContent: 'start' }}>
        <div>
          <h3 className="placer-mono" style={keyHeading(t)}>Postures</h3>
          <ul aria-label="Postures" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex',
            flexDirection: 'column', gap: 8, fontSize: 14, color: t.ink }}>
            {POSTURE_LIST.map((item) => (
              <li key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PostureSymbol posture={item.key} size={18} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="placer-mono" style={keyHeading(t)}>Activities</h3>
          <ul aria-label="Activities" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex',
            flexDirection: 'column', gap: 8, fontSize: 14, color: t.ink, lineHeight: 1.35 }}>
            {ACTIVITIES.map((activity) => <li key={activity.key}>{activity.label}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * The survey area on a map. Each click adds a corner, up to MAX_CORNERS, unless it is
 * `readOnly` — a project's area, shown but not changed.
 */
export function SurveyAreaMap({ t, tool, area, onChange, readOnly = false, height = 420 }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);

  // Read through a ref, so the listener added once always extends the latest outline.
  const latest = useRef(area);
  latest.current = area;
  useEffect(() => {
    if (!mapRef.current) return undefined;
    let drawing;
    try {
      drawing = createMap(mapRef.current, { center: latest.current[0] ?? MAP_CENTER, zoom: MAP_ZOOM });
    } catch (error) {
      console.error('Error initializing map:', error);
      return undefined;
    }
    if (latest.current.length > 0) fitPoints(drawing, latest.current, { padding: 60 });
    if (!readOnly) {
      onBackgroundClick(drawing, (point) => {
        if (latest.current.length < MAX_CORNERS) onChange([...latest.current, point]);
      });
    }
    setMap(drawing);
    return () => drawing.remove();
    // The map is made once; the outline is drawn onto it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return undefined;
    const corners = readOnly ? [] : area.map((point, index) => addPin(map, point, {
      size: 12, fill: tool.color, ring: '#FFFFFF', ringWidth: 2, zIndex: 2, title: `Corner ${index + 1}`,
    }));
    const removeArea = showAreas(map, 'survey-area', [{ path: area, fill: tool.color, stroke: tool.color }],
      { fillOpacity: 0.18 });
    return () => {
      corners.forEach((marker) => marker.remove());
      removeArea();
    };
  }, [map, area, tool.color, readOnly]);

  return (
    <>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>
        {readOnly
          ? 'The area this project maps, outlined for you.'
          : 'Outline the area you will map: click its corners on the map, in order around the edge.'}
      </p>
      <div ref={mapRef} role="region" aria-label="Survey area map"
        style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden', background: t.surfaceAlt }} />
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn t={t} type="button" variant="ghost" size="sm" icon="undo" disabled={area.length === 0}
            onClick={() => onChange(area.slice(0, -1))}>
            Undo corner
          </Btn>
          <Btn t={t} type="button" variant="ghost" size="sm" icon="trash" disabled={area.length === 0}
            onClick={() => onChange([])}>
            Clear area
          </Btn>
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint, marginLeft: 'auto' }}>
            {area.length} {area.length === 1 ? 'corner' : 'corners'}
          </span>
        </div>
      )}
    </>
  );
}

/** Configuring for a project, stage 1: the instructions, as the tool's own step 2. */
export function InstructionsStep({ t }) {
  return <StationaryInstructions t={t} />;
}

/** Configuring for a project, stage 2: the area and the location, which observers then share. */
export function SurveyAreaStep({ t, tool, setup, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SurveyAreaMap t={t} tool={tool} area={setup.area} height={300}
        onChange={(area) => onChange({ ...setup, area })} />
      <Field t={t} label="Location" htmlFor="stationary-project-location">
        <input id="stationary-project-location" type="text" maxLength={120} placeholder="e.g. Stortorget, Malmö"
          value={setup.location} onChange={(event) => onChange({ ...setup, location: event.target.value })}
          style={inputStyle(t)} />
      </Field>
    </div>
  );
}

export function StationaryActivitySetup({ t, tool, session, fixed = false, onChange, onBack, onStart }) {
  const [tried, setTried] = useState(false);
  const problems = sessionProblems(session);
  const { area } = session;
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

      {/* One card holding two: the area on the left, the sheet's header on the right.
          On a narrow screen they stack. */}
      <Panel t={t} title="Set up the session">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
          <Panel t={t} style={{ ...INNER, flex: '3 1 420px' }} title="Survey area" aside={!fixed && (
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>click the map to add a corner</span>
          )}>
            <SurveyAreaMap t={t} tool={tool} area={area} readOnly={fixed}
              onChange={(next) => onChange({ ...session, area: next })} />
          </Panel>

          <Panel t={t} style={{ ...INNER, flex: '2 1 260px' }} title="Session">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field t={t} label="Name" htmlFor="stationary-name">
                <input id="stationary-name" type="text" maxLength={80} autoComplete="name"
                  value={session.name} onChange={set('name')} style={inputStyle(t)} />
              </Field>
              <Field t={t} label="Location" htmlFor="stationary-location">
                <input id="stationary-location" type="text" maxLength={120} placeholder="e.g. Stortorget, Malmö"
                  value={session.location} onChange={set('location')} readOnly={fixed}
                  style={{ ...inputStyle(t), ...(fixed ? { background: t.surfaceAlt, color: t.inkDim } : null) }} />
              </Field>
              <Field t={t} label="Date" htmlFor="stationary-date">
                <input id="stationary-date" type="date" value={session.date} onChange={set('date')} style={inputStyle(t)} />
              </Field>
              <Field t={t} label="Time" htmlFor="stationary-time">
                <input id="stationary-time" type="time" value={session.time} onChange={set('time')} style={inputStyle(t)} />
              </Field>
              <Field t={t} label="Weather" htmlFor="stationary-weather">
                <select id="stationary-weather" value={session.weather} onChange={set('weather')} style={inputStyle(t)}>
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
          <Btn t={t} type="submit">Start mapping</Btn>
        </div>
      </Panel>
    </form>
  );
}

export default StationaryActivitySetup;
