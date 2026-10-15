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
import { useText } from '../../i18n';

/** The first screen: which prompts to deal from. */
function ChooseMode({ t, onChoose }) {
  const { text } = useText();
  return (
    <Panel t={t} title={text('dreamIt.whichPrompts')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {MODES.map((mode) => (
          <button key={mode.id} type="button" onClick={() => onChoose(mode.id)} className="placer-btn placer-btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', padding: 20, minHeight: 120,
              borderRadius: 12, cursor: 'pointer', background: t.surface, color: t.ink,
              border: `1px solid ${t.lineStrong}`, fontFamily: 'var(--placer-font)' }}>
            <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{text(`dreamIt.modes.${mode.id}.name`)}</span>
            <span style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>
              {text(`dreamIt.modes.${mode.id}.note`, { count: PROMPTS.length })}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/** The second screen, for a group writing prompts of its own. */
function WritePrompts({ t, mode, own, onChange, onBack, onStart }) {
  const { text } = useText();
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
    <Panel t={t} title={text(mode === 'both' ? 'dreamIt.addOwn' : 'dreamIt.writeOwn')}>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          id={`${id}-prompt`}
          aria-label={text('dreamIt.yourPrompt')}
          type="text"
          maxLength={MAX_PROMPT_LENGTH}
          value={draft}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={text('dreamIt.promptPlaceholder')}
          style={{ flex: 1, minWidth: 0, height: 48, padding: '0 14px', borderRadius: 12,
            border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink,
            fontFamily: 'var(--placer-font)', fontSize: 16, fontWeight: 600 }} />
        <Btn t={t} type="submit" variant="outline" icon="plus" disabled={full}>{text('common.add')}</Btn>
      </form>

      {own.length > 0 && (
        <ol aria-label={text('dreamIt.yourPrompts')} style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
          {own.map((prompt) => (
            <li key={prompt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
              borderBottom: `1px solid ${t.line}` }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: t.ink, lineHeight: 1.4,
                overflowWrap: 'anywhere' }}>
                {prompt}
              </span>
              <Btn t={t} type="button" variant="ghost" size="sm" icon="close" ariaLabel={text('dreamIt.remove', { prompt })}
                onClick={() => onChange(own.filter((entry) => entry !== prompt))}
                style={{ width: 32, padding: 0, flexShrink: 0 }} />
            </li>
          ))}
        </ol>
      )}

      <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, margin: '16px 0 0' }}>
        {mode === 'both' && `${text('dreamIt.shuffledIn', { count: PROMPTS.length })} `}
        {text('dreamIt.notSaved')}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
        <Btn t={t} variant="outline" icon="chevLeft" onClick={onBack}>{text('common.back')}</Btn>
        <Btn t={t} variant="primary" icon="sparkle" disabled={own.length === 0} onClick={onStart}>
          {text('dreamIt.startWith', { count: deckPrompts(mode, own).length })}
        </Btn>
      </div>
    </Panel>
  );
}

/** The generator itself, dealing from the prompts it is given. */
function Generator({ t, prompts, hasOwn, onChange }) {
  const { text } = useText();
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
    <Panel t={t} title={text('dreamIt.yourPrompt')} style={{ padding: '20px 24px 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
        <div aria-live="polite" style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {prompt ? (
            <p className="placer-disp" style={{ maxWidth: 760, margin: 0, fontSize: 'clamp(26px, 4.2vw, 44px)',
              fontWeight: 700, color: t.ink, lineHeight: 1.2, letterSpacing: '-0.03em', overflowWrap: 'anywhere' }}>
              {prompt}
            </p>
          ) : (
            <p style={{ maxWidth: 520, margin: 0, fontSize: 17, color: t.inkDim, lineHeight: 1.6 }}>
              {text('dreamIt.generateHint')}
            </p>
          )}
        </div>
        <Btn t={t} variant="primary" icon="sparkle" onClick={generate}
          style={{ height: 56, padding: '0 28px', fontSize: 17 }}>
          {text(prompt ? 'dreamIt.generateAnother' : 'dreamIt.generate')}
        </Btn>
        <p className="placer-mono" style={{ margin: 0, fontSize: 11, color: t.inkDim, letterSpacing: '0.04em',
          textTransform: 'uppercase' }}>
          {dealt === 0
            ? text('dreamIt.promptCount', { count: prompts.length })
            : text('dreamIt.promptOf', { n: ((dealt - 1) % prompts.length) + 1, count: prompts.length })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onChange}>{text('dreamIt.changePrompts')}</Btn>
          {hasOwn && (
            <p style={{ margin: 0, fontSize: 12.5, color: t.inkDim }}>
              {text('dreamIt.ownNotSaved')}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function DreamIt({ t }) {
  const { text, language } = useText();
  const [mode, setMode] = useState(null);
  const [own, setOwn] = useState([]);
  const [playing, setPlaying] = useState(false);
  // `language` too: our prompts are dealt in whichever language is chosen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prompts = useMemo(() => deckPrompts(mode, own), [mode, own, language]);

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
        <Panel t={t} title={text('dreamIt.whatFor')}>
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            {text('dreamIt.whatForBody')}
          </p>
        </Panel>
        <Panel t={t} title={text('dreamIt.howToRun')}>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: t.inkDim, lineHeight: 1.7 }}>
            {[1, 2, 3, 4, 5].map((step) => <li key={step}>{text(`dreamIt.steps.${step}`)}</li>)}
          </ol>
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginTop: 12 }}>
            {text('dreamIt.noWrongAnswers')}
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default DreamIt;
