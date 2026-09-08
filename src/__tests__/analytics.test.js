import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    capture: vi.fn(),
  },
}));

const CONSENT_KEY = 'placer_analytics_consent';
const GRANTED = 'granted';
const DENIED = 'denied';
// The key consent was stored under before the rename from PLOT.
const LEGACY_CONSENT_KEY = 'plot_analytics_consent';

// The module tracks whether posthog.init() has run in this page load, so each
// test needs a fresh copy of it — and a fresh set of mocks with it.
let posthog;
let analytics;

function configure() {
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com');
}

describe('analytics consent gate', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    posthog = (await import('posthog-js')).default;
    // resetModules gives a fresh analytics module (so its "already started" flag
    // resets) but the mocked posthog keeps the same spies, so clear them here.
    vi.clearAllMocks();
    analytics = await import('../analytics');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not load PostHog at all for an undecided visitor', () => {
    configure();
    analytics.initAnalytics();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('does not load PostHog for a visitor who rejected', () => {
    configure();
    localStorage.setItem(CONSENT_KEY, DENIED);
    analytics.initAnalytics();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('does nothing when the env vars are missing', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    vi.stubEnv('VITE_POSTHOG_HOST', '');
    localStorage.setItem(CONSENT_KEY, GRANTED);

    expect(analytics.isAnalyticsConfigured()).toBe(false);
    analytics.initAnalytics();
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('loads PostHog opted out, then opts in, for a returning visitor who accepted', () => {
    configure();
    localStorage.setItem(CONSENT_KEY, GRANTED);
    analytics.initAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    const [token, config] = posthog.init.mock.calls[0];
    expect(token).toBe('phc_test');
    expect(config).toMatchObject({
      api_host: 'https://eu.i.posthog.com',
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      opt_out_capturing_persistence_type: 'localStorage',
    });
    // No repeat consent event for a decision made on an earlier visit.
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('records the consent event when accepting for the first time', () => {
    configure();
    analytics.grantConsent();

    expect(localStorage.getItem(CONSENT_KEY)).toBe(GRANTED);
    expect(posthog.init).toHaveBeenCalledTimes(1);
    // No argument — PostHog captures its default $opt_in event.
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith();
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('never loads PostHog when the visitor rejects', () => {
    configure();
    analytics.denyConsent();

    expect(localStorage.getItem(CONSENT_KEY)).toBe(DENIED);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
  });

  it('stops capture when consent is withdrawn after being given', () => {
    configure();
    analytics.grantConsent();
    analytics.denyConsent();

    expect(localStorage.getItem(CONSENT_KEY)).toBe(DENIED);
    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    // PostHog was already loaded, so it is not initialised a second time.
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it('resumes capture when consent is given again in the same page load', () => {
    configure();
    analytics.grantConsent();
    analytics.denyConsent();
    posthog.capture.mockClear();
    analytics.grantConsent();

    expect(localStorage.getItem(CONSENT_KEY)).toBe(GRANTED);
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(2);
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('reads only the two decisions it writes, treating anything else as undecided', () => {
    expect(analytics.readConsent()).toBeNull();

    localStorage.setItem(CONSENT_KEY, 'maybe');
    expect(analytics.readConsent()).toBeNull();

    localStorage.setItem(CONSENT_KEY, GRANTED);
    expect(analytics.readConsent()).toBe(GRANTED);
  });

  it('reports undecided rather than throwing when storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });
    configure();

    expect(analytics.readConsent()).toBeNull();
    expect(() => analytics.grantConsent()).not.toThrow();
    // The choice still applies for this page load.
    expect(posthog.init).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('consent stored under the pre-rename key', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    posthog = (await import('posthog-js')).default;
    vi.clearAllMocks();
    analytics = await import('../analytics');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('carries an acceptance across to the new key', () => {
    localStorage.setItem(LEGACY_CONSENT_KEY, GRANTED);

    expect(analytics.readConsent()).toBe(GRANTED);
    expect(localStorage.getItem(CONSENT_KEY)).toBe(GRANTED);
    expect(localStorage.getItem(LEGACY_CONSENT_KEY)).toBeNull();
  });

  it('carries a refusal across, so the visitor is not asked again', () => {
    localStorage.setItem(LEGACY_CONSENT_KEY, DENIED);

    expect(analytics.readConsent()).toBe(DENIED);
    expect(localStorage.getItem(CONSENT_KEY)).toBe(DENIED);
    expect(localStorage.getItem(LEGACY_CONSENT_KEY)).toBeNull();
  });

  it('starts PostHog on boot for a visitor who accepted before the rename', () => {
    configure();
    localStorage.setItem(LEGACY_CONSENT_KEY, GRANTED);

    analytics.initAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
  });

  it('prefers the current key when both are present', () => {
    localStorage.setItem(CONSENT_KEY, DENIED);
    localStorage.setItem(LEGACY_CONSENT_KEY, GRANTED);

    expect(analytics.readConsent()).toBe(DENIED);
  });

  it('ignores a legacy value that is not a decision', () => {
    localStorage.setItem(LEGACY_CONSENT_KEY, 'maybe');

    expect(analytics.readConsent()).toBeNull();
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
  });
});
