/* PLACER — Toolkit: Site-Specific Spatial Mapping Tool.
 *
 * Pick a site on an OpenStreetMap map (with geolocation + place search), tell us
 * a little about yourself, answer eighteen ordered questions as a stack of cards,
 * then optionally map markers, reflect, and leave contact details for follow-up.
 * If the map cannot load the picker falls back to coordinates + presets — the
 * survey never depends on the map tiles.
 *
 * Opened in a project's room (ConfigureToolDialog sets it up), there is no picker: the
 * site is the room's, named by its organisers and seen in the view they framed
 * (SiteScope.jsx), and the markers are placed on that view rather than a sketch. It
 * opens in steps — drop a pin on the site where you are, Start the survey, then About
 * you — and the pin stays on the map through the survey.
 *
 * There, once the eighteen cards are done, a person can record their answers to the
 * room — never their contact details (recordedAnswers in lib/toolkit/siteMapping.js) —
 * and then see everybody else's: a tally card under the survey, and all of it, with
 * the markers on the map, behind See other answers. `recording` is how: given by the
 * project page's version (SiteMappingOnPage), or made here from a room it is open in.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Meter, Panel, Readout } from '../ToolLayout';
import { Btn, Chip, CopyButton } from '../UI';
import { PlaceSearch } from '../PlaceSearch';
import { SITE_ASPECT, SiteView } from './SiteScope';
import { KeepOnProfile, onItsOwn } from './KeepOnProfile';
import { addPlainMarker, createMap, onBackgroundClick, toLngLat } from '../../lib/map';
import {
  AGE_RANGES,
  GENDER_OPTIONS,
  MAP_MARKERS,
  REFLECTION_MOODS,
  REFLECTION_PROMPTS,
  SITE_PRESETS,
  SURVEY_QUESTIONS,
  answerQuestion,
  answeredCount,
  buildJSON,
  buildSummary,
  emptyState,
  hasReflection,
  hinderingCount,
  invitingCount,
  isSurveyComplete,
  isValidEmail,
  markerCounts,
  parseSiteSearch,
  placeMarker,
  recordedAnswers,
  removeMarker,
  siteFromConfig,
  siteMapUrl,
} from '../../lib/toolkit/siteMapping';

const DEFAULT_CENTER = { lat: 52.5206, lng: 13.4095 };

function fieldStyle(t) {
  return {
    width: '100%', height: 42, padding: '0 12px', borderRadius: 12,
    border: `1.5px solid ${t.line}`, background: t.surfaceAlt, color: t.ink,
    fontFamily: 'var(--placer-font)', fontSize: 14.5, fontWeight: 500,
  };
}

function areaStyle(t) {
  return {
    ...fieldStyle(t), height: 'auto', minHeight: 72, padding: 10,
    fontWeight: 500, lineHeight: 1.5, resize: 'vertical',
  };
}

function coordsFromPointer(event, cols = 100, rows = 70) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x: Math.min(0.98, Math.max(0.02, x)), y: Math.min(0.98, Math.max(0.02, y)), cols, rows };
}

/** Recorded answers (recordedAnswers) as the state the tool works in, to carry on from. */
function stateFromRecorded(recorded) {
  return {
    ...emptyState(),
    answers: { ...emptyState().answers, ...recorded.answers },
    markers: recorded.markers.map((m, index) => ({ id: `recorded-${index}`, ...m })),
    mood: recorded.mood,
    notes: recorded.notes,
    profile: { ageRange: recorded.profile.ageRange ?? '', gender: recorded.profile.gender ?? '', genderSelf: '' },
    here: recorded.here,
  };
}

