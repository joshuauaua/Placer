/* PLACER — Sandbox: Stationary Activity Mapping.
 *
 * A map-based field observation tool. The Google Map is the dominant
 * visual element; the recording card floats over its left half and
 * the tally sits below it. The user first clicks the map to pick a
 * location, then selects posture and activities, then records.
 * The site's text face (--placer-font) is used throughout.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '../Icon';
import { Panel, Readout } from '../SandboxLayout';
import { Btn, Chip, CopyButton } from '../UI';
import {
  ACTIVITIES_BY_POSTURE,
  ACTIVITY_BY_KEY,
  POSTURES,
  POSTURE_LIST,
  normaliseObservation,
  emptyTallies,
  tally,
  peopleWord,
  summaryText,
} from '../../lib/sandbox/stationaryActivity';

const MAP_CENTER = { lat: 55.6054, lng: 12.9854 };
const MAP_ZOOM = 15;

const ACTIVITY_GROUPS = [
  { key: 'getting-around', label: 'Getting Around', activities: ['waiting'] },
  { key: 'food-work', label: 'Food & Work', activities: ['consuming', 'commercial'] },
  { key: 'culture-leisure', label: 'Culture & Leisure', activities: ['cultural', 'recreation', 'leisure'] },
];

function postureIconColor(postureKey) {
  return POSTURES[postureKey]?.color ?? '#888';
}

export function StationaryActivityMap({ t, experiment }) {
  const mapRef = useRef(null);
  const mapObjectRef = useRef(null);
  const markersRef = useRef([]);
  const [googleLoaded, setGoogleLoaded] = useState(() => !!window.google);
  const [map, setMap] = useState(null);

  const [observations, setObservations] = useState([]);
  const [posture, setPosture] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const locationMarkerRef = useRef(null);
  const [last, setLast] = useState(null);
  const nextId = useRef(1);

  const counts = useMemo(() => tally(observations), [observations]);
  const activityList = posture ? ACTIVITIES_BY_POSTURE[posture] : [];
  const recordDisabled = !posture || activities.length === 0 || !selectedLocation;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  /* --- Load Google Maps script --- */
  useEffect(() => {
    if (window.google) { setGoogleLoaded(true); return; }
    if (!apiKey) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setGoogleLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps script');
    document.head.appendChild(script);
  }, [apiKey]);

  /* --- Initialise map --- */
  useEffect(() => {
    if (!googleLoaded || !mapRef.current || mapObjectRef.current) return;
    try {
      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: MAP_CENTER, zoom: MAP_ZOOM,
        mapTypeControl: true, streetViewControl: true,
        styles: [{ featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -20 }] }],
      });
      mapObjectRef.current = googleMap;
      setMap(googleMap);
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [googleLoaded]);

  /* --- Sync observations to map markers --- */
  useEffect(() => {
    if (!map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    observations.forEach((obs) => {
      const person = normaliseObservation(obs);
      if (!person) return;
      const cell = obs.cell ?? Math.floor(Math.random() * 40);
      const col = cell % 8;
      const row = Math.floor(cell / 8);
      const position = {
        lat: MAP_CENTER.lat + (row - 2) * 0.002 + (col % 3 - 1) * 0.0005,
        lng: MAP_CENTER.lng + (col - 4) * 0.002 + (row % 3 - 1) * 0.0005,
      };
      const color = postureIconColor(person.posture);
      const marker = new window.google.maps.Marker({
        position, map,
        title: `${POSTURES[person.posture]?.label ?? person.posture}: ${person.activities.map((k) => ACTIVITY_BY_KEY[k]?.label ?? k).join(', ')}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10, fillColor: color, fillOpacity: 0.9,
          strokeColor: '#FFFFFF', strokeWeight: 2,
        },
        zIndex: 10,
      });
      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="font-family:var(--placer-font);padding:6px 10px;min-width:160px"><strong style="color:${color}">${POSTURES[person.posture]?.label ?? person.posture}</strong><br>${person.activities.map((k) => ACTIVITY_BY_KEY[k]?.label ?? k).join('<br>')}<div style="font-size:11px;color:#888;margin-top:4px">Observation #${person.id}</div></div>`,
      });
      marker.addListener('click', () => infoWindow.open(map, marker));
      markersRef.current.push(marker);
    });
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [observations, map]);

  /* --- Map click handler --- */
  const handleMapClick = useCallback((event) => {
    if (!event.latLng || !map) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setSelectedLocation({ lat, lng });
    if (locationMarkerRef.current) locationMarkerRef.current.setMap(null);
    const marker = new window.google.maps.Marker({
      position: { lat, lng }, map,
      title: 'Observation location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8, fillColor: experiment.color, fillOpacity: 1,
        strokeColor: '#FFFFFF', strokeWeight: 3,
      },
      zIndex: 20,
    });
    locationMarkerRef.current = marker;
  }, [map, experiment.color]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', handleMapClick);
    return () => {
      if (window.google) window.google.maps.event.removeListener(listener);
    };
  }, [map, handleMapClick]);

  /* --- Handlers --- */
  function pickPosture(key) {
    setPosture((current) => (current === key ? null : key));
    setActivities([]);
  }

  function toggleActivity(key) {
    setActivities((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

  function toggleGroup(groupKey) {
    const group = ACTIVITY_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    const allActive = group.activities.every((a) => activities.includes(a));
    if (allActive) {
      setActivities((current) => current.filter((a) => !group.activities.includes(a)));
    } else {
      setActivities((current) => {
        const next = [...current];
        group.activities.forEach((a) => {
          if (!next.includes(a)) next.push(a);
        });
        return next;
      });
    }
  }

  function record() {
    if (!posture || activities.length === 0 || !selectedLocation) return;
    const cell = Math.floor(Math.random() * 40);
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
    setPosture(null);
    setActivities([]);
    setSelectedLocation(null);
    if (locationMarkerRef.current) { locationMarkerRef.current.setMap(null); locationMarkerRef.current = null; }
  }

  const locationStr = selectedLocation
    ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--placer-font)' }}>
      {/* 1 · Map card — dominant background */}
      <Panel t={t} title="Observation Map" aside={
        <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
          {counts.total} {peopleWord(counts.total)} recorded · click the map to pick a spot
        </span>
      }>
        <div style={{ position: 'relative' }}>
          {/* Recording card — overlay on the left half of the map */}
          <div style={{
            position: 'absolute', top: 8, left: 8, width: '44%', zIndex: 10,
            maxHeight: '90%', overflowY: 'auto',
          }}>
            <div style={{
              background: t.surface, border: `2px solid ${t.line}`, borderRadius: 12,
              padding: 16, boxShadow: t.shadow,
              opacity: selectedLocation ? 1 : 0.6,
              pointerEvents: selectedLocation ? 'auto' : 'none',
            }}>
              <div className="placer-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: experiment.color, marginBottom: 14 }}>
                Record Observation
              </div>

              {!selectedLocation && (
                <p style={{ fontSize: 12, color: '#B3261E', margin: '0 0 12px' }}>
                  Click a spot on the map first to set a location.
                </p>
              )}

              {selectedLocation && (
                <div style={{ fontSize: 11, color: t.inkDim, marginBottom: 12 }}>
                  Location: {locationStr}
                </div>
              )}

              <div role="group" aria-label="Posture — pick one" style={{ marginBottom: 12 }}>
                <div className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', color: t.inkFaint, marginBottom: 6 }}>1 · Posture</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {POSTURE_LIST.map((item) => (
                    <Chip
                      key={item.key} t={t} color={item.color}
                      active={posture === item.key} ariaPressed={posture === item.key}
                      onClick={() => pickPosture(item.key)} style={{ fontSize: 11, height: 30, padding: '0 8px' }}>
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div role="group" aria-label="Activity — pick one or more" style={{ marginBottom: 12 }}>
                <div className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', color: t.inkFaint, marginBottom: 6 }}>2 · Activity</div>
                {posture ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {ACTIVITY_GROUPS.map((group) => (
                      <div key={group.key} style={{ flex: 1, minWidth: 0 }}>
                        <div className="placer-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
                          textTransform: 'uppercase', color: experiment.color, marginBottom: 4, opacity: 0.8 }}>
                          {group.label}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {group.activities.map((key) => {
                            const item = ACTIVITY_BY_KEY[key];
                            const active = activities.includes(key);
                            return (
                              <label key={key} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 11, cursor: 'pointer', color: active ? t.ink : t.inkDim,
                                padding: '2px 4px', borderRadius: 4,
                                background: active ? (experiment.color + '18') : 'transparent',
                              }}>
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => toggleActivity(key)}
                                  style={{ accentColor: experiment.color }}
                                />
                                {item?.label ?? key}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: t.inkFaint, margin: 0 }}>Choose a posture first.</p>
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

          {/* Google Map container */}
          <div
            ref={mapRef}
            role="group"
            aria-label="Observation map — click to select a location, then record"
            style={{
              width: '100%', height: 520, borderRadius: 12,
              border: `1px solid ${t.line}`, overflow: 'hidden',
              background: t.surfaceAlt, cursor: 'crosshair',
            }}
          />

          {/* No API key notice */}
          {(!apiKey || !googleLoaded) && (
            <div style={{ background: '#F5F5F5', borderLeft: `4px solid #111111`, color: '#111111',
              padding: 10, marginTop: 8, fontSize: 13, borderRadius: 6 }}>
              <strong>Google Maps API Key Required</strong> — add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>.env</code> to enable the map.
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {POSTURE_LIST.map((item) => (
              <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: t.inkDim, fontFamily: 'var(--placer-font)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                {item.label} ({counts.byPosture[item.key]})
              </span>
            ))}
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--placer-font)' }}>
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
                    <span className="placer-disp" style={{ fontSize: 16, fontWeight: 700, color: people > 0 ? item.color : t.inkFaint }}>
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
              <td className="placer-disp" style={{ padding: '8px', textAlign: 'right', fontSize: 16, fontWeight: 700, color: t.ink }}>{counts.total}</td>
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
