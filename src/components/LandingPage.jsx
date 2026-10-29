/* PLACER — landing page
 *
 * The holding page for the project: a hero saying what PLACER is for, with
 * Get started opening the waitlist, the practices it is built with, how it
 * works, what people say, who it is for, how it gets going, case studies, and
 * a waitlist form to close. Who builds and funds it is in the site footer.
 * User Labs and the Placemaking Trends survey are in the menu and the footer.
 * Shown as the home view only, with the nav bar hidden (see App.jsx).
 */

import { useEffect, useRef, useState } from 'react';

import cityDrawing from '../assets/landing-city.svg';
import cityDrawingMobile from '../assets/landing-city-mobile.svg';
import logoStpln from '../assets/logo-stpln.png';
import logoAks from '../assets/logo-aks.png';
import { saveSurveyResponse } from '../services/api';
import { HaveYourSay } from './HaveYourSay';
import { Icon } from './Icon';

/* The practices PLACER is built with, under the hero. Logos are stored at 160px
 * tall. One without a logo file yet shows its name instead. */
const PARTNERS = [
  { name: 'Gehl Institute', href: 'https://gehlinstitute.org/', logo: null },
  { name: 'STPLN', href: 'https://stpln.se/', logo: logoStpln },
  { name: 'Ankara Aks', href: 'https://ankaraaks.com/', logo: logoAks },
];

/* How a session goes, beside a picture of each step. `media` will be a screen
 * recording of the app doing it; until then the frame shows a placeholder. */
const STEPS = [
  {
    key: 'ask',
    title: 'Ask a question',
    text: 'Choose a tool and put your question to the room, on site or online.',
    media: null,
  },
  {
    key: 'answer',
    title: 'Get answers in real time',
    text: 'People join with a code on their phone, and their answers appear live as they come in.',
    media: null,
  },
  {
    key: 'act',
    title: 'Shape what comes next',
    text: 'Use what you learn to decide the next step, and bring everyone back to build on it.',
    media: null,
  },
];

// How long each step stays up before the next one takes over. The ring around
// the active step's number fills over the same time.
const STEP_MS = 5000;

// The ring's radius in a 40px box, and the length of its circumference.
const RING_R = 18;
const RING_LENGTH = 2 * Math.PI * RING_R;

/* The steps as tabs on the left, the active one's picture on the right. They
 * take turns on their own, a ring filling around the active number as its time
 * runs; a click switches straight to a step and starts its time afresh. Both
 * the timer and the ring pause while the pointer or focus is on the section,
 * and the timer picks up with what was left. Anyone who prefers reduced motion
 * gets neither: the steps wait for a click. A phone stacks them, the picture
 * under the list. */
