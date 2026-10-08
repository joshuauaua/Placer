/* PLACER — the map every view draws on: OpenStreetMap, through MapLibre.
 *
 * Tiles are OpenFreeMap's vector tiles of OpenStreetMap data (openfreemap.org) — no
 * key, no account and no request quota, so a map is there whether or not anything is
 * configured. Its Positron style is already the pale ground the brand kit asks for;
 * `quieten` below takes the rest of the way there, switching off the points of
 * interest so the character-coloured pins and areas are the only colour on screen.
 *
 * MapLibre takes [lng, lat] where the rest of the app keeps { lat, lng } — toLngLat
 * and fromLngLat are the one place that is translated.
 *
 * Google is still used for one thing, Street View, which OpenStreetMap has nothing
 * like: see lib/googleMaps.js and MapContainer.
 */

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const MAP_STYLE_URL = import.meta.env?.VITE_MAP_STYLE_URL
  || 'https://tiles.openfreemap.org/styles/positron';

/** { lat, lng } → MapLibre's [lng, lat]. */
export const toLngLat = (point) => [point.lng, point.lat];

/** MapLibre's LngLat (or anything with lng/lat) → { lat, lng }. */
export const fromLngLat = (lngLat) => ({ lat: lngLat.lat, lng: lngLat.lng });

// The layers that hold the map's own colour: shop and station icons, house numbers.
// Off, the same as the Google style this replaces had them.
const QUIET_LAYER = /(^|_)poi(_|$)|housenum|transit|aerialway/i;

function quieten(map) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (QUIET_LAYER.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
  }
}

/**
 * A map in `container`, opening on `center` ({ lat, lng }) at `zoom`. Anything else is
 * passed to MapLibre as it is — `interactive: false` for a picture of a place, say.
 *
 * `map.ready` resolves once the style has loaded, which is when sources and layers
 * can be added; markers can go on straight away.
 */
export function createMap(container, { center, zoom, controls = true, ...options }) {
  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE_URL,
    center: toLngLat(center),
    zoom,
    attributionControl: { compact: true },
    // So the canvas can still be read after it is drawn: capturing the map as the
    // background of an imagination (MapContainer) reads it.
    canvasContextAttributes: { preserveDrawingBuffer: true },
    ...options,
  });
  map.ready = new Promise((resolve) => {
    map.once('load', () => {
      quieten(map);
      resolve(map);
    });
  });
  if (controls) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  return map;
}

/**
 * A round pin, in the brand kit's style: a circle of `fill` with a `ringWidth` ring of
 * `ring`. Returned as the marker's element so it can be restyled in place —
 * see stylePin.
 */
function pinElement(style) {
  const element = document.createElement('div');
  stylePin(element, style);
  return element;
}

/** Restyle a pin made by addPin, to enlarge a picked one, say. */
export function stylePin(element, { fill, ring, size = 22, ringWidth = 2, zIndex = 1 }) {
  Object.assign(element.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    boxSizing: 'border-box',
    background: fill,
    border: `${ringWidth}px solid ${ring}`,
    zIndex: String(zIndex),
  });
}

/**
 * A pin on `map` at `position`, styled as stylePin says, calling `onClick` when it is
 * clicked. `title` is its tooltip and its accessible name. Returns the MapLibre Marker;
 * `marker.remove()` takes it off.
 */
export function addPin(map, position, { title, onClick, ...style }) {
  const element = pinElement(style);
  if (title) {
    element.title = title;
    element.setAttribute('aria-label', title);
  }
  if (onClick) {
    element.setAttribute('role', 'button');
    element.style.cursor = 'pointer';
    element.tabIndex = 0;
    element.addEventListener('click', onClick);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(event);
      }
    });
  }
  return new maplibregl.Marker({ element }).setLngLat(toLngLat(position)).addTo(map);
}

/** MapLibre's own teardrop marker, for "this is the spot you chose". */
export function addPlainMarker(map, position, { color } = {}) {
  return new maplibregl.Marker({ color }).setLngLat(toLngLat(position)).addTo(map);
}

