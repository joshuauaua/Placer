/* PLACER — Toolkit: Stationary Activity Mapping, step 3 — setting up the session.
 *
 * Between the instructions and the map. The observer outlines the area they will map,
 * a corner per click on the map, and fills in the sheet's header: their name, the
 * date and time, the weather and the location. Start mapping stays put until
 * everything is there (sessionProblems), and says what is missing once tried.
 */

import { useEffect, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { WEATHER, sessionProblems } from '../../lib/toolkit/stationaryActivity';
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

export function StationaryActivitySetup({ t, tool, session, onChange, onBack, onStart }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [tried, setTried] = useState(false);
  const problems = sessionProblems(session);
  const { area } = session;
  const set = (field) => (event) => onChange({ ...session, [field]: event.target.value });

  // Each click on the map adds a corner to the outline. Read through a ref, so the
  // listener added once always extends the latest outline.
  const latest = useRef(session);
  latest.current = session;
  useEffect(() => {
    if (!mapRef.current) return undefined;
    let drawing;
    try {
      drawing = createMap(mapRef.current, { center: area[0] ?? MAP_CENTER, zoom: MAP_ZOOM });
    } catch (error) {
      console.error('Error initializing map:', error);
      return undefined;
    }
    if (latest.current.area.length > 0) fitPoints(drawing, latest.current.area, { padding: 60 });
    onBackgroundClick(drawing, (point) =>
      onChange({ ...latest.current, area: [...latest.current.area, point] }));
    setMap(drawing);
    return () => drawing.remove();
    // The map is made once; the outline is drawn onto it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return undefined;
    const corners = area.map((point, index) => addPin(map, point, {
      size: 12, fill: tool.color, ring: '#FFFFFF', ringWidth: 2, zIndex: 2, title: `Corner ${index + 1}`,
    }));
    const removeArea = showAreas(map, 'survey-area', [{ path: area, fill: tool.color, stroke: tool.color }],
      { fillOpacity: 0.18 });
    return () => {
      corners.forEach((marker) => marker.remove());
      removeArea();
    };
  }, [map, area, tool.color]);

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

      <Panel t={t} title="Survey area" aside={
        <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
          {area.length} {area.length === 1 ? 'corner' : 'corners'} · click the map to add one
        </span>
      }>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>
          Outline the area you will map: click its corners on the map, in order around the edge.
        </p>
        <div ref={mapRef} role="region" aria-label="Survey area map"
          style={{ width: '100%', height: 420, borderRadius: 10, overflow: 'hidden', background: t.surfaceAlt }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn t={t} type="button" variant="ghost" size="sm" icon="undo" disabled={area.length === 0}
            onClick={() => onChange({ ...session, area: area.slice(0, -1) })}>
            Undo corner
          </Btn>
          <Btn t={t} type="button" variant="ghost" size="sm" icon="trash" disabled={area.length === 0}
            onClick={() => onChange({ ...session, area: [] })}>
            Clear area
          </Btn>
        </div>
      </Panel>

      <Panel t={t} title="Session">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          <Field t={t} label="Name" htmlFor="stationary-name">
            <input id="stationary-name" type="text" maxLength={80} autoComplete="name"
              value={session.name} onChange={set('name')} style={inputStyle(t)} />
          </Field>
          <Field t={t} label="Location" htmlFor="stationary-location">
            <input id="stationary-location" type="text" maxLength={120} placeholder="e.g. Stortorget, Malmö"
              value={session.location} onChange={set('location')} style={inputStyle(t)} />
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

      {tried && problems.length > 0 && (
        <ul role="alert" style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#B3261E', lineHeight: 1.6 }}>
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn t={t} type="submit">Start mapping</Btn>
      </div>
    </form>
  );
}

export default StationaryActivitySetup;