/** The share of `part` in `whole`, as a whole percentage. */
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function SiteMapping({ t, tool, room = null, recording = null }) {
  const c = tool.color;
  const fixed = useMemo(() => siteFromConfig(room?.config), [room?.config]);

  // Recording to a room this is open in, when no host records for it.
  const [roomSent, setRoomSent] = useState(null);
  const rec = recording ?? (room?.status === 'open' ? {
    sent: roomSent,
    status: 'idle',
    others: room.combined,
    onRecord: (answers) => { room.publish(answers); setRoomSent(answers); },
  } : null);
  // What this person recorded before, coming back to it: they carry on from there.
  const resumed = recording?.sent && fixed ? recording.sent : null;

  const [site, setSite] = useState(() => (resumed ? fixed : null));
  const [siteName, setSiteName] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [placeLabel, setPlaceLabel] = useState('');
  const [mapsReady, setMapsReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [geoState, setGeoState] = useState('idle');
  const [geoMessage, setGeoMessage] = useState('');
  const [searchError, setSearchError] = useState('');
  const [state, setState] = useState(() => (resumed ? stateFromRecorded(resumed) : emptyState()));
  const [cardIndex, setCardIndex] = useState(0);
  // On a project's site, the steps before the survey: 'where' you are, then 'about' you.
  const [intro, setIntro] = useState('where');
  const [panel, setPanel] = useState(resumed ? 'choice' : 'survey');
  const [selectedMarker, setSelectedMarker] = useState(MAP_MARKERS[0].key);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Stand up the picker map while there is no site yet — clicks choose the site. The
  // survey itself never needs it, so a map that fails degrades to coordinates +
  // presets, not a block.
  useEffect(() => {
    if (site || fixed || !mapEl.current) return undefined;
    let map;
    try {
      map = createMap(mapEl.current, {
        center: picked || DEFAULT_CENTER,
        zoom: picked ? 16 : 12,
      });
    } catch {
      setMapFailed(true);
      return undefined;
    }
    map.ready.then(() => setMapsReady(true));
    map.on('error', (event) => {
      // A tile that will not load is not a failed map; a style that will not is.
      if (!map.isStyleLoaded()) {
        console.error('Could not load the map:', event?.error);
        setMapFailed(true);
      }
    });
    onBackgroundClick(map, (coords) => {
      setPicked(coords);
      setPlaceLabel('');
      setSiteSearch(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  // Keep one pin on the picked spot.
  useEffect(() => {
    markerRef.current?.remove();
    markerRef.current = null;
    if (!mapRef.current || !picked) return;
    markerRef.current = addPlainMarker(mapRef.current, picked, { color: c });
    mapRef.current.panTo(toLngLat(picked));
  }, [picked, mapsReady, c]);

  function pickPlace(result) {
    setPicked(result.point);
    setPlaceLabel(result.name || result.label);
    setSiteSearch(`${result.point.lat.toFixed(5)}, ${result.point.lng.toFixed(5)}`);
    if (result.name && !siteName) setSiteName(result.name);
    mapRef.current?.jumpTo({ center: toLngLat(result.point), zoom: 16 });
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      setGeoMessage('This browser does not share locations — pick the site on the map instead.');
      return;
    }
    setGeoState('locating');
    setGeoMessage('Asking the browser where you are…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPicked(coords);
        setSiteSearch(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        setGeoState('found');
        setGeoMessage(`Centred near you (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) — drag the pin by clicking the map.`);
        mapRef.current?.jumpTo({ center: toLngLat(coords), zoom: 16 });
      },
      (err) => {
        setGeoState('denied');
        setGeoMessage(
          err?.code === 1
            ? 'Location permission was denied — search or click the map instead.'
            : 'Could not get your location — search or click the map instead.',
        );
      },
      { timeout: 10000 },
    );
  }

  const done = isSurveyComplete(state.answers);
  const answered = answeredCount(state.answers);
  const counts = useMemo(() => markerCounts(state.markers), [state.markers]);
  const placedTotal = state.markers.length;
  const reflected = hasReflection(state);
  const mapsUrl = site ? siteMapUrl(site) : null;
  const summary = useMemo(() => (site ? buildSummary(site, state) : ''), [site, state]);
  const current = SURVEY_QUESTIONS[Math.min(cardIndex, SURVEY_QUESTIONS.length - 1)];

  function loadSite(preset) {
    const coords = preset || picked || parseSiteSearch(siteSearch);
    if (!coords) {
      setSearchError('Pick a spot on the map, search for a place, or type coordinates as "lat, lng" — e.g. 52.52, 13.40.');
      return;
    }
    setSearchError('');
    setSite({
      name: preset
        ? preset.label
        : siteName.trim() || placeLabel.trim() || 'Field site',
      lat: coords.lat,
      lng: coords.lng,
    });
    setPanel('survey');
    setCardIndex(0);
  }

  function setProfile(patch) {
    setState((s) => ({ ...s, profile: { ...(s.profile || { ageRange: '', gender: '', genderSelf: '' }), ...patch } }));
  }

  function setContact(patch) {
    setState((s) => ({ ...s, contact: { ...(s.contact || { name: '', email: '', phone: '', consent: false }), ...patch } }));
  }

  function answerCurrent(value) {
    const next = answerQuestion(state.answers, current.key, value);
    setState((s) => ({ ...s, answers: next }));
    if (isSurveyComplete(next)) {
      setPanel('choice');
      return;
    }
    const nextIndex = SURVEY_QUESTIONS.findIndex((q) => next[q.key] !== true && next[q.key] !== false);
    setCardIndex(nextIndex === -1 ? cardIndex + 1 : nextIndex);
  }

  function goCard(index) {
    setCardIndex(Math.min(SURVEY_QUESTIONS.length - 1, Math.max(0, index)));
  }

  function dropOnMap(event) {
    event.preventDefault();
    // jsdom reports a zero-size box, so fall back to the centre there — in a
    // real browser the rect always has size and the pointer decides.
    const point = coordsFromPointer(event) || { x: 0.5, y: 0.5 };
    const type = event.dataTransfer?.getData('text/marker-type') || selectedMarker;
    setState((s) => ({ ...s, markers: placeMarker(s.markers, type, point.x, point.y) }));
  }

  function clickMap(event) {
    const point = coordsFromPointer(event) || { x: 0.5, y: 0.5 };
    setState((s) => ({ ...s, markers: placeMarker(s.markers, selectedMarker, point.x, point.y) }));
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null;
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function reset() {
    setState(emptyState());
    setCardIndex(0);
    setPanel('survey');
    setSite(null);
    setPicked(null);
    setPlaceLabel('');
    setPlaceQuery('');
    setSiteSearch('');
    setGeoState('idle');
    setGeoMessage('');
    setIntro('where');
  }

  const contact = state.contact || {};
  const emailOk = isValidEmail(contact.email);

  // ——— Recording to the room, and everybody else's answers ———
  const recorded = useMemo(() => recordedAnswers(state), [state]);
  const changed = rec ? JSON.stringify(recorded) !== JSON.stringify(rec.sent ?? null) : false;
  const others = rec?.sent ? rec.others : null;

  const recordControls = rec && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Btn t={t} variant="primary" size="md" icon={rec.sent && !changed ? 'check' : 'send'}
        disabled={!done || rec.status === 'sending' || rec.status === 'closed' || (Boolean(rec.sent) && !changed)}
        onClick={() => rec.onRecord(recorded)}>
        {rec.status === 'sending' ? 'Recording…'
          : !rec.sent ? 'Record my answers' : changed ? 'Update my answers' : 'Answers recorded'}
      </Btn>
      {rec.sent && panel !== 'others' && (
        <Btn t={t} variant="outline" size="md" icon="chart" onClick={() => setPanel('others')}>
          See other answers
        </Btn>
      )}
      <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.6, margin: 0 }}>
        {rec.status === 'closed' ? 'This has closed, so no more answers are being recorded.'
          : rec.status === 'error' ? 'Your answers did not go through. Please try again.'
            : rec.sent && changed ? 'You have changed your answers since recording them.'
              : 'Recorded without your name or contact details. Everybody taking part can see what you record.'}
      </p>
    </div>
  );

  // The questions most people found here, for the tally card.
  const topFound = others ? SURVEY_QUESTIONS
    .filter((q) => others.answered[q.key] > 0)
    .sort((a, b) => (others.yes[b.key] / others.answered[b.key]) - (others.yes[a.key] / others.answered[a.key]))
    .slice(0, 3) : [];

  const tallyCard = others && panel !== 'others' && (
    <Panel t={t} title="Everyone's answers so far" aside={
      <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
        {others.people} {others.people === 1 ? 'person' : 'people'}
      </span>
    }>
      {topFound.map((q) => (
        <Meter key={q.key} t={t} label={q.label} color={q.kind === 'hindering' ? '#B3261E' : c}
          value={others.yes[q.key] / others.answered[q.key]}
          caption={`${percent(others.yes[q.key], others.answered[q.key])}% yes`} />
      ))}
      <p style={{ fontSize: 12.5, color: t.inkDim, margin: '4px 0 12px' }}>
        {others.markers.length} {others.markers.length === 1 ? 'marker' : 'markers'} on the map, yours included.
      </p>
      <Btn t={t} variant="quiet" size="sm" full icon="chart" onClick={() => setPanel('others')}>See other answers</Btn>
    </Panel>
  );

  // Who the person is: below the picker on the Toolkit's own page, a step of its own on
  // a project's site (`own`), where the step's title already says what it is.
  const recordable = Boolean(recording) || room?.status === 'open';
  const aboutYouFields = (own) => (
    <div style={own ? undefined : { marginTop: 22, borderTop: `1px solid ${t.line}`, paddingTop: 16 }}>
      <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
        {own ? 'Optional — it helps read the answers' : 'About you — optional, helps read the answers'}
      </span>
      <div style={{ marginTop: 10 }}>
        <span id="age-label" style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Age</span>
        <div role="group" aria-labelledby="age-label" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {AGE_RANGES.map((range) => (
            <Chip key={range.value} t={t} color={c} active={state.profile?.ageRange === range.value}
              ariaPressed={state.profile?.ageRange === range.value}
              onClick={() => setProfile({ ageRange: state.profile?.ageRange === range.value ? '' : range.value })}>
              {range.label}
            </Chip>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <span id="gender-label" style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Gender</span>
        <div role="group" aria-labelledby="gender-label" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {GENDER_OPTIONS.map((option) => (
            <Chip key={option.value} t={t} color={c} active={state.profile?.gender === option.value}
              ariaPressed={state.profile?.gender === option.value}
              onClick={() => setProfile({ gender: state.profile?.gender === option.value ? '' : option.value })}>
              {option.label}
            </Chip>
          ))}
        </div>
        {state.profile?.gender === 'self-describe' && (
          <input aria-label="Describe your gender" type="text" placeholder="Self-describe (optional)"
            value={state.profile?.genderSelf || ''}
            onChange={(e) => setProfile({ genderSelf: e.target.value })}
            style={{ ...fieldStyle(t), marginTop: 8 }} />
        )}
      </div>
      <p style={{ fontSize: 12.5, color: t.inkFaint, lineHeight: 1.6, marginTop: 10 }}>
        {recordable
          ? 'Recorded with your answers if you record them, without your name.'
          : 'Stays in this browser — it only leaves with your download if you export.'}
      </p>
    </div>
  );
  const aboutYou = aboutYouFields(false);

  function dropHere(event) {
    const point = coordsFromPointer(event) || { x: 0.5, y: 0.5 };
    setState((s) => ({ ...s, here: { x: point.x, y: point.y } }));
  }

  // The person's pin, drawn in the same 100 × 70 space as the markers.
  const herePin = (here) => (
    <g aria-hidden="true">
      <circle cx={here.x * 100} cy={here.y * 70} r="4.2" fill={c} opacity="0.22" />
      <circle cx={here.x * 100} cy={here.y * 70} r="2.2" fill={c} stroke="#fff" strokeWidth="0.8" />
    </g>
  );

  // ——— Phase 0, in a project: where you are on its site, then who you are ———
  if (!site && fixed && intro === 'where') {
    return (
      <div style={{ maxWidth: 860 }}>
        <Panel t={t} title={`Where are you? · ${fixed.name}`}>
          <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, marginBottom: 16 }}>
            Tap the map where you are standing now. Then start the survey: a few questions about
            you, and Section 1 as a stack of eighteen cards.
          </p>
          <div role="group" aria-label={`Map of ${fixed.name}. Tap where you are to drop your pin.`}
            onClick={dropHere}
            style={{ position: 'relative', width: '100%', aspectRatio: SITE_ASPECT, borderRadius: 12,
              overflow: 'hidden', border: `1px solid ${t.line}`, background: t.surfaceAlt, cursor: 'crosshair' }}>
            <SiteView scope={fixed.scope} label={`Map of ${fixed.name}`} />
            <svg viewBox="0 0 100 70" preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {state.here && herePin(state.here)}
            </svg>
          </div>
          <p role="status" aria-live="polite" style={{ fontSize: 13, color: t.inkDim, marginTop: 10, minHeight: 20 }}>
            {state.here ? 'Your pin is down. Tap again to move it.' : 'No pin yet — tap the map where you are.'}
          </p>
          <div style={{ marginTop: 12 }}>
            <Btn t={t} variant="primary" size="md" icon="arrowRight" disabled={!state.here}
              onClick={() => setIntro('about')}>
              Start the survey
            </Btn>
          </div>
        </Panel>
      </div>
    );
  }

  if (!site && fixed) {
    return (
      <div style={{ maxWidth: 860 }}>
        <Panel t={t} title="About you">
          {aboutYouFields(true)}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <Btn t={t} variant="outline" size="md" icon="chevLeft" onClick={() => setIntro('where')}>
              Back
            </Btn>
            <Btn t={t} variant="primary" size="md" icon="arrowRight"
              onClick={() => { setSite(fixed); setPanel('survey'); setCardIndex(0); }}>
              Continue to the survey
            </Btn>
          </div>
        </Panel>
      </div>
    );
  }

  // ——— Phase 0: no site yet — map-based picker + who you are ———
  if (!site) {
    const showMap = !mapFailed;
    return (
      <div style={{ maxWidth: 860 }}>
        <Panel t={t} title="Find your site on the map">
          <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, marginBottom: 16 }}>
            Search for the place, tap “use my location”, or click straight onto the map.
            Once the site loads, Section 1 opens as a stack of eighteen cards.
          </p>
          <label className="placer-mono" htmlFor="site-name" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
            Site name
          </label>
          <input id="site-name" type="text" placeholder="e.g. Lindenplatz" value={siteName}
            onChange={(e) => setSiteName(e.target.value)} style={{ ...fieldStyle(t), marginTop: 6 }} />
          <div style={{ marginTop: 14 }}>
            <label className="placer-mono" htmlFor="site-place-search" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              Search for a place
            </label>
            <div style={{ marginTop: 6 }}>
              <PlaceSearch id="site-place-search" value={placeQuery} onChange={setPlaceQuery}
                onPick={pickPlace} near={picked} placeholder="Square, park, address…" style={fieldStyle(t)} />
            </div>
          </div>
          {showMap ? (
            <div style={{ marginTop: 12 }}>
              <div ref={mapEl} role="application" aria-label="Choose site on map. Click to drop the site pin."
                style={{ width: '100%', height: 320, borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.line}`, background: t.surfaceAlt }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                <Btn t={t} variant="outline" size="sm" icon="pin"
                  disabled={geoState === 'locating'} onClick={locateMe}>
                  {geoState === 'locating' ? 'Locating…' : 'Use my location'}
                </Btn>
                <span role="status" aria-live="polite" style={{ fontSize: 12.5, color: t.inkDim }}>
                  {geoMessage || (picked
                    ? `Picked ${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}${placeLabel ? ` — ${placeLabel}` : ''}. Click again to move the pin.`
                    : mapsReady ? 'Click the map to drop the site pin.' : 'Loading the map…')}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: t.inkFaint, lineHeight: 1.6, marginTop: 12 }}>
              The map could not load — search or coordinates below still work.
            </p>
          )}
          <div style={{ marginTop: 14 }}>
            <label className="placer-mono" htmlFor="site-search" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              Or type coordinates (lat, lng)
            </label>
            <input id="site-search" type="text" placeholder="52.5206, 13.4095" value={siteSearch}
              onChange={(e) => {
                setSiteSearch(e.target.value);
                const parsed = parseSiteSearch(e.target.value);
                if (parsed) {
                  setPicked(parsed);
                  setPlaceLabel('');
                }
              }} style={{ ...fieldStyle(t), marginTop: 6 }} />
          </div>
          {searchError && (
            <p role="alert" style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{searchError}</p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
            <Btn t={t} variant="primary" size="md" icon="pin"
              onClick={() => loadSite(null)}>
              Load site{picked ? ` · ${picked.lat.toFixed(3)}, ${picked.lng.toFixed(3)}` : ''}
            </Btn>
            {picked && (
              <Btn t={t} variant="ghost" size="sm" onClick={() => { setPicked(null); setPlaceLabel(''); setSiteSearch(''); }}>
                Clear pin
              </Btn>
            )}
          </div>
          <div style={{ marginTop: 18 }}>
            <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              Or start from a preset place
            </span>
            <div role="group" aria-label="Preset sites" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {SITE_PRESETS.map((preset) => (
                <Chip key={preset.key} t={t} color={c} active={false} ariaPressed={false}
                  onClick={() => { setSiteName(preset.label); setSiteSearch(`${preset.lat}, ${preset.lng}`); setPicked({ lat: preset.lat, lng: preset.lng }); loadSite(preset); }}>
                  {preset.label}
                </Chip>
              ))}
            </div>
          </div>
          {aboutYou}
        </Panel>
      </div>
    );
  }

  // ——— Site loaded: map + side box ———
  // On a phone the two stack, and while the eighteen cards are up only they show: the
  // map is for the sections after them (.placer-site-mapping in index.css).
  return (
    <div className="placer-site-mapping" data-panel={panel}
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: 20, alignItems: 'start' }}>
      {/* Left: the site map */}
      <div className="placer-site-mapping-map" style={{ minWidth: 0 }}>
      <Panel t={t} title={site.name} aside={
        <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
          {site.lat.toFixed(4)}, {site.lng.toFixed(4)} · {placedTotal} marker{placedTotal === 1 ? '' : 's'}
        </span>
      }>
        <div
          role="group"
          aria-label="Site map. Choose a marker on the right, then click or drop it on the map."
          onClick={panel === 'spatial' ? clickMap : undefined}
          onDragOver={(e) => { if (panel === 'spatial') e.preventDefault(); }}
          onDrop={panel === 'spatial' ? dropOnMap : undefined}
          style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.line}`, background: t.surfaceAlt, cursor: panel === 'spatial' ? 'crosshair' : 'default' }}>
          {site.scope && <SiteView scope={site.scope} label={`Map of ${site.name}`} />}
          <svg viewBox="0 0 100 70" style={{ position: 'relative', width: '100%', display: 'block' }} role="img"
            aria-label={site.scope
              ? `Markers placed on ${site.name}: ${placedTotal}`
              : `Schematic plan of ${site.name} with ${placedTotal} placed markers`}>
            {!site.scope && <>
            {/* grass, paths, water hint */}
            <rect x="0" y="0" width="100" height="70" fill={t.mapMode === 'dark' ? '#232329' : '#E9EFE2'} />
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`v${i}`} x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="70" stroke={t.line} strokeWidth="0.25" />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={(i + 1) * 10} x2="100" y2={(i + 1) * 10} stroke={t.line} strokeWidth="0.25" />
            ))}
            <rect x="8" y="8" width="84" height="54" rx="3" fill="none" stroke={t.inkFaint} strokeWidth="0.6" strokeDasharray="2 1.5" />
            <path d="M8 44 C 30 40, 55 48, 92 38" stroke={t.inkFaint} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.7" />
            <ellipse cx="70" cy="52" rx="14" ry="7" fill={t.mapMode === 'dark' ? '#2E3B33' : '#CFE0C2'} stroke={t.line} strokeWidth="0.5" />
            {/* site centre */}
            <g>
              <circle cx="50" cy="32" r="3.2" fill={c} opacity="0.2" />
              <circle cx="50" cy="32" r="1.6" fill={c} stroke="#fff" strokeWidth="0.5" />
            </g>
            </>}
            {panel === 'others' && others && (
              <g aria-hidden="true" opacity="0.55">
                {others.here.map((spot, index) => (
                  <circle key={`here-${index}`} cx={spot.x * 100} cy={spot.y * 70} r="1.4" fill={c} stroke="#fff" strokeWidth="0.4" />
                ))}
                {others.markers.map((m, index) => (
                  <circle key={`other-${index}`} cx={m.x * 100} cy={m.y * 70} r="2.2"
                    fill={MAP_MARKERS.find((k) => k.key === m.type).color} stroke="#fff" strokeWidth="0.5" />
                ))}
              </g>
            )}
            {state.here && herePin(state.here)}
            {state.markers.map((m) => {
              const kind = MAP_MARKERS.find((k) => k.key === m.type);
              return (
                <g key={m.id}>
                  <circle cx={m.x * 100} cy={m.y * 70} r="3" fill={kind.color} stroke="#fff" strokeWidth="0.7" />
                  <text x={m.x * 100} y={m.y * 70 + 1.4} textAnchor="middle" fontSize="3" fontWeight="700" fill="#fff"
                    style={{ fontFamily: 'var(--placer-font)', pointerEvents: 'none' }}>
                    {kind.label[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div role="status" aria-live="polite" style={{ marginTop: 10, fontSize: 13, color: t.inkDim, minHeight: 20 }}>
          {panel === 'others' && others
            ? `Everybody's pins and markers, faded under yours — ${others.people} ${others.people === 1 ? 'person' : 'people'}, ${others.markers.length} ${others.markers.length === 1 ? 'marker' : 'markers'}.`
            : panel === 'spatial'
            ? `Placing “${MAP_MARKERS.find((k) => k.key === selectedMarker).label}” — click the map, or drag the icon onto it. ${placedTotal} placed.`
            : `${answered}/18 questions · ${placedTotal} markers · ${reflected ? 'reflection noted' : 'no reflection yet'}`}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, fontWeight: 700, color: c }}>
              Open this site in OpenStreetMap ↗
            </a>
          )}
          <div style={{ flex: 1 }} />
          {!fixed && <Btn t={t} variant="ghost" size="sm" icon="pencil" onClick={() => setSite(null)}>Change site</Btn>}
        </div>
        {panel === 'spatial' && placedTotal > 0 && (
          <ul style={{ listStyle: 'none', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {state.here && herePin(state.here)}
            {state.markers.map((m) => {
              const kind = MAP_MARKERS.find((k) => k.key === m.type);
              return (
                <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.inkDim }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: kind.color, flex: '0 0 auto' }} />
                  {kind.label} at {Math.round(m.x * 100)}, {Math.round(m.y * 70)}
                  <div style={{ flex: 1 }} />
                  <Btn t={t} variant="ghost" size="sm" ariaLabel={`Remove ${kind.label} marker`}
                    onClick={() => setState((s) => ({ ...s, markers: removeMarker(s.markers, m.id) }))}>
                    <Icon name="trash" size={14} stroke={2} style={{ color: t.inkDim }} />
                  </Btn>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      </div>

      {/* Right: the side box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {panel === 'survey' && (
          <Panel t={t} title={`Section 1 · Site survey — question ${Math.min(cardIndex + 1, 18)} of 18`} aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>{answered}/18</span>
          }>
            {/* progress */}
            <div style={{ height: 6, borderRadius: 999, background: t.surfaceAlt, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: `${(answered / 18) * 100}%`, height: '100%', background: c, borderRadius: 999 }} />
            </div>
            {/* stack of cards: two ghost cards behind the live one */}
            <div style={{ position: 'relative', padding: '0 0 10px' }} aria-live="polite">
              <div aria-hidden="true" style={{ position: 'absolute', inset: '8px 10px 2px', borderRadius: 12, background: t.surfaceAlt, border: `1px solid ${t.line}` }} />
              <div aria-hidden="true" style={{ position: 'absolute', inset: '4px 5px 6px', borderRadius: 12, background: t.surfaceAlt, border: `1px solid ${t.line}` }} />
              <div style={{ position: 'relative', border: `1.5px solid ${t.line}`, borderRadius: 12, padding: 18, background: t.surface, boxShadow: t.shadow }}>
                <div className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: current.kind === 'hindering' ? '#B3261E' : c, marginBottom: 8 }}>
                  {current.number}. {current.kind === 'hindering' ? 'Hindering' : 'Inviting'} · {current.kind === 'hindering' ? 'does it block?' : 'is it here?'}
                </div>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 16.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1.4, padding: 0, marginBottom: 4 }}>
                    {current.label}
                  </legend>
                  {current.detail && (
                    <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55, marginBottom: 14 }}>{current.detail}</p>
                  )}
                  <div role="group" aria-label={`Answer question ${current.number}`} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <Btn t={t} variant={state.answers[current.key] === true ? 'primary' : 'outline'} size="md"
                      ariaPressed={state.answers[current.key] === true} onClick={() => answerCurrent(true)}>
                      Yes
                    </Btn>
                    <Btn t={t} variant={state.answers[current.key] === false ? 'primary' : 'outline'} size="md"
                      ariaPressed={state.answers[current.key] === false} onClick={() => answerCurrent(false)}>
                      No
                    </Btn>
                  </div>
                </fieldset>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Btn t={t} variant="ghost" size="sm" icon="chevLeft" disabled={cardIndex === 0} onClick={() => goCard(cardIndex - 1)}>
                Back
              </Btn>
              <div style={{ flex: 1 }} />
              <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
                {state.answers[current.key] === true || state.answers[current.key] === false ? 'answered ✓' : 'answer to move on'}
              </span>
            </div>
          </Panel>
        )}

        {panel === 'choice' && (
          <Panel t={t} title="Section 1 complete">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: c + '12', border: `1.5px solid ${c + '55'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: c, color: '#fff', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={17} stroke={2.8} />
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>
                  Eighteen of eighteen — {site.name} is in your notebook.
                </div>
                <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.6, marginTop: 4 }}>
                  {invitingCount(state.answers)} inviting · {hinderingCount(state.answers)} hindering.
                  Both sections below are optional — or finish here.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn t={t} variant="outline" size="md" icon="pin" onClick={() => setPanel('spatial')}>
                Add spatial mapping (optional)
              </Btn>
              <Btn t={t} variant="outline" size="md" icon="comment" onClick={() => setPanel('reflection')}>
                Add qualitative reflection (optional)
              </Btn>
              {/* Where answers are recorded, recording them takes the place of leaving
                  contact details. */}
              {rec ? recordControls : (
              <div style={{ border: `1.5px dashed ${t.line}`, borderRadius: 12, padding: '12px 14px', background: t.surfaceAlt }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
                  Want to stay involved in {site.name}?
                </div>
                <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.6, marginTop: 4, marginBottom: 10 }}>
                  Leave contact details on the next step and the team can invite you to
                  follow-up walks and share what changed. Optional — the survey counts either way.
                </p>
                <Btn t={t} variant="outline" size="sm" icon="send" onClick={() => setPanel('export')}>
                  Continue — leave contact details
                </Btn>
              </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: t.ink }}>
                <input type="checkbox" checked={false} onChange={() => setPanel('export')}
                  aria-label="Complete the tool and export" style={{ width: 17, height: 17, accentColor: c }} />
                I&apos;m done — complete the tool & export
              </label>
              <Btn t={t} variant="primary" size="md" onClick={() => setPanel('export')}>Finish & export data</Btn>
              <Btn t={t} variant="ghost" size="sm" icon="pencil" onClick={() => { setPanel('survey'); goCard(0); }}>
                Review the eighteen cards again
              </Btn>
            </div>
          </Panel>
        )}

        {panel === 'spatial' && (
          <Panel t={t} title="Section 2 · Spatial mapping" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>{placedTotal} placed</span>
          }>
            <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.6, marginBottom: 12 }}>
              Drag an icon onto the map — or tap one, then tap the map. Five kinds, as many as you saw.
            </p>
            <div role="group" aria-label="Marker palette" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MAP_MARKERS.map((kind) => (
                <button key={kind.key} type="button" draggable
                  onDragStart={(e) => e.dataTransfer?.setData('text/marker-type', kind.key)}
                  onClick={() => setSelectedMarker(kind.key)}
                  aria-pressed={selectedMarker === kind.key}
                  title={kind.help}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                    cursor: 'grab', textAlign: 'left', fontFamily: 'var(--placer-font)',
                    border: `1.5px solid ${selectedMarker === kind.key ? kind.color : t.line}`,
                    background: selectedMarker === kind.key ? kind.color + '14' : 'transparent', color: t.ink }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: kind.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    <Icon name={kind.icon} size={16} stroke={2.2} />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{kind.label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: t.inkDim }}>{counts[kind.key] || 0} on map · {kind.verb}</span>
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Btn t={t} variant="outline" size="sm" onClick={() => setPanel('choice')}>Back to sections</Btn>
              <Btn t={t} variant="primary" size="sm" onClick={() => setPanel('reflection')}>Next — reflection</Btn>
            </div>
          </Panel>
        )}

        {panel === 'reflection' && (
          <Panel t={t} title="Section 3 · Qualitative reflection">
            <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.6, marginBottom: 12 }}>
              How did {site.name} feel? One overall sense, then whatever you noticed — in your words.
            </p>
            <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              Overall feeling
            </span>
            <div role="group" aria-label="Overall feeling" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, marginBottom: 16 }}>
              {REFLECTION_MOODS.map((mood) => (
                <Chip key={mood.value} t={t} color={c} active={state.mood === mood.value}
                  ariaPressed={state.mood === mood.value}
                  onClick={() => setState((s) => ({ ...s, mood: s.mood === mood.value ? null : mood.value }))}>
                  {mood.label}
                </Chip>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {REFLECTION_PROMPTS.map((field) => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="placer-mono" htmlFor={`refl-${field.key}`}
                    style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
                    {field.label}
                  </label>
                  <textarea id={`refl-${field.key}`} rows={3} value={state.notes[field.key] || ''}
                    onChange={(e) => setState((s) => ({ ...s, notes: { ...s.notes, [field.key]: e.target.value } }))}
                    placeholder={field.placeholder} style={areaStyle(t)} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Btn t={t} variant="outline" size="sm" onClick={() => setPanel('choice')}>Back to sections</Btn>
              <Btn t={t} variant="primary" size="sm" icon="check" onClick={() => setPanel('export')}>Keep & export</Btn>
            </div>
          </Panel>
        )}

        {panel === 'others' && others && (
          <Panel t={t} title="Everyone's answers" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
              {others.people} {others.people === 1 ? 'person' : 'people'}
            </span>
          }>
            <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.6, marginBottom: 14 }}>
              What everybody who recorded their answers found at {site.name}, yours included. It
              updates as more people record theirs.
            </p>
            <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              Site survey — who said yes
            </span>
            <div style={{ marginTop: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
              {SURVEY_QUESTIONS.map((q) => (
                <Meter key={q.key} t={t} label={`${q.number}. ${q.label}`} color={q.kind === 'hindering' ? '#B3261E' : c}
                  value={others.answered[q.key] ? others.yes[q.key] / others.answered[q.key] : 0}
                  caption={`${others.yes[q.key]}/${others.answered[q.key]}`} />
              ))}
            </div>
            <span className="placer-mono" style={{ display: 'block', marginTop: 16, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              How it felt
            </span>
            <div style={{ marginTop: 10 }}>
              {REFLECTION_MOODS.map((mood) => {
                const felt = Object.values(others.moods).reduce((sum, n) => sum + n, 0);
                return (
                  <Meter key={mood.value} t={t} label={mood.label} color={c}
                    value={felt ? others.moods[mood.value] / felt : 0} caption={String(others.moods[mood.value])} />
                );
              })}
            </div>
            <span className="placer-mono" style={{ display: 'block', marginTop: 16, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              Markers on the map
            </span>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MAP_MARKERS.map((kind) => (
                <li key={kind.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.inkDim }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: kind.color, flex: '0 0 auto' }} />
                  {kind.label}
                  <div style={{ flex: 1 }} />
                  <span className="placer-mono">{others.markerCounts[kind.key]}</span>
                </li>
              ))}
            </ul>
            {REFLECTION_PROMPTS.some((field) => others.notes[field.key].length > 0) && (
              <>
                <span className="placer-mono" style={{ display: 'block', marginTop: 16, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
                  In their words
                </span>
                <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {REFLECTION_PROMPTS.filter((field) => others.notes[field.key].length > 0).map((field) => (
                    <div key={field.key}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginBottom: 6 }}>{field.label}</div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {others.notes[field.key].map((note, index) => (
                          <li key={index} style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55, padding: '8px 10px',
                            borderRadius: 10, background: t.surfaceAlt, overflowWrap: 'anywhere' }}>
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <Btn t={t} variant="outline" size="sm" onClick={() => setPanel('choice')}>Back to sections</Btn>
            </div>
          </Panel>
        )}

        {panel === 'export' && (
          <Panel t={t} title="Review & export">
            {rec && <div style={{ marginBottom: 16 }}>{recordControls}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: t.surfaceAlt, borderRadius: 12, padding: '12px 14px' }}>
                <Readout t={t} label="Survey" value={`${answered}/18`} tone={done ? c : undefined} />
              </div>
              <div style={{ background: t.surfaceAlt, borderRadius: 12, padding: '12px 14px' }}>
                <Readout t={t} label="Markers" value={placedTotal} />
              </div>
            </div>
            <div style={{ border: `1.5px solid ${t.line}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>
                Stay in touch about {site.name}? (optional)
              </div>
              <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.6, marginTop: 4, marginBottom: 12 }}>
                The survey is complete — this just lets the team invite you to follow-ups.
                Nothing is sent anywhere; details only leave with your download.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="placer-mono" htmlFor="contact-name" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
                    Name
                  </label>
                  <input id="contact-name" type="text" autoComplete="name" placeholder="Your name"
                    value={state.contact?.name || ''} onChange={(e) => setContact({ name: e.target.value })}
                    style={{ ...fieldStyle(t), marginTop: 6 }} />
                </div>
                <div>
                  <label className="placer-mono" htmlFor="contact-email" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
                    Email
                  </label>
                  <input id="contact-email" type="email" autoComplete="email" placeholder="you@example.org"
                    value={state.contact?.email || ''} onChange={(e) => setContact({ email: e.target.value })}
                    style={{ ...fieldStyle(t), marginTop: 6 }} />
                </div>
                <div>
                  <label className="placer-mono" htmlFor="contact-phone" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
                    Phone (optional)
                  </label>
                  <input id="contact-phone" type="tel" autoComplete="tel" placeholder="+49 …"
                    value={state.contact?.phone || ''} onChange={(e) => setContact({ phone: e.target.value })}
                    style={{ ...fieldStyle(t), marginTop: 6 }} />
                </div>
                {!isValidEmail(state.contact?.email) && (
                  <p role="alert" style={{ fontSize: 13, color: '#B3261E', margin: 0 }}>
                    That email does not look right — check for a missing @.
                  </p>
                )}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 500, color: t.ink, lineHeight: 1.5 }}>
                  <input type="checkbox" checked={state.contact?.consent === true}
                    onChange={(e) => setContact({ consent: e.target.checked })}
                    aria-label="Happy to be contacted about follow-ups"
                    style={{ width: 17, height: 17, marginTop: 2, accentColor: c }} />
                  Yes — I&apos;m happy to be contacted about follow-ups for this site.
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <Btn t={t} variant="primary" size="sm" onClick={() => download(`site-mapping-${site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`, buildJSON(site, state), 'application/json')}>
                Download JSON
              </Btn>
              <Btn t={t} variant="outline" size="sm" onClick={() => download(`site-mapping-${site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`, summary, 'text/plain')}>
                Download summary (.txt)
              </Btn>
              <CopyButton t={t} variant="quiet" size="sm" icon="send" label="Copy summary" copiedLabel="Summary copied"
                value={summary} fieldLabel="Your site summary" multiline />
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 320, overflow: 'auto',
              fontFamily: "'Space Mono', monospace", fontSize: 11.5, color: t.inkDim, lineHeight: 1.65,
              background: t.surfaceAlt, borderRadius: 12, padding: 12 }}>
              {summary}
            </pre>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Btn t={t} variant="ghost" size="sm" icon="trash" onClick={() => { if (window.confirm('Start over? Everything for this site will be cleared.')) reset(); }}>
                Start over
              </Btn>
            </div>
          </Panel>
        )}

        {/* Used on its own, the site and what was answered about it can be kept on the
            profile: the same answers a room would be sent, so never contact details. */}
        {panel === 'export' && !rec && onItsOwn(room) && (
          <KeepOnProfile t={t} tool={tool.id}
            intro="Save this site and your answers on your profile as an inquiry, to come back to later. Your contact details are not kept with it."
            inquiry={{
              title: site.name, note: '',
              config: { site: { name: site.name, point: { lat: site.lat, lng: site.lng } }, ...recorded },
            }} />
        )}

        {/* mini progress, always visible once loaded */}
        {panel !== 'export' && done && (
          <Panel t={t} title="Progress" style={{ padding: 16 }}>
            <p className="placer-mono" style={{ fontSize: 11, color: t.inkDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              18/18 · {placedTotal} markers · {reflected ? 'reflected' : 'no reflection yet'}
            </p>
            {rec && panel !== 'choice' && <div style={{ marginTop: 12 }}>{recordControls}</div>}
            <div style={{ marginTop: 10 }}>
              <Btn t={t} variant="quiet" size="sm" full onClick={() => setPanel('export')}>Finish & export data</Btn>
            </div>
          </Panel>
        )}

        {/* Everyone's answers, popping up once this person has recorded theirs. */}
        {tallyCard}
      </div>
    </div>
  );
}

export default SiteMapping;
