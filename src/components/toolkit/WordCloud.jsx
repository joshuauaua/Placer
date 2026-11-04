/* PLACER — Toolkit: Word Cloud.
 *
 * A Poll with the answers left open: type whatever you want to ask, and everybody adds
 * a few words of their own. The cloud draws each word larger the more people said it.
 * Here the prompt is decoration — read it aloud, put it on a slide — and is never
 * published anywhere; only the words a person adds are sent to the room.
 *
 * A room set up for a project (`room.config`, see `setup` in toolkit/tools.js) has its
 * prompt and its words per person fixed: the organiser chose them before opening the
 * room, so the prompt is shown rather than typed.
 *
 * The cloud leads the page, as its largest card, with the prompt in its top corner;
 * under it are the prompt and the field to answer it in, and the same answers as a list
 * with how many times each was given.
 *
 * A timer is optional. Whoever asked the prompt starts it — here, or the room's
 * facilitator in a room set up with one — and it counts down in the cloud's bottom
 * corner; once it runs out, no more words are taken. While it runs they can pause it
 * and carry on, or stop it, which ends the exercise there and locks the cloud. In a room
 * the timer is sent as `timer` on the facilitator's own contribution, which is how it
 * reaches everybody else (roomTimer in lib/wordCloud.js).
 *
 * The cloud can be shown over the whole screen (FullScreenCloud), to put up on a
 * projector while people answer; it carries on filling in there.
 *
 * Cloud, WordCounts, WordEntry and FullScreenCloud are those parts on their own, which
 * the project page's version (WordCloudOnPage) uses too. The counting is in src/lib/wordCloud.js.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Panel } from '../ToolLayout';
import { KeepOnProfile, onItsOwn } from './KeepOnProfile';
import { Btn } from '../UI';
import { TimerSelect } from './WordCloudSetup';
import { PALETTE_LIST } from '../../theme';
import {
  MAX_WORD_LENGTH, addWord, cloudTimer, cloudWords, countWords, formatCountdown, isPaused,
  pauseTimer, resumeTimer, roomTimer, secondsLeft, startTimer, stopTimer, wordLimit,
} from '../../lib/wordCloud';

// The brand's three colours, each in the two tones dark enough to read as type on white.
const WORD_COLORS = PALETTE_LIST.flatMap((colour) => [colour.c700, colour.c900]);

// A word keeps its colour however the cloud around it changes, so it is chosen by the
// word itself rather than by where it currently sits.
function wordColor(word) {
  let sum = 0;
  for (const char of word) sum += char.codePointAt(0);
  return WORD_COLORS[sum % WORD_COLORS.length];
}

/**
 * A count drawn as a cloud: a list of words, each as large as the people behind it.
 * `scale` enlarges the type, for the tool's own page where the cloud is the main thing.
 */
export function Cloud({ result, minHeight = 160, scale = 1 }) {
  const cloud = useMemo(() => cloudWords(result), [result]);
  return (
    <ul aria-label="Word cloud" style={{ listStyle: 'none', margin: 0, padding: '8px 0', minHeight,
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', alignContent: 'center',
      gap: '4px 18px' }}>
      {cloud.map(({ word, count, weight }) => (
        <li key={word} title={`${count} ${count === 1 ? 'person' : 'people'}`}
          style={{ fontSize: Math.round((16 + weight * 38) * scale), fontWeight: 700, lineHeight: 1.15,
            letterSpacing: '-0.02em', color: wordColor(word), overflowWrap: 'anywhere' }}>
          {word}
          <span className="placer-visually-hidden">, said by {count}</span>
        </li>
      ))}
    </ul>
  );
}

