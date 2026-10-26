/* PLACER — Toolkit: Stationary Activity Mapping.
 *
 * A map-based field observation tool, after Gehl's Public Life Data Protocol. After
 * the cover come its instructions: the field sheet's directions and its key, each
 * posture's symbol and the activities. "Get started" moves on to setting up the
 * session (StationaryActivitySetup.jsx): the area outlined on a map, and the sheet's
 * header. Start mapping then opens the map (OpenStreetMap), the dominant visual element; the
 * recording card floats over its left half and the tally sits below it. The user
 * first clicks the map to pick a location, then selects posture and activities,
 * then records. Every posture is drawn as its symbol (PostureSymbol.jsx).
 * The site's text face (--placer-font) is used throughout.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '../Icon';
import { Panel, Readout } from '../ToolLayout';
import { Btn, Chip, CopyButton } from '../UI';
import { PostureSymbol, symbolElement } from './PostureSymbol';
import { StationaryActivitySetup } from './StationaryActivitySetup';
import {
  ACTIVITIES,
  ACTIVITIES_BY_POSTURE,
  DIRECTIONS,
  HANDING_IN,
  ACTIVITY_BY_KEY,
  POSTURES,
  POSTURE_LIST,
  emptySession,
  insideArea,
  sessionLines,
  normaliseObservation,
  emptyTallies,
  tally,
  peopleWord,
  summaryText,
} from '../../lib/toolkit/stationaryActivity';
import { addPin, createMap, fitPoints, onBackgroundClick, openPopup, showAreas } from '../../lib/map';

const MAP_CENTER = { lat: 55.6054, lng: 12.9854 };
const MAP_ZOOM = 15;

const ACTIVITY_GROUPS = [
  { key: 'getting-around', label: 'Getting Around', activities: ['waiting'] },
  { key: 'food-work', label: 'Food & Work', activities: ['consuming', 'commercial'] },
  { key: 'social-culture', label: 'Social & Culture', activities: ['conversing', 'cultural', 'recreation'] },
];

const INK = '#111111';

// A recorded person on the map: their posture's symbol in black on a small white tile,
// so an open circle still reads against the streets.
function markerTile(posture) {
  const tile = document.createElement('div');
  Object.assign(tile.style, {
    width: '24px', height: '24px', boxSizing: 'border-box', borderRadius: '6px',
    background: '#FFFFFF', border: `1px solid ${INK}`, color: INK,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  tile.append(symbolElement(posture, 16));
  return tile;
}

function describe(person) {
  return {
    posture: POSTURES[person.posture]?.label ?? person.posture,
    activities: person.activities.map((k) => ACTIVITY_BY_KEY[k]?.label ?? k),
  };
}

// What a recorded point says when it is clicked.
function popupContent(person, id) {
  const { posture, activities } = describe(person);
  const node = document.createElement('div');
  node.style.cssText = 'font-family:var(--placer-font);padding:2px 4px;min-width:150px;font-size:13px;line-height:1.5';
  const heading = document.createElement('strong');
  heading.style.color = INK;
  heading.textContent = posture;
  node.append(heading);
  activities.forEach((label) => {
    const line = document.createElement('div');
    line.textContent = label;
    node.append(line);
  });
  const footer = document.createElement('div');
  footer.style.cssText = 'font-size:11px;color:#888;margin-top:4px';
  footer.textContent = `Observation #${id}`;
  node.append(footer);
  return node;
}

export function StationaryActivityMap({ t, tool }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapFailed, setMapFailed] = useState(false);

  const [observations, setObservations] = useState([]);
  const [posture, setPosture] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [last, setLast] = useState(null);
  // Which step after the cover: the instructions, setting up the session, or the map.
  const [step, setStep] = useState('instructions');
  const [session, setSession] = useState(() => emptySession());
  const nextId = useRef(1);

  const counts = useMemo(() => tally(observations), [observations]);
  const activityList = posture ? ACTIVITIES_BY_POSTURE[posture] : [];
  const outside = selectedLocation && !insideArea(selectedLocation, session.area);
  const recordDisabled = !posture || activities.length === 0 || !selectedLocation || outside;

  /* --- Initialise map; a click on it picks the spot to record --- */
  useEffect(() => {
    if (step !== 'map' || !mapRef.current) return undefined;
    let osmMap;
    try {
      osmMap = createMap(mapRef.current, { center: MAP_CENTER, zoom: MAP_ZOOM });
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapFailed(true);
      return undefined;
    }
    fitPoints(osmMap, session.area, { padding: 60 });
    onBackgroundClick(osmMap, (point) => setSelectedLocation(point));
    setMap(osmMap);
    return () => osmMap.remove();
    // Made afresh each time the map step opens; the area is fixed by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* --- The survey area outlined in step 3 --- */
  useEffect(() => {
    if (!map) return undefined;
    return showAreas(map, 'survey-area', [{ path: session.area, fill: tool.color, stroke: tool.color }],
      { fillOpacity: 0.12 });
  }, [map, session.area, tool.color]);

  /* --- One point per observation, where it was recorded --- */
  useEffect(() => {
    if (!map) return undefined;
    const markers = observations.flatMap((obs) => {
      const person = normaliseObservation(obs);
      if (!person || !obs.position) return [];
      const { posture: postureLabel, activities: activityLabels } = describe(person);
      return [addPin(map, obs.position, {
        element: markerTile(person.posture),
        title: `${postureLabel}: ${activityLabels.join(', ')}`,
        onClick: () => openPopup(map, obs.position, popupContent(person, obs.id)),
      })];
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [observations, map]);

  /* --- The spot about to be recorded --- */
  useEffect(() => {
    if (!map || !selectedLocation) return undefined;
    const marker = addPin(map, selectedLocation, {
      size: 16, fill: tool.color, ring: '#FFFFFF', ringWidth: 3, zIndex: 2,
      title: 'Observation location',
    });
    return () => marker.remove();
  }, [map, selectedLocation, tool.color]);

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
    const person = { id: nextId.current, posture, activities: [...activities], cell, position: selectedLocation };
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
  }

  const locationStr = selectedLocation
    ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
    : '';

  // Step 3: outlining the area and filling in the sheet's header.
  if (step === 'configure') {
    return (
      <StationaryActivitySetup t={t} tool={tool} session={session} onChange={setSession}
        onBack={() => setStep('instructions')} onStart={() => setStep('map')} />
    );
  }

  // Step 2, after the cover: the field sheet's directions and its key.
  if (step === 'instructions') {
    return (
    <div style={{ fontFamily: 'var(--placer-font)' }}>
      {/* The field sheet's directions, and its key to the symbols and activities. */}
      <Panel t={t} title="Instructions">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
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
              <h3 className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: t.inkDim, margin: '0 0 10px' }}>Postures</h3>
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
              <h3 className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: t.inkDim, margin: '0 0 10px' }}>Activities</h3>
              <ul aria-label="Activities" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex',
                flexDirection: 'column', gap: 8, fontSize: 14, color: t.ink, lineHeight: 1.35 }}>
                {ACTIVITIES.map((activity) => <li key={activity.key}>{activity.label}</li>)}
              </ul>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn t={t} onClick={() => setStep('configure')}>Get started</Btn>
        </div>
      </Panel>

    </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--placer-font)' }}>
      <div>
        <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={() => setStep('configure')}>Session</Btn>
      </div>

      {/* The sheet's header, as set up in step 3. */}
      <p aria-label="Session" className="placer-mono" style={{ margin: 0, fontSize: 12, color: t.inkDim, lineHeight: 1.6 }}>
        {sessionLines(session).join(' · ')}
      </p>

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
                textTransform: 'uppercase', color: tool.color, marginBottom: 14 }}>
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

              {outside && (
                <p style={{ fontSize: 12, color: '#B3261E', margin: '0 0 12px' }}>
                  That spot is outside the survey area. Pick a spot inside the outline.
                </p>
              )}

              <div role="group" aria-label="Posture — pick one" style={{ marginBottom: 12 }}>
                <div className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', color: t.inkFaint, marginBottom: 6 }}>1 · Posture</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {POSTURE_LIST.map((item) => (
                    <Chip
                      key={item.key} t={t}
                      active={posture === item.key} ariaPressed={posture === item.key}
                      onClick={() => pickPosture(item.key)}
                      style={{ fontSize: 11, height: 30, padding: '0 8px', gap: 6 }}>
                      <PostureSymbol posture={item.key} size={12} />
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
                          textTransform: 'uppercase', color: tool.color, marginBottom: 4, opacity: 0.8 }}>
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
                                background: active ? (tool.color + '18') : 'transparent',
                              }}>
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => toggleActivity(key)}
                                  style={{ accentColor: tool.color }}
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

          {/* Map container */}
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

          {mapFailed && (
            <div style={{ background: '#F5F5F5', borderLeft: `4px solid #111111`, color: '#111111',
              padding: 10, marginTop: 8, fontSize: 13, borderRadius: 6 }}>
              <strong>The map could not load.</strong> Try reloading the page.
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {POSTURE_LIST.map((item) => (
              <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: t.inkDim, fontFamily: 'var(--placer-font)' }}>
                <PostureSymbol posture={item.key} size={12} style={{ color: t.ink }} />
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
                      <PostureSymbol posture={item.key} size={12} />
                      {item.label}
                    </span>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <span className="placer-disp" style={{ fontSize: 16, fontWeight: 700, color: people > 0 ? t.ink : t.inkFaint }}>
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
            t={t} value={summaryText(counts, session)} variant="primary" size="sm" icon="send"
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
