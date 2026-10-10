/* PLACER — Toolkit: a tool's setup, asked for in stages.
 *
 * Walks through a list of stages — the tool's own (setupSteps in toolkit/tools.js),
 * then whatever its host adds, such as when the room starts and how long it stays open — one at a time,
 * with Back and Next between them and the host's button at the end. A list of one is
 * a single screen, as before stages existed: no counter, no Back.
 *
 * Each stage is { title, content, problems }. A stage's problems are only listed once
 * somebody has tried to move past it — a form that starts out shouting has not let you
 * fill it in yet — and Next will not leave a stage that has any.
 *
 * Used by ConfigureToolDialog, which sets a project's tool up from its dashboard.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn } from '../UI';

export function SetupSteps({
  t, steps, busy = false, onCancel, onFinish, finishLabel, busyLabel, finishButton = {}, cancelVariant = 'outline',
}) {
  const [index, setIndex] = useState(0);
  const [tried, setTried] = useState(false);
  const bodyRef = useRef(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const staged = steps.length > 1;

  // A new stage starts quiet, with its first field ready to type in.
  useEffect(() => {
    setTried(false);
    if (index > 0) bodyRef.current?.querySelector('input, select, textarea')?.focus();
  }, [index]);

  const next = (event) => {
    event.preventDefault();
    if (busy) return;
    setTried(true);
    if (step.problems.length > 0) return;
    if (last) onFinish();
    else setIndex(index + 1);
  };

  return (
    <form onSubmit={next} noValidate>
      {staged && (
        <div style={{ marginBottom: 16 }}>
          <div aria-hidden="true" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {steps.map((entry, i) => (
              <span key={entry.title} style={{ flex: 1, height: 4, borderRadius: 2,
                background: i <= index ? t.ink : t.line }} />
            ))}
          </div>
          <div className="placer-caption" style={{ color: t.inkFaint, marginBottom: 4 }}>
            Step {index + 1} of {steps.length}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.ink, margin: 0 }}>{step.title}</h3>
        </div>
      )}

      <div ref={bodyRef}>{step.content}</div>

      {tried && step.problems.length > 0 && (
        <ul role="alert" style={{ listStyle: 'none', margin: '16px 0 0', padding: '12px 16px', borderRadius: 12,
          background: t.surfaceAlt, border: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {step.problems.map((problem) => (
            <li key={problem} style={{ fontSize: 14, color: t.ink }}>{problem}</li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <Btn t={t} variant={cancelVariant} size="sm" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        {index > 0 && (
          <Btn t={t} variant="outline" size="sm" type="button" onClick={() => setIndex(index - 1)} disabled={busy}>
            Back
          </Btn>
        )}
        {last ? (
          <Btn t={t} variant="primary" size="sm" type="submit" disabled={busy} {...finishButton}>
            {busy ? busyLabel : finishLabel}
          </Btn>
        ) : (
          <Btn t={t} variant="primary" size="sm" type="submit">Next</Btn>
        )}
      </div>
    </form>
  );
}

export default SetupSteps;
