/* PLACER — shared Playwright fixtures.
 *
 * Two things every spec wants, and one that only the create flow does:
 *
 *  - Nothing leaves the machine. Every request to a host other than the preview
 *    server is aborted, so a test can never pass or fail on Google's or
 *    PostHog's availability. `externalRequests` collects what was attempted, for
 *    the specs that want to assert on it.
 *  - The cookie banner is pre-decided. .env.e2e configures PostHog so that
 *    e2e/consent.e2e.js has a banner to test, which means every other spec would
 *    otherwise get one floating over the footer and the map controls — the same
 *    collision src/test/setup.js works around for the unit tests. Those specs
 *    inherit a recorded "denied"; the consent spec sets `consent: null` to be
 *    asked properly.
 *  - `googleMaps: true` installs a stub of the small slice of the Maps JS API
 *    that MapContainer uses, so the create flow is reachable without a key.
 */

import { test as base, expect } from '@playwright/test'

/** Where src/analytics.js records the visitor's choice. */
export const CONSENT_KEY = 'placer_analytics_consent'
/** Where src/services/api.js keeps posted imaginations. */
export const IMAGINATIONS_KEY = 'placemaking_imaginations'

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])

/** Whether a request is being served by the preview server rather than the internet. */
function isLocal(url) {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol === 'data:' || protocol === 'blob:' || protocol === 'about:') return true
    return LOCAL_HOSTNAMES.has(hostname)
  } catch {
    // Not a URL this test has any business letting through.
    return false
  }
}

export const test = base.extend({
  /**
   * The consent decision to seed before the app loads: 'denied' (the default),
   * 'granted', or null to arrive undecided and be shown the banner.
   */
  consent: ['denied', { option: true }],

  /** Set true to run with a stubbed Google Maps JS API in place. */
  googleMaps: [false, { option: true }],

  /**
   * Hosts a spec tried to reach and was stopped from reaching. Auto-used, so the
   * block is in place whether or not a spec asks for the list.
   */
  externalRequests: [
    async ({ page }, use) => {
      const attempted = []
      await page.route('**/*', (route) => {
        const url = route.request().url()
        if (isLocal(url)) return route.continue()
        attempted.push(url)
        return route.abort('blockedbyclient')
      })
      await use(attempted)
    },
    { auto: true },
  ],

  // Both of the below write into the page before any navigation, which is what
  // addInitScript guarantees: it runs on every document, ahead of the app's own
  // scripts.
  seedConsent: [
    async ({ page, consent }, use) => {
      if (consent) {
        await page.addInitScript(
          ([key, decision]) => {
            window.localStorage.setItem(key, decision)
          },
          [CONSENT_KEY, consent],
        )
      }
      await use(consent)
    },
    { auto: true },
  ],

  seedGoogleMaps: [
    async ({ page, googleMaps }, use) => {
      if (googleMaps) await page.addInitScript(googleMapsStub)
      await use(googleMaps)
    },
    { auto: true },
  ],
})

export { expect }

/**
 * A stand-in for the Maps JS API, injected before the app boots.
 *
 * MapContainer checks `window.google` before appending Google's script tag and
 * returns early when it is already there, so defining this is also what keeps the
 * request to maps.googleapis.com from being made at all.
 *
 * The panorama reports itself hidden, which is the honest answer for a map that
 * was never really loaded — and it sends handleCaptureView down its
 * html-to-image path, capturing the DOM instead of asking Google's servers for a
 * Street View frame. That is the branch a keyless environment can actually run.
 *
 * Runs in the browser as a plain function: init scripts are serialised and
 * evaluated outside the module graph, so nothing here can be imported.
 */
function googleMapsStub() {
  const listen = (store) => (event, handler) => {
    store[event] = handler
    return { remove: () => delete store[event] }
  }

  // Named apart from the globals they stand in for, so nothing in this scope
  // shadows window.Map.
  class GoogleMap {
    constructor(container, options = {}) {
      this._container = container
      this._listeners = {}
      this._zoom = options.zoom ?? 15
      this._center = options.center ?? null
      this.addListener = listen(this._listeners)
    }
    getStreetView() {
      return {
        getVisible: () => false,
        getPosition: () => null,
        getPov: () => ({ heading: 0, pitch: 0 }),
        getZoom: () => 1,
      }
    }
    getZoom() {
      return this._zoom
    }
    setZoom(zoom) {
      this._zoom = zoom
    }
    setCenter(center) {
      this._center = center
    }
    panTo(center) {
      this._center = center
    }
  }

  class GoogleMarker {
    constructor(options = {}) {
      Object.assign(this, options)
      this._listeners = {}
      this.addListener = listen(this._listeners)
    }
    setMap(map) {
      this.map = map
    }
  }

  class Autocomplete {
    constructor(input, options = {}) {
      this._input = input
      this._options = options
      this._listeners = {}
      this.addListener = listen(this._listeners)
    }
    getPlace() {
      return {}
    }
  }

  window.google = {
    maps: {
      Map: GoogleMap,
      Marker: GoogleMarker,
      SymbolPath: { CIRCLE: 'circle' },
      event: { clearInstanceListeners: () => {} },
      places: { Autocomplete },
    },
  }
}
