/* PLACER — the survey shell: intro, one question per screen, email, thank you.
 *
 * Everything shown comes from the content passed in, so a different survey is a
 * different JSON file rather than a different component.
 */

import markIntro from '../../assets/street-bench.png';
import markSuccess from '../../assets/street-planter-cube.png';
import { Btn } from '../UI';
import { SurveyQuestion } from './SurveyQuestion';
import { useSurveyForm } from './useSurveyForm';

// Matches the form inputs on Describe and the admin dashboard.
const inputStyle = (t) => ({
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  border: `1.5px solid ${t.line}`,
  borderRadius: 12,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

// The alert red used across the app.
const DANGER = '#B3261E';

/* The acknowledgement above Submit. It opens the legal page in a new tab, so a
 * reader who follows it comes back to a survey with its answers intact. */
function TermsNotice({ t, labels }) {
  return (
    <p style={{ marginTop: 24, fontSize: 13, color: t.inkDim, lineHeight: 1.6 }}>
      {labels.termsNotice}{' '}
      <a
        href="/terms-and-privacy"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: t.ink, fontWeight: 600, textDecoration: 'underline' }}
      >
        {labels.termsLinkLabel}
      </a>
      .
    </p>
  );
}

/* The drawings that open and close the survey. They are the only pictures in the
 * flow; the glyphs on Back, Next and the selected options are controls, not
 * illustration. Line art on a light ground, so they are shown as they are rather
 * than reversed out of an accent badge, and sized to be legible — the detail in
 * them is lost at icon size. The headings beside them carry the meaning, so they
 * are decoration as far as a screen reader is concerned.
 *
 * The height scales with the screen: see .placer-survey-mark in index.css. */
function Mark({ t, src }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="placer-survey-mark"
      // Black ink on a dark page is no drawing at all: reverse it instead.
      style={{ filter: t.mapMode === 'dark' ? 'invert(1)' : undefined }}
    />
  );
}

/** A centred card on the gradient, shared by the intro and thank-you screens.
 *
 * The layout, the padding and the centring that survives an overflow all live in
 * .placer-survey-screen. Given no height it fills the visible viewport itself, which
 * is what the /survey route wants; the dialog passes '100%' and keeps its own. */