/** A small popup on `map` at `position` holding `node`, a DOM node. */
export function openPopup(map, position, node) {
  return new maplibregl.Popup({ offset: 14, closeButton: false })
    .setLngLat(toLngLat(position))
    .setDOMContent(node)
    .addTo(map);
}

// A polygon's ring has to end where it starts.
function closedRing(path) {
  const ring = path.map(toLngLat);
  const [first] = ring;
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return ring;
}

// The area layers a click on the map should count as landing on something — see
// onBackgroundClick. Kept per map.
const clickableLayers = new WeakMap();

function clickable(map) {
  if (!clickableLayers.has(map)) clickableLayers.set(map, new Set());
  return clickableLayers.get(map);
}

/**
 * Draw `areas` on `map` as filled outlines under the id `id` (one source, a fill and a
 * line layer). Each area is { path: [{ lat, lng }, ...], fill, stroke }, and anything
 * else on it comes back through `onClick(area)` when it is clicked. Areas with fewer
 * than three points are skipped. Returns a function that takes them all off again.
 */
export function showAreas(map, id, areas, { fillOpacity = 0.4, onClick } = {}) {
  const drawn = areas.filter((area) => (area?.path?.length ?? 0) >= 3);
  const fillId = `${id}-fill`;
  const lineId = `${id}-line`;
  let removed = false;

  const data = {
    type: 'FeatureCollection',
    features: drawn.map((area, index) => ({
      type: 'Feature',
      id: index,
      properties: { fill: area.fill, stroke: area.stroke },
      geometry: { type: 'Polygon', coordinates: [closedRing(area.path)] },
    })),
  };

  const handleClick = (event) => {
    const index = event.features?.[0]?.id;
    if (index !== undefined && drawn[index]) onClick(drawn[index]);
  };
  const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
  const noPointer = () => { map.getCanvas().style.cursor = ''; };

  map.ready.then(() => {
    if (removed) return;
    map.addSource(id, { type: 'geojson', data });
    map.addLayer({ id: fillId, type: 'fill', source: id,
      paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': fillOpacity } });
    map.addLayer({ id: lineId, type: 'line', source: id,
      paint: { 'line-color': ['get', 'stroke'], 'line-width': 2 } });
    if (onClick) {
      clickable(map).add(fillId);
      map.on('click', fillId, handleClick);
      map.on('mouseenter', fillId, pointer);
      map.on('mouseleave', fillId, noPointer);
    }
  });

  return () => {
    removed = true;
    clickable(map).delete(fillId);
    // The map may already be gone — removed with its page — and with it the style.
    try {
      if (onClick) {
        map.off('click', fillId, handleClick);
        map.off('mouseenter', fillId, pointer);
        map.off('mouseleave', fillId, noPointer);
      }
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getSource(id)) map.removeSource(id);
    } catch {
      // Nothing left to take off.
    }
  };
}

/**
 * Call `handler(point)` for a click on the map itself — not on a pin and not on a
 * clickable area — with the { lat, lng } clicked. MapLibre reports a click on a pin or
 * an area as a click on the map too, so without this, picking a pin would also be read
 * as clicking away from it. Returns a function that stops listening.
 */
export function onBackgroundClick(map, handler) {
  const listener = (event) => {
    if (event.originalEvent?.target?.closest?.('.maplibregl-marker')) return;
    const layers = [...clickable(map)].filter((layerId) => map.getLayer(layerId));
    if (layers.length > 0 && map.queryRenderedFeatures(event.point, { layers }).length > 0) return;
    handler(fromLngLat(event.lngLat), event);
  };
  map.on('click', listener);
  return () => map.off('click', listener);
}

/** Frame every point in `points` ({ lat, lng }), with `padding` pixels to spare. */
export function fitPoints(map, points, { padding = 40, maxZoom = 17, animate = false } = {}) {
  if (points.length === 0) return;
  const bounds = new maplibregl.LngLatBounds(toLngLat(points[0]), toLngLat(points[0]));
  points.forEach((point) => bounds.extend(toLngLat(point)));
  map.fitBounds(bounds, { padding, maxZoom, animate });
}

/** A link to `point` on openstreetmap.org, for "open in a map". */
export function osmUrl({ lat, lng }, zoom = 18) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
