/* A stand-in for maplibre-gl in tests, mocked in for every test by setup.js.
 *
 * jsdom has no WebGL, so the real library cannot draw. This keeps what tests look at:
 * where each map is centred, the sources and layers added to it, and its markers and
 * popups — which are put into the map's container as real elements, so a test can
 * find a pin by its role and name and click it the way a person would.
 *
 * `maps` is every map made since the last reset, newest last. `clickMap` and
 * `clickLayer` stand in for a click on the map's ground and on a drawn area.
 */

export const maps = [];

export function resetMaps() {
  maps.length = 0;
}

/** The map made most recently. */
export function lastMap() {
  return maps[maps.length - 1];
}

const toLngLatObject = (value) => (Array.isArray(value)
  ? { lng: value[0], lat: value[1] }
  : { lng: value.lng, lat: value.lat });

class FakeMap {
  constructor(options) {
    this.options = options;
    this.container = options.container;
    this.center = toLngLatObject(options.center);
    this.zoom = options.zoom;
    this.handlers = [];
    this.sources = new Map();
    this.layers = new Map();
    this.markers = [];
    this.popups = [];
    this.controls = [];
    this.loaded = false;
    this.removed = false;
    this.canvas = document.createElement('canvas');
    this.canvas.toDataURL = () => 'data:image/png;base64,MAP';
    maps.push(this);
    queueMicrotask(() => {
      if (this.removed) return;
      this.loaded = true;
      this.fire('load');
    });
  }

  on(type, layerOrListener, maybeListener) {
    const [layer, listener] = maybeListener ? [layerOrListener, maybeListener] : [null, layerOrListener];
    this.handlers.push({ type, layer, listener });
    return this;
  }

  once(type, listener) {
    const wrapped = (event) => {
      this.off(type, wrapped);
      listener(event);
    };
    return this.on(type, wrapped);
  }

  off(type, layerOrListener, maybeListener) {
    const [layer, listener] = maybeListener ? [layerOrListener, maybeListener] : [null, layerOrListener];
    this.handlers = this.handlers.filter((handler) =>
      !(handler.type === type && handler.layer === layer && handler.listener === listener));
    return this;
  }

  fire(type, event = {}, layer = null) {
    this.handlers
      .filter((handler) => handler.type === type && handler.layer === layer)
      .forEach((handler) => handler.listener({ type, target: this, ...event }));
  }

  addControl(control) { this.controls.push(control); return this; }
  getStyle() { return { layers: [] }; }
  setLayoutProperty() {}
  isStyleLoaded() { return this.loaded; }
  triggerRepaint() { queueMicrotask(() => this.fire('idle')); }

  addSource(id, source) { this.sources.set(id, source); }
  getSource(id) { return this.sources.get(id); }
  removeSource(id) { this.sources.delete(id); }
  addLayer(layer) { this.layers.set(layer.id, layer); }
  getLayer(id) { return this.layers.get(id); }
  removeLayer(id) { this.layers.delete(id); }

  // A test that wants a click to land on an area says which, through clickLayer.
  queryRenderedFeatures(point, { layers } = {}) {
    return this.hitLayer && layers?.includes(this.hitLayer) ? [{ id: 0 }] : [];
  }

  getCanvas() { return this.canvas; }
  getContainer() { return this.container; }
  getZoom() { return this.zoom; }
  getCenter() { return this.center; }
  // A small box around the centre, as a map's view would be.
  getBounds() {
    const { lng, lat } = this.center;
    return { getWest: () => lng - 0.01, getSouth: () => lat - 0.007, getEast: () => lng + 0.01, getNorth: () => lat + 0.007 };
  }
  panTo(center) { this.center = toLngLatObject(center); return this; }
  jumpTo({ center, zoom }) {
    if (center) this.center = toLngLatObject(center);
    if (zoom !== undefined) this.zoom = zoom;
    return this;
  }
  easeTo(options) { return this.jumpTo(options); }
  flyTo(options) { return this.jumpTo(options); }
  fitBounds(bounds) { this.bounds = bounds; return this; }
  remove() {
    this.removed = true;
    [...this.markers].forEach((marker) => marker.remove());
  }
}

class Marker {
  constructor({ element, color } = {}) {
    this.element = element ?? document.createElement('div');
    this.element.classList.add('maplibregl-marker');
    this.color = color;
  }

  setLngLat(lngLat) { this.lngLat = toLngLatObject(lngLat); return this; }
  getLngLat() { return this.lngLat; }
  getElement() { return this.element; }

  addTo(map) {
    this.map = map;
    map.markers.push(this);
    map.container?.appendChild?.(this.element);
    return this;
  }

  remove() {
    if (this.map) this.map.markers = this.map.markers.filter((marker) => marker !== this);
    this.element.remove();
    this.map = null;
    return this;
  }
}

class Popup {
  setLngLat(lngLat) { this.lngLat = toLngLatObject(lngLat); return this; }
  setDOMContent(node) { this.node = node; return this; }
  addTo(map) {
    map.popups.push(this);
    map.container?.appendChild?.(this.node);
    return this;
  }
  remove() { this.node?.remove(); return this; }
}

class NavigationControl {}

class LngLatBounds {
  constructor(sw, ne) { this.points = [sw, ne].map(toLngLatObject); }
  extend(point) { this.points.push(toLngLatObject(point)); return this; }
}

/** A click on the map's own ground at `point` ({ lat, lng }). */
export function clickMap(map, point) {
  map.hitLayer = null;
  map.fire('click', { lngLat: point, point: { x: 0, y: 0 }, originalEvent: { target: map.canvas } });
}

/** A click on feature `index` of the area layer `layerId`, as the map reports it. */
export function clickLayer(map, layerId, index = 0) {
  map.hitLayer = layerId;
  const event = { lngLat: { lat: 0, lng: 0 }, point: { x: 0, y: 0 }, features: [{ id: index }],
    originalEvent: { target: map.canvas } };
  map.fire('click', event);
  map.fire('click', event, layerId);
  map.hitLayer = null;
}

const maplibregl = { Map: FakeMap, Marker, Popup, NavigationControl, LngLatBounds };

export { FakeMap as Map, Marker, Popup, NavigationControl, LngLatBounds };
export default maplibregl;
