/* PLACER — draw the project's location as one or more shapes on a Google map.
 *
 * supabase/projects.sql used to say locations were "a plain array of place names, not
 * geocoded points... giving it real geometry is a feature of its own." This is that
 * feature: a polygon per area of interest, stored alongside (not instead of) the
 * free-text place names.
 *
 * The polygon tool is hand-rolled — click the map to place each vertex, then close the
 * shape — rather than built on the Maps JavaScript API's own Drawing Library, because
 * Google decommissioned that library in May 2026 (deprecated August 2025); see
 * https://developers.google.com/maps/deprecations. There is no drop-in replacement
 * (Google's own suggestion, Terra Draw, is a separate package this app does not
 * depend on), so drawing mode here is just: a draft google.maps.Polyline that grows by
 * one point per map click, finished into a real, editable google.maps.Polygon once it
 * has at least three.
 *
 * Semi-controlled, the same shape a file input is: `initialShapes` seeds the one piece
 * of state this owns, and `onChange` reports every edit back to the parent form. There
 * is no controlled `shapes` prop, because a Google Maps Polygon is a live, mutable
 * overlay object — re-deriving it from a prop on every parent render would mean either
 * fighting the overlay the user is mid-drag on, or throwing it away and rebuilding it,
 * neither of which a form field should do to what's on screen underneath a stroke.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn } from './UI';
import { googleMapsApiKey, loadGoogleMaps } from '../lib/googleMaps';
import { MAP_STYLE } from '../lib/mapStyle';

// Same default centre MapContainer opens on: STPLN, Malmöhusvägen 5, Malmö.
const DEFAULT_CENTER = { lat: 55.6054, lng: 12.9854 };

// A polygon needs at least this many points to enclose any area.
const MIN_POLYGON_POINTS = 3;

const pathToPoints = (polygon) =>
  polygon.getPath().getArray().map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));

/**
 * `initialShapes` is an array of `{ path: [{ lat, lng }, ...] }`, the same shape this
 * reports back through `onChange`. Read once, on mount — see the header.
 */
