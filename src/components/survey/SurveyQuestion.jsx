/* PLACER — one survey question, as a group of option buttons. */

import { Icon } from '../Icon';

/**
 * `scale` questions lay their options out in a wrapping row, which suits a short
 * rating strip; everything else stacks them full width. `multiple` questions
 * take a square indicator and toggle, single-choice ones a round one and replace.
 */
export function SurveyQuestion({ t, question, value, onToggle }) {
  const labelId = `survey-question-${question.key}`;
  const { multiple, scale } = question;

  const isSelected = (optionValue) =>
    multiple ? Array.isArray(value) && value.includes(optionValue) : value === optionValue;

  return (
    <div>
      <h1 id={labelId} style={{ fontSize: 28, fontWeight: 700, color: t.ink, lineHeight: 1.4, marginBottom: multiple ? 8 : 40 }}>
        {question.label}
      </h1>

      {multiple && (
        <div style={{ fontSize: 14, color: t.inkDim, marginBottom: 32 }}>Select all that apply.</div>
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
                background: selected ? t.accent + (t.mapMode === 'dark' ? '14' : '22') : t.surface,
                textAlign: scale ? 'center' : 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: scale ? 'center' : 'flex-start',
                gap: 16,
                fontFamily: "'Archivo', sans-serif",
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
    </div>
  );
}

export default SurveyQuestion;
