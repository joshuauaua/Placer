/* PLACER — landing page
 *
 * The home view for anybody signed out: what the project is, who is building it,
 * and who funds it, with a way onto the waitlist, into User Labs and through the
 * Placemaking Trends survey. Somebody signed in goes straight to their dashboard
 * instead (see App.jsx). The same page as the landingpage branch's, where it is
 * the whole site.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';

import cityDrawing from '../assets/landing-city.svg';
import cityDrawingMobile from '../assets/landing-city-mobile.svg';
import logoSwedishInstitute from '../assets/logo-swedish-institute.png';
import photoWaitlist from '../assets/about-malmo.jpg';
import photoUserLabs from '../assets/user-labs.webp';
import photoSurvey from '../assets/placemaking-trends-cover.webp';
import { HaveYourSay } from './HaveYourSay';
import { ExternalLink } from './LegalLayout';
import { CHARACTER, NEUTRAL } from '../theme';

// Trimmed to its artwork and stored at 160px tall, so a height here is enough
// to size it and the width stays in proportion.
const FUNDER_HEIGHT = 52;

// A second character button under the feedback trigger, to User Labs: the
// city worker's blue, in the same 100-fill/700-hairline/300-hover pattern as
// the practitioner purple used for "Join the Waitlist" (see HaveYourSay).
const LABS_BG = CHARACTER.cityWorker.c100;
const LABS_BORDER = CHARACTER.cityWorker.c700;
const LABS_FG = '#111111';

// A third, to the Placemaking Trends survey (SurveyPage at /survey, which is
// /placemaking-trends-survey on the landingpage branch): the citizen orange.
const SURVEY_BG = CHARACTER.citizen.c100;
const SURVEY_BORDER = CHARACTER.citizen.c700;
const SURVEY_FG = '#111111';

// How long each card stays up before the next one rotates in.
const ROTATE_MS = 6000;

/* The three things a visitor can do, one card each: a photo, the title that
 * says what the button is for, and the button. Each is a render function so
 * the card can hand it the theme. */
const OPTIONS = [
  {
    key: 'waitlist',
    photo: photoWaitlist,
    title: 'Be the first to use PLACER',
    action: (t) => <HaveYourSay t={t} />,
  },
  {
    key: 'userLabs',
    photo: photoUserLabs,
    title: 'Help shape what we build',
    action: () => (
      <Link
        href="/user-labs"
        className="placer-labs-trigger"
        style={{ background: LABS_BG, color: LABS_FG, border: `1px solid ${LABS_BORDER}` }}>
        Apply to User Labs
      </Link>
    ),
  },
  {
    key: 'survey',
    photo: photoSurvey,
    title: 'Tell us about placemaking in your city',
    action: () => (
      <Link
        href="/survey"
        className="placer-labs-trigger placer-survey-trigger"
        style={{ background: SURVEY_BG, color: SURVEY_FG, border: `1px solid ${SURVEY_BORDER}` }}>
        Take the Placemaking Trends survey
      </Link>
    ),
  },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* The right of the landing card: the three option cards stacked in one place,
 * one showing at a time, rotating on their own every few seconds, with a dot
 * for each underneath to jump to it. Rotation pauses while the pointer or
 * focus is on the carousel, which also keeps the waitlist dialog (rendered
 * inside its card) from being rotated away while it is open, and is off
 * entirely for anyone who prefers reduced motion. The hidden cards are inert,
 * so neither a tab nor a screen reader lands on them. */
function LandingCarousel({ t }) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const id = setTimeout(() => setActive((i) => (i + 1) % OPTIONS.length), ROTATE_MS);
    return () => clearTimeout(id);
  }, [active, paused]);

  return (
    <section
      className="placer-landing-actions"
      aria-roledescription="carousel"
      aria-label="Get involved"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
      <div className="placer-landing-slides">
        {OPTIONS.map((option, i) => (
          <div
            key={option.key}
            className="placer-landing-option"
            data-active={i === active}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${OPTIONS.length}`}
            aria-hidden={i !== active}
            inert={i !== active}
            style={{
              '--placer-landing-option-bg': t.surface,
              '--placer-landing-option-line': t.line,
            }}>
            <img className="placer-landing-option-photo" src={option.photo} alt="" />
            <div className="placer-landing-option-body">
              <h2 className="placer-landing-option-title" style={{ color: t.ink }}>{option.title}</h2>
              {option.action(t)}
            </div>
          </div>
        ))}
      </div>

      <div className="placer-landing-dots">
        {OPTIONS.map((option, i) => (
          <button
            key={option.key}
            type="button"
            className="placer-landing-dot"
            aria-label={`Show card ${i + 1}: ${option.title}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => setActive(i)}
            style={{ backgroundColor: i === active ? t.ink : NEUTRAL.grey500 }}
          />
        ))}
      </div>
    </section>
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
        * the three things a visitor can do about it, on smaller cards that take
        * turns, with the credit along the bottom. A phone stacks them, the pitch
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

        <LandingCarousel t={t} />

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
