/* PLACER — the survey shell: intro, one question per screen, email, thank you.
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
  fontFamily: "'Archivo', sans-serif",
  outline: 'none',
});

// The label above any text field on the final step.
const fieldLabelStyle = (t) => ({
  display: 'block',
  fontSize: 14,
  fontWeight: 700,
  color: t.ink,
  marginBottom: 8,
});

// The browser's own hint for the contact fields a survey can ask for. Anything
// not listed is left for the browser to guess.
const AUTOCOMPLETE = {
  name: 'name',
  organization: 'organization',
  email: 'email',
};

// The alert red used across the app.
const DANGER = '#D6452F';

/** A centred card on the gradient, shared by the intro and thank-you screens. */
function FullScreen({ t, children }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${t.page} 0%, ${t.chrome} 100%)`,
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 600, textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/**
 * The default final step: a consent box that gates one address field. Without
 * the box ticked there is nothing to validate and Submit stays available.
 */
function ConsentStep({ t, content, survey, consentId, emailId, onEnter }) {
  return (
    <>
      <label
        htmlFor={consentId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          borderRadius: 12,
          border: `2px solid ${survey.wantsReport ? t.accent : t.line}`,
          background: survey.wantsReport
            ? t.accent + (t.mapMode === 'dark' ? '14' : '22')
            : t.surface,
          cursor: 'pointer',
        }}
      >
        <input
          id={consentId}
          type="checkbox"
          checked={survey.wantsReport}
          onChange={(e) => survey.setWantsReport(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: t.accent, cursor: 'pointer', flex: '0 0 auto' }}
        />
        <span style={{ fontSize: 16, fontWeight: survey.wantsReport ? 600 : 500, color: t.ink }}>
          {content.steps.consentLabel}
        </span>
      </label>

      {survey.wantsReport && (
        <div style={{ marginTop: 24 }}>
          <label htmlFor={emailId} style={fieldLabelStyle(t)}>
            {content.steps.emailLabel}
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={survey.email}
            placeholder={content.steps.emailPlaceholder}
            onChange={(e) => survey.setEmail(e.target.value)}
            onKeyDown={onEnter}
            style={inputStyle(t)}
          />
        </div>
      )}
    </>
  );
}

/**
 * The lead-capture final step, for content carrying a `contact` block: the
 * opt-in asked as a normal question, and the fields the chosen answer reveals.
 */
function ContactStep({ t, survey, idPrefix, onEnter }) {
  const { contact } = survey;

  return (
    <>
      <SurveyQuestion
        t={t}
        question={contact.question}
        value={survey.contactChoice}
        onToggle={survey.setContactChoice}
      />

      {survey.contactRevealed && (
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {contact.fields.map((field) => {
            const fieldId = `${idPrefix}-${field.key}`;
            return (
              <div key={field.key}>
                <label htmlFor={fieldId} style={fieldLabelStyle(t)}>
                  {field.label}
                </label>
                <input
                  id={fieldId}
                  type={field.type ?? 'text'}
                  autoComplete={AUTOCOMPLETE[field.key]}
                  required={field.required}
                  value={survey.contactValues[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(e) => survey.setContactField(field.key, e.target.value)}
                  onKeyDown={onEnter}
                  style={inputStyle(t)}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * @param content  a validated survey, from `resolveSurveyContent`
 * @param submit   persists the finished response; rejects if it could not
 * @param source   tag recorded with the response, e.g. `community_survey`
 * @param idPrefix namespaces the final step's field ids, so two surveys never collide
 */
export function SurveyForm({ t, content, submit, source, idPrefix = 'survey' }) {
  const survey = useSurveyForm({ content, submit, source });
  const { step } = survey;

  if (step === 'intro') {
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

  const onEmailStep = step === 'email';
  const heading = onEmailStep ? content.steps.emailTitle : content.steps[`${step}Title`];
  const description = onEmailStep
    ? content.steps.emailDescription
    : content.steps[`${step}Description`];
  const counterText = onEmailStep
    ? 'Final step'
    : `${survey.currentQuestionNumber} / ${survey.totalQuestions}`;

  const emailId = `${idPrefix}-email`;
  const consentId = `${idPrefix}-consent`;

  // There is no <form> around the final step's fields — the shared Btn renders a
  // submit button, which would make Back and Next submit too.
  const submitOnEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    survey.onSubmit();
  };

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
      {/* Section heading, position in the survey, and progress */}
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

      {/* The current question, or the email field */}
      <div
        ref={survey.scrollRef}
        className="placer-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '48px 32px' }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
            {description}
          </p>

          {onEmailStep ? (
            <div>
              {survey.contact ? (
                <ContactStep t={t} survey={survey} idPrefix={idPrefix} onEnter={submitOnEnter} />
              ) : (
                <ConsentStep
                  t={t}
                  content={content}
                  survey={survey}
                  consentId={consentId}
                  emailId={emailId}
                  onEnter={submitOnEnter}
                />
              )}

              {/* A failed save, not a rejected address — so it sits outside the
                  field group and shows whether or not the field is here. */}
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
                question={survey.currentQuestion}
                value={survey.currentAnswer}
                onToggle={survey.toggleOption}
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
  );
}

export default SurveyForm;
