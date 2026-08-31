import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../../theme';

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    capture: vi.fn(),
  },
}));

const CONSENT_KEY = 'placer_analytics_consent';

// analytics.js remembers whether PostHog has been loaded in this page load, so
// each test gets a fresh copy of it — and the banner that imports it.
let posthog;
let CookieBanner;

function renderBanner() {
  const { hook } = memoryLocation({ path: '/' });
  return render(
    <Router hook={hook}>
      <CookieBanner t={THEME} />
    </Router>
  );
}

const banner = () => screen.queryByRole('region', { name: 'Cookie consent' });

describe('CookieBanner', () => {
  beforeEach(async () => {
    // The root test setup blanks these so the banner stays out of unrelated tests.
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com');
    localStorage.clear();
    vi.resetModules();
    posthog = (await import('posthog-js')).default;
    vi.clearAllMocks();
    CookieBanner = (await import('../CookieBanner')).CookieBanner;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('asks before analytics run when no decision has been made', () => {
    renderBanner();
    expect(banner()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    // Showing the banner must not itself load PostHog.
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('links to the privacy policy', () => {
    renderBanner();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  });

  it('stays hidden once a decision is stored', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    renderBanner();
    expect(banner()).not.toBeInTheDocument();

    localStorage.setItem(CONSENT_KEY, 'denied');
    renderBanner();
    expect(banner()).not.toBeInTheDocument();
  });

  it('stays hidden when PostHog is not configured for this build', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    vi.stubEnv('VITE_POSTHOG_HOST', '');
    renderBanner();
    expect(banner()).not.toBeInTheDocument();
  });

  it('loads PostHog and opts in on Accept, remembering the decision', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(localStorage.getItem(CONSENT_KEY)).toBe('granted');
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
    expect(banner()).not.toBeInTheDocument();
  });

  it('leaves PostHog unloaded on Reject, remembering the decision', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(banner()).not.toBeInTheDocument();
  });

  it('does not touch PostHog when it is unconfigured but a choice is somehow made', () => {
    renderBanner();
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(localStorage.getItem(CONSENT_KEY)).toBe('granted');
    expect(posthog.init).not.toHaveBeenCalled();
  });
});
