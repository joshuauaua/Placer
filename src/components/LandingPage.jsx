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

      {/* position:relative to lift the copy above the border behind it. The rule
        * between the pitch and the credit moves to the foot of the copy on a
        * phone (see index.css), so its colour is published as a custom property
        * both sides can read. */}
      <div style={{
        position: 'relative',
        margin: 'auto',
        maxWidth: 620,
        padding: '64px 24px',
        textAlign: 'center',
        '--placer-landing-line': t.line,
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

        {/* Dropped on a phone, where the pitch below says the same thing in a
          * sentence and the screen has no room to spare for a second strapline. */}
        <p className="placer-landing-tagline" style={{ fontSize: 19, color: t.inkDim }}>
          a toolkit for participatory placemaking
        </p>

        <p className="placer-landing-pitch" style={{ fontSize: 17, color: t.ink, lineHeight: 1.7 }}>
          PLACER is an emerging platform designed to bring citizens, design
          practitioners, and municipal stakeholders together to collaboratively
          shape inclusive, democratic public spaces.
        </p>

        {/* The rule carries the separation the dropped heading used to provide,
          * setting the credit line apart from the pitch above, and the feedback
          * trigger sits on top of it rather than floating over a corner of the
          * page. On a phone the rule (and the trigger riding it) drops, the
          * credit reads on from the pitch as one block, and the trigger becomes
          * a fixed bar across the foot of the screen instead (see index.css). */}
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