function LandingSteps() {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  // The time left on a step, kept across pauses. Belongs to `step`; a new step
  // starts with the whole STEP_MS.
  const left = useRef({ step: 0, ms: STEP_MS });

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    if (left.current.step !== active) left.current = { step: active, ms: STEP_MS };
    const started = Date.now();
    const id = setTimeout(() => setActive((n) => (n + 1) % STEPS.length), left.current.ms);
    return () => {
      clearTimeout(id);
      left.current.ms = Math.max(0, left.current.ms - (Date.now() - started));
    };
  }, [active, paused]);

  return (
    <div
      className="placer-landing-steps"
      data-paused={paused}
      style={{ '--placer-landing-step-ms': `${STEP_MS}ms`, '--placer-landing-ring-length': RING_LENGTH }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
      <div className="placer-landing-steps-list" role="tablist" aria-label="How it works">
        {STEPS.map((step, i) => (
          <button
            key={step.key}
            type="button"
            role="tab"
            id={`placer-landing-step-${step.key}`}
            aria-selected={i === active}
            aria-controls={`placer-landing-step-${step.key}-panel`}
            className="placer-landing-step"
            onClick={() => setActive(i)}>
            <span className="placer-landing-step-number" aria-hidden="true">
              {i === active && (
                <svg className="placer-landing-step-ring" viewBox="0 0 40 40">
                  <circle className="placer-landing-step-ring-track" cx="20" cy="20" r={RING_R} />
                  <circle className="placer-landing-step-ring-fill" cx="20" cy="20" r={RING_R} />
                </svg>
              )}
              {i + 1}
            </span>
            <span>
              <span className="placer-landing-step-title">{step.title}</span>
              <span className="placer-landing-step-text">{step.text}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="placer-landing-steps-media">
        {STEPS.map((step, i) => (
          <div
            key={step.key}
            role="tabpanel"
            id={`placer-landing-step-${step.key}-panel`}
            aria-labelledby={`placer-landing-step-${step.key}`}
            className="placer-landing-step-media"
            hidden={i !== active}>
            {step.media
              ? <video src={step.media} autoPlay muted loop playsInline />
              : <span className="placer-landing-step-placeholder">{step.title}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* What people who have used PLACER say, each beside a photo of them or their
 * project. Placeholders until real quotes, with permission to use them, come in:
 * replace each entry's quote, name and role, and set `photo` to an imported
 * image. */
const TESTIMONIALS = [
  { key: 'one', photo: null, quote: 'Testimonial quote goes here.', name: 'Name Surname', role: 'Role, Organisation' },
  { key: 'two', photo: null, quote: 'Testimonial quote goes here.', name: 'Name Surname', role: 'Role, Organisation' },
  { key: 'three', photo: null, quote: 'Testimonial quote goes here.', name: 'Name Surname', role: 'Role, Organisation' },
];

/* One testimonial at a time: the photo on the left, the quote and who said it
 * on the right, with arrows to step either way (round from the last to the
 * first) and a count. The others stay in the page but hidden. A phone puts the
 * photo over the quote. */
function LandingTestimonials() {
  const [active, setActive] = useState(0);
  const step = (by) => setActive((n) => (n + by + TESTIMONIALS.length) % TESTIMONIALS.length);

  return (
    <section
      className="placer-landing-testimonials"
      aria-roledescription="carousel"
      aria-label="What people say">
      <div className="placer-landing-testimonials-stage">
        {TESTIMONIALS.map((item, i) => (
          <figure
            key={item.key}
            className="placer-landing-testimonial"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${TESTIMONIALS.length}`}
            hidden={i !== active}>
            <div className="placer-landing-testimonial-photo">
              {item.photo
                ? <img src={item.photo} alt="" />
                : <span className="placer-landing-testimonial-placeholder">Photo</span>}
            </div>
            <div className="placer-landing-testimonial-body">
              <blockquote>
                <p>“{item.quote}”</p>
              </blockquote>
              <figcaption>
                <span className="placer-landing-testimonial-name">{item.name}</span>
                <span className="placer-landing-testimonial-role">{item.role}</span>
              </figcaption>
            </div>
          </figure>
        ))}

        <div className="placer-landing-testimonials-controls">
          <button type="button" className="placer-landing-testimonials-arrow" onClick={() => step(-1)}
            aria-label="Previous testimonial">
            <Icon name="chevLeft" size={20} stroke={2} />
          </button>
          <span className="placer-landing-testimonials-count" aria-live="polite">
            {active + 1} / {TESTIMONIALS.length}
          </span>
          <button type="button" className="placer-landing-testimonials-arrow" onClick={() => step(1)}
            aria-label="Next testimonial">
            <Icon name="chevRight" size={20} stroke={2} />
          </button>
        </div>
      </div>
    </section>
  );
}

/* What PLACER does for each audience: a few things each, every one with an
 * icon (a name from Icon.jsx) and a screen recording to come. `media` stays null until there is one, and the frame
 * shows a placeholder. Draft copy; reword freely. */
const AUDIENCES = [
  {
    key: 'practitioners',
    label: 'Design Practitioners',
    items: [
      {
        key: 'workshops',
        icon: 'comment',
        title: 'Run live workshops',
        text: 'Put polls, word clouds and maps on the screen, and let the room answer from their phones.',
        media: null,
      },
      {
        key: 'mapping',
        icon: 'pin',
        title: 'Map how a place is used',
        text: 'Record where people stay and how they move, with field tools built on the Public Life Data Protocol.',
        media: null,
      },
      {
        key: 'sketch',
        icon: 'pencil',
        title: 'Sketch ideas together',
        text: 'Let participants draw on a street view of the site and see their ideas take shape.',
        media: null,
      },
      {
        key: 'share',
        icon: 'share',
        title: 'Share what you found',
        text: 'Turn every response into charts and summaries you can take straight to the client.',
        media: null,
      },
    ],
  },
  {
    key: 'officials',
    label: 'City Officials',
    items: [
      {
        key: 'reach',
        icon: 'user',
        title: 'Reach more residents',
        text: 'Hear from people online and on site, in one place, including those who never come to meetings.',
        media: null,
      },
      {
        key: 'budget',
        icon: 'coins',
        title: 'Set priorities with a budget',
        text: 'Let residents spend a set budget across proposals, and see what matters most to them.',
        media: null,
      },
      {
        key: 'projects',
        icon: 'layers',
        title: 'Keep every project together',
        text: 'Each project’s tools, responses and updates live on one page the public can follow.',
        media: null,
      },
      {
        key: 'report',
        icon: 'send',
        title: 'Report back',
        text: 'Show residents what was heard and what happens next, so taking part feels worth it.',
        media: null,
      },
    ],
  },
];

/* Under the engagement statement: a toggle between the audiences, and a card
 * for the chosen one. On its left the audience's items as expandables, one open
 * at a time; on its right the open one's screen recording. Switching audience
 * opens its first item. A phone stacks the list over the picture. */
function LandingAudiences() {
  const [audienceIndex, setAudienceIndex] = useState(0);
  const [open, setOpen] = useState(0);
  const audience = AUDIENCES[audienceIndex];
  const item = audience.items[open];

  const choose = (i) => {
    setAudienceIndex(i);
    setOpen(0);
  };

  return (
    <div className="placer-landing-audiences">
      <div className="placer-landing-audience-toggle" role="tablist" aria-label="Who it is for">
        {AUDIENCES.map((a, i) => (
          <button
            key={a.key}
            type="button"
            role="tab"
            id={`placer-landing-audience-${a.key}`}
            aria-selected={i === audienceIndex}
            aria-controls="placer-landing-audience-card"
            onClick={() => choose(i)}>
            {a.label}
          </button>
        ))}
      </div>

      <div
        className="placer-landing-audience-card"
        id="placer-landing-audience-card"
        role="tabpanel"
        aria-labelledby={`placer-landing-audience-${audience.key}`}>
        <ul className="placer-landing-audience-items">
          {audience.items.map((it, i) => (
            <li key={it.key} className="placer-landing-audience-item" data-open={i === open}>
              <button
                type="button"
                aria-expanded={i === open}
                aria-controls={`placer-landing-audience-${it.key}-text`}
                onClick={() => setOpen(i)}>
                <span className="placer-landing-audience-item-icon" aria-hidden="true">
                  <Icon name={it.icon} size={20} stroke={1.8} />
                </span>
                <span className="placer-landing-audience-item-title">{it.title}</span>
                <Icon name={i === open ? 'minus' : 'plus'} size={18} stroke={2} />
              </button>
              <p id={`placer-landing-audience-${it.key}-text`} hidden={i !== open}>{it.text}</p>
            </li>
          ))}
        </ul>

        <div className="placer-landing-audience-media">
          {item.media
            ? <video key={item.key} src={item.media} autoPlay muted loop playsInline />
            : <span className="placer-landing-step-placeholder">{item.title}</span>}
        </div>
      </div>
    </div>
  );
}

/* Getting going, as three cards under the "Easy to start" statement, each
 * with a screen recording to come above its title. `media` stays null until
 * there is one, and the frame shows a placeholder. */
const START_CARDS = [
  {
    key: 'templates',
    title: 'Customizable templates',
    text: 'Pick a template. Then make it your own.',
    media: null,
  },
  {
    key: 'present',
    title: 'Instant presentations',
    text: 'Put it on any screen, and people join with a code to answer live.',
    media: null,
  },
  {
    key: 'setups',
    title: 'Flexible setups',
    text: 'Use with any tool. In-room, remote or both.',
    media: null,
  },
];

/* Projects PLACER has been used on, as large cards. Placeholders until the
 * write-ups exist: set each entry's photo (an imported image), title, place and
 * summary, and `href` to the full case study once it is published. */
const CASE_STUDIES = [
  {
    key: 'one',
    photo: null,
    place: 'City, Country',
    title: 'Case study title',
    summary: 'A short summary of the project, who took part and what their participation changed.',
    href: null,
  },
  {
    key: 'two',
    photo: null,
    place: 'City, Country',
    title: 'Case study title',
    summary: 'A short summary of the project, who took part and what their participation changed.',
    href: null,
  },
  {
    key: 'three',
    photo: null,
    place: 'City, Country',
    title: 'Case study title',
    summary: 'A short summary of the project, who took part and what their participation changed.',
    href: null,
  },
];

/* The case studies as a row that moves sideways: one large card in view, the
 * next peeking in at the edge. The arrows step a card at a time (the row snaps
 * to each), and on a phone a swipe does the same. An arrow greys out at its
 * end. The row itself scrolls, so the cards stay ordinary content to a screen
 * reader or a tab. */
function LandingCases() {
  const track = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = () => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  const step = (direction) => {
    const el = track.current;
    const card = el?.querySelector('.placer-landing-case');
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div className="placer-landing-cases">
      <ul className="placer-landing-cases-track" ref={track} onScroll={update} aria-label="Case studies">
        {CASE_STUDIES.map((study) => (
          <li key={study.key} className="placer-landing-case">
            <article>
              <div className="placer-landing-case-photo">
                {study.photo
                  ? <img src={study.photo} alt="" />
                  : <span className="placer-landing-step-placeholder">Photo</span>}
              </div>
              <div className="placer-landing-case-body">
                <p className="placer-landing-case-place">{study.place}</p>
                <h3 className="placer-landing-case-title">{study.title}</h3>
                <p className="placer-landing-case-summary">{study.summary}</p>
                {study.href && (
                  <a className="placer-landing-case-link" href={study.href} target="_blank" rel="noopener noreferrer">
                    Read the case study
                    <Icon name="arrowRight" size={18} stroke={2} />
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="placer-landing-testimonials-controls">
        <button type="button" className="placer-landing-testimonials-arrow" onClick={() => step(-1)}
          disabled={atStart} aria-label="Previous case study">
          <Icon name="chevLeft" size={20} stroke={2} />
        </button>
        <button type="button" className="placer-landing-testimonials-arrow" onClick={() => step(1)}
          disabled={atEnd} aria-label="Next case study">
          <Icon name="chevRight" size={20} stroke={2} />
        </button>
      </div>
    </div>
  );
}

// The waitlist form's sign-ups share the waitlist survey's source, so they land
// in survey_followups as "Add to the waitlist" beside it, with no answers.
const WAITLIST_SOURCE = 'landing_survey';

/* The close of the page: an email field and a button, on an ink band. */
function WaitlistSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await saveSurveyResponse({ source: WAITLIST_SOURCE, email: email.trim() });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="placer-landing-waitlist" aria-labelledby="placer-landing-waitlist-title">
      <h2 id="placer-landing-waitlist-title" className="placer-landing-waitlist-title">
        Join the waitlist
      </h2>
      <p className="placer-landing-waitlist-text">
        Be the first to use PLACER. Leave your email and we’ll let you know when it’s ready.
      </p>

      {status === 'done' ? (
        <p role="status" className="placer-landing-waitlist-done">Thanks — you’re on the list.</p>
      ) : (
        <form className="placer-landing-waitlist-form" onSubmit={submit}>
          <label htmlFor="placer-landing-waitlist-email" className="placer-landing-waitlist-label">Email</label>
          <input
            id="placer-landing-waitlist-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
          </button>
        </form>
      )}

      {status === 'error' && (
        <p role="alert" className="placer-landing-waitlist-error">That did not go through. Please try again.</p>
      )}
    </section>
  );
}

export function LandingPage({ t }) {
  return (
    // Both drawings are published as custom properties so index.css can swap in
    // the portrait one on a phone, which an inline background-image would not allow.
    <div className="placer-landing" style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: t.page,
      '--placer-landing-city': `url(${cityDrawing})`,
      '--placer-landing-city-mobile': `url(${cityDrawingMobile})`,
    }}>
      {/* The pitch on the left, the isometric city on the right. A phone stacks
        * them, the pitch first. Sizes and layout live in index.css. */}
      <section className="placer-landing-hero">
        <div className="placer-landing-hero-text">
          <h1 className="placer-landing-title" style={{ color: t.ink }}>
            Understand, imagine and plan. Together.
          </h1>

          <p className="placer-landing-pitch">
            Get everyone involved in shaping the world around. With tools built for
            interaction, you’ll spark engagement and turn live insights into action.
          </p>

          {/* The platform is not open yet, so getting started means the waitlist. */}
          <HaveYourSay t={t} className="placer-landing-cta" label="Get started" />
        </div>

        {/* Decoration, so it goes in as a CSS background and never reaches
          * assistive tech. The frame clips the slow zoom of the layer inside it. */}
        <div className="placer-landing-hero-art" aria-hidden="true">
          <div className="placer-landing-city" />
        </div>
      </section>

      <section className="placer-landing-partners" aria-labelledby="placer-landing-partners-title">
        <h2 id="placer-landing-partners-title" className="placer-landing-partners-title">
          Developed with leading design experts
        </h2>
        <ul className="placer-landing-partners-list">
          {PARTNERS.map((partner) => (
            <li key={partner.name}>
              <a className="placer-landing-partner" href={partner.href} target="_blank" rel="noopener noreferrer">
                {partner.logo
                  ? <img src={partner.logo} alt={partner.name} />
                  : <span className="placer-landing-partner-name">{partner.name}</span>}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works, in a line: ask, hear back live, act on it. */}
      <section className="placer-landing-statement" aria-labelledby="placer-landing-statement-title">
        <h2 id="placer-landing-statement-title" className="placer-landing-statement-title" style={{ color: t.ink }}>
          Good questions,<br />great insights.
        </h2>
        <p className="placer-landing-statement-text">
          Start with a question. Get answers in real time. Use what you learn to shape what comes next.
        </p>

        <LandingSteps />
      </section>

      <LandingTestimonials />

      {/* Why it matters, after what people say. */}
      <section className="placer-landing-statement" aria-labelledby="placer-landing-engagement-title">
        <h2 id="placer-landing-engagement-title" className="placer-landing-statement-title" style={{ color: t.ink }}>
          More engagement,<br />every day.
        </h2>
        <p className="placer-landing-statement-text">
          Easily add participation into more areas of work and learning, helping everyone engage more and understand better.
        </p>

        <LandingAudiences />
      </section>

      {/* How quickly it gets going, over three cards. */}
      <section className="placer-landing-statement" aria-labelledby="placer-landing-start-title">
        <h2 id="placer-landing-start-title" className="placer-landing-statement-title" style={{ color: t.ink }}>
          Easy to start.<br />Simple to connect.
        </h2>
        <p className="placer-landing-statement-text">
          Choose a template, create from scratch, or prompt AI. You’ll be ready to present and interact in no time,
          no matter where your audience is.
        </p>

        <ul className="placer-landing-start-cards">
          {START_CARDS.map((card) => (
            <li key={card.key} className="placer-landing-start-card">
              <div className="placer-landing-start-card-media">
                {card.media
                  ? <video src={card.media} autoPlay muted loop playsInline />
                  : <span className="placer-landing-step-placeholder">{card.title}</span>}
              </div>
              <h3 className="placer-landing-start-card-title">{card.title}</h3>
              <p className="placer-landing-start-card-text">{card.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* What participation does, over the case studies. */}
      <section className="placer-landing-statement" aria-labelledby="placer-landing-power-title">
        <h2 id="placer-landing-power-title" className="placer-landing-statement-title" style={{ color: t.ink }}>
          The power of<br />participation.
        </h2>
        <p className="placer-landing-statement-text">
          PLACER makes it simple to bring people into decisions about the places they share, and to turn what they
          tell you into change that lasts.
        </p>

        <LandingCases />
      </section>

      <WaitlistSignup />
    </div>
  );
}

export default LandingPage;
