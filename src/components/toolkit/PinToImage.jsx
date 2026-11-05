/* PLACER — Toolkit: Pin to Image.
 *
 * The organiser picks a picture and asks a question about it; everybody answers by
 * pinning one dot on the picture, and every dot shows on it as they come in. Set up as
 * Word Cloud is: a question per slide, as many slides as wanted, and an optional timer
 * the room's facilitator starts, after which no more pins are taken
 * (lib/pinToImage.js).
 *
 * `answering` is what somebody taking part sees, in a room and in the setup page's
 * Preview: one card — what to do, over the question, over the picture with everybody's
 * dots, and Submit pin and Remove pin under it. Tapping the picture places their dot
 * (tap again to move it), which only reaches the room once they submit it; Remove pin
 * takes it back, from the room too once it was sent. `slide` is only the slide, with
 * nothing to do. `presenting` is the facilitator's: the question over the picture as it
 * fills with dots, how many have pinned, and the timer to run.
 *
 * PinBoard is the picture with its dots on its own; the setup's picture (PinImageField)
 * and the results (PinToImageResults) use it too.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { Countdown, useCountdown } from './WordCloud';
import { mediaUrl } from '../../services/media';
import {
  DEFAULT_PROMPT, combinePins, pinAt, readPin, roomTimer,
} from '../../lib/pinToImage';
import { cloudTimer, isPaused, pauseTimer, resumeTimer, startTimer, stopTimer } from '../../lib/wordCloud';

const DOT = 18;

/**
 * The picture, with `pins` on it as dots and `own` (this person's) picked out. Given
 * `onPin`, a click or tap on the picture is a pin there.
 */
export function PinBoard({ t, imageUrl, pins = [], own = null, onPin = null, label = 'The picture', maxHeight = null }) {
  const ref = useRef(null);
  if (!imageUrl) return null;
  const place = (event) => {
    if (!onPin) return;
    const pin = pinAt(ref.current?.getBoundingClientRect(), event.clientX, event.clientY);
    if (pin) onPin(pin);
  };
  const dot = (pin, mine, key) => (
    <span key={key} aria-hidden="true" style={{ position: 'absolute', left: `${pin.x * 100}%`, top: `${pin.y * 100}%`,
      width: mine ? DOT + 6 : DOT, height: mine ? DOT + 6 : DOT, transform: 'translate(-50%, -50%)',
      borderRadius: '50%', background: mine ? t.ink : 'var(--placer-blue-700)',
      border: '3px solid #FFFFFF', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.35)', opacity: mine ? 1 : 0.85,
      pointerEvents: 'none' }} />
  );
  return (
    <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
      <div ref={ref} role={onPin ? 'button' : 'img'} tabIndex={onPin ? 0 : undefined}
        aria-label={onPin ? `${label}: tap to pin your dot` : `${label}, with ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}`}
        onClick={place}
        onKeyDown={(event) => {
          // Enter or space pins the middle, for a keyboard; a dot can then be moved by tapping.
          if (!onPin || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          onPin(own ?? { x: 0.5, y: 0.5 });
        }}
        style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0,
          cursor: onPin ? 'crosshair' : 'default', borderRadius: 12, overflow: 'hidden' }}>
        <img src={imageUrl} alt="" draggable={false}
          style={{ display: 'block', maxWidth: '100%', maxHeight: maxHeight ?? undefined, height: 'auto',
            userSelect: 'none' }} />
        {pins.map((pin, index) => dot(pin, false, index))}
        {own && dot(own, true, 'own')}
      </div>
    </div>
  );
}

function Title({ t, prompt, size = 28 }) {
  return (
    <h2 style={{ margin: '0 0 14px', fontSize: size, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em',
      color: prompt ? t.ink : t.inkFaint, overflowWrap: 'anywhere' }}>
      {prompt || DEFAULT_PROMPT}
    </h2>
  );
}

function NoPicture({ t }) {
  return (
    <p style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      fontSize: 14, color: t.inkDim, margin: 0 }}>
      The picture to pin on goes here.
    </p>
  );
}

