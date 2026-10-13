/* PLACER — Toolkit: writing a Pop Quiz.
 *
 * The questions — up to twenty, each either four choices with one marked right or a
 * blank to fill in — and how long each stays up. For a project's room they are written
 * here, once, before the room opens, as the stages of the registry entry's `setup.steps`
 * (SetupSteps walks through them, then how long the room stays open). These only edit
 * the setup.
 *
 * QuestionsEditor and TimeField are the two parts on their own, which the Pop Quiz's
 * own screen uses too, for a quiz written to try the tool out.
 */

import { useId } from 'react';
import { Btn } from '../UI';
import {
  DEFAULT_SECONDS, KINDS, LETTERS, MAX_BLANK_LENGTH, MAX_CHOICE_LENGTH, MAX_QUESTIONS, MAX_QUESTION_LENGTH,
  MIN_QUESTIONS, TIME_OPTIONS, emptyQuestion, withKind,
} from '../../lib/popQuiz';

const field = (t) => ({
  height: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface,
  color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: 600, minWidth: 0,
});

function QuestionEditor({ t, id, number, question, onChange, onRemove, removable }) {
  const set = (patch) => onChange({ ...question, ...patch });
  const setChoice = (index, value) => set({ choices: question.choices.map((choice, i) => (i === index ? value : choice)) });

  return (
    <fieldset style={{ border: `1px solid ${t.line}`, borderRadius: 12, padding: 16, margin: 0, minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 12 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, padding: '0 6px' }}>Question {number}</legend>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select aria-label={`Kind of question ${number}`} value={question.kind}
          onChange={(event) => onChange(withKind(question, event.target.value))}
          style={{ ...field(t), width: 'auto' }}>
          {KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <Btn t={t} type="button" variant="outline" size="sm" icon="trash" ariaLabel={`Remove question ${number}`}
          disabled={!removable} onClick={onRemove} style={{ width: 40, padding: 0, flexShrink: 0 }} />
      </div>

      <input
        aria-label={`Question ${number}`}
        type="text"
        maxLength={MAX_QUESTION_LENGTH}
        value={question.text}
        onChange={(event) => set({ text: event.target.value })}
        placeholder={question.kind === 'blank' ? 'The square was first laid out in ___.' : 'What do you want to ask?'}
        style={{ ...field(t), height: 48, fontSize: 16, fontWeight: 700 }} />

      {question.kind === 'blank' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={`${id}-answer`} style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim }}>
            The right answer
          </label>
          <input
            id={`${id}-answer`}
            aria-label={`Answer to question ${number}`}
            type="text"
            maxLength={MAX_BLANK_LENGTH}
            value={question.answer}
            onChange={(event) => set({ answer: event.target.value })}
            style={field(t)} />
          <span style={{ fontSize: 12.5, color: t.inkDim }}>
            Capitals, accents and punctuation are ignored when it is checked.
          </span>
        </div>
      ) : (
        <div role="radiogroup" aria-label={`Choices for question ${number}`}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.choices.map((choice, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="radio"
                name={`${id}-correct`}
                aria-label={`${LETTERS[index]} is the right answer to question ${number}`}
                checked={question.correct === index}
                onChange={() => set({ correct: index })} />
              <span aria-hidden="true" className="placer-mono"
                style={{ width: 16, fontSize: 13, fontWeight: 700, color: t.inkDim }}>
                {LETTERS[index]}
              </span>
              <input
                aria-label={`Choice ${LETTERS[index]} for question ${number}`}
                type="text"
                maxLength={MAX_CHOICE_LENGTH}
                value={choice}
                onChange={(event) => setChoice(index, event.target.value)}
                style={{ ...field(t), flex: 1 }} />
            </div>
          ))}
          <span style={{ fontSize: 12.5, color: t.inkDim }}>Select the one that is right.</span>
        </div>
      )}
    </fieldset>
  );
}

/** The list of questions, each editable and removable, with more added below. */
export function QuestionsEditor({ t, questions, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {questions.map((question, index) => (
        <QuestionEditor
          key={index}
          t={t}
          id={`${id}-${index}`}
          number={index + 1}
          question={question}
          removable={questions.length > MIN_QUESTIONS}
          onChange={(next) => onChange(questions.map((entry, i) => (i === index ? next : entry)))}
          onRemove={() => onChange(questions.filter((_, i) => i !== index))} />
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {questions.length < MAX_QUESTIONS && (
          <Btn t={t} type="button" variant="outline" size="sm" icon="plus"
            onClick={() => onChange([...questions, emptyQuestion()])}>
            Add a question
          </Btn>
        )}
        <span style={{ fontSize: 12.5, color: t.inkDim }}>
          {questions.length} of {MAX_QUESTIONS} questions
        </span>
      </div>
    </div>
  );
}

/** How long each question stays up. */
export function TimeField({ t, seconds, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-seconds`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        Time per question
      </label>
      <select id={`${id}-seconds`} value={seconds ?? DEFAULT_SECONDS}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ...field(t), width: 'auto', alignSelf: 'flex-start' }}>
        {TIME_OPTIONS.map((option) => <option key={option} value={option}>{option} seconds</option>)}
      </select>
      <span style={{ fontSize: 12.5, color: t.inkDim }}>
        A right answer scores more the sooner it comes, and nothing once the time is up.
      </span>
    </div>
  );
}

/** The first stage: the questions. */
export function QuestionsStep({ t, setup, onChange }) {
  return (
    <QuestionsEditor t={t} questions={setup.questions}
      onChange={(questions) => onChange({ ...setup, questions })} />
  );
}

/** The second stage: the time each question gets. */
export function TimeStep({ t, setup, onChange }) {
  return <TimeField t={t} seconds={setup.seconds} onChange={(seconds) => onChange({ ...setup, seconds })} />;
}

/** Both stages on one screen, for a host that does not walk through `steps`. */
export function PopQuizSetup({ t, setup, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <QuestionsStep t={t} setup={setup} onChange={onChange} />
      <TimeStep t={t} setup={setup} onChange={onChange} />
    </div>
  );
}

export default PopQuizSetup;
