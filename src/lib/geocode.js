/* PLACER — turning a place written as text into a point on the map.
 *
 * Organisations say where they are in a free-text field ("Malmö", "Rosengård, Malmö"),
 * not as coordinates, so Explore asks Google's geocoder where that is before it can
 * pin one. The geocoder is rate limited and billed per request, and many organisations
 * share a town, so each distinct place is asked about once per page load, and the
 * answer — a miss included — is kept and handed to everyone who asks after.
 *
 * Needs the Maps JavaScript API already loaded (lib/googleMaps.js).
 */

const cache = new Map();

/** Strip what does not change the answer, so "Malmö " and "malmö" are one request. */
function keyFor(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The point `text` names, as { lat, lng }, or null when Google does not know it or
 * cannot be asked. Never rejects: a place that fails to geocode is a pin that is not
 * drawn, not a broken map.
 */
export function geocodePlace(text) {
  const key = keyFor(text ?? '');
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return cache.get(key);
  // Not cached: once Maps has loaded, the same place is worth asking about again.
  const Geocoder = window.google?.maps?.Geocoder;
  if (!Geocoder) return Promise.resolve(null);

  const pending = new Promise((resolve) => {
    try {
      new Geocoder().geocode({ address: text }, (results, status) => {
        const location = status === 'OK' ? results?.[0]?.geometry?.location : null;
        resolve(location ? { lat: location.lat(), lng: location.lng() } : null);
      });
    } catch (error) {
      console.error(`Could not geocode "${text}":`, error);
      resolve(null);
    }
  });

  cache.set(key, pending);
  return pending;
}

export function resetGeocodeCacheForTests() {
  cache.clear();
}
