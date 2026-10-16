/* PLACER — the welcome tour, the first time somebody signs in.
 *
 * Five steps over the dashboard: what PLACER is, then Explore, the Toolkit, projects
 * and the profile, each with a button that goes there. Next and Back (or the arrow
 * keys) move between them; Skip, the close button or Escape end the tour from any
 * step, as does Get started on the last one or any step's own button. Every way out
 * calls `onClose`, which is where DashboardPage records that the tour has been seen
 * (services/onboarding.js), so it opens once per account however it was left.
 *
 * A click outside the panel does nothing: on a first visit that is far more likely a
 * stray click than a wish to skip the whole tour.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { PALETTE } from '../theme';
import { CATEGORIES } from '../toolkit/tools';

/** The steps, in order. `action` names the prop its button calls, and is left out when there is none. */
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    icon: 'sparkle',
    colour: PALETTE.purple,
    title: (name) => (name ? `Welcome to PLACER, ${name}` : 'Welcome to PLACER'),
    body: 'PLACER is an open toolkit for shaping public places together with the people '
      + 'who use them. Here is a quick look around, in five steps.',
  },
  {
    id: 'explore',
    icon: 'pin',
    colour: PALETTE.blue,
    title: () => 'Explore what is happening',
    body: 'The Explore map shows projects and organisations near you. Follow the ones you '
      + 'care about, and their news lands in Your Activity on the dashboard.',
    action: { label: 'Open the map', icon: 'pin', call: 'onExplore' },
  },
  {
    id: 'toolkit',
    icon: 'layers',
    colour: PALETTE.orange,
    title: () => 'Try the Toolkit',
    body: 'Tools to understand a place, imagine what it could be and plan what happens next: '
      + 'polls, word clouds, site mapping, co-budgets and more. Try one on your own, or run '
      + 'it live with a room full of people.',
    categories: true,
    action: { label: 'Browse the Toolkit', icon: 'layers', call: 'onOpenToolkit' },
  },
  {
    id: 'project',
    icon: 'grid',
    colour: PALETTE.purple,
    title: () => 'Start a project',
    body: 'A project gathers people around one place. Give it a location and dates, choose '
      + 'its tools, and share a public page where anyone can take part.',
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

export function OnboardingDialog({ t, name = '', onClose, onExplore, onOpenToolkit, onNewProject, onEditProfile }) {
  const [index, setIndex] = useState(0);
  const panelRef = useRef(null);
  const handlers = { onExplore, onOpenToolkit, onNewProject, onEditProfile };

  const step = ONBOARDING_STEPS[index];
  const last = index === ONBOARDING_STEPS.length - 1;
  const action = step.action && handlers[step.action.call] ? step.action : null;
  const titleId = 'onboarding-title';

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

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

  const go = () => {
    onClose();
    handlers[action.call]();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(0, 0, 0, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
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
            <Icon name={step.icon} size={40} stroke={1.8} />
          </span>
        </div>

        <div style={{ padding: '24px 28px 0' }}>
          <p className="placer-mono" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: step.colour.c700, margin: '0 0 8px' }}>
            Step {index + 1} of {ONBOARDING_STEPS.length}
          </p>
          <h2 id={titleId} className="placer-disp" style={{ fontSize: 26, fontWeight: 700,
            letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 10px', overflowWrap: 'anywhere' }}>
            {step.title(name)}
          </h2>
          <p id="onboarding-body" style={{ fontSize: 15.5, lineHeight: 1.6, color: t.inkDim, margin: 0 }}>
            {step.body}
          </p>
          {step.categories && (
            <ul aria-label="Toolkit categories" style={{ listStyle: 'none', padding: 0, margin: '14px 0 0',
              display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.map((category) => (
                <li key={category.id} className="placer-mono" style={{ fontSize: 11.5, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999,
                  background: category.colour.c100, color: category.colour.c900 }}>
                  {category.name}
                </li>
              ))}
            </ul>
          )}
          {action && (
            <div style={{ marginTop: 18 }}>
              <Btn t={t} variant="outline" size="sm" icon={action.icon} onClick={go}>{action.label}</Btn>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap', padding: '24px 28px 24px' }}>
          <ol aria-label="Steps" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: 6 }}>
            {ONBOARDING_STEPS.map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => setIndex(i)}
                  aria-label={`Step ${i + 1}: ${s.title('')}`} aria-current={i === index ? 'step' : undefined}
                  style={{ display: 'block', width: i === index ? 22 : 8, height: 8, padding: 0, border: 'none',
                    borderRadius: 999, cursor: 'pointer',
                    background: i === index ? t.ink : t.lineStrong }} />
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {index === 0
              ? <Btn t={t} variant="ghost" onClick={onClose}>Skip</Btn>
              : <Btn t={t} variant="ghost" icon="chevLeft" onClick={() => setIndex(index - 1)}>Back</Btn>}
            {last
              ? <Btn t={t} onClick={onClose}>Get started</Btn>
              : <Btn t={t} onClick={() => setIndex(index + 1)}>Next</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingDialog;
