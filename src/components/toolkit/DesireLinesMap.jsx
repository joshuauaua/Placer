/* PLACER — Toolkit: the map Desire Lines are drawn on.
 *
 * An OpenStreetMap view of the site with the walks laid over it as lines: what others
 * drew, faint, so that where many walked it darkens; and one's own, each walk in a colour
 * of its own (`color` on its runs), solid where it follows what others drew and dashed
 * where it goes its own way.
 *
 * Drawing is switched on with `mode`. 'freehand' takes a drag across the map as a walk
 * and ends it on release; 'points' takes a tap as one more point of a walk, for a
 * steadier line or a finger that is not. While either is on, dragging no longer moves
 * the map — 'move' hands it back. The walk being drawn is `draft`, held by the caller,
 * who gets every change through `onDraft` and the finished walk (freehand) through
 * `onFinish`.
 *
 * Elements — entrances, obstacles, anything else — are pins on the map, each with the
 * initial of its kind and its name for a tooltip. 'place' takes a tap as one placed,
 * through `onPlace`. Fixed ones (the organiser's) are larger, and other people's smaller
 * and fainter, so whose is whose can be told.
 *
 * Lines are lib/desireLines.js's [lng, lat] points, as MapLibre takes them.
 */

import { useEffect, useRef } from 'react';
import { addPin, createMap, openPopup } from '../../lib/map';
import { frame } from './SiteScope';

const SOURCES = ['others', 'aligned', 'differs', 'draft'];
const TAP_PIXELS = 5;

// A ring to draw with in place of the map's hand: dark, with a pale edge so it shows on
// both the paper-coloured ground and the water and parks.
const RING_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="4" fill="none" '
  + 'stroke="#FFFFFF" stroke-width="3"/><circle cx="8" cy="8" r="4" fill="none" stroke="#111111" stroke-width="1.5"/></svg>',
)}") 8 8, crosshair`;

// Each line is a list of points, or { points, color } to draw it in a colour of its own.
const collection = (lines) => ({
  type: 'FeatureCollection',
  features: lines
    .map((line) => (Array.isArray(line) ? { points: line } : line))
    .filter(({ points }) => points.length >= 2)
    .map(({ points, color }) => ({
      type: 'Feature', properties: { color: color ?? null }, geometry: { type: 'LineString', coordinates: points },
    })),
});

// Set a source's lines, adding the source the first time.
function setLines(map, id, lines) {
  const data = collection(lines);
  const source = map.getSource(id);
  if (source) source.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

function addLayers(map, colors) {
  const line = (id, paint) => {
    if (map.getLayer(id)) return;
    map.addLayer({ id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint });
  };
  line('others', { 'line-color': colors.others, 'line-width': 5, 'line-opacity': 0.22 });
  // Each walk has its own colour, from its feature; where it leaves what others drew it goes dashed.
  const walk = ['coalesce', ['get', 'color'], colors.aligned];
  line('differs', { 'line-color': walk, 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1.5, 1.5] });
  line('aligned', { 'line-color': walk, 'line-width': 4, 'line-opacity': 0.9 });
  line('draft', { 'line-color': walk, 'line-width': 3, 'line-dasharray': [1.5, 1.5] });
}

/**
 * `scope` is the view to open on ({ point, zoom, bounds }), `others` the paths drawn by
 * other people, `runs` this person's own as [{ points, aligned }] (see compare in
 * lib/desireLines.js) and `draft` the points of the walk being drawn.
 */
