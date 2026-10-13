/* PLACER — Toolkit: Dream It.
 *
 * A prompt generator for the part of a workshop where nobody is solving anything yet.
 * One button deals a prompt — "If this place had a voice, what would it say?" — for
 * people to answer aloud, in turn, and listen to each other answering. It is about how
 * a place could feel, not what can be built, so there is nothing here to fill in and
 * nothing is saved: the talking is the point.
 *
 * It opens on a choice of which prompts to deal from: the existing ones, the group's
 * own, or both together. A group's own prompts are written on the next screen and held
 * in this component only, so refreshing or leaving the page lets go of them — which the
 * screen says, since it is the kind of thing somebody finds out too late.
 *
 * The prompts and the dealing are in src/lib/dreamIt.js.
 */

import { useId, useMemo, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import {
  MAX_OWN_PROMPTS, MAX_PROMPT_LENGTH, MODES, PROMPTS, addPrompt, deckPrompts, drawPrompt, writesOwn,
} from '../../lib/dreamIt';

/** The first screen: which prompts to deal from. */
function ChooseMode({ t, onChoose }) {
  return (
    <Panel t={t} title="Which prompts do you want to use?">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {MODES.map((mode) => (
          <button key={mode.id} type="button" onClick={() => onChoose(mode.id)} className="placer-btn placer-btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', padding: 20, minHeight: 120,
              borderRadius: 12, cursor: 'pointer', background: t.surface, color: t.ink,
              border: `1px solid ${t.lineStrong}`, fontFamily: 'var(--placer-font)' }}>
            <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{mode.name}</span>
            <span style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>{mode.note}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/** The second screen, for a group writing prompts of its own. */
function WritePrompts({ t, mode, own, onChange, onBack, onStart }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const full = own.length >= MAX_OWN_PROMPTS;

  const add = (event) => {
    event.preventDefault();
    const next = addPrompt(own, draft, mode);
    if (next !== own) onChange(next);
    setDraft('');
  };

  return (
    <Panel t={t} title={mode === 'both' ? 'Add your own prompts' : 'Write your own prompts'}>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          id={`${id}-prompt`}
          aria-label="Your prompt"
          type="text"
          maxLength={MAX_PROMPT_LENGTH}
          value={draft}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What would you like people to imagine?"
          style={{ flex: 1, minWidth: 0, height: 48, padding: '0 14px', borderRadius: 12,
            border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink,
            fontFamily: 'var(--placer-font)', fontSize: 16, fontWeight: 600 }} />
        <Btn t={t} type="submit" variant="outline" icon="plus" disabled={full}>Add</Btn>
      </form>

      {own.length > 0 && (
        <ol aria-label="Your prompts" style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
          {own.map((prompt) => (
            <li key={prompt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
              borderBottom: `1px solid ${t.line}` }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: t.ink, lineHeight: 1.4,
                overflowWrap: 'anywhere' }}>
                {prompt}
              </span>
              <Btn t={t} type="button" variant="ghost" size="sm" icon="close" ariaLabel={`Remove “${prompt}”`}
                onClick={() => onChange(own.filter((entry) => entry !== prompt))}
                style={{ width: 32, padding: 0, flexShrink: 0 }} />
            </li>
          ))}
        </ol>
      )}

      <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, margin: '16px 0 0' }}>
        {mode === 'both' && `They will be shuffled in with the ${PROMPTS.length} existing prompts. `}
        Your prompts are not saved: refreshing or leaving this page loses them.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
        <Btn t={t} variant="outline" icon="chevLeft" onClick={onBack}>Back</Btn>
        <Btn t={t} variant="primary" icon="sparkle" disabled={own.length === 0} onClick={onStart}>
          Start with {deckPrompts(mode, own).length} {deckPrompts(mode, own).length === 1 ? 'prompt' : 'prompts'}
        </Btn>
      </div>
    </Panel>
  );
}

