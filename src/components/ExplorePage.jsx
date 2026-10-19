/* PLACER — Explore, at /explore: what is going on in the places around you.
 *
 * The map sits in a frame with a header of its own: the search in the middle, and at
 * the left a dropdown choosing what the map shows, which doubles as its legend. Once
 * something is picked, on the map or from the search, a card over the map's left edge
 * previews it, with a link through to its page and a Save, which is a follow
 * (services/follows.js) worded for keeping a place.
 *
 * Projects are drawn where they have outlined themselves, the same outline their own
 * page shows, with a pin in the middle so a small one can still be found zoomed out.
 * Organisations are pinned at the address they chose from the suggestions on their
 * setup form; one saved without that point is pinned wherever OpenStreetMap places its
 * address or town — see lib/geocode.js. The map is OpenStreetMap's, through lib/map.js. Case studies have nowhere to come from yet
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
import { PALETTE, THEME } from '../theme';
import { geocodePlace } from '../lib/geocode';
import { addPin, createMap, onBackgroundClick, showAreas, stylePin, toLngLat } from '../lib/map';
import { spreadPins } from '../lib/pinSpread';
import { isSupabaseConfigured, readMapProjects } from '../services/projects';
import { readMapOrganisations } from '../services/organisations';

// Each layer in its own theme colour: projects blue, the same as their outline
// everywhere else; case studies orange; organisations purple.
// Pins are the 100 with a 2px ring in the 700, areas the 300 outlined in the 700.
export const LAYERS = [
  { key: 'projects', label: 'Projects', kind: 'project', colour: PALETTE.blue },
  { key: 'caseStudies', label: 'Case studies', kind: 'caseStudy', colour: PALETTE.orange, soon: true },
  { key: 'organisations', label: 'Organisations', kind: 'organisation', colour: PALETTE.purple },
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

function pinStyle(colour, selected) {
  return {
    size: selected ? 26 : 18,
    fill: selected ? colour.c300 : colour.c100,
    ring: colour.c700,
    ringWidth: selected ? 3 : 2,
    zIndex: selected ? 2 : 1,
  };
}

/** What the map shows, as a dropdown off a pill in the frame's header. It stays open
 * while layers are ticked on and off; a click elsewhere or Escape closes it. */
