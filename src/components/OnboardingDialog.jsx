/* PLACER — the welcome tour, the first time somebody signs in.
 *
 * A cover saying what PLACER is, with one button, Get started. Then five steps:
 * projects — the heart of it — the Toolkit, Explore, starting a project and the
 * profile, each going there. The cover is not counted as a step and
 * has no dot. Going there
 * does not end the tour: the page changes underneath and the tour moves on to its next
 * step, over the new page (WelcomeTour keeps it open across pages). Only the last
 * step's button ends it. Next
 * and Back (or the arrow keys) move between steps; the close button or Escape end the
 * tour from any step. The last step has no Done: its own button, Edit my profile, takes
 * Next's place. Every way out calls
 * `onClose`, which is where WelcomeTour records that the tour has been seen
 * (services/onboarding.js), so it opens once per account however it was left.
 *
 * A click outside the panel does nothing: on a first visit that is far more likely a
 * stray click than a wish to skip the whole tour.
 *
 * A step with a `spotlight` points at the real thing instead of offering a button: the
 * screen darkens around the side nav's item for it (SideNav marks each with data-tour),
 * a ring pulses round it, and clicking it there does what the item does. The ring says
 * it all, so there is no line of text telling them to click it. Where that item is not on screen the step falls back to its `action` button.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { PALETTE } from '../theme';

/**
 * The steps, in order. Each shows an `icon` from the set, or an `image` in its place.
 * `points` adds a numbered list under the body, and `more` a paragraph after it.
 * `action` names the prop its button calls, and is left out when there is none.
 */
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    cover: true,
    // The bench from the favicon (public/favicon.svg), PLACER's own mark, rather than
    // an icon from the set. It is drawn on white, the same as the tile it sits in.
    image: '/favicon.svg',
    colour: PALETTE.purple,
    title: (name) => (name ? `Welcome to PLACER, ${name}` : 'Welcome to PLACER'),
    body: 'PLACER is an open toolkit for shaping shared places together with the people '
      + 'who use them. Here is a quick look around, in five steps.',
  },
  {
    id: 'projects',
    icon: 'grid',
    colour: PALETTE.orange,
    title: () => 'Projects are where change starts',
    body: 'A project is how people say what they want to change about a place, and bring '
      + 'others in to shape it. Everything in PLACER gathers around a project page: people, '
      + 'ideas, updates and its decisions. Have a look at what others have started.',
    spotlight: { target: 'projects', label: 'Projects', call: 'onOpenProjects' },
    action: { label: 'See the projects', icon: 'grid', call: 'onOpenProjects' },
  },
  {
    id: 'toolkit',
    icon: 'layers',
    colour: PALETTE.blue,
    title: () => 'Check out the Toolkit',
    body: 'In the Toolkit you can explore tools from expert organisations. Each one is for:',
    points: [
      'Understanding a place and collecting data about it',
      'Imagining and visualising ideas for it',
      'Planning to drive change in it',
    ],
    more: 'Some are done solo and others in a group, and they come in all shapes and sizes. '
      + 'We recommend mixing and matching them to fit what your project needs.',
    spotlight: { target: 'toolkit', label: 'Toolkit', call: 'onOpenToolkit' },
    action: { label: 'Browse the Toolkit', icon: 'layers', call: 'onOpenToolkit' },
  },
  {
    id: 'explore',
    icon: 'pin',
    colour: PALETTE.orange,
    title: () => 'Explore what is happening',
    body: 'The Explore map shows projects and organisations near you. Follow the ones you '
      + 'care about, and their news lands in Your Activity on the dashboard.',
    spotlight: { target: 'map', label: 'Explore', call: 'onExplore' },
    action: { label: 'Open the map', icon: 'pin', call: 'onExplore' },
  },
  {
    id: 'project',
    icon: 'grid',
    colour: PALETTE.purple,
    title: () => 'Start your own project',
    body: 'When you are ready, start your own project. Give it a location and a timeframe, '
      + 'choose its tools, and share a public page where anyone can take part.',
    spotlight: { target: 'newProject', label: 'New project', call: 'onNewProject' },
    action: { label: 'Create a project', icon: 'plus', call: 'onNewProject' },
  },
  {
    id: 'profile',
    icon: 'user',
    colour: PALETTE.blue,
    title: () => 'Make your profile yours',
    body: 'Add a photo, a short bio and your home area, so people know who is behind a '
      + 'project, and the map opens where you are.',
    action: { label: 'Edit my profile', icon: 'pencil', call: 'onEditProfile' },
  },
];

