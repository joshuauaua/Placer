/* PLACER — Step 3: describe the scene and the idea.
 *
 * A title, a category and the idea itself are needed to go on. What the place is like
 * today and who the idea is for are asked too, and optional: they are what turns a
 * picture into something a planner can act on. */

import { Btn, Chip, Field, inputStyle } from './UI';
import { FlowScreen } from './FlowLayout';
import { CAT_LIST } from '../theme';
import { MAX_DESCRIPTION } from '../lib/ideaVisualizer';

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
      step={3}
      onBack={onBack}
      backLabel="Back to canvas"
      actions={
        <Btn t={t} variant="primary" size="sm" icon="arrowRight" onClick={onNext} disabled={!complete}>
          Next: Save
        </Btn>
      }
    >
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '40px 40px 96px' }}
        className="placer-scroll">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 36 }}>
            <h1 className="placer-disp" style={{ fontSize: 36, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
              Describe the scene and your idea
            </h1>
            <p style={{ fontSize: 17, color: t.inkDim, lineHeight: 1.6 }}>
              Say what the place is like now, what you would change, and who it is for.
              The more you tell, the easier it is for others to see what you see.
            </p>
          </div>

          {preview && (
            <img
              src={preview}
              alt="Your imagination"
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', background: t.surfaceAlt,
                borderRadius: 12, border: `1px solid ${t.line}`,
                boxShadow: t.shadow, marginBottom: 32, display: 'block' }}
            />
          )}

          <Field t={t} spacing={28} label="Title *" htmlFor="imagination-title">
            <input
              id="imagination-title"
              type="text"
              value={draft.title}
              onChange={(e) => onDraftChange({ title: e.target.value })}
              placeholder="e.g., Pocket park on the old Lot 7 parking"
              style={inputStyle(t)}
            />
          </Field>

          <Field t={t} spacing={28} label="Category *" hint="Pick the one that fits best — it sets the colour on the map.">
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

          <Field t={t} spacing={28} label="The place today" htmlFor="imagination-scene"
            hint="Optional. What is there now, how it is used, and what is missing or not working.">
            <textarea
              id="imagination-scene"
              value={draft.scene ?? ''}
              onChange={(e) => onDraftChange({ scene: e.target.value })}
              placeholder="e.g., A wide pavement in full sun, with nowhere to sit and cars parked on the corner."
              rows={3}
              maxLength={MAX_DESCRIPTION}
              style={{ ...inputStyle(t), resize: 'vertical' }}
            />
          </Field>

          <Field t={t} spacing={28} label="Your idea *" htmlFor="imagination-blurb"
            hint="What you placed in the picture, and what it would change.">
            <textarea
              id="imagination-blurb"
              value={draft.blurb}
              onChange={(e) => onDraftChange({ blurb: e.target.value })}
              placeholder="e.g., Trees for shade, benches under them, and planters to keep cars off the corner."
              rows={5}
              maxLength={MAX_DESCRIPTION}
              style={{ ...inputStyle(t), resize: 'vertical' }}
            />
          </Field>

          <Field t={t} spacing={28} label="Who is it for?" htmlFor="imagination-audience"
            hint="Optional. The people who would use it, and when.">
            <textarea
              id="imagination-audience"
              value={draft.audience ?? ''}
              onChange={(e) => onDraftChange({ audience: e.target.value })}
              placeholder="e.g., Parents waiting at the school gate, and older neighbours on their way to the shops."
              rows={2}
              maxLength={MAX_DESCRIPTION}
              style={{ ...inputStyle(t), resize: 'vertical' }}
            />
          </Field>

          {!complete && (
            <div style={{ fontSize: 13.5, color: t.inkDim, fontWeight: 500 }}>
              Fill in the title, category, and your idea to continue.
            </div>
          )}

          {/* Said here rather than only at the last step, so that needing an account is
              not a surprise sprung on somebody who has already finished. Deliberately
              not a gate: this step, and the drawing before it, stay open to everybody. */}
          {needsAccount && (
            <div style={{ marginTop: 20, fontSize: 13.5, color: t.inkDim, lineHeight: 1.55 }}>
              You will need an account to save this. You can sign in on the next step —
              nothing you have made will be lost.
            </div>
          )}
        </div>
      </div>
    </FlowScreen>
  );
}

export default DescribePage;
