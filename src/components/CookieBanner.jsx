/* PLACER — analytics consent pop-up, in the bottom-left corner.
 *
 * Shown until the visitor accepts or rejects analytics. PostHog has not been
 * loaded at this point (see src/analytics.js), so this asks before anything is
 * turned on rather than notifying after the fact.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Btn } from './UI';
import { isAnalyticsConfigured, readConsent, grantConsent, denyConsent } from '../analytics';

// Space between the pop-up and the viewport's left and bottom edges.
const CORNER_GAP = 16;

export function CookieBanner({ t }) {
  // Read once on mount: a decision made in this tab hides the banner via state,
  // and a decision made in a previous visit keeps it from ever showing.
  const [decided, setDecided] = useState(() => readConsent() !== null);
  const ref = useRef(null);

  // Nothing to consent to when PostHog is not configured for this build.
  const visible = !decided && isAnalyticsConfigured();

  // The pop-up floats over the app, so publish the height it takes up from the
  // bottom of the viewport as --placer-consent-inset, for anything anchored there
  // to sit clear of it (the map's search and capture controls, for one).
  useEffect(() => {
    if (!visible) return undefined;
    const root = document.documentElement;
    const measure = () => {
      root.style.setProperty('--placer-consent-inset', `${ref.current ? ref.current.offsetHeight + CORNER_GAP : 0}px`);
    };
    measure();
    // Its height changes with the viewport width, as the text rewraps.
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--placer-consent-inset');
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
      aria-label="Analytics consent"
      style={{
        position: 'fixed', left: CORNER_GAP, bottom: CORNER_GAP, zIndex: 200,
        width: `min(380px, calc(100vw - ${CORNER_GAP * 2}px))`, boxSizing: 'border-box',
        padding: '18px 20px', borderRadius: 16,
        background: t.surface, border: `1px solid ${t.line}`, boxShadow: t.shadow,
      }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 6 }}>Analytics</div>
      <div style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
        We would like to use PostHog to record how the app is used so that we can improve it.
        Nothing is stored on your device and it only runs if you accept.{' '}
        <Link
          href="/terms-and-privacy"
          style={{ color: t.ink, fontWeight: 500, textDecoration: 'underline' }}>
          Terms and Privacy
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Btn t={t} variant="primary" size="sm" onClick={decide(grantConsent)}>Accept analytics</Btn>
        <Btn t={t} variant="outline" size="sm" onClick={decide(denyConsent)}>Reject</Btn>
      </div>
    </div>
  );
}

export default CookieBanner;
