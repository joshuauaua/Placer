/* PLACER — "Have your say": a floating trigger, and the survey it opens.
 *
 * The landing page is a holding page, so the survey is offered rather than
 * imposed: a button straddling the rule between the pitch and the credit
 * (see LandingPage), and the same flow that /survey renders lifted into a
 * dialog over the page instead of replacing it.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { Icon } from './Icon';
import defaultSurveyContent from './survey/content/default.json';

// The survey drags in the whole flow, its content and the api layer. Most
// visitors to a holding page never open it, so it is fetched on the click
// rather than bundled with the page.
const SurveyPage = lazy(() => import('./SurveyPage'));

const LABEL = 'Follow the Project';

// Same survey as /survey, but opened from a "follow the project" button rather
// than found on its own page, so the cover page greets that intent instead of
// the generic one.
export const LANDING_SURVEY_CONTENT = {
  ...defaultSurveyContent,
  hero: {
    ...defaultSurveyContent.hero,
    title: 'Thanks for wanting to follow the project',
    subtitle: 'First, can you answer a few questions to help us understand how you’d use PLACER? It takes about three minutes, and it shapes what we build next.',
  },
};

// Deliberately off-palette: the theme is black and white, and this one call to
// action is the exception rather than an accent drawn from it.
const TRIGGER_BG = '#00FFF9';
const TRIGGER_FG = '#000000';

// Above the cookie banner (200), so an open survey is not overlapped by it. The
// trigger sits below it and clears it by offsetting instead (see index.css).
const DIALOG_Z = 300;

// Everything the browser will let us focus inside the panel, in tab order.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Fallback({ t }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: t.page, fontSize: 14, color: t.inkDim,
    }}>
      Loading…
    </div>
  );
}

export function HaveYourSay({ t }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const panel = panelRef.current;

    // Escape closes it, the way a dialog is expected to. Tab wraps at both ends
    // so focus cannot wander off into the page behind the scrim, which is inert
    // to a mouse but not otherwise to a keyboard.
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const stops = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      // Anything outside the panel counts as past the end: the next Tab from
      // there belongs back at the top of the dialog.
      if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // The panel itself, not the first control: the survey opens on its intro
    // copy, and that should be read before the button that skips past it.
    panel?.focus();

    // The page behind the dialog should stay where it is while the survey scrolls.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Put the caret back where the visitor left it.
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="placer-feedback-trigger"
        onClick={() => setOpen(true)}
        // Shape and place live in index.css: a phone gets a bar instead of a
        // pill, and a media query cannot override an inline style.
        style={{ background: TRIGGER_BG, color: TRIGGER_FG, boxShadow: t.shadow }}
      >
        {LABEL}
      </button>

      {open && (
        <div
          // A click on the scrim is deliberately not a close: a part-finished
          // survey is easy to lose and hard to retype. The × and Escape do it.
          style={{
            position: 'fixed', inset: 0, zIndex: DIALOG_Z,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={LABEL}
            tabIndex={-1}
            // A definite height, because the survey fills what it is given. It is in
            // index.css rather than here because it needs the vh/dvh fallback pair,
            // which one style object cannot hold.
            className="placer-survey-dialog"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 900,
              background: t.page,
              border: `1px solid ${t.line}`,
              borderRadius: 16,
              boxShadow: t.shadow,
              overflow: 'hidden',
              outline: 'none',
            }}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close the survey"
              style={{
                position: 'absolute', top: 14, right: 14, zIndex: 1,
                width: 34, height: 34, borderRadius: '50%',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                // Legible against the survey's own header, whichever theme is on.
                background: 'rgba(22,21,15,0.62)', color: '#FFFFFF',
              }}
            >
              <Icon name="close" size={18} stroke={2.4} />
            </button>

            <Suspense fallback={<Fallback t={t} />}>
              <SurveyPage
                t={t}
                content={LANDING_SURVEY_CONTENT}
                height="100%"
                // Distinguishes a response left here from one left on /survey.
                source="landing_survey"
                idPrefix="landing-survey"
                // Closing beats the default, which walks the browser to / and
                // would reload the very page the dialog is sitting on.
                onClose={() => setOpen(false)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}

export default HaveYourSay;
