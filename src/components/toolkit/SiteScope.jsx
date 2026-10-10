/* PLACER — Toolkit: the view of a site that a project fixes for Site-Specific Spatial
 * Mapping.
 *
 * SiteScopePicker is the organiser's half, in ConfigureToolDialog: search for the place,
 * then move and zoom the map until it frames the site. What the map shows when they
 * save is the scope — its bounds, plus its centre and zoom — and SiteView is everybody
 * else's half: the same view, fixed, that the tool's markers are placed over.
 *
 * Both are drawn at the tool's 10:7, so a scope framed in one fits the other exactly.
 */

import { useEffect, useRef, useState } from 'react';
import { PlaceSearch } from '../PlaceSearch';
import { addPlainMarker, createMap, toLngLat } from '../../lib/map';

export const SITE_ASPECT = '10 / 7';

// Close enough to frame a square or a park, with the streets around it.
const PLACE_ZOOM = 17;
const DEFAULT_CENTER = { lat: 52.5206, lng: 13.4095 };

/** What a map is showing, as a scope: { point, zoom, bounds }. */
function scopeOf(map) {
  const center = map.getCenter();
  const box = map.getBounds?.();
  return {
    point: { lat: center.lat, lng: center.lng },
    zoom: map.getZoom(),
    bounds: box ? [box.getWest(), box.getSouth(), box.getEast(), box.getNorth()] : null,
  };
}

/** Frame a map on a scope: its bounds when there are some, its centre and zoom otherwise. */
function frame(map, scope) {
  if (scope.bounds) {
    const [west, south, east, north] = scope.bounds;
    map.fitBounds([[west, south], [east, north]], { padding: 0, animate: false });
  } else {
    map.jumpTo({ center: toLngLat(scope.point), zoom: scope.zoom ?? PLACE_ZOOM });
  }
}

/**
 * The site's scope being chosen. `scope` is what was saved or framed so far, or null;
 * every pan, zoom and pick reports a new one through `onChange`. `address` and
 * `onAddress` are the search field's text, and `onPlace` hears of each place picked.
 */
export function SiteScopePicker({ t, scope, onChange, address, onAddress, onPlace, startAt = null, color, fieldStyle }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [pin, setPin] = useState(scope?.point ?? null);

  useEffect(() => {
    if (!mapEl.current) return undefined;
    let map;
    try {
      map = createMap(mapEl.current, {
        center: scope?.point ?? startAt ?? DEFAULT_CENTER,
        zoom: scope?.zoom ?? (startAt ? PLACE_ZOOM : 12),
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    mapRef.current = map;
    map.ready.then(() => {
      if (scope) frame(map, scope);
      // Only a map moved by the organiser is a scope they chose; one sitting on the
      // default city is not.
      map.on('moveend', () => onChange(scopeOf(map)));
    });
    map.on('error', (event) => {
      if (!map.isStyleLoaded()) {
        console.error('Could not load the map:', event?.error);
        setFailed(true);
      }
    });
    return () => {
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
    // Made once: the scope it reports is not fed back in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The place searched for keeps a pin, so the frame can be set around it.
  useEffect(() => {
    pinRef.current?.remove();
    pinRef.current = null;
    if (mapRef.current && pin) pinRef.current = addPlainMarker(mapRef.current, pin, { color });
  }, [pin, color]);

  const pick = (result) => {
    onAddress(result.label);
    setPin(result.point);
    // Reported straight away too, in case the map cannot report it.
    onChange({ point: result.point, zoom: PLACE_ZOOM, bounds: null });
    onPlace?.(result);
    mapRef.current?.jumpTo({ center: toLngLat(result.point), zoom: PLACE_ZOOM });
  };

  return (
    <div>
      <label htmlFor="site-scope-search"
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Search for the place *
      </label>
      <PlaceSearch id="site-scope-search" value={address} onChange={onAddress} onPick={pick}
        near={pin} placeholder="Square, park, address…" style={fieldStyle} />

      <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, margin: '20px 0 6px' }}>Frame the site *</div>
      <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
        Drag and zoom until the map shows the whole site. Everybody taking part sees it from exactly
        this view, and places their markers on it.
      </div>
      {failed ? (
        <p style={{ fontSize: 13, color: t.inkFaint, lineHeight: 1.6, margin: 0 }}>
          The map could not load. Picking the place from the suggestions still sets the site, at a
          few streets around it.
        </p>
      ) : (
        <div ref={mapEl} role="application" aria-label="The site's view. Drag and zoom to frame it."
          style={{ width: '100%', aspectRatio: SITE_ASPECT, borderRadius: 12, overflow: 'hidden',
            border: `1.5px solid ${t.line}`, background: t.surfaceAlt }} />
      )}
    </div>
  );
}

/**
 * A project's site, shown fixed in the view its organiser framed: no dragging, no
 * zooming, so that a marker placed at a spot on it means the same place to everybody.
 * Fills its container, which should be at SITE_ASPECT.
 */
export function SiteView({ scope, label }) {
  const mapEl = useRef(null);
  const key = JSON.stringify(scope);

  useEffect(() => {
    if (!mapEl.current || !scope?.point) return undefined;
    let map;
    try {
      map = createMap(mapEl.current, {
        center: scope.point, zoom: scope.zoom ?? PLACE_ZOOM, interactive: false, controls: false,
      });
    } catch {
      return undefined;
    }
    frame(map, scope);
    // Resized with the page, it keeps the same view rather than the same zoom.
    map.on('resize', () => frame(map, scope));
    return () => map.remove();
    // `key` stands for the scope, which may be a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={mapEl} role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }} />;
}
