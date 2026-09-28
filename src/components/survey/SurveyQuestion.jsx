/* PLACER — one survey question, as a group of option buttons. */

import { Icon } from '../Icon';

// Matches the inputs in SurveyForm, and on Describe and the admin dashboard.
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

/**
 * `scale` questions lay their options out in a wrapping row, which suits a short
 * rating strip; everything else stacks them full width. `multiple` questions
 * take a square indicator and toggle, single-choice ones a round one and replace.
 *
 * `rank` questions are `multiple` ones read as an ordering: answers are stored in
 * the order they were picked, so the indicator shows each one's position instead
 * of a tick. Picking again drops it and the rest close up.
 *
 * An option flagged `other` opens a text field below the list once it is picked:
 * the option on its own says nothing, so the hook holds Next until it is filled.
 */
export function SurveyQuestion({
  t,
  question,
  value,
  onToggle,
  otherPicked,
  otherText = '',
  onOtherTextChange,
  otherLabel,
  otherPlaceholder,
}) {
  const labelId = `survey-question-${question.key}`;
  const otherId = `${labelId}-other`;
  const { rank } = question;

  /** 1-based position of an answer in the picking order, or 0 when unpicked. */
  const rankOf = (optionValue) =>
    Array.isArray(value) ? value.indexOf(optionValue) + 1 : 0;
  const { multiple, scale, maxChoices } = question;

  const isSelected = (optionValue) =>
    multiple ? Array.isArray(value) && value.includes(optionValue) : value === optionValue;

  /* At the ceiling every unpicked option goes inert, so the only move left is to let
   * one go. The hook refuses the pick as well; this is what makes the refusal visible
   * rather than a tap that quietly does nothing. */
  const pickedCount = Array.isArray(value) ? value.length : 0;
  const atLimit = multiple && maxChoices !== undefined && pickedCount >= maxChoices;

  return (
    <div>
      <h1 id={labelId} className="placer-survey-question" style={{ fontWeight: 700, color: t.ink, lineHeight: 1.4, marginBottom: multiple ? 8 : 40 }}>
        {question.label}
      </h1>

      {multiple && (
        <div style={{ fontSize: 14, color: t.inkDim, marginBottom: 32 }}>
          {rank ? 'Choose in order of priority, most important first.' : 'Select all that apply.'}
          {atLimit && (
            <span
              // Announced when it appears: the buttons going quiet is otherwise
              // invisible to anyone not looking at them.
              role="status"
              style={{ display: 'block', marginTop: 6, fontWeight: 500, color: t.ink }}
            >
              {`${maxChoices} chosen — deselect one to change the ranking.`}
            </span>
          )}
        </div>
      )}

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
          const blocked = atLimit && !selected;
          return (
            <button
              key={option.value}
              type="button"
              // Enter on a picked option continues rather than toggling it off
              // again; see the listener in useSurveyForm.
              data-survey-option
              disabled={blocked}
              aria-pressed={selected}
              // The position is shown in a decorative badge, so it is said here
              // instead: "selected" alone would lose the ordering.
              aria-label={
                rank && selected ? `${option.label}, priority ${rankOf(option.value)}` : undefined
              }
              onClick={() => onToggle(option.value)}
              style={{
                padding: scale ? '16px 20px' : '20px 24px',
                flex: scale ? '1 1 auto' : '0 0 auto',
                minWidth: scale ? 72 : undefined,
                borderRadius: 12,
                border: `2px solid ${selected ? t.accent : t.line}`,
                background: selected ? t.surfaceAlt : t.surface,
                textAlign: scale ? 'center' : 'left',
                cursor: blocked ? 'not-allowed' : 'pointer',
                opacity: blocked ? 0.45 : 1,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: scale ? 'center' : 'flex-start',
                gap: 16,
                fontFamily: 'var(--placer-font)',
              }}
              onMouseEnter={(e) => {
                if (selected || blocked) return;
                e.currentTarget.style.borderColor = t.lineStrong;
                e.currentTarget.style.background = t.surfaceAlt;
              }}
              onMouseLeave={(e) => {
                if (selected || blocked) return;
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
                    // A ranked answer shows a number, which wants a round badge.
                    borderRadius: multiple && !rank ? 7 : '50%',
                    border: `2px solid ${selected ? t.accent : t.lineStrong}`,
                    background: selected ? t.accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.accentInk,
                  }}
                >
                  {selected &&
                    (rank ? (
                      rankOf(option.value)
                    ) : multiple ? (
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
                {/* With a description the label becomes a title: emboldened, and the
                    description runs on after it rather than onto its own line, so the
                    pair reads as one sentence at desktop width. */}
                {option.description ? (
                  <>
                    <strong style={{ fontWeight: 700 }}>{option.label}:</strong>{' '}
                    {option.description}
                  </>
                ) : (
                  option.label
                )}
              </span>
            </button>
          );
        })}
      </div>

      {otherPicked && (
        <div style={{ marginTop: 16 }}>
          <label
            htmlFor={otherId}
            style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}
          >
            {otherLabel}
          </label>
          <input
            id={otherId}
            type="text"
            value={otherText}
            placeholder={otherPlaceholder}
            onChange={(event) => onOtherTextChange(event.target.value)}
            style={inputStyle(t)}
          />
        </div>
      )}
    </div>
  );
}

export default SurveyQuestion;