/** The same count as a list: every answer with how many times it was given, the most given first. */
export function WordCounts({ t, result }) {
  return (
    <ol aria-label="Answers and how many times each was given" style={{ listStyle: 'none', margin: 0, padding: 0,
      maxHeight: 260, overflowY: 'auto' }}>
      {result.words.map(({ word, count }) => (
        <li key={word} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '7px 0',
          borderBottom: `1px solid ${t.line}` }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: t.ink, overflowWrap: 'anywhere' }}>
            {word}
          </span>
          <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>{count}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The field somebody adds their words through, and the words they have added so far,
 * each removable. `draft` is held by the caller, so it can send a word still being
 * typed along with the rest.
 */
export function WordEntry({ t, words, limit, draft, onDraft, onChange, disabled = false, over = false }) {
  const id = useId();
  const full = words.length >= limit;
  disabled = disabled || over;

  const add = (event) => {
    event.preventDefault();
    const next = addWord(words, draft, limit);
    if (next !== words) onChange(next);
    onDraft('');
  };

  return (
    <div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          id={`${id}-word`}
          aria-label="Your word"
          type="text"
          maxLength={MAX_WORD_LENGTH}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          disabled={disabled || full}
          placeholder={over ? 'Finished' : full ? 'That is all your words' : 'Type a word'}
          style={{ flex: 1, minWidth: 0, height: 48, padding: '0 14px', borderRadius: 12,
            border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink,
            fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 600 }} />
        <Btn t={t} type="submit" variant="outline" icon="plus" disabled={disabled || full}>Add</Btn>
      </form>

      {words.length > 0 && (
        <ul aria-label="Your words" style={{ listStyle: 'none', margin: '12px 0 0', padding: 0,
          display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {words.map((word) => (
            <li key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 36,
              padding: '0 4px 0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surfaceAlt,
              color: t.ink, fontSize: 15, fontWeight: 600 }}>
              {word}
              <Btn t={t} type="button" variant="ghost" size="sm" icon="close" ariaLabel={`Remove ${word}`}
                disabled={disabled} onClick={() => onChange(words.filter((entry) => entry !== word))}
                style={{ width: 28, height: 28, padding: 0 }} />
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 12.5, color: t.inkFaint, marginTop: 10 }}>
        {over ? 'Finished — no more words are being taken.'
          : limit === 1 ? 'One word each.' : `${words.length} of ${limit} words.`}
      </p>
    </div>
  );
}

/**
 * Seconds left on a timer, kept ticking while it runs: null before it starts, 0 once
 * it is over. A paused timer holds still.
 */
export function useCountdown(timer) {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = timer?.endsAt ?? null;
  // Read against whichever is later, so a timer started since the last tick does not
  // show a second short until the next one.
  const [seenAt, setSeenAt] = useState(now);
  if (endsAt !== null && seenAt !== endsAt) {
    setSeenAt(endsAt);
    setNow(Date.now());
  }
  const left = secondsLeft(timer, now);
  const running = endsAt !== null && left > 0;

  useEffect(() => {
    if (!running) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [running]);

  return left;
}

/** The countdown as it is shown: the time left, that it is paused, or that it is over. */
export function Countdown({ t, left, paused = false }) {
  if (left === null) return null;
  return (
    <span role="timer" aria-label="Time left" className="placer-mono"
      style={{ fontSize: left > 0 ? 20 : 13, fontWeight: 700, color: left > 0 && !paused ? t.ink : t.inkDim }}>
      {left > 0 ? `${formatCountdown(left)}${paused ? ' · paused' : ''}` : 'Finished'}
    </span>
  );
}

/**
 * A Full screen button, and the cloud over the whole screen once it is pressed: the
 * prompt above it, and how many have answered and the timer below. It draws whatever
 * `result` is now, so it stays live. The browser's own full screen is asked for too;
 * leaving that, or pressing Escape or the close button, goes back to the page.
 */
export function FullScreenCloud({ t, prompt, result, people = null, left = null, paused = false, emptyText = null }) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const overlay = overlayRef.current;
    overlay?.focus();
    // Refused by some browsers (an iPhone's, for one), which leaves the overlay alone
    // filling the window — as good, short of the browser's bars.
    Promise.resolve(overlay?.requestFullscreen?.()).catch(() => {});
    const onFullscreen = () => { if (!document.fullscreenElement) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {});
    };
  }, [open]);

  const empty = !result || result.total === 0;
  return (
    <>
      <Btn t={t} variant="outline" size="sm" icon="expand" onClick={() => setOpen(true)}>
        Full screen
      </Btn>
      {open && createPortal(
        <div ref={overlayRef} role="dialog" aria-modal="true" aria-label="Word cloud in full screen"
          tabIndex={-1}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: t.surface, outline: 'none',
            display: 'flex', flexDirection: 'column', gap: 16, padding: 'clamp(16px, 4vw, 48px)', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <p style={{ flex: 1, margin: 0, fontSize: 'clamp(22px, 3.2vw, 40px)', fontWeight: 700, color: t.ink,
              lineHeight: 1.25, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>
              {prompt}
            </p>
            <Btn t={t} variant="outline" size="sm" icon="close" onClick={() => setOpen(false)}>
              Exit full screen
            </Btn>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            {empty ? (
              <p style={{ fontSize: 18, color: t.inkDim, textAlign: 'center' }}>{emptyText}</p>
            ) : (
              <Cloud result={result} minHeight={0} scale={2.2} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 28 }}>
            {people !== null && (
              <span className="placer-mono" style={{ fontSize: 14, color: t.inkFaint }}>
                {people} {people === 1 ? 'person' : 'people'}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <Countdown t={t} left={left} paused={paused} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function WordCloud({ t, room }) {
  const [prompt, setPrompt] = useState('');
  const [words, setWords] = useState([]);
  const [draft, setDraft] = useState('');
  const [ownSeconds, setOwnSeconds] = useState(null);
  // The timer as this browser last set it: all there is outside a room, and in one the
  // facilitator's own, which shows straight away rather than once the room has heard.
  // Undefined until this browser has touched it.
  const [ownTimer, setOwnTimer] = useState(undefined);
  const fixedPrompt = room?.config?.prompt ?? null;
  const limit = wordLimit(room?.config);

  const inRoom = room?.status === 'open';
  const emptyText = inRoom
    ? 'Nobody has added a word yet. Yours will show up here as soon as you add one.'
    : 'Add a word to see it here.';
  const editable = !room?.config && !inRoom;

  const seconds = editable ? ownSeconds : cloudTimer(room?.config);
  const heard = useMemo(
    () => (inRoom ? roomTimer((room.contributions ?? []).map((entry) => entry.state)) : null),
    [inRoom, room?.contributions],
  );
  const timer = seconds ? (ownTimer !== undefined ? ownTimer : heard) : null;
  const left = useCountdown(timer);
  const over = left === 0;
  const paused = isPaused(timer);
  // Whoever asked the prompt runs the timer: anybody here, the facilitator in a room.
  const runsTimer = inRoom ? room.isHost : editable;
  const canStart = Boolean(seconds) && timer === null && runsTimer;
  const underWay = left !== null && left > 0 && runsTimer;

  // Held in a ref rather than an effect dependency: the room object is rebuilt on
  // every render, so depending on it would republish on every incoming change — the
  // same reason the Poll keeps one.
  const roomRef = useRef(room);
  roomRef.current = room;

  // The facilitator's contribution carries the timer as well as their words, so it has
  // to go out again with every change they make after starting it.
  const timerRef = useRef(null);
  timerRef.current = inRoom && room.isHost ? timer : null;
  const publish = (next, withTimer = timerRef.current) => {
    const current = roomRef.current;
    if (current?.status === 'open') current.publish(withTimer ? { words: next, timer: withTimer } : { words: next });
  };

  // Nothing is sent until somebody has added a word; after that every change is,
  // removing the last one included, so taking a word back takes it out of the cloud.
  const touched = useRef(false);
  const change = (next) => {
    touched.current = true;
    setWords(next);
  };

  useEffect(() => {
    if (touched.current) publish(words);
    // `publish` only reads refs, so it is left out of the dependencies on purpose.
  }, [words]);

  // Start, pause, carry on and stop all come to the same thing: the timer is now this.
  const setTimer = (next) => {
    setOwnTimer(next);
    if (inRoom) publish(words, next);
  };

  const roomResult = room?.combined ?? null;
  const soloResult = useMemo(() => countWords([{ words }], limit), [words, limit]);
  const result = inRoom ? roomResult : soloResult;
  const empty = !result || result.total === 0;
  const shownPrompt = fixedPrompt ?? prompt.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Panel t={t} title={inRoom ? "The room's cloud" : 'Your cloud'} aside={shownPrompt && (
        <p style={{ maxWidth: '70%', margin: 0, textAlign: 'right', fontSize: 15, fontWeight: 700, color: t.ink,
          lineHeight: 1.35, overflowWrap: 'anywhere' }}>
          {shownPrompt}
        </p>
      )}>
        {empty ? (
          <p style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
            {emptyText}
          </p>
        ) : (
          <Cloud result={result} minHeight={320} scale={1.5} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 36, marginTop: 8 }}>
          {inRoom && (
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
              {roomResult?.people ?? 0} {roomResult?.people === 1 ? 'person' : 'people'}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <FullScreenCloud t={t} prompt={shownPrompt} result={result} people={inRoom ? roomResult?.people ?? 0 : null}
            left={left} paused={paused} emptyText={emptyText} />
          <Countdown t={t} left={left} paused={paused} />
          {canStart && (
            <Btn t={t} variant="primary" size="sm" icon="clock" onClick={() => setTimer(startTimer(seconds))}>
              Start the {seconds} second timer
            </Btn>
          )}
          {underWay && (
            <>
              <Btn t={t} variant="outline" size="sm"
                onClick={() => setTimer(paused ? resumeTimer(timer) : pauseTimer(timer))}>
                {paused ? 'Continue' : 'Pause'}
              </Btn>
              <Btn t={t} variant="primary" size="sm" onClick={() => setTimer(stopTimer())}>Stop</Btn>
            </>
          )}
          {over && editable && (
            <Btn t={t} variant="outline" size="sm" onClick={() => setOwnTimer(null)}>Reset the timer</Btn>
          )}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20,
        alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* A prompt fixed by the room's setup is already on the cloud card, so only one
              still being written gets a card here. */}
          {!fixedPrompt && (
            <Panel t={t} title="Ask something">
              <label htmlFor="word-cloud-prompt"
                style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: t.inkDim, marginBottom: 8 }}>
                The prompt
              </label>
              <input
                id="word-cloud-prompt"
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="One word for this place?"
                style={{ width: '100%', padding: '12px 14px', fontSize: 18, fontWeight: 700, borderRadius: 12,
                  border: `1.5px solid ${t.line}`, background: t.chrome, color: t.ink,
                  fontFamily: 'var(--placer-font)', outline: 'none' }}
              />
              <p style={{ fontSize: 12.5, color: t.inkFaint, marginTop: 8, lineHeight: 1.5 }}>
                Shown on this screen only — read it aloud, or put it on a slide. What gets counted
                is the words below, not the wording.
              </p>
              {editable && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
                  <label htmlFor="word-cloud-timer" style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim }}>
                    Timer
                  </label>
                  <TimerSelect t={t} id="word-cloud-timer" value={ownSeconds} disabled={timer !== null && !over}
                    onChange={(next) => { setOwnSeconds(next); setOwnTimer(null); }} />
                  <p style={{ fontSize: 12.5, color: t.inkFaint, lineHeight: 1.5 }}>
                    Optional. Start it from the cloud; when it runs out, no more words are taken.
                  </p>
                </div>
              )}
            </Panel>
          )}

          <Panel t={t} title="Add your words">
            <WordEntry t={t} words={words} limit={limit} draft={draft} onDraft={setDraft} onChange={change}
              over={over} />
            {words.length > 0 && !over && (
              <p style={{ fontSize: 12.5, color: t.inkDim, marginTop: 6 }}>
                {inRoom ? 'Sent to the room.' : 'Remove a word to change your mind.'}
              </p>
            )}
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <Panel t={t} title="Answers">
            {empty ? (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
                Each answer is listed here, with how many times it was given.
              </p>
            ) : (
              <WordCounts t={t} result={result} />
            )}
          </Panel>

          <Panel t={t} title="How it works">
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
              Open a room and share its PIN or QR code, and everybody who joins adds a few words of
              their own — the cloud above grows live, and a word gets larger each time another
              person says it. Opened from a project, a room can stay open for up to 90 days, so its
              QR code can go on a poster. Closing the room, or its time running out, lets go of
              every word in it.
            </p>
          </Panel>

          {onItsOwn(room) && (
            <KeepOnProfile t={t} tool="word-cloud" intro="Save this prompt and your words on your profile as an inquiry, to come back to later."
              inquiry={prompt.trim() || words.length > 0 ? {
                title: prompt.trim() || 'Word Cloud', note: '',
                config: { prompt: prompt.trim(), seconds: ownSeconds, words },
              } : null} />
          )}
        </div>
      </div>
    </div>
  );
}

export default WordCloud;