export function LocationMapPicker({ t, initialShapes = [], onChange = () => {} }) {
  const apiKey = googleMapsApiKey();
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const mapInitializedRef = useRef(false);
  const [googleLoaded, setGoogleLoaded] = useState(() => !!window.google?.maps);
  const [loadError, setLoadError] = useState(false);
  // { id, polygon } — the live overlays, kept in a ref because the polygon objects
  // themselves (not their coordinates) are what the map needs to draw and edit.
  const overlaysRef = useRef([]);
  const nextIdRef = useRef(0);
  // Mirrors overlaysRef as plain data, purely so the shape list below the map (and the
  // parent form, through onChange) has something to read without reaching into Maps
  // objects.
  const [shapes, setShapes] = useState([]);
  // Kept current every render so the Maps event listeners set up once, in the
  // init effect below, always call today's onChange rather than the one that
  // existed when they were attached.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // The shape being placed one click at a time. `drawingRef`/`draftPointsRef` are what
  // the map's click listener reads — it is attached once, in the init effect, so it can
  // only see today's state through refs, never through the closure it was created with.
  // `drawingMode`/`draftPoints` are the same data held in state, purely so the controls
  // below the map can render from it.
  const drawingRef = useRef(false);
  const draftPointsRef = useRef([]);
  const draftPolylineRef = useRef(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);

  const shapeStyle = {
    fillColor: t.accent,
    fillOpacity: 0.25,
    strokeColor: t.accent,
    strokeWeight: 2,
    editable: true,
    draggable: true,
  };

  const reportChange = () => {
    const next = overlaysRef.current.map(({ id, polygon }) => ({ id, path: pathToPoints(polygon) }));
    setShapes(next);
    onChangeRef.current(next.map(({ path }) => ({ path })));
  };

  const removeShape = (id) => {
    const found = overlaysRef.current.find((entry) => entry.id === id);
    found?.polygon.setMap(null);
    overlaysRef.current = overlaysRef.current.filter((entry) => entry.id !== id);
    reportChange();
  };

  const addOverlay = (polygon) => {
    const id = nextIdRef.current++;
    overlaysRef.current = [...overlaysRef.current, { id, polygon }];

    const path = polygon.getPath();
    path.addListener('set_at', reportChange);
    path.addListener('insert_at', reportChange);
    path.addListener('remove_at', reportChange);
    polygon.addListener('dragend', reportChange);

    reportChange();
  };

  // A map that is still draggable turns most clicks into a pan instead of a 'click'
  // event the moment the mouse moves even a pixel between down and up — which is how
  // DrawingManager used to get away with a plain click-to-place-a-vertex interaction.
  // Turning dragging off for the duration of drawing is what makes that work here too.
  const startDrawing = () => {
    draftPointsRef.current = [];
    drawingRef.current = true;
    setDraftPoints([]);
    setDrawingMode(true);
    draftPolylineRef.current?.setPath([]);
    mapObjRef.current?.setOptions({ draggable: false, draggableCursor: 'crosshair' });
  };

  const cancelDrawing = () => {
    drawingRef.current = false;
    draftPointsRef.current = [];
    setDrawingMode(false);
    setDraftPoints([]);
    draftPolylineRef.current?.setPath([]);
    mapObjRef.current?.setOptions({ draggable: true, draggableCursor: null });
  };

  const finishDrawing = () => {
    if (draftPointsRef.current.length < MIN_POLYGON_POINTS || !mapObjRef.current) return;
    const polygon = new window.google.maps.Polygon({ ...shapeStyle, paths: draftPointsRef.current });
    polygon.setMap(mapObjRef.current);
    addOverlay(polygon);
    cancelDrawing();
  };

  const handleMapClick = (event) => {
    if (!drawingRef.current) return;
    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
    draftPointsRef.current = [...draftPointsRef.current, point];
    setDraftPoints(draftPointsRef.current);
    draftPolylineRef.current?.setPath(draftPointsRef.current);
  };

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) setGoogleLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to load Google Maps script', error);
        if (!cancelled) setLoadError(true);
      });

    return () => { cancelled = true; };
  }, [apiKey]);

  // Init the map once, then seed whatever shapes the project already has.
  useEffect(() => {
    if (!googleLoaded || !mapRef.current || mapInitializedRef.current) return;

    const google = window.google;
    const initialWithPoints = initialShapes.filter((shape) => (shape?.path?.length ?? 0) >= MIN_POLYGON_POINTS);
    const center = initialWithPoints[0]?.path[0] ?? DEFAULT_CENTER;

    const googleMap = new google.maps.Map(mapRef.current, {
      center,
      zoom: initialWithPoints.length > 0 ? 15 : 12,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      styles: MAP_STYLE,
    });
    mapObjRef.current = googleMap;

    // The in-progress shape's outline, growing by one point per click. Not clickable,
    // so it never steals a click from the map underneath it while drawing.
    const draftPolyline = new google.maps.Polyline({
      path: [],
      strokeColor: t.accent,
      strokeWeight: 2,
      clickable: false,
    });
    draftPolyline.setMap(googleMap);
    draftPolylineRef.current = draftPolyline;

    googleMap.addListener('click', handleMapClick);

    for (const shape of initialWithPoints) {
      const polygon = new google.maps.Polygon({ ...shapeStyle, paths: shape.path });
      polygon.setMap(googleMap);
      addOverlay(polygon);
    }

    mapInitializedRef.current = true;
    // initialShapes is read once, on the deliberate init-only pass this effect is —
    // see the header on why this component is semi-controlled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleLoaded]);

  const canFinish = draftPoints.length >= MIN_POLYGON_POINTS;

  return (
    <div>
      {apiKey && !loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {!drawingMode && (
            <Btn t={t} variant="outline" size="sm" icon="pencil" onClick={startDrawing} disabled={!googleLoaded}>
              Draw shape
            </Btn>
          )}
          {drawingMode && (
            <>
              <span style={{ fontSize: 13.5, color: t.inkDim }}>
                Click the map to place points{draftPoints.length > 0 ? ` (${draftPoints.length})` : ''}.
              </span>
              <Btn t={t} variant="primary" size="sm" icon="check" onClick={finishDrawing} disabled={!canFinish}>
                Finish shape
              </Btn>
              <Btn t={t} variant="ghost" size="sm" icon="close" onClick={cancelDrawing}>
                Cancel
              </Btn>
            </>
          )}
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', height: 360, borderRadius: 8,
        overflow: 'hidden', border: `1.5px solid ${t.line}`, background: t.chrome }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {(!apiKey || loadError) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 20, textAlign: 'center', background: t.chrome }}>
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5 }}>
              {apiKey
                ? 'Could not load Google Maps. Try again in a moment.'
                : 'Add a Google Maps API key to draw the location on a map.'}
            </p>
          </div>
        )}
      </div>

      {shapes.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex',
          flexDirection: 'column', gap: 6 }}>
          {shapes.map((shape, i) => (
            <li key={shape.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 8, background: t.chrome, fontSize: 13.5, color: t.ink }}>
              <span>Shape {i + 1} · {shape.path.length} points</span>
              <Btn t={t} variant="ghost" size="sm" icon="trash"
                ariaLabel={`Remove shape ${i + 1}`}
                onClick={() => removeShape(shape.id)}>
                Remove
              </Btn>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LocationMapPicker;
