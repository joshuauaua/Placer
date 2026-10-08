/* PLACER — places written as text, and where they are.
 *
 * Both address suggestions as somebody types (PlaceSearch) and turning a saved place
 * name into a point (Explore pins organisations that never picked an address this
 * way) go to Photon, the OpenStreetMap geocoder komoot runs (photon.komoot.io). It
 * needs no key; it does ask for fair use, which is why suggestions wait for a pause in
 * the typing, and why each distinct place is only ever looked up once per page load
 * — the answer, a miss included, is kept and handed to everyone who asks after.
 * VITE_GEOCODER_URL points this at another Photon, such as one of our own.
 */

const GEOCODER_URL = (import.meta.env?.VITE_GEOCODER_URL || 'https://photon.komoot.io').replace(/\/$/, '');

// Photon's types for a town, city or region rather than a street or a building: what
// Settings' location asks for, since it is shown on a public profile.
const REGION_TYPES = new Set(['city', 'district', 'locality', 'county', 'state', 'country']);

/** "Malmö, Sweden" for a Photon result's properties, or one of the two, or ''. */
export function townAndCountry(properties = {}) {
  const town = (properties.type === 'city' ? properties.name : '')
    || properties.city || properties.county || properties.state || '';
  const country = properties.country || '';
  // A city-state's town and country can share a name ("Singapore, Singapore").
  return [town, country !== town ? country : ''].filter(Boolean).join(', ');
}

/** One line for a result, the way an address is written: name, street, town, country. */
function labelFor(properties) {
  const street = [properties.street, properties.housenumber].filter(Boolean).join(' ');
  const town = [properties.postcode, properties.city].filter(Boolean).join(' ');
  const parts = [properties.name, street, town, properties.state, properties.country].filter(Boolean);
  // A street's own name is also its street; say it once.
  return parts.filter((part, index) => parts.indexOf(part) === index).join(', ');
}

function toResult(feature) {
  const [lng, lat] = feature?.geometry?.coordinates ?? [];
  const properties = feature?.properties ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    label: labelFor(properties),
    name: properties.name || '',
    point: { lat, lng },
    townAndCountry: townAndCountry(properties),
    type: properties.type || '',
  };
}

/**
 * Places matching `query`, best first, as { label, name, point, townAndCountry, type }.
 * `regions` keeps only towns, cities and regions. `near` ({ lat, lng }) prefers results
 * close to it. Rejects when Photon cannot be reached; an AbortSignal can cancel it.
 */
export async function searchPlaces(query, { regions = false, near = null, limit = 6, signal } = {}) {
  const text = (query ?? '').trim();
  if (!text) return [];
  // In English, the language the app is written in: otherwise Photon names places in
  // the local language ("Sverige"), and a town and country saved to a profile would read
  // differently from one place to the next.
  const params = new URLSearchParams({ q: text, limit: String(regions ? limit * 3 : limit), lang: 'en' });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  const response = await fetch(`${GEOCODER_URL}/api/?${params}`, { signal });
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);
  const body = await response.json();
  return (body?.features ?? [])
    .map(toResult)
    .filter(Boolean)
    .filter((result) => !regions || REGION_TYPES.has(result.type))
    .slice(0, limit);
}

const cache = new Map();

/** Strip what does not change the answer, so "Malmö " and "malmö" are one request. */
function keyFor(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The point `text` names, as { lat, lng }, or null when it is not known or the
 * geocoder cannot be asked. Never rejects: a place that fails to geocode is a pin that
 * is not drawn, not a broken map.
 */
export function geocodePlace(text) {
  const key = keyFor(text ?? '');
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return cache.get(key);

  const pending = searchPlaces(text, { limit: 1 })
    .then((results) => results[0]?.point ?? null)
    .catch((error) => {
      console.error(`Could not geocode "${text}":`, error);
      // Not kept: a failure to reach the geocoder is worth asking about again later.
      cache.delete(key);
      return null;
    });

  cache.set(key, pending);
  return pending;
}

export function resetGeocodeCacheForTests() {
  cache.clear();
}
