/* PLACER — Google's Maps JavaScript API, loaded once, for Street View only.
 *
 * Every map in the app is OpenStreetMap's (lib/map.js). Street View is the one thing
 * OpenStreetMap has nothing like, so the imagination flow (MapContainer) still opens
 * Google's panorama over the map, and captures it through the Street View Static API
 * (lib/staticMaps.js). Both need VITE_GOOGLE_MAPS_API_KEY; without it the map works
 * and Street View is simply not offered.
 *
 * The API refuses to be loaded twice: a second <script src="maps.googleapis.com/maps/api/js...">
 * throws "You have included the Google Maps JavaScript API multiple times", so whoever asks
 * first loads it, and every later caller — even one that starts before the first has
 * finished — gets back that same in-flight promise rather than a second script tag.
 */

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
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
