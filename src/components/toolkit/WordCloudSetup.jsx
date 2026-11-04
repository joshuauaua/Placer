/* PLACER — Toolkit: setting up a Word Cloud room.
 *
 * The prompt people will be asked, how many words each of them can answer it with, and
 * optionally a timer after which no more are taken.
 * On a project's page the prompt sits above the cloud, so it is written here, once,
 * before the room opens — the prompt first, then the words, as the stages of the
 * registry entry's `setup.steps` (SetupSteps walks through them, then how long the room
 * stays open). These only edit the setup.
 */

import { useId } from 'react';
import {
  DEFAULT_LIMIT, DEFAULT_PROMPT, MAX_LIMIT, MAX_PROMPT_LENGTH, MIN_LIMIT, TIMER_OPTIONS,
} from '../../lib/wordCloud';

const LIMITS = Array.from({ length: MAX_LIMIT - MIN_LIMIT + 1 }, (_, index) => MIN_LIMIT + index);

/** The first stage: the prompt. */
export function PromptStep({ t, setup, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-prompt`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        The prompt
      </label>
      <input
        id={`${id}-prompt`}
        aria-describedby={`${id}-prompt-hint`}
        type="text"
        maxLength={MAX_PROMPT_LENGTH}
        value={setup.prompt}
        onChange={(event) => onChange({ ...setup, prompt: event.target.value })}
        placeholder={DEFAULT_PROMPT}
        style={{ height: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
          background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 700 }} />
      <span id={`${id}-prompt-hint`} style={{ fontSize: 12.5, color: t.inkDim }}>
        On the project&rsquo;s page it is shown above the cloud.
      </span>
    </div>
  );
}

function LimitField({ t, setup, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-limit`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        Words per person
      </label>
      <select
        id={`${id}-limit`}
        aria-describedby={`${id}-limit-hint`}
        value={setup.limit ?? DEFAULT_LIMIT}
        onChange={(event) => onChange({ ...setup, limit: Number(event.target.value) })}
        style={{ height: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
          background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: 600,
          width: 'auto', alignSelf: 'flex-start' }}>
        {LIMITS.map((limit) => <option key={limit} value={limit}>{limit}</option>)}
      </select>
      <span id={`${id}-limit-hint`} style={{ fontSize: 12.5, color: t.inkDim }}>
        One word each gives the sharpest cloud; more lets people say a little more. Each answer can be up to 20 characters.
      </span>
    </div>
  );
}

/** The timer as a choice: none, or one of TIMER_OPTIONS. The tool's own screen uses it too. */
export function TimerSelect({ t, id, value, onChange, disabled = false }) {
  return (
    <select
      id={id}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      style={{ height: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
        background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: 600,
        width: 'auto', alignSelf: 'flex-start' }}>
      <option value="">No timer</option>
      {TIMER_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
    </select>
  );
}

function TimerField({ t, setup, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-timer`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        Timer
      </label>
      <TimerSelect t={t} id={`${id}-timer`} value={setup.timer}
        onChange={(timer) => onChange({ ...setup, timer })} />
      <span style={{ fontSize: 12.5, color: t.inkDim }}>
        Optional. You start it from the room, and when it runs out nobody can add more words.
      </span>
    </div>
  );
}

/** The second stage: how many words each person gets and for how long, under the prompt they answer. */
export function WordsStep({ t, setup, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 17, fontWeight: 700, color: t.ink, lineHeight: 1.35, margin: 0 }}>
        {setup.prompt}
      </p>
      <LimitField t={t} setup={setup} onChange={onChange} />
      <TimerField t={t} setup={setup} onChange={onChange} />
    </div>
  );
}

/** Both stages on one screen, for a host that does not walk through `steps`. */
export function WordCloudSetup({ t, setup, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PromptStep t={t} setup={setup} onChange={onChange} />
      <LimitField t={t} setup={setup} onChange={onChange} />
      <TimerField t={t} setup={setup} onChange={onChange} />
    </div>
  );
}

export default WordCloudSetup;
