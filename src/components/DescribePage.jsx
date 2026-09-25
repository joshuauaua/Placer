/* PLACER — Step 2: describe the imagination */

import { Btn, Chip } from './UI';
import { FlowScreen } from './FlowLayout';
import { CAT_LIST } from '../theme';

// Matches the form inputs on the admin dashboard.
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

function Field({ t, label, htmlFor, hint, children }) {
  // The category group is a set of buttons rather than one control, so it gets a
  // plain heading instead of a <label> pointing at nothing.
  const Label = htmlFor ? 'label' : 'div';
  return (
    <div style={{ marginBottom: 28 }}>
      <Label
        htmlFor={htmlFor}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </Label>
      {hint && (
        <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

/**
 * `onDraftChange` receives a partial patch ({ title }, { cat }, …) for the parent to
 * merge, so each field only states what it changed.
 */
export function DescribePage({ t, draft, onDraftChange, onBack, onNext, preview,
  needsAccount = false }) {
  const complete = !!(draft.title.trim() && draft.cat && draft.blurb.trim());

  return (
    <FlowScreen
      t={t}
      step={2}
      onBack={onBack}
      backLabel="Back to canvas"
      actions={
        <Btn t={t} variant="primary" size="sm" icon="arrowRight" onClick={onNext} disabled={!complete}>
          Next: Post
        </Btn>
      }
    >
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '40px 40px 96px' }}
        className="placer-scroll">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 36 }}>
            <h1 className="placer-disp" style={{ fontSize: 36, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
              Describe your imagination
            </h1>
            <p style={{ fontSize: 17, color: t.inkDim, lineHeight: 1.6 }}>
              Tell people what you changed and why it matters. This is what they read
              before they vote.
            </p>
          </div>

          {preview && (
            <img
              src={preview}
              alt="Your imagination"
              style={{ width: '100%', borderRadius: 12, border: `1px solid ${t.line}`,
                boxShadow: t.shadow, marginBottom: 32, display: 'block' }}
            />
          )}

          <Field t={t} label="Title *" htmlFor="imagination-title">
            <input
              id="imagination-title"
              type="text"
              value={draft.title}
              onChange={(e) => onDraftChange({ title: e.target.value })}
              placeholder="e.g., Pocket park on the old Lot 7 parking"
              style={inputStyle(t)}
            />
          </Field>

          <Field t={t} label="Category *" hint="Pick the one that fits best — it sets the colour on the map.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CAT_LIST.map((c) => (
                <Chip
                  key={c.key}
                  t={t}
                  active={draft.cat === c.key}
                  color={c.color}
                  icon={c.icon}
                  dot
                  onClick={() => onDraftChange({ cat: c.key })}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field t={t} label="Description *" htmlFor="imagination-blurb">
            <textarea
              id="imagination-blurb"
              value={draft.blurb}
              onChange={(e) => onDraftChange({ blurb: e.target.value })}
              placeholder="What is wrong with the space today, and what would your change do for it?"
              rows={5}
              style={{ ...inputStyle(t), resize: 'vertical' }}
            />
          </Field>

          {!complete && (
            <div style={{ fontSize: 13.5, color: t.inkDim, fontWeight: 500 }}>
              Fill in the title, category, and description to continue.
            </div>
          )}

          {/* Said here rather than only at the last step, so that needing an account is
              not a surprise sprung on somebody who has already finished. Deliberately
              not a gate: this step, and the drawing before it, stay open to everybody. */}
          {needsAccount && (
            <div style={{ marginTop: 20, fontSize: 13.5, color: t.inkDim, lineHeight: 1.55 }}>
              You will need an account to post this. You can sign in on the next step —
              nothing you have made will be lost.
            </div>
          )}
        </div>
      </div>
    </FlowScreen>
  );
}

export default DescribePage;