function FullScreen({ t, height, glass, children }) {
  return (
    <div
      className={`placer-survey-screen${height ? '' : ' placer-viewport'}`}
      style={{
        width: '100%',
        height,
        // On glass the panel behind is the surface, so the gradient would only hide it.
        background: glass ? 'transparent' : `linear-gradient(135deg, ${t.page} 0%, ${t.chrome} 100%)`,
      }}
    >
      <div style={{ maxWidth: 600, textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/**
 * "Enter ↵ to continue", shown wherever Enter will actually do something — the
 * listener in useSurveyForm ignores a step that is not ready, so promising it on
 * one would be a lie. The same hint the Placemaking Trends survey shows.
 */
function EnterHint({ t, labels, phrase }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: t.inkDim,
      }}
    >
      <kbd
        className="placer-mono"
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          border: `1px solid ${t.line}`,
          background: t.chrome,
          color: t.ink,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {labels.enterKeyLabel}
      </kbd>
      {phrase}
    </span>
  );
}

// The question screen's header and footer bands when the survey sits on glass: a
// faint white wash over the blur rather than an opaque fill, so the bands still read
// as bands.
const GLASS_BAND = 'rgba(255, 255, 255, 0.35)';

/**
 * @param content  a validated survey, from `resolveSurveyContent`
 * @param submit   persists the finished response; rejects if it could not
 * @param source   tag recorded with the response, e.g. `community_survey`
 * @param idPrefix namespaces the email field's ids, so two surveys never collide
 * @param height   what the survey fills. Omitted as a route, where it takes the
 *                 visible viewport via .placer-viewport; '100%' in a dialog, which
 *                 has a definite height of its own
 * @param onClose  replaces the default "leave the survey" behaviour, which is a
 *                 navigation to / and no use to a caller already showing /
 * @param glass    drops the survey's own opaque backgrounds so a glass panel
 *                 behind it shows through (see HaveYourSay)
 */
export function SurveyForm({
  t,
  content,
  submit,
  source,
  idPrefix = 'survey',
  height,
  onClose,
  glass = false,
}) {
  const survey = useSurveyForm({ content, submit, source });
  const { step } = survey;

  if (step === 'intro') {
    return (
      <FullScreen t={t} height={height} glass={glass}>
        <Mark t={t} src={markIntro} />

        <h1
          className="placer-disp placer-survey-title"
          style={{
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}
        >
          {content.hero.title}
        </h1>

        <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
          {content.hero.subtitle}
        </p>

        <Btn t={t} variant="accent" size="lg" icon="arrowRight" onClick={survey.handleNext}>
          {content.hero.startLabel}
        </Btn>

        <div style={{ marginTop: 16 }}>
          <EnterHint t={t} labels={content.steps} phrase={content.steps.enterHintStart} />
        </div>
      </FullScreen>
    );
  }

  if (step === 'success') {
    return (
      // No card: the thank-you screen is the whole surface it is shown on, the
      // same as the intro. Inside the dialog a bordered card would read as a
      // second panel within the panel.
      <FullScreen t={t} height={height} glass={glass}>
        <Mark t={t} src={markSuccess} />

        <h1
          className="placer-disp placer-survey-title-success"
          style={{
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.02em',
            marginBottom: 16,
          }}
        >
          {content.success.title}
        </h1>

        <p
          style={{
            fontSize: 18,
            color: t.inkDim,
            lineHeight: 1.6,
            marginBottom: 32,
            whiteSpace: 'pre-line',
          }}
        >
          {content.success.body}
        </p>

        <Btn t={t} variant="accent" size="lg" onClick={onClose ?? survey.reset}>
          {content.success.closeLabel}
        </Btn>
      </FullScreen>
    );
  }

  const onEmailStep = step === 'email';
  const heading = onEmailStep ? content.steps.emailTitle : content.steps[`${step}Title`];
  // Only the closing step explains itself; a question is its own heading.
  const description = onEmailStep
    ? (survey.emailRequired
        ? content.steps.emailRequiredDescription
        : content.steps.emailDescription)
    : null;
  const counterText = onEmailStep
    ? 'Final step'
    : `${survey.currentQuestionNumber} / ${survey.totalQuestions}`;

  const emailId = `${idPrefix}-email`;

  // Whether Enter would do anything here, which is what the hint promises.
  const enterWorks = onEmailStep
    ? survey.canSubmit && !survey.isSubmitting
    : survey.currentQuestionValid;

  const band = glass ? GLASS_BAND : t.surface;

  return (
    <div
      className={height ? undefined : 'placer-viewport'}
      style={{
        width: '100%',
        height,
        display: 'flex',
        flexDirection: 'column',
        background: glass ? 'transparent' : t.page,
      }}
    >
      {/* Section heading, position in the survey, and progress */}
      <div
        className="placer-survey-head"
        style={{
          flex: '0 0 auto',
          borderBottom: `1px solid ${t.line}`,
          background: band,
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <h2
              className="placer-disp"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: '-0.02em',
              }}
            >
              {heading}
            </h2>
            <span
              className="placer-mono"
              style={{ fontSize: 13, fontWeight: 500, color: t.inkDim, whiteSpace: 'nowrap' }}
            >
              {counterText}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Survey progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(survey.progressValue)}
            style={{
              width: '100%',
              height: 6,
              background: t.chrome,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${survey.progressValue}%`,
                height: '100%',
                background: t.accent,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* The current question, or the email field */}
      <div
        ref={survey.scrollRef}
        className="placer-scroll placer-survey-body"
        style={{ flex: 1, overflowY: 'auto' }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {description && (
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
              {description}
            </p>
          )}

          {onEmailStep ? (
            <div>
              <div>
                <label
                  htmlFor={emailId}
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 700,
                    color: t.ink,
                    marginBottom: 8,
                  }}
                >
                  {content.steps.emailLabel}
                  {survey.emailRequired && <span aria-hidden="true"> *</span>}
                </label>
                <input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  required={survey.emailRequired}
                  aria-required={survey.emailRequired}
                  value={survey.email}
                  placeholder={content.steps.emailPlaceholder}
                  onChange={(e) => survey.setEmail(e.target.value)}
                  // There is no <form> around this — the shared Btn renders a
                  // submit button, which would make Back and Next submit too.
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      survey.onSubmit();
                    }
                  }}
                  style={inputStyle(t)}
                />
              </div>

              <TermsNotice t={t} labels={content.steps} />

              {/* A failed save, not a rejected address — so it sits outside the
                  field group and shows whether or not the field is here. */}
              {survey.errorMessage && (
                <div
                  role="alert"
                  style={{
                    marginTop: 24,
                    padding: 16,
                    borderRadius: 12,
                    background: `${DANGER}22`,
                    borderLeft: `4px solid ${DANGER}`,
                    fontSize: 14,
                    fontWeight: 500,
                    color: t.ink,
                  }}
                >
                  {survey.errorMessage}
                </div>
              )}
            </div>
          ) : (
            survey.currentQuestion && (
              <SurveyQuestion
                key={survey.currentQuestion.key}
                t={t}
                question={survey.currentQuestion}
                value={survey.currentAnswer}
                onToggle={survey.toggleOption}
                otherPicked={survey.currentOtherPicked}
                otherText={survey.currentOtherText}
                onOtherTextChange={survey.setCurrentOtherText}
                otherLabel={content.steps.otherLabel}
                otherPlaceholder={content.steps.otherPlaceholder}
              />
            )
          )}
        </div>
      </div>

      {/* Navigation */}
      <div
        className="placer-survey-foot"
        style={{
          flex: '0 0 auto',
          borderTop: `1px solid ${t.line}`,
          background: band,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Btn
            t={t}
            variant="ghost"
            icon="chevLeft"
            onClick={survey.handleBack}
            disabled={survey.isSubmitting}
          >
            {content.steps.backLabel}
          </Btn>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {enterWorks && (
              <EnterHint
                t={t}
                labels={content.steps}
                phrase={onEmailStep ? content.steps.enterHintSubmit : content.steps.enterHint}
              />
            )}

            {onEmailStep ? (
              <Btn
                t={t}
                variant="accent"
                icon="check"
                onClick={survey.onSubmit}
                disabled={!survey.canSubmit || survey.isSubmitting}
              >
                {survey.isSubmitting ? content.steps.submittingLabel : content.steps.submitLabel}
              </Btn>
            ) : (
              <Btn
                t={t}
                variant="accent"
                icon="arrowRight"
                onClick={survey.handleNext}
                disabled={!survey.currentQuestionValid}
              >
                {content.steps.nextLabel}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SurveyForm;
