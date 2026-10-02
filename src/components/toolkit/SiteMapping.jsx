/* PLACER — Toolkit: Site-Specific Spatial Mapping Tool.
 *
 * Pick a site on a Google Map (with geolocation + Places search when an API
 * key is configured), tell us a little about yourself, answer eighteen ordered
 * questions as a stack of cards, then optionally map markers, reflect, and
 * leave contact details for follow-up. Without an API key the picker falls
 * back to coordinates + presets — the survey never depends on the map tiles.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Panel, Readout } from '../ToolLayout';
import { Btn, Chip, CopyButton } from '../UI';
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
  googleMapsUrl,
  hasReflection,
  hinderingCount,
  invitingCount,
  isSurveyComplete,
  isValidEmail,
  markerCounts,
  parseSiteSearch,
  placeMarker,
  removeMarker,
} from '../../lib/toolkit/siteMapping';

const MAPS_API_KEY = (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const DEFAULT_CENTER = { lat: 52.5206, lng: 13.4095 };

function loadGoogleMaps(apiKey) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  const existing = document.querySelector('script[data-placer-maps]');
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      if (window.google?.maps) resolve(true);
    });
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.dataset.placerMaps = 'true';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

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

export function SiteMapping({ t, tool }) {
  const c = tool.color;
  const [site, setSite] = useState(null);
  const [siteName, setSiteName] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [picked, setPicked] = useState(null);
  const [placeLabel, setPlaceLabel] = useState('');
  const [mapsReady, setMapsReady] = useState(() => !!window.google?.maps);
  const [mapFailed, setMapFailed] = useState(false);
  const [geoState, setGeoState] = useState('idle');
  const [geoMessage, setGeoMessage] = useState('');
  const [searchError, setSearchError] = useState('');
  const [state, setState] = useState(() => emptyState());
  const [cardIndex, setCardIndex] = useState(0);
  const [panel, setPanel] = useState('survey');
  const [selectedMarker, setSelectedMarker] = useState(MAP_MARKERS[0].key);
  const mapEl = useRef(null);
  const searchEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Load the Maps script for the site picker only — the survey itself never
  // needs it, so a missing key degrades to coordinates + presets, not a block.
  useEffect(() => {
    if (site || !MAPS_API_KEY || window.google?.maps) {
      if (window.google?.maps) setMapsReady(true);
      return;
    }
    let cancelled = false;
    loadGoogleMaps(MAPS_API_KEY).then((ok) => {
      if (cancelled) return;
      setMapsReady(ok);
      setMapFailed(!ok);
    });
    return () => { cancelled = true; };
  }, [site]);

  // Stand up the picker map once, then keep it — clicks choose the site.
  useEffect(() => {
    if (site || !mapsReady || !window.google?.maps || !mapEl.current || mapRef.current) return;
    try {
      const map = new window.google.maps.Map(mapEl.current, {
        center: picked || DEFAULT_CENTER,
        zoom: picked ? 16 : 12,
        mapTypeControl: false,
        streetViewControl: false,
      });
      map.addListener('click', (e) => {
        if (!e.latLng) return;
        const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setPicked(coords);
        setPlaceLabel('');
        setSiteSearch(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
      });
      mapRef.current = map;
    } catch {
      setMapFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, mapsReady]);

  // Keep one pin on the picked spot.
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    if (!picked) return;
    markerRef.current = new window.google.maps.Marker({
      position: picked,
      map: mapRef.current,
      title: 'Chosen site',
    });
    mapRef.current.panTo(picked);
  }, [picked]);

  // Places search — progressive enhancement; the coordinate field always works.
  useEffect(() => {
    if (site || !mapsReady || !window.google?.maps?.places || !searchEl.current) return;
    let autocomplete;
    try {
      autocomplete = new window.google.maps.places.Autocomplete(searchEl.current, {
        fields: ['geometry', 'formatted_address', 'name'],
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        const coords = { lat: loc.lat(), lng: loc.lng() };
        setPicked(coords);
        setPlaceLabel(place.name || place.formatted_address || '');
        setSiteSearch(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        if (place.name && !siteName) setSiteName(place.name);
        mapRef.current?.setCenter(coords);
        mapRef.current?.setZoom(16);
      });
    } catch {
      return undefined;
    }
    return () => {
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, mapsReady]);

  // Reset the picker map handle when leaving the site, so "Change site"
  // rebuilds it cleanly instead of reusing a detached div.
  useEffect(() => {
    if (!site) {
      mapRef.current = null;
      markerRef.current = null;
    }
  }, [site]);

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
        if (mapRef.current) {
          mapRef.current.setCenter(coords);
          mapRef.current.setZoom(16);
        }
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
  const mapsUrl = site ? googleMapsUrl(site) : null;
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
    setSiteSearch('');
    setGeoState('idle');
    setGeoMessage('');
  }

  const contact = state.contact || {};
  const emailOk = isValidEmail(contact.email);

  // ——— Phase 0: no site yet — map-based picker + who you are ———
  if (!site) {
    const showMap = MAPS_API_KEY && !mapFailed;
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
            <input id="site-place-search" ref={searchEl} type="text" placeholder="Square, park, address…"
              style={{ ...fieldStyle(t), marginTop: 6 }} />
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
              {MAPS_API_KEY
                ? 'The map could not load — search or coordinates below still work.'
                : 'Map tiles need a Google Maps key (VITE_GOOGLE_MAPS_API_KEY). Coordinates and presets below still work.'}
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
          <div style={{ marginTop: 22, borderTop: `1px solid ${t.line}`, paddingTop: 16 }}>
            <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
              About you — optional, helps read the answers
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
              Stays in this browser — it only leaves with your download if you export.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  // ——— Site loaded: map + side box ———
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: 20, alignItems: 'start' }}>
      {/* Left: the site map */}
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
          style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.line}`, background: t.surfaceAlt, cursor: panel === 'spatial' ? 'crosshair' : 'default' }}>
          <svg viewBox="0 0 100 70" style={{ width: '100%', display: 'block' }} role="img"
            aria-label={`Schematic plan of ${site.name} with ${placedTotal} placed markers`}>
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
          {panel === 'spatial'
            ? `Placing “${MAP_MARKERS.find((k) => k.key === selectedMarker).label}” — click the map, or drag the icon onto it. ${placedTotal} placed.`
            : `${answered}/18 questions · ${placedTotal} markers · ${reflected ? 'reflection noted' : 'no reflection yet'}`}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, fontWeight: 700, color: c }}>
              Open this site in Google Maps ↗
            </a>
          )}
          <div style={{ flex: 1 }} />
          <Btn t={t} variant="ghost" size="sm" icon="pencil" onClick={() => setSite(null)}>Change site</Btn>
        </div>
        {panel === 'spatial' && placedTotal > 0 && (
          <ul style={{ listStyle: 'none', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
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

        {panel === 'export' && (
          <Panel t={t} title="Review & export">
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

        {/* mini progress, always visible once loaded */}
        {panel !== 'export' && done && (
          <Panel t={t} title="Progress" style={{ padding: 16 }}>
            <p className="placer-mono" style={{ fontSize: 11, color: t.inkDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              18/18 · {placedTotal} markers · {reflected ? 'reflected' : 'no reflection yet'}
            </p>
            <div style={{ marginTop: 10 }}>
              <Btn t={t} variant="quiet" size="sm" full onClick={() => setPanel('export')}>Finish & export data</Btn>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

export default SiteMapping;