export function DesireLinesMap({
  t, scope, colors, others, runs, draft, mode, onDraft, onFinish, label, elements = [], onPlace, draftColor,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const stroke = useRef(null);
  const scopeKey = JSON.stringify(scope);
  // Read inside the pointer handlers and the map's callbacks, which are set up once.
  const live = useRef({});
  live.current = { mode, draft, onDraft, onFinish, onPlace, others, runs, draftColor };

  const paint = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const { others: theirs, runs: mine, draft: drawing } = live.current;
    setLines(map, 'others', theirs.map((path) => path.points));
    setLines(map, 'aligned', mine.filter((run) => run.aligned));
    setLines(map, 'differs', mine.filter((run) => !run.aligned));
    setLines(map, 'draft', [{ points: drawing, color: live.current.draftColor }]);
  };

  useEffect(() => {
    if (!mapEl.current || !scope?.point) return undefined;
    let map;
    try {
      map = createMap(mapEl.current, { center: scope.point, zoom: scope.zoom ?? 17 });
    } catch {
      return undefined;
    }
    mapRef.current = map;
    readyRef.current = false;
    map.ready.then(() => {
      frame(map, scope);
      SOURCES.forEach((id) => setLines(map, id, []));
      addLayers(map, colors);
      readyRef.current = true;
      paint();
    });
    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // Made once per site; the lines come in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(paint, [others, runs, draft]);

  // The elements as pins. They can go on before the map's style has loaded.
  const pinsKey = JSON.stringify(elements);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const pins = elements.map((element) => {
      const size = element.tone === 'fixed' ? 28 : element.tone === 'others' ? 16 : 22;
      const pin = addPin(map, { lat: element.point[1], lng: element.point[0] }, {
        title: element.name, fill: colors[element.type] ?? colors.other, ring: '#FFFFFF', size, ringWidth: 2,
      });
      Object.assign(pin.getElement().style, {
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF',
        fontSize: `${Math.round(size * 0.5)}px`, fontWeight: 700, opacity: element.tone === 'others' ? 0.6 : 1,
      });
      const el = pin.getElement();
      el.textContent = element.initial;
      // The browser's own tooltip is slow and plain; a popup with the description replaces it.
      el.removeAttribute('title');
      let popup = null;
      const show = () => {
        const card = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = element.name;
        card.append(name);
        if (element.note) {
          const note = document.createElement('p');
          note.textContent = element.note;
          note.style.cssText = 'margin:4px 0 0;font-size:13px;line-height:1.4;max-width:220px;';
          card.append(note);
        }
        card.style.cssText = 'font-family:var(--placer-font);font-size:13px;color:#111111;';
        popup = openPopup(map, { lat: element.point[1], lng: element.point[0] }, card);
      };
      const hide = () => { popup?.remove(); popup = null; };
      el.addEventListener('mouseenter', show);
      el.addEventListener('mouseleave', hide);
      pin.hidePopup = hide;
      return pin;
    });
    return () => pins.forEach((pin) => { pin.hidePopup(); pin.remove(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, scopeKey]);

  // Dragging moves the map only when nobody is drawing, and the pointer is a ring then
  // rather than the map's hand.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode === 'move') map.dragPan?.enable();
    else map.dragPan?.disable();
    map.getCanvas().style.cursor = mode === 'move' ? '' : RING_CURSOR;
  }, [mode, scopeKey]);

  const pointOf = (event) => {
    const rect = mapEl.current.getBoundingClientRect();
    const position = [event.clientX - rect.left, event.clientY - rect.top];
    const { lng, lat } = mapRef.current.unproject(position);
    return { position, point: [lng, lat] };
  };

  const down = (event) => {
    if (live.current.mode === 'move' || !mapRef.current
      || event.target.closest?.('.maplibregl-ctrl, .maplibregl-marker')) return;
    const { position, point } = pointOf(event);
    stroke.current = { from: position, points: [point], moved: false };
    mapEl.current.setPointerCapture?.(event.pointerId);
  };

  const move = (event) => {
    const current = stroke.current;
    if (!current) return;
    const { position, point } = pointOf(event);
    if (Math.hypot(position[0] - current.from[0], position[1] - current.from[1]) > TAP_PIXELS) current.moved = true;
    if (live.current.mode !== 'freehand' || !current.moved) return;
    current.points.push(point);
    live.current.onDraft(current.points.slice());
  };

  const up = (event) => {
    const current = stroke.current;
    stroke.current = null;
    if (!current) return;
    const { point } = pointOf(event);
    if (live.current.mode === 'place') {
      if (!current.moved) live.current.onPlace?.(point);
    } else if (live.current.mode === 'points') {
      if (!current.moved) live.current.onDraft([...live.current.draft, point]);
    } else if (current.moved) {
      live.current.onFinish([...current.points, point]);
    }
  };

  return (
    <div ref={mapEl} role="application" aria-label={label} className="placer-desire-map"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { stroke.current = null; }}
      style={{ borderRadius: 12, overflow: 'hidden',
        border: `1.5px solid ${t.line}`, background: t.surfaceAlt, touchAction: mode === 'move' ? 'auto' : 'none' }} />
  );
}

export default DesireLinesMap;
