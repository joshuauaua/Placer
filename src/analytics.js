/* PLOT — PostHog analytics, gated on the visitor's cookie consent.
 *
 * PostHog is not loaded at all until the visitor accepts on the cookie banner:
 * no request leaves the browser, no cookie is written, no session is recorded.
 * Everything that touches PostHog's consent API lives here; the rest of the app
 * only ever calls posthog.capture(), which is a no-op until then.
 */

import posthog from 'posthog-js';

// Where the decision is remembered. Deliberately outside the STORAGE_KEYS map in
// services/api.js, so "erase my data" does not wipe the record of a choice the
// visitor has to be able to rely on — the GDPR page changes it explicitly.
export const CONSENT_KEY = 'plot_analytics_consent';
export const GRANTED = 'granted';
export const DENIED = 'denied';

// Whether posthog.init() has run in this page load.
let started = false;

// Read at call time rather than module load so tests can stub the environment.
export function isAnalyticsConfigured() {
  return Boolean(import.meta.env.VITE_POSTHOG_KEY && import.meta.env.VITE_POSTHOG_HOST);
}

/** The stored decision, or null if the visitor has not been asked yet. */
export function readConsent() {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === GRANTED || stored === DENIED ? stored : null;
  } catch {
    // Storage blocked (private mode, cookies disabled). Treat as undecided —
    // the banner shows again, and analytics stay off.
    return null;
  }
}

function writeConsent(decision) {
  try {
    localStorage.setItem(CONSENT_KEY, decision);
  } catch {
    // Nothing to do: without storage the decision holds for this page load only.
  }
}

// Only ever called once consent is known to be granted.
function startPostHog({ recordConsentEvent }) {
  if (started || !isAnalyticsConfigured()) return;
  started = true;

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    defaults: '2026-05-30',
    // Start opted out even here, so that opting in below is the one switch that
    // turns capture on. That also clears an opt-out flag left in storage by an
    // earlier withdrawal, which would otherwise silently outlive a re-accept.
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    // Keep the opt-in/out flag itself out of a cookie.
    opt_out_capturing_persistence_type: 'localStorage',
  });

  // PostHog's default $opt_in event is the audit trail for the consent, so it is
  // captured when consent is given — but not again on the page loads that follow.
  if (recordConsentEvent) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_in_capturing({ captureEventName: false });
  }

  // The automatic init-time pageview is dropped while opted out, so without this
  // the session would have no entry page.
  posthog.capture('$pageview');
}

/** Called once on boot. Loads PostHog only for a visitor who already accepted. */
export function initAnalytics() {
  if (!isAnalyticsConfigured()) {
    if (import.meta.env.DEV) {
      console.error(
        'VITE_POSTHOG_KEY and VITE_POSTHOG_HOST are required by PostHog but are missing or un-configured. ' +
        'This causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY and VITE_POSTHOG_HOST are configured.'
      );
    }
    return;
  }

  if (readConsent() === GRANTED) {
    startPostHog({ recordConsentEvent: false });
  }
}

/** Accept analytics: remember it, then start capturing. */
export function grantConsent() {
  writeConsent(GRANTED);
  if (!isAnalyticsConfigured()) return;

  if (started) {
    // Re-accepting after withdrawing earlier in this same page load.
    posthog.opt_in_capturing();
    posthog.capture('$pageview');
  } else {
    startPostHog({ recordConsentEvent: true });
  }
}

/** Reject analytics, or withdraw a previous acceptance. */
export function denyConsent() {
  writeConsent(DENIED);
  // Nothing to switch off if PostHog was never loaded.
  if (started) posthog.opt_out_capturing();
}
