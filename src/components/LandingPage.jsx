/* PLACER — landing page
 *
 * The holding page for the project: what it is, who is building it, and who
 * funds it, with a way onto the waitlist, into User Labs and through the
 * Placemaking Trends survey. Shown as the home view only, with the nav bar
 * hidden (see App.jsx). The same hero as the Development branch's.
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
import { CHARACTER } from '../theme';

// Trimmed to its artwork and stored at 160px tall, so a height here is enough
// to size it and the width stays in proportion. Kept small and dimmed (see
// index.css) so it reads as an endorsement rather than a second focal point.
const FUNDER_HEIGHT = 32;

// How long each card stays up before the next one rotates in.
const ROTATE_MS = 6000;

/* The three things a visitor can do, one slide each, and each on one of the
 * three characters' colours in turn: a photo, then a bar tinted in that colour
 * with the title that says what the button is for, and the button. Each action is a render function so the card can hand
 * it the theme. */
const OPTIONS = [
  {
    key: 'waitlist',
    colour: CHARACTER.practitioner,
    photo: photoWaitlist,
    title: 'Be the first to use PLACER',
    action: (t) => <HaveYourSay t={t} className="placer-landing-option-link" />,
  },
  {
    key: 'userLabs',
    colour: CHARACTER.cityWorker,
    photo: photoUserLabs,
    title: 'Help shape what we build',
    action: () => <Link href="/user-labs" className="placer-landing-option-link">Apply to User Labs</Link>,
  },
  {
    key: 'survey',
    colour: CHARACTER.citizen,
    photo: photoSurvey,
    title: 'Tell us about placemaking in your city',
    action: () => (
      <Link href="/placemaking-trends-survey" className="placer-landing-option-link">Take the Placemaking Trends survey</Link>
    ),
  },
];

/* What PLACER is for, under the pitch: a step number, a title and a line for
 * each. */
const FEATURES = [
  { title: 'Understand', text: 'how your community uses a place' },
  { title: 'Imagine', text: 'new possibilities' },
  { title: 'Plan', text: 'meaningful change' },
];

// The width index.css treats as a phone, where the carousel gives way to a
// single waitlist button inside the pitch.
const MOBILE_QUERY = '(max-width: 1023px)';

function matchesMobile() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(MOBILE_QUERY).matches;
}

// Read on the first render, so a phone never mounts the carousel, and followed
// as the window resizes. Swapping the two in JS rather than hiding one in CSS
// keeps a single waitlist button, and dialog, on the page at a time.
function useIsMobile() {
  const [mobile, setMobile] = useState(matchesMobile);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* The right of the landing card: one media card with the three slides stacked
 * in it, one showing at a time, rotating on their own every few seconds, with a dot
 * for each centred along the photo's foot to jump to it. Rotation pauses while the pointer or
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
            style={{ '--placer-landing-option-bg': option.colour.c50 }}>
            <img className="placer-landing-option-photo" src={option.photo} alt="" />
            <div className="placer-landing-option-body">
              <h2 className="placer-landing-option-title">{option.title}</h2>
              {option.action(t)}
            </div>
          </div>
        ))}

        <div className="placer-landing-dots">
          {OPTIONS.map((option, i) => (
            <button
              key={option.key}
              type="button"
              className="placer-landing-dot"
              aria-label={`Show card ${i + 1}: ${option.title}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* A partner link in the credit line: no underline at rest, a hairline under it
 * on hover and focus (see index.css). */
function CreditLink({ href, children }) {
  return (
    <a className="placer-landing-credit-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function LandingPage({ t }) {
  const mobile = useIsMobile();

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
        * the three things a visitor can do about it, as slides of one media card
        * that take turns, with the credit along the bottom. A phone shows the
        * pitch alone, ending in the waitlist button. */}
      <div className="placer-landing-column" style={{
        position: 'relative',
        margin: 'auto',
      }}>
        <div className="placer-landing-info">
          {/* The wordmark, then the pitch. Their sizes are set in index.css so a
            * phone can scale them down. */}
          <h1 className="placer-disp placer-landing-title" style={{ color: t.ink }}>PLACER</h1>

          <p className="placer-landing-pitch">Placer is the open toolkit for co-designing shared spaces.</p>

          {/* What it does, in three numbered steps. */}
          <ol className="placer-landing-features">
            {FEATURES.map((feature, i) => (
              <li key={feature.title} className="placer-landing-feature">
                <span className="placer-landing-feature-step" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong className="placer-landing-feature-title">{feature.title}</strong>{' '}
                  <span className="placer-landing-feature-text">{feature.text}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="placer-landing-tagline">All in one shared workspace.</p>

          {/* A phone has no carousel, so the waitlist, its first card, is offered here. */}
          {mobile && (
            <div className="placer-landing-cta">
              <HaveYourSay t={t} className="placer-landing-option-link" />
            </div>
          )}
        </div>

        {!mobile && <LandingCarousel t={t} />}

        {/* The credit and the funder lockup run the full width of the card,
          * under a rule. Hidden below 1024px (see index.css). */}
        <div className="placer-landing-footer">
          <p className="placer-landing-credit">
            PLACER is developed by <CreditLink href="https://stpln.se/">STPLN</CreditLink>{' '}
            and <CreditLink href="https://ankaraaks.com/">Ankara Aks</CreditLink>, funded
            by the Swedish Institute.
          </p>

          {/* The lockup reads "Funded by Swedish Institute" as part of the artwork. */}
          <img
            className="placer-landing-funder"
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
