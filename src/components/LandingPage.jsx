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

      {/* position:relative to lift the copy above the border behind it. On a
        * phone a rule appears above the funder lockup instead (see index.css),
        * so its colour is published as a custom property that side can read. */}
      <div className="placer-landing-column" style={{
        position: 'relative',
        margin: 'auto',
        maxWidth: 620,
        textAlign: 'center',
        '--placer-landing-line': t.line,
      }}>
        {/* The wordmark, then the pitch. Their sizes are set in index.css so a
          * phone can scale them down. */}
        <h1 className="placer-disp placer-landing-title" style={{ color: t.ink }}>PLACER</h1>

        <p className="placer-landing-pitch" style={{ color: t.ink }}>
          PLACER aims to be the definitive digital toolkit for participatory
          placemaking. We believe that everyone has the potential to play a role in
          shaping the city. We bridge the gap between everyday folks, designers, and
          local leaders to build lively public spaces where everyone feels welcome.
        </p>

        {/* The feedback trigger sits centred here, in the gap that separates
          * the pitch from the credit, rather than floating over a corner of
          * the page. On a phone that gap closes, the credit reads on from the
          * pitch as one block, and the trigger becomes a fixed bar across the
          * foot of the screen instead (see index.css). */}
        <div className="placer-landing-divider">
          <HaveYourSay t={t} />
        </div>

        <p className="placer-landing-credit" style={{ fontSize: 15.5, color: t.inkDim, lineHeight: 1.7 }}>
          PLACER is developed by <ExternalLink t={t} href="https://stpln.se/">STPLN</ExternalLink>{' '}
          and <ExternalLink t={t} href="https://ankaraaks.com/">Ankara Aks</ExternalLink>, funded
          by the Swedish Institute.
        </p>

        {/* The lockup reads "Funded by Swedish Institute" as part of the artwork. */}
        <div className="placer-landing-funder">
          <img
            src={logoSwedishInstitute}
            alt="Funded by Swedish Institute"
            style={{ height: FUNDER_HEIGHT, width: 'auto' }}
          />
        </div>

        {/* On a phone the trigger is a bar across the foot of the screen, so the
          * column ends with the room it takes up and nothing sits under it.
          * Empty on a wide screen, where the trigger rides the rule above instead. */}
        <div className="placer-feedback-spacer" aria-hidden="true" />
      </div>
    </div>
  );
}

export default LandingPage;
