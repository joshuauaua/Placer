/* PLACER — the survey shell: cover, one question per screen, opt-ins, thank you.
 *
 * Everything shown comes from the content passed in, so a different survey is a
 * different JSON file rather than a different component.
 */

import coverArt from '../../assets/cover-bench.png';
import { Icon } from '../Icon';
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

const selectedFill = (t) => t.surfaceAlt;

/**
 * A centred card on the gradient, shared by the cover and thank-you screens. The
 * cover runs to several paragraphs and a glossary, so the pane scrolls rather
 * than clipping on a short window.
 */
function FullScreen({ t, children, maxWidth = 640 }) {
  return (
    <div
      className="placer-scroll"
      style={{
        width: '100%',
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${t.page} 0%, ${t.chrome} 100%)`,
        padding: 20,
      }}
    >
      <div style={{ maxWidth, width: '100%', margin: 'auto', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/**
 * "Enter ↵ to continue", shown wherever Enter will actually do something — the
 * listener in useSurveyForm ignores a step that is not ready, so promising it on
 * one would be a lie.
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
          fontWeight: 500,
        }}
      >
        {labels.enterKeyLabel}
      </kbd>
      {phrase}
    </span>
  );
}

/** A tickable row, used for both the opt-ins and (once) the old single consent. */
function CheckRow({ t, id, checked, label, onChange }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px',
        borderRadius: 12,
        border: `2px solid ${checked ? t.accent : t.line}`,
        background: checked ? selectedFill(t) : t.surface,
        cursor: 'pointer',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 20, height: 20, accentColor: t.accent, cursor: 'pointer', flex: '0 0 auto' }}
      />
      <span style={{ fontSize: 16, fontWeight: checked ? 600 : 500, color: t.ink, lineHeight: 1.5 }}>
        {label}
      </span>
    </label>
  );
}

/**
 * @param content  a validated survey, from `resolveSurveyContent`
 * @param submit   persists the finished response; rejects if it could not
 * @param source   tag recorded with the response, e.g. `community_survey`
 * @param idPrefix namespaces the closing step's ids, so two surveys never collide
 */
export function SurveyForm({ t, content, submit, source, idPrefix = 'survey' }) {
  const survey = useSurveyForm({ content, submit, source });
  const { step } = survey;

  if (step === 'cover') {
    return (
      <FullScreen t={t} maxWidth={1040}>
        {/* Across the top, over both columns. */}
        <h1
          className="placer-disp"
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 40,
          }}
        >
          {content.cover.title}
        </h1>

        {/* Two columns where there is room for them, one where there is not:
            auto-fit collapses the grid on a narrow window without a media query,
            which inline styles cannot express. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 40,
            // Centered rather than top-aligned: the glossary card is shorter than
            // the description column next to it, and pinning it to the top left
            // an awkward gap of its own underneath.
            alignItems: 'center',
            textAlign: 'left',
            marginBottom: 40,
          }}
        >
          <div>
            {/* Decorative: it says nothing the title and copy do not. */}
            <img
              src={coverArt}
              alt=""
              style={{ width: 168, height: 'auto', display: 'block', marginBottom: 24 }}
            />

            {content.cover.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 48)}
                style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.7, marginBottom: 16 }}
              >
                {paragraph}
              </p>
            ))}
          </div>

          {content.cover.glossary && (
            <div
              style={{
                padding: '20px 28px 6px',
                background: t.surface,
                border: `1px solid ${t.line}`,
                borderRadius: 16,
              }}
            >
              <h2
                className="placer-disp"
                style={{
                  // A step above the 15px terms below it, so the heading still
                  // reads as a heading over the rows it introduces.
                  fontSize: 18,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: '-0.01em',
                  marginBottom: 4,
                }}
              >
                {content.cover.glossaryTitle}
              </h2>

              {content.cover.glossary.map((entry, index) => (
                <details
                  key={entry.term}
                  className="placer-disclosure"
                  style={{ borderTop: index === 0 ? 'none' : `1px solid ${t.line}` }}
                >
                  <summary
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '14px 0',
                      fontSize: 15,
                      fontWeight: 700,
                      color: t.ink,
                    }}
                  >
                    {entry.term}
                    <span className="placer-disclosure-chev" aria-hidden="true">
                      <Icon name="chevDown" size={18} stroke={2.4} style={{ color: t.inkDim }} />
                    </span>
                  </summary>

                  <p style={{ margin: '0 0 16px', fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
                    {entry.definition}
                  </p>
                </details>
              ))}
            </div>
          )}
        </div>

        <Btn t={t} variant="accent" size="lg" icon="arrowRight" onClick={survey.handleNext}>
          {content.cover.startLabel}
        </Btn>

        <div style={{ marginTop: 16 }}>
          <EnterHint t={t} labels={content.steps} phrase={content.steps.enterHintStart} />
        </div>
      </FullScreen>
    );
  }

  if (step === 'success') {
    return (
      <FullScreen t={t}>
        <div
          style={{
            padding: 60,
            background: t.surface,
            borderRadius: 16,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadow,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              background: t.accent,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <Icon name="check" size={44} stroke={3} style={{ color: t.accentInk }} />
          </div>

          <h1
            className="placer-disp"
            style={{
              fontSize: 36,
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

          <Btn t={t} variant="accent" size="lg" onClick={survey.reset}>
            {content.success.closeLabel}
          </Btn>
        </div>
      </FullScreen>
    );
  }

  const onOptInStep = step === 'optIn';
  const heading = onOptInStep ? content.steps.optInTitle : content.steps[`${step}Title`];
  const counterText = onOptInStep
    ? 'Final step'
    : `${survey.currentQuestionNumber} / ${survey.totalQuestions}`;

  // Whether Enter would do anything here, which is what the hint promises.
  const enterWorks = onOptInStep
    ? survey.canSubmit && !survey.isSubmitting
    : survey.currentQuestionValid;

  // A paragraph is the one place Enter is not free: it says how to get a newline.
  const showNewLineHint =
    !onOptInStep && survey.currentQuestion && survey.currentQuestion.type === 'paragraph';

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: t.page,
      }}
    >
      {/* Module heading, position in the survey, and progress */}
      <div
        style={{
          flex: '0 0 auto',
          padding: '24px 32px',
          borderBottom: `1px solid ${t.line}`,
          background: t.surface,
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

      {/* The current question, or the closing opt-ins */}
      <div
        ref={survey.scrollRef}
        className="placer-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '48px 32px' }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {onOptInStep && (
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
              {content.steps.optInDescription}
            </p>
          )}

          {onOptInStep ? (
            <div>
              {/* The opt-ins gate the contact fields: with none ticked there is
                  nothing to validate and Submit stays available. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {content.optIns.map((entry) => (
                  <CheckRow
                    key={entry.key}
                    t={t}
                    id={`${idPrefix}-optin-${entry.key}`}
                    checked={survey.optIns[entry.key]}
                    label={entry.label}
                    onChange={() => survey.toggleOptIn(entry.key)}
                  />
                ))}
              </div>

              {survey.wantsContact && (
                <div style={{ marginTop: 32 }}>
                  <h3
                    className="placer-disp"
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: t.ink,
                      letterSpacing: '-0.01em',
                      marginBottom: 4,
                    }}
                  >
                    {content.contact.title}
                  </h3>
                  {content.contact.description && (
                    <p style={{ fontSize: 14, color: t.inkDim, marginBottom: 20 }}>
                      {content.contact.description}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 16,
                    }}
                  >
                    {content.contact.fields.map((field) => {
                      const fieldId = `${idPrefix}-${field.key}`;
                      return (
                        <div key={field.key}>
                          <label
                            htmlFor={fieldId}
                            style={{
                              display: 'block',
                              fontSize: 14,
                              fontWeight: 700,
                              color: t.ink,
                              marginBottom: 8,
                            }}
                          >
                            {field.label}
                          </label>
                          <input
                            id={fieldId}
                            type={field.type === 'email' ? 'email' : 'text'}
                            autoComplete={field.type === 'email' ? 'email' : 'off'}
                            value={survey.contact[field.key]}
                            placeholder={field.placeholder}
                            onChange={(e) => survey.setContactField(field.key, e.target.value)}
                            style={inputStyle(t)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* A failed save, not a rejected address — so it sits outside the
                  field group and shows whether or not the fields are here. */}
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
              <>
                <SurveyQuestion
                  key={survey.currentQuestion.key}
                  t={t}
                  labels={content.steps}
                  question={survey.currentQuestion}
                  value={survey.currentAnswer}
                  otherText={survey.currentOtherText}
                  onToggle={survey.toggleOption}
                  onText={survey.setWrittenAnswer}
                  onOtherText={survey.setOtherAnswer}
                />

                {showNewLineHint && (
                  <p style={{ marginTop: 12, fontSize: 13, color: t.inkDim }}>
                    {content.steps.newLineHint}
                  </p>
                )}
              </>
            )
          )}
        </div>
      </div>

      {/* Navigation */}
      <div
        style={{
          flex: '0 0 auto',
          padding: '24px 32px',
          borderTop: `1px solid ${t.line}`,
          background: t.surface,
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
                phrase={onOptInStep ? content.steps.enterHintSubmit : content.steps.enterHint}
              />
            )}

            {onOptInStep ? (
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