function FilterMenu({ t, shown, counts, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="placer-explore-filter-menu">
      <button type="button" onClick={() => setOpen((was) => !was)} aria-expanded={open}
        aria-controls="explore-filter-panel" aria-label="Show on the map"
        className="placer-explore-filter-button"
        style={{ border: `1px solid ${t.ink}`, background: t.surface, color: t.ink }}>
        <Icon name="layers" size={16} stroke={2} />
        <span className="placer-explore-filter-label">Show on the map</span>
        <Icon name={open ? 'chevUp' : 'chevDown'} size={16} stroke={2.2} />
      </button>
      {open && (
        <div id="explore-filter-panel" role="group" aria-label="Show on the map"
          className="placer-explore-filter-panel"
          style={{ background: t.surface, border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
          {LAYERS.map((layer) => {
            const on = !layer.soon && shown[layer.key];
            return (
              <label key={layer.key} className="placer-explore-filter"
                style={{ cursor: layer.soon ? 'not-allowed' : 'pointer', color: layer.soon ? t.inkFaint : t.ink }}>
                <input type="checkbox" checked={on} disabled={layer.soon}
                  onChange={() => onToggle(layer.key)} />
                <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', flex: '0 0 auto',
                  background: layer.colour.c100, border: `2px solid ${layer.colour.c700}`,
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
      )}
    </div>
  );
}

function PreviewCard({ t, place, accountId, onSignIn, onOpen }) {
  const layer = LAYERS.find(({ kind }) => kind === place.kind);
  const kindName = KIND_NAMES[place.kind];

  return (
    <section className="placer-explore-card placer-explore-preview" aria-label="Selected place"
      style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '16 / 9', background: layer.colour.c50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: layer.colour.c700 }}>
        {place.image
          ? <img src={place.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <Icon name={place.kind === 'organisation' ? 'building' : 'pin'} size={32} stroke={1.8} />}
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13,
          color: t.inkDim, marginBottom: 8 }}>
          <span className="placer-mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 999, background: layer.colour.c100, color: layer.colour.c900 }}>
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
          // The full height of the box keeps the caret clear of the rounded corners every
          // input gets from index.css, which would clip it at the start of the line.
          style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', background: 'transparent', outline: 'none',
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
                    background: layer.colour.c100, border: `2px solid ${layer.colour.c700}` }} />
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

export function ExplorePage({ homeCenter = null, accountId = null, onSignIn,
  onOpenProject, onOpenOrganisation }) {
  const t = THEME;
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [projects, setProjects] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [shown, setShown] = useState({ projects: true, organisations: true });
  const [selected, setSelected] = useState(null);
  // Each pin's element, by `${kind}-${id}`, so picking one can enlarge it without
  // redrawing the rest.
  const markersRef = useRef(new Map());

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const centre = hasCoords(homeCenter) ? homeCenter : DEFAULT_CENTER;
    try {
      const osmMap = createMap(mapRef.current, {
        center: centre,
        zoom: hasCoords(homeCenter) ? HOME_ZOOM : DEFAULT_ZOOM,
      });
      // A click on the map rather than on something drawn on it puts the preview away.
      onBackgroundClick(osmMap, () => setSelected(null));
      setMap(osmMap);
      return () => osmMap.remove();
    } catch (error) {
      console.error('Error initializing maps:', error);
      return undefined;
    }
    // homeCenter only seeds where the map opens; the map is made once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Organisations without a point get one from the geocoder: from the address
  // when there is one, which is the more exact of the two, or else the town. Each is
  // set as it comes back, so one slow or unknown place does not hold up the rest.
  const organisationCount = organisations.length;
  useEffect(() => {
    if (organisationCount === 0) return undefined;
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
  }, [organisationCount]);

  const visible = useMemo(() => [
    ...(shown.projects ? projects : []),
    ...(shown.organisations ? organisations : []),
  ].filter((place) => hasCoords(place.position)), [shown, projects, organisations]);

  // Draw what is switched on: a pin each, and for a project its outline too.
  useEffect(() => {
    if (!map) return undefined;
    const markers = markersRef.current;
    const pick = (place) => {
      setSelected(place);
      map.panTo(toLngLat(place.position));
    };

    const areas = visible.flatMap((place) => {
      const { colour } = LAYERS.find(({ kind }) => kind === place.kind);
      return (place.shapes ?? []).map((shape) => ({
        path: shape?.path ?? [], fill: colour.c300, stroke: colour.c700, place,
      }));
    });
    const removeAreas = showAreas(map, 'explore-areas', areas,
      { fillOpacity: 0.35, onClick: (area) => pick(area.place) });

    // A project and an organisation at one address are drawn side by side, not on top
    // of each other.
    const offsets = spreadPins(visible.map((place) => place.position));
    const pins = visible.map((place, i) => {
      const { colour } = LAYERS.find(({ kind }) => kind === place.kind);
      const marker = addPin(map, place.position, {
        ...pinStyle(colour, false), title: place.title, onClick: () => pick(place), offset: offsets[i],
      });
      markers.set(`${place.kind}-${place.id}`, marker.getElement());
      return marker;
    });

    return () => {
      removeAreas();
      pins.forEach((marker) => marker.remove());
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
    const element = key && markersRef.current.get(key);
    if (!element) return undefined;
    const { colour } = LAYERS.find(({ kind }) => kind === selected.kind);
    stylePin(element, pinStyle(colour, true));
    return () => stylePin(element, pinStyle(colour, false));
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
      map.easeTo({ center: toLngLat(place.position), zoom: ITEM_ZOOM });
    }
  };

  const goToPlace = async (text) => {
    const position = await geocodePlace(text);
    if (!position || !map) return;
    map.easeTo({ center: toLngLat(position), zoom: PLACE_ZOOM });
  };

  const openPlace = (place) => {
    if (place.kind === 'project') onOpenProject?.(place.id);
    else onOpenOrganisation?.(place.id);
  };

  return (
    <div className="placer-explore" style={{ background: t.page }}>
      <PageHeader t={t} title="Explore" inset={32} maxWidth="none" style={{ marginBottom: 24 }} />
      <div className="placer-explore-frame" style={{ borderColor: t.line }}>
        {/* The frame's own header: what to show at its left, the search in its middle. */}
        <div className="placer-explore-bar" style={{ borderColor: t.line, background: t.surface }}>
          <FilterMenu t={t} shown={shown}
            counts={{ projects: projects.length, organisations: organisations.length }}
            onToggle={(key) => setShown((current) => ({ ...current, [key]: !current[key] }))} />
          <ExploreSearch t={t} places={[...projects, ...organisations]} onPick={pickFromSearch} onPlace={goToPlace} />
        </div>
        <div className="placer-explore-map" style={{ background: t.surfaceAlt }}>
          <div ref={mapRef} data-testid="explore-map" style={{ position: 'absolute', inset: 0 }} />
        </div>
        {/* Only once something is picked: over the map's left edge from 1024px, and
            under the map on a narrower screen, where there is no room beside it. */}
        {selected && (
          <aside className="placer-explore-side">
            <PreviewCard t={t} place={selected} accountId={accountId} onSignIn={onSignIn} onOpen={openPlace} />
          </aside>
        )}
      </div>
    </div>
  );
}

export default ExplorePage;
