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
import { CHARACTER } from '../theme';

// The survey drags in the whole flow, its content and the api layer. Most
// visitors to a holding page never open it, so it is fetched on the click
// rather than bundled with the page.
const SurveyPage = lazy(() => import('./SurveyPage'));

const LABEL = 'Join the Waitlist';

// Same survey as /survey, but opened from the landing page's Join the Waitlist button
// rather than found on its own page, so the cover page, the email step and the
// no-commitment answer speak to that intent instead of the generic one.
export const LANDING_SURVEY_CONTENT = {
  ...defaultSurveyContent,
  hero: {
    ...defaultSurveyContent.hero,
    title: 'Join the Waitlist',
    subtitle: 'We’ve just got a few quick questions for you',
    startLabel: 'Start',
  },
  steps: {
    ...defaultSurveyContent.steps,
    emailDescription: 'Leave your email to join the waitlist, and we’ll let you know when PLACER is ready.',
  },
  section3: defaultSurveyContent.section3.map((question) =>
    question.key !== 'coCreation' ? question : {
      ...question,
      options: question.options.map((option) =>
        option.value !== 'survey-only' ? option : { ...option, label: 'Joining the Waitlist only' }
      ),
    }
  ),
};

// The one call to action on the holding page, as a character button: the
// practitioner's purple 100 with a 1px 700 hairline and ink text, 300 on hover
// (see index.css). The brand kit's only colours are the three characters'.
const TRIGGER_BG = CHARACTER.practitioner.c100;
const TRIGGER_BORDER = CHARACTER.practitioner.c700;
const TRIGGER_FG = '#111111';

// The dialog is the nav bar's glass (see GLASS), so the survey inside paints no
// page colour of its own and the glass shows through. The header, footer and
// inputs stay white so the questions keep their contrast.
const surveyTheme = (t) => ({ ...t, page: 'transparent' });

// The nav bar's matte glass: 12% white over a 24px blur. The scrim under it is
// a light dim rather than the usual dark one, as ink type on glass over black
// would be unreadable.
const GLASS = {
  background: 'rgba(255, 255, 255, 0.12)',
  WebkitBackdropFilter: 'blur(24px) saturate(140%)',
  backdropFilter: 'blur(24px) saturate(140%)',
  border: '1px solid rgba(255, 255, 255, 0.45)',
};
const SCRIM = 'rgba(17, 17, 17, 0.12)';

// Above the cookie banner (200), so an open survey is not overlapped by it.
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

// `className` swaps the character button for another look, such as the landing
// card's text link, and drops the button's own colours with it.
export function HaveYourSay({ t, className }) {
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
        className={className ?? 'placer-feedback-trigger'}
        onClick={() => setOpen(true)}
        // Shape and place live in index.css: a phone gets a full-width bar, and
        // a media query cannot override an inline style.
        style={className ? undefined
          : { background: TRIGGER_BG, color: TRIGGER_FG, border: `1px solid ${TRIGGER_BORDER}` }}
      >
        {LABEL}
      </button>

      {open && (
        <div
          // A click on the scrim is deliberately not a close: a part-finished
          // survey is easy to lose and hard to retype. The × and Escape do it.
          style={{
            position: 'fixed', inset: 0, zIndex: DIALOG_Z,
            background: SCRIM,
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
              ...GLASS,
              // Only the top right corner is rounded; the other three are square.
              borderRadius: '0 16px 0 0',
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

            <Suspense fallback={<Fallback t={surveyTheme(t)} />}>
              <SurveyPage
                t={surveyTheme(t)}
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
