/* PLACER — Explore, at /explore: what is going on in the places around you.
 *
 * The map sits in a frame, with two cards floating over its left edge. The first
 * chooses what the map shows, and doubles as its legend; the second previews whatever
 * was picked on the map or from the search box in the frame's header, with a link through to its page and a Save,
 * which is a follow (services/follows.js) worded for keeping a place.
 *
 * Projects are drawn where they have outlined themselves, the same outline their own
 * page shows, with a pin in the middle so a small one can still be found zoomed out.
 * Organisations are pinned at the address they chose from the suggestions on their
 * setup form; one saved without that point is pinned wherever Google places its address
 * or town — see lib/geocode.js. Case studies have nowhere to come from yet
 * and wait as a filter that cannot be turned on.
 *
 * Imaginations are not here: they have their own map, MapContainer, which is also where
 * a new one is started from.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { FollowButton } from './FollowButton';
import { PageHeader } from './PageHeader';
import { CHARACTER, THEME } from '../theme';
import { loadGoogleMaps } from '../lib/googleMaps';
import { geocodePlace } from '../lib/geocode';
import { MAP_STYLE } from '../lib/mapStyle';
import { isSupabaseConfigured, readMapProjects } from '../services/projects';
import { readMapOrganisations } from '../services/organisations';

// Each layer in a character's colours: projects are run by the city, so blue, the same
// as their outline everywhere else; organisations are the practitioners, so purple.
// Pins are the 100 with a 2px ring in the 700, areas the 300 outlined in the 700.
export const LAYERS = [
  { key: 'projects', label: 'Projects', kind: 'project', character: CHARACTER.cityWorker },
  { key: 'caseStudies', label: 'Case studies', kind: 'caseStudy', character: CHARACTER.citizen, soon: true },
  { key: 'organisations', label: 'Organisations', kind: 'organisation', character: CHARACTER.practitioner },
];

const KIND_NAMES = { project: 'Project', organisation: 'Organisation', caseStudy: 'Case study' };

// STPLN, Malmöhusvägen 5, Malmö — where MapContainer opens too.
const DEFAULT_CENTER = { lat: 55.6054, lng: 12.9854 };
const DEFAULT_ZOOM = 13;
const HOME_ZOOM = 12;
const ITEM_ZOOM = 15;
const PLACE_ZOOM = 14;
const MAX_RESULTS = 6;

const hasCoords = (position) => Number.isFinite(position?.lat) && Number.isFinite(position?.lng);

/** The middle of a project's first outline: where its pin goes. */
export function shapeCentre(shapes) {
  const path = (shapes ?? []).find((shape) => (shape?.path?.length ?? 0) >= 3)?.path;
  if (!path) return null;
  const sum = path.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 });
  return { lat: sum.lat / path.length, lng: sum.lng / path.length };
}

