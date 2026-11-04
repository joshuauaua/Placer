/* PLACER — Toolkit: setting up a Poll room.
 *
 * The question people will be asked, and the answers they can pick from — Yes, No and
 * Undecided to begin with, each one rewritable, removable, and more added below. On a
 * project's page the question sits above the answers, so both are written here, once,
 * before the room opens — the question first, then its answers, as the stages of the
 * registry entry's `setup.steps` (SetupSteps walks through them, then how long the room
 * stays open). These only edit the setup.
 *
 * AnswersEditor is the list on its own, which the Poll's own screen uses too.
 */

import { useId } from 'react';
import { Btn } from '../UI';
import {
  DEFAULT_ANSWERS, DEFAULT_QUESTION, MAX_ANSWERS, MAX_ANSWER_LENGTH, MAX_QUESTION_LENGTH, MIN_ANSWERS,
} from '../../lib/openVote';

export function AnswersEditor({ t, answers, onChange }) {
  const id = useId();
  const set = (index, value) => onChange(answers.map((answer, i) => (i === index ? value : answer)));
  const remove = (index) => onChange(answers.filter((_, i) => i !== index));

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, padding: 0, marginBottom: 6 }}>
        The answers
      </legend>
      {answers.map((answer, index) => (
        <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            id={`${id}-answer-${index}`}
            aria-label={`Answer ${index + 1}`}
            type="text"
            maxLength={MAX_ANSWER_LENGTH}
            value={answer}
            onChange={(event) => set(index, event.target.value)}
            placeholder={DEFAULT_ANSWERS[index] ?? `Answer ${index + 1}`}
            style={{ flex: 1, minWidth: 0, height: 44, padding: '0 14px', borderRadius: 12,
              border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink,
              fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: 600 }} />
          <Btn t={t} type="button" variant="outline" size="sm" icon="close" ariaLabel={`Remove answer ${index + 1}`}
            disabled={answers.length <= MIN_ANSWERS} onClick={() => remove(index)}
            style={{ width: 40, padding: 0, flexShrink: 0 }} />
        </div>
      ))}
      {answers.length < MAX_ANSWERS && (
        <div>
          <Btn t={t} type="button" variant="outline" size="sm" icon="plus" onClick={() => onChange([...answers, ''])}>
            Add an answer
          </Btn>
        </div>
      )}
    </fieldset>
  );
}

/** The first stage: the question. */
export function QuestionStep({ t, setup, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-question`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        The question
      </label>
      <input
        id={`${id}-question`}
        aria-describedby={`${id}-question-hint`}
        type="text"
        maxLength={MAX_QUESTION_LENGTH}
        value={setup.question}
        onChange={(event) => onChange({ ...setup, question: event.target.value })}
        placeholder={DEFAULT_QUESTION}
        style={{ height: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
          background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 700 }} />
      <span id={`${id}-question-hint`} style={{ fontSize: 12.5, color: t.inkDim }}>
        On the project's page it is shown above the answers.
      </span>
    </div>
  );
}

/** The second stage: the answers, under the question they answer. */
export function AnswersStep({ t, setup, onChange }) {
  // A setup saved before answers could be written has none; it offered Yes, No and
  // Undecided, so editing it starts from those.
  const answers = Array.isArray(setup.answers) ? setup.answers : DEFAULT_ANSWERS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 17, fontWeight: 700, color: t.ink, lineHeight: 1.35, margin: 0 }}>
        {setup.question}
      </p>
      <AnswersEditor t={t} answers={answers} onChange={(next) => onChange({ ...setup, answers: next })} />
    </div>
  );
}

/** Both stages on one screen, for a host that does not walk through `steps`. */
export function OpenVoteSetup({ t, setup, onChange }) {
  const answers = Array.isArray(setup.answers) ? setup.answers : DEFAULT_ANSWERS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <QuestionStep t={t} setup={setup} onChange={onChange} />
      <AnswersEditor t={t} answers={answers} onChange={(next) => onChange({ ...setup, answers: next })} />
    </div>
  );
}

export default OpenVoteSetup;
