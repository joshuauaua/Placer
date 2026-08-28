/* PLOT — cookie consent banner.
 *
 * Shown until the visitor accepts or rejects analytics. PostHog has not been
 * loaded at this point (see src/analytics.js), so this asks before anything is
 * turned on rather than notifying after the fact.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Btn } from './UI';
import { isAnalyticsConfigured, readConsent, grantConsent, denyConsent } from '../analytics';

export function CookieBanner({ t }) {
  // Read once on mount: a decision made in this tab hides the banner via state,
  // and a decision made in a previous visit keeps it from ever showing.
  const [decided, setDecided] = useState(() => readConsent() !== null);
  const ref = useRef(null);

  // Nothing to consent to when PostHog is not configured for this build.
  const visible = !decided && isAnalyticsConfigured();

  // The banner floats over the app, so publish its height as --plot-consent-inset
  // for anything anchored to the bottom of the viewport to sit clear of it (the
  // map's search and capture controls, for one).
  useEffect(() => {
    if (!visible) return undefined;
    const root = document.documentElement;
    const measure = () => {
      root.style.setProperty('--plot-consent-inset', `${ref.current?.offsetHeight ?? 0}px`);
    };
    measure();
    // Its height changes with the viewport width, as the text rewraps.
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--plot-consent-inset');
    };
  }, [visible]);

  if (!visible) return null;

  const decide = (record) => () => {
    record();
    setDecided(true);
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Cookie consent"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
        background: t.surface, borderTop: `1px solid ${t.line}`, boxShadow: t.shadow,
      }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '18px 22px',
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 420px', minWidth: 260 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 6 }}>Cookies</div>
          <div style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            PLOT uses PostHog to understand how the app is used, including session recordings.
            Nothing is stored on your device and nothing is sent until you accept.{' '}
            <Link
              href="/privacy"
              style={{ color: t.ink, fontWeight: 600, textDecoration: 'underline' }}>
              Privacy Policy
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flex: '0 0 auto' }}>
          <Btn t={t} variant="outline" size="sm" onClick={decide(denyConsent)}>Reject</Btn>
          <Btn t={t} variant="primary" size="sm" onClick={decide(grantConsent)}>Accept</Btn>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;