/** The first sentence of a description, which is as much as a preview has room for. */
function shortLine(text) {
  const trimmed = (text ?? '').trim().replace(/\s+/g, ' ');
  const sentence = /^.+?[.!?](?=\s|$)/.exec(trimmed)?.[0] ?? trimmed;
  return sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}…` : sentence;
}

/** Everything the map can show, in one shape, so the preview and search need not care which. */
function toPlace(kind, item, position) {
  return kind === 'project'
    ? { kind, id: item.id, title: item.name, image: item.image, position,
      location: (item.locations ?? []).join(', '), line: shortLine(item.summary || item.description),
      href: `/projects/${encodeURIComponent(item.id)}`, shapes: item.locationShapes }
    : { kind, id: item.id, title: item.name, image: item.cover, position,
      location: item.location, address: item.address, line: shortLine(item.description),
      href: `/organisations/${encodeURIComponent(item.id)}` };
}

function pinIcon(character, selected) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: selected ? 13 : 9,
    fillColor: selected ? character.c300 : character.c100,
    fillOpacity: 1,
    strokeColor: character.c700,
    strokeWeight: selected ? 3 : 2,
  };
}

function FilterCard({ t, shown, counts, onToggle }) {
  return (
    <section className="placer-explore-card" aria-labelledby="explore-filter-heading">
      <h2 id="explore-filter-heading" style={{ fontSize: 18, fontWeight: 700, color: t.ink }}>Show on the map</h2>
      <p style={{ fontSize: 14, color: t.inkDim, marginTop: 4, marginBottom: 16 }}>
        Find the places that interest you
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {LAYERS.map((layer) => {
          const on = !layer.soon && shown[layer.key];
          return (
            <label key={layer.key} className="placer-explore-filter"
              style={{ cursor: layer.soon ? 'not-allowed' : 'pointer', color: layer.soon ? t.inkFaint : t.ink }}>
              <input type="checkbox" checked={on} disabled={layer.soon}
                onChange={() => onToggle(layer.key)} />
              <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', flex: '0 0 auto',
                background: layer.character.c100, border: `2px solid ${layer.character.c700}`,
                opacity: layer.soon ? 0.4 : 1 }} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{layer.label}</span>
              {layer.soon
                ? <span className="placer-mono" style={{ fontSize: 11, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: t.inkFaint }}>Coming soon</span>
                : <span style={{ fontSize: 13, color: t.inkDim }}>{counts[layer.key] ?? 0}</span>}
            </label>
          );
        })}
      </div>
    </section>
  );
}

function PreviewCard({ t, place, accountId, onSignIn, onOpen }) {
  if (!place) {
    return (
      <section className="placer-explore-card" aria-label="Selected place"
        style={{ color: t.inkDim, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="pin" size={18} stroke={2} />
        Pick something on the map, or search for it, to see it here.
      </section>
    );
  }

  const layer = LAYERS.find(({ kind }) => kind === place.kind);
  const kindName = KIND_NAMES[place.kind];

  return (
    <section className="placer-explore-card placer-explore-preview" aria-label="Selected place"
      style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '16 / 9', background: layer.character.c50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: layer.character.c700 }}>
        {place.image
          ? <img src={place.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <Icon name={place.kind === 'organisation' ? 'building' : 'pin'} size={32} stroke={1.8} />}
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13,
          color: t.inkDim, marginBottom: 8 }}>
          <span className="placer-mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 999, background: layer.character.c100, color: layer.character.c900 }}>
            {kindName}
          </span>
          {place.location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <Icon name="pin" size={13} stroke={2} />
              {place.location}
            </span>
          )}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: t.ink, lineHeight: 1.25 }}>{place.title}</h2>
        {place.line && (
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.5, marginTop: 6 }}>{place.line}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          marginTop: 16, flexWrap: 'wrap' }}>
          <a href={place.href} className="placer-explore-link"
            onClick={(e) => {
              // An ordinary link for a new tab or a copied address; a plain click
              // stays in the app.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onOpen(place);
            }}>
            View {kindName.toLowerCase()}
            <Icon name="arrowRight" size={15} stroke={2.2} />
          </a>
          {accountId
            ? <FollowButton t={t} type={place.kind} targetId={place.id} label={place.title} size="sm" saveLabels />
            : <Btn t={t} size="sm" icon="bookmark" onClick={onSignIn}>Save</Btn>}
        </div>
      </div>
    </section>
  );
}

function ExploreSearch({ t, places, onPick, onPlace }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const trimmed = query.trim();
  const matches = useMemo(() => {
    if (!trimmed) return [];
    const needle = trimmed.toLowerCase();
    return places
      .filter((place) => `${place.title} ${place.location}`.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS);
  }, [places, trimmed]);
  // Matches first, then the words themselves as somewhere to go.
  const options = trimmed ? [...matches, { kind: 'address', id: 'address', title: trimmed }] : [];

  const choose = (option) => {
    setOpen(false);
    if (option.kind === 'address') onPlace(option.title);
    else {
      setQuery(option.title);
      onPick(option);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' && options.length) {
      e.preventDefault();
      choose(options[Math.min(active, options.length - 1)]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const listOpen = open && options.length > 0;

  return (
    <div className="placer-explore-search">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 14px',
        borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface }}>
        <Icon name="search" size={17} stroke={2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
        <input type="search" role="combobox" aria-label="Search Explore"
          aria-expanded={listOpen} aria-controls="explore-search-results" aria-autocomplete="list"
          aria-activedescendant={listOpen ? `explore-option-${active}` : undefined}
          placeholder="Search projects, organisations or a place…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none',
            fontFamily: 'var(--placer-font)', fontSize: 14, fontWeight: 500, color: t.ink }} />
      </div>
      {listOpen && (
        <ul id="explore-search-results" role="listbox" aria-label="Search results" className="placer-explore-results">
          {options.map((option, index) => {
            const layer = LAYERS.find(({ kind }) => kind === option.kind);
            return (
              <li key={`${option.kind}-${option.id}`} id={`explore-option-${index}`} role="option"
                aria-selected={index === active}
                // Before the input's blur, which would close the list first.
                onMouseDown={(e) => { e.preventDefault(); choose(option); }}
                onMouseEnter={() => setActive(index)}
                style={{ background: index === active ? t.surfaceAlt : 'transparent' }}>
                {layer
                  ? <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', flex: '0 0 auto',
                    background: layer.character.c100, border: `2px solid ${layer.character.c700}` }} />
                  : <Icon name="crosshair" size={15} stroke={2} style={{ color: t.inkDim, flex: '0 0 auto' }} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500, color: t.ink }}>
                    {layer ? option.title : `Go to “${option.title}”`}
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim }}>
                    {layer ? [KIND_NAMES[option.kind], option.location].filter(Boolean).join(' · ') : 'A place on the map'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ExplorePage({ apiKey = '', homeCenter = null, accountId = null, onSignIn,
  onOpenProject, onOpenOrganisation }) {
  const t = THEME;
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [googleLoaded, setGoogleLoaded] = useState(() => !!window.google);
  const [projects, setProjects] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [shown, setShown] = useState({ projects: true, organisations: true });
  const [selected, setSelected] = useState(null);
  // Each pin, by `${kind}-${id}`, so picking one can enlarge it without redrawing the rest.
  const markersRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => { if (!cancelled) setGoogleLoaded(true); })
      .catch((error) => console.error('Failed to load Google Maps script', error));
    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    if (!googleLoaded || !mapRef.current) return undefined;
    const centre = hasCoords(homeCenter) ? homeCenter : DEFAULT_CENTER;
    try {
      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: centre,
        zoom: hasCoords(homeCenter) ? HOME_ZOOM : DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: MAP_STYLE,
      });
      // A click on the map rather than on something drawn on it puts the preview away.
      const clicks = googleMap.addListener('click', () => setSelected(null));
      setMap(googleMap);
      // Only this listener. Clearing every listener on the map would take Google's own
      // with it, and the map would stop drawing its tiles.
      return () => clicks.remove();
    } catch (error) {
      console.error('Error initializing maps:', error);
      return undefined;
    }
    // homeCenter only seeds where the map opens; the map is made once, when Maps loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleLoaded]);

  // Both are public reads, but both need a Supabase project to read from.
  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;
    readMapProjects()
      .then((rows) => {
        // An outline, where one was drawn; otherwise the point of its address.
        if (!cancelled) {
          setProjects(rows.map((row) => toPlace('project', row, shapeCentre(row.locationShapes) ?? row.locationPoint)));
        }
      })
      .catch((error) => console.error('Could not load projects for the map:', error));
    readMapOrganisations()
      // An organisation with a chosen address already has its point; the rest are
      // geocoded below.
      .then((rows) => { if (!cancelled) setOrganisations(rows.map((row) => toPlace('organisation', row, row.locationPoint))); })
      .catch((error) => console.error('Could not load organisations for the map:', error));
    return () => { cancelled = true; };
  }, []);

  // Organisations without a point get one once Maps is there to ask: from the address
  // when there is one, which is the more exact of the two, or else the town. Each is
  // set as it comes back, so one slow or unknown place does not hold up the rest.
  const organisationCount = organisations.length;
  useEffect(() => {
    if (!googleLoaded || organisationCount === 0) return undefined;
    let cancelled = false;
    organisations.forEach((organisation) => {
      if (organisation.position) return;
      geocodePlace(organisation.address || organisation.location).then((position) => {
        if (cancelled || !position) return;
        setOrganisations((current) => current.map((item) =>
          (item.id === organisation.id ? { ...item, position } : item)));
      });
    });
    return () => { cancelled = true; };
    // Re-run for a new list, not for each point it fills in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleLoaded, organisationCount]);

  const visible = useMemo(() => [
    ...(shown.projects ? projects : []),
    ...(shown.organisations ? organisations : []),
  ].filter((place) => hasCoords(place.position)), [shown, projects, organisations]);

  // Draw what is switched on: a pin each, and for a project its outline too.
  useEffect(() => {
    if (!map || !window.google) return undefined;
    const overlays = [];
    const markers = markersRef.current;

    visible.forEach((place) => {
      const { character } = LAYERS.find(({ kind }) => kind === place.kind);
      const pick = () => {
        setSelected(place);
        map.panTo(place.position);
      };

      (place.shapes ?? []).filter((shape) => (shape?.path?.length ?? 0) >= 3).forEach((shape) => {
        const polygon = new window.google.maps.Polygon({
          paths: shape.path, map, clickable: true,
          fillColor: character.c300, fillOpacity: 0.35, strokeColor: character.c700, strokeWeight: 2,
        });
        polygon.addListener('click', pick);
        overlays.push(polygon);
      });

      const marker = new window.google.maps.Marker({
        position: place.position, map, title: place.title, icon: pinIcon(character, false), zIndex: 10,
      });
      marker.addListener('click', pick);
      markers.set(`${place.kind}-${place.id}`, marker);
      overlays.push(marker);
    });

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null));
      markers.clear();
    };
  }, [map, visible]);

  // A picked place's pin is drawn larger, and a hidden layer cannot stay picked.
  useEffect(() => {
    if (selected && !visible.some((place) => place.kind === selected.kind && place.id === selected.id)
      && hasCoords(selected.position)) {
      setSelected(null);
      return undefined;
    }
    const key = selected && `${selected.kind}-${selected.id}`;
    const marker = key && markersRef.current.get(key);
    if (!marker) return undefined;
    const { character } = LAYERS.find(({ kind }) => kind === selected.kind);
    marker.setIcon?.(pinIcon(character, true));
    marker.setZIndex?.(20);
    return () => {
      marker.setIcon?.(pinIcon(character, false));
      marker.setZIndex?.(10);
    };
  }, [selected, visible]);

  useEffect(() => {
    if (!selected) return undefined;
    const handleKeyDown = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const pickFromSearch = (place) => {
    // Searching for something in a hidden layer turns that layer back on.
    const layer = LAYERS.find(({ kind }) => kind === place.kind);
    setShown((current) => ({ ...current, [layer.key]: true }));
    setSelected(place);
    if (map && hasCoords(place.position)) {
      map.panTo(place.position);
      map.setZoom(ITEM_ZOOM);
    }
  };

  const goToPlace = async (text) => {
    const position = await geocodePlace(text);
    if (!position || !map) return;
    map.panTo(position);
    map.setZoom(PLACE_ZOOM);
  };

  const openPlace = (place) => {
    if (place.kind === 'project') onOpenProject?.(place.id);
    else onOpenOrganisation?.(place.id);
  };

  return (
    <div className="placer-explore" style={{ background: t.page }}>
      <PageHeader t={t} title="Explore" inset={32} maxWidth="none" style={{ marginBottom: 24 }} />
      <div className="placer-explore-frame" style={{ borderColor: t.line }}>
        {/* The frame's own header, with the search at its left end. */}
        <div className="placer-explore-bar" style={{ borderColor: t.line, background: t.surface }}>
          <ExploreSearch t={t} places={[...projects, ...organisations]} onPick={pickFromSearch} onPlace={goToPlace} />
        </div>
        <div className="placer-explore-map" style={{ background: t.surfaceAlt }}>
          <div ref={mapRef} data-testid="explore-map" style={{ position: 'absolute', inset: 0 }} />
        </div>
        {/* Over the map's left edge from 1024px; under the map on a narrower screen,
            where there is no room beside it. */}
        <aside className="placer-explore-side">
          <FilterCard t={t} shown={shown}
            counts={{ projects: projects.length, organisations: organisations.length }}
            onToggle={(key) => setShown((current) => ({ ...current, [key]: !current[key] }))} />
          <PreviewCard t={t} place={selected} accountId={accountId} onSignIn={onSignIn} onOpen={openPlace} />
        </aside>
        {!apiKey && (
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, background: t.surface,
            borderLeft: `4px solid ${t.ink}`, padding: 16, boxShadow: t.shadow }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>Google Maps API Key Required</p>
            <p style={{ fontSize: 14 }}>Add your API key to .env to enable map functionality.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExplorePage;