/** The generator itself, dealing from the prompts it is given. */
function Generator({ t, prompts, hasOwn, onChange }) {
  const [prompt, setPrompt] = useState(null);
  const [deck, setDeck] = useState([]);
  const [dealt, setDealt] = useState(0);

  const generate = () => {
    const next = drawPrompt(deck, prompt, { prompts });
    setPrompt(next.prompt);
    setDeck(next.deck);
    setDealt(dealt + 1);
  };

  return (
    <Panel t={t} title="Your prompt" style={{ padding: '20px 24px 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
        <div aria-live="polite" style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {prompt ? (
            <p className="placer-disp" style={{ maxWidth: 760, margin: 0, fontSize: 'clamp(26px, 4.2vw, 44px)',
              fontWeight: 700, color: t.ink, lineHeight: 1.2, letterSpacing: '-0.03em', overflowWrap: 'anywhere' }}>
              {prompt}
            </p>
          ) : (
            <p style={{ maxWidth: 520, margin: 0, fontSize: 17, color: t.inkDim, lineHeight: 1.6 }}>
              Generate a prompt, read it aloud, and give everybody a moment to imagine before anyone answers.
            </p>
          )}
        </div>
        <Btn t={t} variant="primary" icon="sparkle" onClick={generate}
          style={{ height: 56, padding: '0 28px', fontSize: 17 }}>
          {prompt ? 'Generate another prompt' : 'Generate a prompt'}
        </Btn>
        <p className="placer-mono" style={{ margin: 0, fontSize: 11, color: t.inkDim, letterSpacing: '0.04em',
          textTransform: 'uppercase' }}>
          {dealt === 0
            ? `${prompts.length} ${prompts.length === 1 ? 'prompt' : 'prompts'}`
            : `Prompt ${((dealt - 1) % prompts.length) + 1} of ${prompts.length}`}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onChange}>Change the prompts</Btn>
          {hasOwn && (
            <p style={{ margin: 0, fontSize: 12.5, color: t.inkDim }}>
              Your own prompts are not saved: refreshing or leaving this page loses them.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function DreamIt({ t }) {
  const [mode, setMode] = useState(null);
  const [own, setOwn] = useState([]);
  const [playing, setPlaying] = useState(false);
  const prompts = useMemo(() => deckPrompts(mode, own), [mode, own]);

  const choose = (next) => {
    setMode(next);
    setPlaying(!writesOwn(next));
  };
  // Back to the choice, keeping what was written: changing your mind should not cost
  // the prompts a group has just typed in.
  const reset = () => {
    setMode(null);
    setPlaying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {mode === null ? (
        <ChooseMode t={t} onChoose={choose} />
      ) : playing ? (
        <Generator t={t} prompts={prompts} hasOwn={writesOwn(mode)} onChange={reset} />
      ) : (
        <WritePrompts t={t} mode={mode} own={own} onChange={setOwn} onBack={reset}
          onStart={() => setPlaying(true)} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20,
        alignItems: 'start' }}>
        <Panel t={t} title="What it is for">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            Dream It unlocks imagination and makes a safe space for people to share personal visions,
            desires and emotional connections to a place. Rather than practical constraints or immediate
            solutions, it invites everybody to think freely about how the place could feel, function
            or inspire in the future.
          </p>
        </Panel>
        <Panel t={t} title="How to run it">
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: t.inkDim, lineHeight: 1.7 }}>
            <li>Choose the prompts: ours, your own, or both.</li>
            <li>Generate a prompt and read it aloud.</li>
            <li>Give people a quiet moment to imagine.</li>
            <li>Let each person speak, tell a story or speculate — and let the others listen.</li>
            <li>Generate another when the room is ready.</li>
          </ol>
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginTop: 12 }}>
            There are no wrong answers and nothing to solve yet. Speaking, imagining and listening to each
            other is what builds a shared feeling for the place.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default DreamIt;
