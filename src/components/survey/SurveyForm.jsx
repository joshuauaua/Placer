/* PLACER — the survey shell: cover, one question per screen, opt-ins, thank you.
 *
 * Everything shown comes from the content passed in, so a different survey is a
 * different JSON file rather than a different component.
 */

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
  borderRadius: 8,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

// The alert red used across the app.
const DANGER = '#D6452F';

const selectedFill = (t) => t.accent + (t.mapMode === 'dark' ? '14' : '22');

/**
 * A centred card on the gradient, shared by the cover and thank-you screens. The
 * cover runs to several paragraphs and a glossary, so the pane scrolls rather
 * than clipping on a short window.
 */
function FullScreen({ t, children }) {
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
      <div style={{ maxWidth: 640, width: '100%', margin: 'auto', textAlign: 'center' }}>
        {children}
      </div>
    </div>
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
      <FullScreen t={t}>
        <div
          style={{
            width: 80,
            height: 80,
            background: t.accent,
            borderRadius: 16,
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="comment" size={44} stroke={2.2} style={{ color: t.accentInk }} />
        </div>

        <h1
          className="placer-disp"
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 24,
          }}
        >
          {content.cover.title}
        </h1>

        {/* Left-aligned: three justified paragraphs of centred text are hard work. */}
        <div style={{ textAlign: 'left', marginBottom: 32 }}>
          {content.cover.body.map((paragraph) => (
            <p
              key={paragraph.slice(0, 48)}
              style={{ fontSize: 17, color: t.inkDim, lineHeight: 1.7, marginBottom: 16 }}
            >
              {paragraph}
            </p>
          ))}
        </div>

        {content.cover.glossary && (
          <div
            style={{
              textAlign: 'left',
              padding: '20px 28px 6px',
              marginBottom: 32,
              background: t.surface,
              border: `1px solid ${t.line}`,
              borderRadius: 16,
            }}
          >
            <h2
              className="placer-disp"
              style={{
                fontSize: 15,
                fontWeight: 800,
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

        <Btn t={t} variant="accent" size="lg" icon="arrowRight" onClick={survey.handleNext}>
          {content.cover.startLabel}
        </Btn>
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
              fontWeight: 900,
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
  const description = onOptInStep
    ? content.steps.optInDescription
    : content.steps[`${step}Description`];
  const counterText = onOptInStep
    ? 'Final step'
    : `${survey.currentQuestionNumber} / ${survey.totalQuestions}`;

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
                fontWeight: 800,
                color: t.ink,
                letterSpacing: '-0.02em',
              }}
            >
              {heading}
            </h2>
            <span
              className="placer-mono"
              style={{ fontSize: 13, fontWeight: 600, color: t.inkDim, whiteSpace: 'nowrap' }}
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
          <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
            {description}
          </p>

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
                      fontWeight: 800,
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
                            // There is no <form> around this — the shared Btn renders
                            // a submit button, which would make Back and Next submit too.
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                survey.onSubmit();
                              }
                            }}
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
                    borderRadius: 8,
                    background: `${DANGER}22`,
                    borderLeft: `4px solid ${DANGER}`,
                    fontSize: 14,
                    fontWeight: 600,
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
                labels={content.steps}
                question={survey.currentQuestion}
                value={survey.currentAnswer}
                otherText={survey.currentOtherText}
                onToggle={survey.toggleOption}
                onText={survey.setWrittenAnswer}
                onOtherText={survey.setOtherAnswer}
              />
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
  );
}

export default SurveyForm;
