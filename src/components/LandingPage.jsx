/* PLACER — landing page
 *
 * The holding page for the project: what it is, who is building it, and who
 * funds it. Shown as the home view only, with the nav bar hidden (see App.jsx).
 */

import frameLeft from '../assets/frame-street-left.png';
import frameRight from '../assets/frame-street-right.png';
import logoSwedishInstitute from '../assets/logo-swedish-institute.png';
import { HaveYourSay } from './HaveYourSay';
import { ExternalLink } from './LegalLayout';

// Trimmed to its artwork and stored at 160px tall, so a height here is enough
// to size it and the width stays in proportion.
const FUNDER_HEIGHT = 52;

/* The two halves of the street-furniture border. Decorative: they carry no
 * meaning the copy does not, so they are hidden from assistive tech and cannot
 * be clicked. Layout and clipping live in index.css, which needs a media query
 * to drop them on a narrow viewport. */
function StreetFrame({ side, src }) {
  return (
    <div className={`placer-landing-frame placer-landing-frame-${side}`} aria-hidden="true">
      <img src={src} alt="" />
    </div>
  );
}

export function LandingPage({ t }) {
  return (
    // margin:auto on the child rather than justify-content, so content taller
    // than the viewport scrolls from the top instead of being clipped there.
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      background: t.page,
    }}>
      <StreetFrame side="left" src={frameLeft} />
      <StreetFrame side="right" src={frameRight} />

      {/* position:relative to lift the copy above the border behind it. */}
      <div style={{
        position: 'relative',
        margin: 'auto',
        maxWidth: 620,
        padding: '64px 24px',
        textAlign: 'center',
      }}>
        <h1 className="placer-disp" style={{
          fontSize: 64,
          fontWeight: 900,
          color: t.ink,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          marginBottom: 14
        }}>
          PLACER
        </h1>

        <p style={{ fontSize: 19, color: t.inkDim, marginBottom: 40 }}>
          a toolkit for participatory placemaking
        </p>

        <p style={{ fontSize: 17, color: t.ink, lineHeight: 1.7, marginBottom: 56 }}>
          PLACER is an interactive platform that empowers citizens, design
          practitioners, and municipal stakeholders to co-create more inclusive,
          democratic public spaces. By bridging community vision with urban design,
          PLACER provides tools and shared resources to make citymaking
          collaborative, accessible, and transparent.
        </p>

        {/* The rule carries the separation the dropped heading used to provide,
          * setting the credit line apart from the pitch above. The two partners
          * are links rather than logos. */}
        <p style={{
          fontSize: 15.5,
          color: t.inkDim,
          lineHeight: 1.7,
          borderTop: `1px solid ${t.line}`,
          paddingTop: 28,
          marginBottom: 48
        }}>
          PLACER is developed by <ExternalLink t={t} href="https://stpln.se/">STPLN</ExternalLink>{' '}
          and <ExternalLink t={t} href="https://ankaraaks.com/">Ankara Aks</ExternalLink>, funded
          by the Swedish Institute.
        </p>

        {/* The lockup reads "Funded by Swedish Institute" as part of the artwork. */}
        <img
          src={logoSwedishInstitute}
          alt="Funded by Swedish Institute"
          style={{ height: FUNDER_HEIGHT, width: 'auto' }}
        />

        {/* On a phone the trigger is a bar across the foot of the screen, so the
          * column ends with the room it takes up and nothing sits under it.
          * Empty on a wide screen, where the trigger is a circle off to the side. */}
        <div className="placer-feedback-spacer" aria-hidden="true" />
      </div>

      {/* Fixed to the viewport, so it sits outside the scrolling column. */}
      <HaveYourSay t={t} />
    </div>
  );
}

export default LandingPage;