export function PinToImage({ t, room, slide = false, untitled = false, answering = false, presenting = false }) {
  const config = room?.config ?? null;
  const prompt = config?.prompt?.trim() ?? '';
  const imageUrl = mediaUrl(config?.imagePath);
  const inRoom = room?.status === 'open';

  const states = useMemo(() => (room?.contributions ?? []).map((entry) => entry.state), [room?.contributions]);
  const everybody = room?.combined ?? combinePins(states);

  // The timer: set up as seconds, run by the facilitator, heard by everybody else.
  const seconds = cloudTimer(config);
  const [ownTimer, setOwnTimer] = useState(undefined);
  const heard = useMemo(() => (inRoom ? roomTimer(states) : null), [inRoom, states]);
  const timer = seconds ? (ownTimer !== undefined ? ownTimer : heard) : null;
  const left = useCountdown(timer);
  const over = left === 0;
  const paused = isPaused(timer);

  // This person's pin: where they have placed it (`draft`), and what they submitted
  // (`own`), which is what the room has. Submitting sends it; removing takes it back.
  const [draft, setDraft] = useState(null);
  const [own, setOwn] = useState(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const timerRef = useRef(null);
  timerRef.current = inRoom && room.isHost ? timer : null;
  const publish = (pin, withTimer = timerRef.current) => {
    const current = roomRef.current;
    if (current?.status !== 'open') return;
    current.publish(withTimer ? { pin, timer: withTimer } : { pin });
  };
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) publish(own);
    // `publish` only reads refs, so it is left out on purpose.
  }, [own]); // eslint-disable-line react-hooks/exhaustive-deps
  const pin = (next) => {
    if (over) return;
    setDraft(readPin(next));
  };
  const submit = () => {
    if (over || !draft) return;
    touched.current = true;
    setOwn(draft);
  };
  const remove = () => {
    setDraft(null);
    if (own) {
      touched.current = true;
      setOwn(null);
    }
  };
  const submitted = Boolean(own && draft && own.x === draft.x && own.y === draft.y);

  // Everybody else's dots: the room's, less the one that is this person's own.
  const others = useMemo(() => {
    const pins = [...everybody.pins];
    if (own) {
      const at = pins.findIndex((candidate) => candidate.x === own.x && candidate.y === own.y);
      if (at >= 0) pins.splice(at, 1);
    }
    return pins;
  }, [everybody.pins, own]);

  if (answering || (inRoom && !presenting && !slide)) {
    return (
      <div className="placer-answering">
        <section aria-label="Pin to Image" className="placer-answering-main" style={{ background: t.surface,
          border: `1px solid ${t.line}`, borderRadius: 12, padding: 24, boxShadow: t.shadow, minWidth: 0 }}>
          {/* What to do, over the question. */}
          <p role="status" style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: t.inkDim }}>
            {over ? 'Time is up'
              : submitted ? 'Pin submitted · tap to move it'
                : draft ? 'Submit your pin, or tap to move it'
                  : 'Place your pin · tap the picture'}
          </p>
          <Title t={t} prompt={prompt} />
          {left !== null && <div style={{ margin: '0 0 12px' }}><Countdown t={t} left={left} paused={paused} /></div>}
          <div className="placer-answering-cloud">
            {imageUrl ? (
              <PinBoard t={t} imageUrl={imageUrl} pins={others} own={draft ?? own} onPin={over ? null : pin}
                maxHeight="calc(100dvh - 300px)" />
            ) : <NoPicture t={t} />}
          </div>
          {/* Side by side, on a phone too. */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <Btn t={t} variant="outline" icon="close" onClick={remove} disabled={!draft && !own}
              style={{ flex: '1 1 0', maxWidth: 220, padding: '0 12px' }}>
              Remove pin
            </Btn>
            <Btn t={t} variant="primary" icon="check" onClick={submit} disabled={over || !draft || submitted}
              style={{ flex: '1 1 0', maxWidth: 220, padding: '0 12px' }}>
              {submitted ? 'Submitted' : own ? 'Submit new pin' : 'Submit pin'}
            </Btn>
          </div>
        </section>
      </div>
    );
  }

  if (slide) {
    return (
      <section aria-label="Pin to Image" style={{ minWidth: 0 }}>
        {!untitled && <Title t={t} prompt={prompt} size={26} />}
        {imageUrl ? <PinBoard t={t} imageUrl={imageUrl} pins={everybody.pins} /> : <NoPicture t={t} />}
      </section>
    );
  }

  if (presenting) {
    const setTimer = (next) => {
      setOwnTimer(next);
      if (inRoom) publish(own, next);
    };
    const runs = inRoom && room.isHost;
    return (
      <section aria-label="Pin to Image" style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
        padding: 24, boxShadow: t.shadow, minWidth: 0 }}>
        <Title t={t} prompt={prompt} />
        {imageUrl ? <PinBoard t={t} imageUrl={imageUrl} pins={everybody.pins} maxHeight="70vh" /> : <NoPicture t={t} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 36, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
            {everybody.people} {everybody.people === 1 ? 'pin' : 'pins'}
          </span>
          <div style={{ flex: 1 }} />
          <Countdown t={t} left={left} paused={paused} />
          {runs && seconds && timer === null && (
            <Btn t={t} variant="primary" size="sm" icon="clock" onClick={() => setTimer(startTimer(seconds))}>
              Start the {seconds} second timer
            </Btn>
          )}
          {runs && left !== null && left > 0 && (
            <>
              <Btn t={t} variant="outline" size="sm"
                onClick={() => setTimer(paused ? resumeTimer(timer) : pauseTimer(timer))}>
                {paused ? 'Continue' : 'Pause'}
              </Btn>
              <Btn t={t} variant="primary" size="sm" onClick={() => setTimer(stopTimer())}>Stop</Btn>
            </>
          )}
        </div>
      </section>
    );
  }

  // On its own, outside a room: there is nothing to pin on until an organiser sets it up.
  return (
    <Panel t={t} title="Pin to Image">
      <p style={{ fontSize: 15, color: t.inkDim, margin: 0, lineHeight: 1.6 }}>
        Pin to Image runs with a group: create it from Create a tool, add a picture and a question, and publish it.
        Everybody then answers by pinning a dot on the picture.
      </p>
    </Panel>
  );
}

export default PinToImage;
