/* PLACER — landing page
 *
 * The home view for anybody signed out: what the project is, who is building it,
 * and who funds it, with a way onto the waitlist and into User Labs. Somebody
 * signed in goes straight to their dashboard instead (see App.jsx). The same page
 * as the landingpage branch's, where it is the whole site.
 */

import { Link } from 'wouter';

import cityDrawing from '../assets/landing-city.svg';
import cityDrawingMobile from '../assets/landing-city-mobile.svg';
import logoSwedishInstitute from '../assets/logo-swedish-institute.png';
import photoWaitlist from '../assets/about-malmo.jpg';
import photoUserLabs from '../assets/user-labs.webp';
import { HaveYourSay } from './HaveYourSay';
import { ExternalLink } from './LegalLayout';
import { CHARACTER } from '../theme';

// Trimmed to its artwork and stored at 160px tall, so a height here is enough
// to size it and the width stays in proportion.
const FUNDER_HEIGHT = 52;

// A second character button under the feedback trigger, to User Labs: the
// city worker's blue, in the same 100-fill/700-hairline/300-hover pattern as
// the practitioner purple used for "Join the Waitlist" (see HaveYourSay).
const LABS_BG = CHARACTER.cityWorker.c100;
const LABS_BORDER = CHARACTER.cityWorker.c700;
const LABS_FG = '#111111';

/* One of the two smaller cards on the right of the landing card: a photo, a
 * title and the button that acts on it. The photo is decoration, the title
 * says what the button is for. On a phone only the button is left, so the
 * card's colours go in as custom properties that index.css can drop there. */
function LandingOption({ t, photo, title, children }) {
  return (
    <div className="placer-landing-option" style={{
      '--placer-landing-option-bg': t.surface,
      '--placer-landing-option-line': t.line,
    }}>
      <img className="placer-landing-option-photo" src={photo} alt="" />
      <div className="placer-landing-option-body">
        <h2 className="placer-landing-option-title" style={{ color: t.ink }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function LandingPage({ t }) {
  return (
    // margin:auto on the card rather than justify-content, so content taller
    // than the viewport scrolls from the top instead of being clipped there.
    // The isometric city fills the page behind the card, on a layer of its own
    // so it can slowly zoom. It is decoration, so it goes in as a CSS background
    // and never reaches assistive tech. Both drawings are published as custom
    // properties so index.css can swap in the portrait one on a phone, which an
    // inline background-image would not allow.
    <div className="placer-landing" style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      backgroundColor: t.page,
      '--placer-landing-city': `url(${cityDrawing})`,
      '--placer-landing-city-mobile': `url(${cityDrawingMobile})`,
    }}>
      {/* The backdrop clips the zoom to the page: the page itself cannot, as
        * App.jsx's scroll view forces its overflow visible. */}
      <div className="placer-landing-backdrop" aria-hidden="true">
        <div className="placer-landing-city" />
      </div>

      {/* The card over the drawing: what PLACER is on the left, and on the right
        * the two things a visitor can do about it, each on a smaller card of its
        * own, with the credit along the bottom. A phone stacks them, the pitch
        * first. */}
      <div className="placer-landing-column" style={{
        position: 'relative',
        margin: 'auto',
        background: t.surface,
        border: `1px solid ${t.line}`,
      }}>
        <div className="placer-landing-info">
          {/* The wordmark, then the pitch. Their sizes are set in index.css so a
            * phone can scale them down. */}
          <h1 className="placer-disp placer-landing-title" style={{ color: t.ink }}>PLACER</h1>

          <div className="placer-landing-pitch" style={{ color: t.ink }}>
            <p>Placer is the open toolkit for co-designing shared spaces.</p>
            <p style={{ marginTop: '1em' }}>
              Understand how your community uses a place, imagine new possibilities, and
              plan meaningful change: all in one shared workspace.
            </p>
          </div>
        </div>

        <div className="placer-landing-actions">
          <LandingOption t={t} photo={photoWaitlist} title="Be the first to use PLACER">
            <HaveYourSay t={t} />
          </LandingOption>
          <LandingOption t={t} photo={photoUserLabs} title="Help shape what we build">
            <Link
              href="/user-labs"
              className="placer-labs-trigger"
              style={{ background: LABS_BG, color: LABS_FG, border: `1px solid ${LABS_BORDER}` }}>
              Apply to User Labs
            </Link>
          </LandingOption>
        </div>

        {/* The credit and the funder lockup run the full width of the card,
          * under a rule. Hidden below 1024px (see index.css). */}
        <div className="placer-landing-footer" style={{ borderTop: `1px solid ${t.line}` }}>
          <p className="placer-landing-credit" style={{ fontSize: 15.5, color: t.inkDim, lineHeight: 1.7 }}>
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
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
