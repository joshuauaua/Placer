/* PLACER — one survey question, in whichever form it is asked. */

import { Icon } from '../Icon';
import { otherOption, questionType, scaleRange } from './content';

/** Matches the form inputs on Describe, the admin dashboard and the survey's own contact step. */
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

/** The tint a selected option carries, which differs by theme. */
const selectedFill = (t) => t.accent + (t.mapMode === 'dark' ? '14' : '22');

function Heading({ t, id, children, tight }) {
  return (
    <h1
      id={id}
      style={{ fontSize: 28, fontWeight: 700, color: t.ink, lineHeight: 1.4, marginBottom: tight ? 8 : 40 }}
    >
      {children}
    </h1>
  );
}

function Hint({ t, children }) {
  return <div style={{ fontSize: 14, color: t.inkDim, marginBottom: 32 }}>{children}</div>;
}

/**
 * A group of option buttons. `multiple` questions take a square indicator and
 * toggle, single-choice ones a round one and replace. The option marked `other`
 * reveals a field for the free text, which is what makes the answer useful.
 */
function ChoiceQuestion({ t, labels, question, value, otherText, onToggle, onOtherText }) {
  const labelId = `survey-question-${question.key}`;
  const { multiple, scale } = question;
  const other = otherOption(question);

  const isSelected = (optionValue) =>
    multiple ? Array.isArray(value) && value.includes(optionValue) : value === optionValue;

  const otherChosen = other ? isSelected(other.value) : false;
  const otherId = `survey-other-${question.key}`;

  return (
    <div>
      <Heading t={t} id={labelId} tight={multiple}>
        {question.label}
      </Heading>

      {multiple && <Hint t={t}>Select all that apply.</Hint>}

      <div
        role="group"
        aria-labelledby={labelId}
        style={{
          display: 'flex',
          flexDirection: scale ? 'row' : 'column',
          flexWrap: scale ? 'wrap' : 'nowrap',
          gap: 12,
        }}
      >
        {question.options.map((option) => {
          const selected = isSelected(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(option.value)}
              style={{
                padding: scale ? '16px 20px' : '20px 24px',
                flex: scale ? '1 1 auto' : '0 0 auto',
                minWidth: scale ? 72 : undefined,
                borderRadius: 12,
                border: `2px solid ${selected ? t.accent : t.line}`,
                background: selected ? selectedFill(t) : t.surface,
                textAlign: scale ? 'center' : 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: scale ? 'center' : 'flex-start',
                gap: 16,
                fontFamily: 'var(--placer-font)',
              }}
              onMouseEnter={(e) => {
                if (selected) return;
                e.currentTarget.style.borderColor = t.lineStrong;
                e.currentTarget.style.background = t.surfaceAlt;
              }}
              onMouseLeave={(e) => {
                if (selected) return;
                e.currentTarget.style.borderColor = t.line;
                e.currentTarget.style.background = t.surface;
              }}
            >
              {!scale && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: multiple ? 7 : '50%',
                    border: `2px solid ${selected ? t.accent : t.lineStrong}`,
                    background: selected ? t.accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                  }}
                >
                  {selected &&
                    (multiple ? (
                      <Icon name="check" size={15} stroke={3} style={{ color: t.accentInk }} />
                    ) : (
                      <span
                        style={{ width: 8, height: 8, borderRadius: '50%', background: t.accentInk }}
                      />
                    ))}
                </span>
              )}

              <span
                style={{
                  fontSize: 16,
                  fontWeight: selected ? 600 : 500,
                  color: t.ink,
                  whiteSpace: scale ? 'nowrap' : 'normal',
                }}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {otherChosen && (
        <div style={{ marginTop: 20 }}>
          <label
            htmlFor={otherId}
            style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}
          >
            {labels.otherLabel}
          </label>
          <input
            id={otherId}
            type="text"
            value={otherText ?? ''}
            placeholder={labels.otherPlaceholder}
            onChange={(e) => onOtherText(e.target.value)}
            style={inputStyle(t)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * A 1-10 strip. The ends are labelled underneath rather than inside the buttons,
 * which keeps ten of them legible on a phone.
 */
function ScaleQuestion({ t, question, value, onToggle }) {
  const labelId = `survey-question-${question.key}`;
  const [min, max] = scaleRange(question);
  const points = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));

  return (
    <div>
      <Heading t={t} id={labelId} tight>
        {question.label}
      </Heading>

      <Hint t={t}>
        {question.minLabel} · {question.maxLabel}
      </Hint>

      <div
        role="group"
        aria-labelledby={labelId}
        style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
      >
        {points.map((point) => {
          const selected = value === point;
          return (
            <button
              key={point}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(point)}
              style={{
                padding: '16px 0',
                flex: '1 1 56px',
                minWidth: 56,
                borderRadius: 12,
                border: `2px solid ${selected ? t.accent : t.line}`,
                background: selected ? selectedFill(t) : t.surface,
                color: t.ink,
                fontSize: 17,
                fontWeight: selected ? 700 : 500,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'var(--placer-font)',
              }}
              onMouseEnter={(e) => {
                if (selected) return;
                e.currentTarget.style.borderColor = t.lineStrong;
                e.currentTarget.style.background = t.surfaceAlt;
              }}
              onMouseLeave={(e) => {
                if (selected) return;
                e.currentTarget.style.borderColor = t.line;
                e.currentTarget.style.background = t.surface;
              }}
            >
              {point}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          marginTop: 12,
          fontSize: 13,
          color: t.inkDim,
        }}
      >
        <span>{question.minLabel}</span>
        <span style={{ textAlign: 'right' }}>{question.maxLabel}</span>
      </div>
    </div>
  );
}

/** A typed answer: one line for `text`, a box for `paragraph`. */
function WrittenQuestion({ t, labels, question, value, onText }) {
  const fieldId = `survey-question-${question.key}`;
  const labelId = `survey-question-label-${question.key}`;
  const paragraph = questionType(question) === 'paragraph';

  const shared = {
    id: fieldId,
    'aria-labelledby': labelId,
    value: value ?? '',
    placeholder: question.placeholder,
    maxLength: question.maxLength,
    onChange: (e) => onText(e.target.value),
    style: inputStyle(t),
  };

  return (
    <div>
      {/* The question is the field's label, and it is also the screen's heading:
          named by reference rather than wrapped, so the heading stays a heading. */}
      <Heading t={t} id={labelId} tight={question.optional}>
        {question.label}
      </Heading>

      {question.optional && <Hint t={t}>{labels.optionalHint}</Hint>}

      {paragraph ? (
        <textarea
          {...shared}
          rows={7}
          style={{ ...shared.style, resize: 'vertical', lineHeight: 1.6 }}
        />
      ) : (
        <input {...shared} type="text" />
      )}
    </div>
  );
}

/** Dispatches on the question's type. */
export function SurveyQuestion(props) {
  const type = questionType(props.question);
  if (type === 'scale') return <ScaleQuestion {...props} />;
  if (type === 'text' || type === 'paragraph') return <WrittenQuestion {...props} />;
  return <ChoiceQuestion {...props} />;
}

export default SurveyQuestion;
