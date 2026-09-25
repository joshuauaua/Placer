/* PLACER — the survey shell: cover, one question per screen, opt-ins, thank you.
 *
 * Everything shown comes from the content passed in, so a different survey is a
 * different JSON file rather than a different component.
 */

import coverPhoto from '../../assets/placemaking-trends-cover.webp';
import { Icon } from '../Icon';
import { PhotoSplit, PhotoSplitHeading } from '../PhotoSplit';
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

// The glass nav bar (.placer-glass-nav in index.css) is fixed over the top of every
// page, so each screen here starts this far down to keep its top out from under it.
const NAV_HEIGHT = 56;

/**
 * A centred card on the gradient, for the thank-you screen. The pane scrolls
 * rather than clipping on a short window.
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
        padding: `${NAV_HEIGHT + 20}px 20px 20px`,
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
function CheckRow({ t, id, checked, label, onChange, disabled = false }) {
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
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: 20,
          height: 20,
          accentColor: t.accent,
          cursor: disabled ? 'not-allowed' : 'pointer',
          flex: '0 0 auto',
        }}
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
    // The User Labs layout (see PhotoSplit): a photo from a lab on the left, the
    // title, copy and start button on the right.
    return (
      <PhotoSplit
        t={t}
        src={coverPhoto}
        alt="A deck of Dream It cards clipped to a plywood board beside a street map dotted with pins, from a participatory placemaking workshop."
      >
        <PhotoSplitHeading t={t} title={content.cover.title} subtitle={content.cover.subtitle} />

        <div style={{ marginTop: 20 }}>
          {content.cover.body.map((paragraph) => (
            <p
              key={paragraph.slice(0, 48)}
              style={{ fontSize: 17, color: t.inkDim, lineHeight: 1.65, marginBottom: 14 }}
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 20px', marginTop: 20 }}>
          <button
            onClick={survey.handleNext}
            className="placer-split-action"
            style={{ marginTop: 0, background: t.primaryBg, color: t.primaryFg }}
          >
            {content.cover.startLabel}
          </button>
          <EnterHint t={t} labels={content.steps} phrase={content.steps.enterHintStart} />
        </div>
      </PhotoSplit>
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
          padding: `${NAV_HEIGHT + 24}px 32px 24px`,
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
          {onOptInStep && content.steps.optInDescription && (
            <p
              style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 32, whiteSpace: 'pre-line' }}
            >
              {content.steps.optInDescription}
            </p>
          )}

          {onOptInStep ? (
            <div>
              {/* Always shown — not gated behind an opt-in any more. Submit still
                  stays available with all of it blank; typing anything here is
                  what makes the fields required to be complete (see wantsContact
                  in useSurveyForm). */}
              <div>
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
                          disabled={survey.isAnonymous}
                          placeholder={field.placeholder}
                          onChange={(e) => survey.setContactField(field.key, e.target.value)}
                          style={{
                            ...inputStyle(t),
                            ...(survey.isAnonymous && { opacity: 0.5, cursor: 'not-allowed' }),
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* A subheading above the checkboxes is optional content — a survey
                  whose opt-ins need no grouping label simply leaves it out. */}
              <div style={{ marginTop: 32 }}>
                {content.steps.optInChecklistTitle && (
                  <h3
                    className="placer-disp"
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: t.ink,
                      letterSpacing: '-0.01em',
                      marginBottom: 12,
                    }}
                  >
                    {content.steps.optInChecklistTitle}
                  </h3>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {content.optIns.map((entry) => (
                    <CheckRow
                      key={entry.key}
                      t={t}
                      id={`${idPrefix}-optin-${entry.key}`}
                      checked={survey.optIns[entry.key]}
                      label={entry.label}
                      onChange={() => survey.toggleOptIn(entry.key)}
                      disabled={survey.isAnonymous && entry.key !== survey.anonymousOptInKey}
                    />
                  ))}
                </div>
              </div>

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