// How far the spotlight's hole reaches past the item it is cut round.
const SPOTLIGHT_PAD = 6;

/** Where the side nav's `target` item is on screen, or null when it is not there to point at. */
function findTarget(target) {
  const element = target && document.querySelector(`[data-tour="${target}"]`);
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function OnboardingDialog({ t, name = '', onClose, onOpenProjects, onExplore, onOpenToolkit, onNewProject,
  onEditProfile }) {
  const [index, setIndex] = useState(0);
  const panelRef = useRef(null);
  const handlers = { onOpenProjects, onExplore, onOpenToolkit, onNewProject, onEditProfile };

  const step = ONBOARDING_STEPS[index];
  const last = index === ONBOARDING_STEPS.length - 1;
  // The cover comes first and is not one of the numbered steps.
  const numbered = ONBOARDING_STEPS.filter((s) => !s.cover);
  const stepNumber = (s) => numbered.indexOf(s) + 1;
  const titleId = 'onboarding-title';

  // The spotlit item's place, measured when the step opens and again whenever the window
  // changes size (the side nav collapses, or becomes the bottom bar).
  const [spot, setSpot] = useState(null);
  const spotlight = step.spotlight && handlers[step.spotlight.call] ? step.spotlight : null;
  useLayoutEffect(() => {
    if (!spotlight) {
      setSpot(null);
      return undefined;
    }
    const measure = () => setSpot(findTarget(spotlight.target));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [spotlight]);
  const spotlit = spotlight && spot;

  const action = !spotlit && step.action && handlers[step.action.call] ? step.action : null;

  // On the panel from the start, and again at each step: a step's button that has just
  // been used is gone, and focus would otherwise drop to the page underneath.
  useEffect(() => {
    panelRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      // Only while the panel itself has focus, so they do nothing new anywhere else.
      else if (e.target === panelRef.current && e.key === 'ArrowRight') {
        setIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
      } else if (e.target === panelRef.current && e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Go where the step points, then on to the next step over that page; from the last
  // step there is nothing left to show, so the tour ends.
  const go = (call) => {
    if (last) onClose();
    else setIndex(index + 1);
    handlers[call]();
  };

  const hole = spotlit && {
    position: 'fixed', top: spot.top - SPOTLIGHT_PAD, left: spot.left - SPOTLIGHT_PAD,
    width: spot.width + SPOTLIGHT_PAD * 2, height: spot.height + SPOTLIGHT_PAD * 2, borderRadius: 16,
  };

  return (
    // With a spotlight the dimming is the hole's own shadow, so the item shows through.
    // When the item is low on the screen (the phone's bottom bar), the panel keeps above it.
    <div style={{ position: 'fixed', inset: 0, zIndex: 190, background: spotlit ? 'transparent' : 'rgba(0, 0, 0, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      paddingBottom: spotlit && spot.top > window.innerHeight / 2
        ? window.innerHeight - spot.top + SPOTLIGHT_PAD + 16 : 16 }}>
      {spotlit && (
        <>
          <div aria-hidden="true" className="placer-tour-spotlight"
            style={{ ...hole, pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
              '--placer-tour-ring': step.colour.c300 }} />
          {/* Over the item itself, so the click lands here rather than on the dimmed page;
              it does what the item would. */}
          <button type="button" onClick={() => go(spotlight.call)} aria-label={spotlight.label}
            style={{ ...hole, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
        </>
      )}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby="onboarding-body" tabIndex={-1}
        style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto', background: t.surface, borderRadius: 20, boxShadow: t.shadow, outline: 'none',
          fontFamily: 'var(--placer-font)', color: t.ink }}>
        <button type="button" onClick={onClose} aria-label="Close the welcome tour"
          style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 10,
            border: 'none', background: 'rgba(255, 255, 255, 0.7)', cursor: 'pointer', color: t.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} stroke={2} />
        </button>

        <div aria-hidden="true" style={{ height: 168, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: `linear-gradient(135deg, ${step.colour.c100} 0%, ${step.colour.c300} 100%)` }}>
          <span style={{ width: 88, height: 88, borderRadius: 24, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: t.surface, color: step.colour.c700,
            boxShadow: `inset 0 0 0 1.5px ${step.colour.c700}` }}>
            {step.image
              ? <img src={step.image} alt="" width={72} height={72} style={{ display: 'block' }} />
              : <Icon name={step.icon} size={40} stroke={1.8} />}
          </span>
        </div>

        <div style={{ padding: '24px 28px 0' }}>
          {!step.cover && (
            <p className="placer-mono" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: step.colour.c700, margin: '0 0 8px' }}>
              Step {stepNumber(step)} of {numbered.length}
            </p>
          )}
          <h2 id={titleId} className="placer-disp" style={{ fontSize: 26, fontWeight: 700,
            letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 10px', overflowWrap: 'anywhere' }}>
            {step.title(name)}
          </h2>
          <p id="onboarding-body" style={{ fontSize: 15.5, lineHeight: 1.6, color: t.inkDim, margin: 0 }}>
            {step.body}
          </p>
          {step.points && (
            <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 8 }}>
              {step.points.map((point, i) => (
                <li key={point} style={{ display: 'flex', alignItems: 'baseline', gap: 10,
                  fontSize: 15.5, lineHeight: 1.5, color: t.ink }}>
                  <span className="placer-mono" aria-hidden="true" style={{ flexShrink: 0, width: 22, height: 22,
                    borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, background: step.colour.c100, color: step.colour.c900 }}>
                    {i + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ol>
          )}
          {step.more && (
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: t.inkDim, margin: '12px 0 0' }}>{step.more}</p>
          )}
          {action && !last && (
            <div style={{ marginTop: 18 }}>
              <Btn t={t} variant="outline" size="sm" icon={action.icon} onClick={() => go(action.call)}>{action.label}</Btn>
            </div>
          )}
        </div>

        {step.cover ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 28px 24px' }}>
            <Btn t={t} icon="arrowRight" onClick={() => setIndex(index + 1)}>Get started</Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            flexWrap: 'wrap', padding: '24px 28px 24px' }}>
            <ol aria-label="Steps" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: 6 }}>
              {numbered.map((s) => {
                const i = ONBOARDING_STEPS.indexOf(s);
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => setIndex(i)}
                      aria-label={`Step ${stepNumber(s)}: ${s.title('')}`}
                      aria-current={i === index ? 'step' : undefined}
                      style={{ display: 'block', width: i === index ? 22 : 8, height: 8, padding: 0, border: 'none',
                        borderRadius: 999, cursor: 'pointer',
                        background: i === index ? t.ink : t.lineStrong }} />
                  </li>
                );
              })}
            </ol>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <Btn t={t} variant="ghost" icon="chevLeft" onClick={() => setIndex(index - 1)}>Back</Btn>
              {!last && <Btn t={t} onClick={() => setIndex(index + 1)}>Next</Btn>}
              {last && (action
                ? <Btn t={t} icon={action.icon} onClick={() => go(action.call)}>{action.label}</Btn>
                : <Btn t={t} onClick={onClose}>Done</Btn>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingDialog;
