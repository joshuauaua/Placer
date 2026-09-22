/* PLACER — one Google Maps JS API script, shared by every consumer.
 *
 * The API refuses to be loaded twice: a second <script src="maps.googleapis.com/maps/api/js...">
 * throws "You have included the Google Maps JavaScript API multiple times", and — because this is
 * a single-page app where views mount and unmount without a reload (MapContainer on the community
 * map, LocationMapPicker on project setup) — two components each injecting their own tag with a
 * different `libraries=` list is exactly how that happens. Every consumer asks for the same fixed
 * set (LIBRARIES below) through the loader here instead, so whichever mounts first is the one that
 * decides what loads, and every later caller — even one that starts before the first has finished —
 * gets back that same in-flight promise rather than a second script tag.
 */

// The union of what any consumer needs: 'places' for address search (MapContainer,
// LocationMapPicker). The location-outline polygon tool (LocationMapPicker) used to add
// 'drawing' here for the Drawing Library, but Google decommissioned that library in May
// 2026 — see LocationMapPicker's header for what draws the polygon now.
const LIBRARIES = 'places';

export function isGoogleMapsConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
}

export function googleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

let loadPromise = null;

/** The shared `google` global, loaded once no matter how many components ask for it. */
export function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${LIBRARIES}`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      // A failed load must not be cached — the next mount that asks gets a fresh attempt
      // rather than being stuck replaying a rejected promise forever.
      loadPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Test-only: the cache above is module-level and outlives any one component, which is the
// whole point of it in the app — but it also outlives a single `it()` block, so a test that
// renders a consumer with no window.google needs this to see the script-injecting path again
// rather than a promise a previous test left pending. Not for use outside tests.
export function resetGoogleMapsLoaderForTests() {
  loadPromise = null;
}
