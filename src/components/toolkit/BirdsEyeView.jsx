/* PLACER — Toolkit: Birds Eye View.
 *
 * The organiser draws a place from above and puts the pieces that could go in it on
 * the plan (BirdsEyeSetup); everybody taking part answers by moving and turning those
 * pieces into the layout they would want, and submitting it (lib/birdsEye.js).
 *
 * `answering` is what somebody taking part sees, in a room and in the setup page's
 * Preview: one card — what to do, the question, the plan to arrange, and Start over
 * and Submit layout under it. Their layout reaches the room only once submitted, and
 * again each time it is changed and submitted anew. `slide` is the plan alone.
 * `presenting` is the facilitator's: the plan with everybody's layouts laid over it,
 * how many have sent one, and the timer to run.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { BirdsEyePlan } from './BirdsEyePlan';
import { Countdown, useCountdown } from './WordCloud';
import { DEFAULT_PROMPT, combineLayouts, readAssets, readLayout, readOutline, roomTimer } from '../../lib/birdsEye';
import { cloudTimer, isPaused, pauseTimer, resumeTimer, startTimer, stopTimer } from '../../lib/wordCloud';

function Title({ t, prompt, size = 28 }) {
  return (
    <h2 style={{ margin: '0 0 14px', fontSize: size, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em',
      color: prompt ? t.ink : t.inkFaint, overflowWrap: 'anywhere' }}>
      {prompt || DEFAULT_PROMPT}
    </h2>
  );
}

const sameLayout = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function BirdsEyeView({ t, room, slide = false, untitled = false, answering = false, presenting = false }) {
  const config = room?.config ?? null;
  const prompt = config?.prompt?.trim() ?? '';
  const outline = readOutline(config?.outline);
  const assets = useMemo(() => readAssets(config?.assets), [config?.assets]);
  const inRoom = room?.status === 'open';

  const states = useMemo(() => (room?.contributions ?? []).map((entry) => entry.state), [room?.contributions]);
  const everybody = room?.combined ?? combineLayouts(states, config);

  const seconds = cloudTimer(config);
  const [ownTimer, setOwnTimer] = useState(undefined);
  const heard = useMemo(() => (inRoom ? roomTimer(states) : null), [inRoom, states]);
  const timer = seconds ? (ownTimer !== undefined ? ownTimer : heard) : null;
  const left = useCountdown(timer);
  const over = left === 0;
  const paused = isPaused(timer);

  // This person's layout as they arrange it (`draft`), and what they submitted (`own`).
  const [draft, setDraft] = useState({});
  const [own, setOwn] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const timerRef = useRef(null);
  timerRef.current = inRoom && room.isHost ? timer : null;
  const publish = (layout, withTimer = timerRef.current) => {
    const current = roomRef.current;
    if (current?.status !== 'open') return;
    current.publish(withTimer ? { layout, timer: withTimer } : { layout });
  };
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) publish(own);
  }, [own]); // eslint-disable-line react-hooks/exhaustive-deps

  const moved = Object.keys(draft).length > 0;
  const submitted = own !== null && sameLayout(own, draft);
  const changeAsset = (id, patch) => {
    if (over) return;
    const asset = assets.find((candidate) => candidate.id === id);
    if (!asset) return;
    setDraft((was) => {
      const at = was[id] ?? { x: asset.x, y: asset.y, r: asset.r };
      return { ...was, [id]: { ...at, ...patch } };
    });
  };
  const submit = () => {
    if (over || !moved) return;
    touched.current = true;
    setOwn(readLayout(draft, assets));
  };
  const startOver = () => {
    setDraft({});
    setSelectedId(null);
    if (own) {
      touched.current = true;
      setOwn(null);
    }
  };

  if (answering || (inRoom && !presenting && !slide)) {
    return (
      <div className="placer-answering">
        <section aria-label="Birds Eye View" className="placer-answering-main" style={{ background: t.surface,
          border: `1px solid ${t.line}`, borderRadius: 12, padding: 24, boxShadow: t.shadow, minWidth: 0 }}>
          <p role="status" style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: t.inkDim }}>
            {over ? 'Time is up'
              : submitted ? 'Layout submitted · keep moving to change it'
                : moved ? 'Submit your layout, or keep moving pieces'
                  : 'Drag the pieces where you would put them · turn one by its top handle'}
          </p>
          <Title t={t} prompt={prompt} />
          {left !== null && <div style={{ margin: '0 0 12px' }}><Countdown t={t} left={left} paused={paused} /></div>}
          <div className="placer-answering-cloud">
            <BirdsEyePlan outline={outline} assets={assets} layout={draft} mode={over ? 'view' : 'arrange'}
              selectedId={selectedId} onSelect={setSelectedId} onChangeAsset={changeAsset}
              height="min(60dvh, 560px)" label={`Plan: ${prompt || DEFAULT_PROMPT}`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <Btn t={t} variant="outline" icon="undo" onClick={startOver} disabled={!moved && !own}
              style={{ flex: '1 1 0', maxWidth: 220, padding: '0 12px' }}>
              Start over
            </Btn>
            <Btn t={t} variant="primary" icon="check" onClick={submit} disabled={over || !moved || submitted}
              style={{ flex: '1 1 0', maxWidth: 220, padding: '0 12px' }}>
              {submitted ? 'Submitted' : own ? 'Submit new layout' : 'Submit layout'}
            </Btn>
          </div>
        </section>
      </div>
    );
  }

  if (slide) {
    return (
      <section aria-label="Birds Eye View" style={{ minWidth: 0 }}>
        {!untitled && <Title t={t} prompt={prompt} size={26} />}
        <BirdsEyePlan outline={outline} assets={assets} overlays={everybody.layouts} showPieces={everybody.people === 0}
          label="Plan of the place" />
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
      <section aria-label="Birds Eye View" style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
        padding: 24, boxShadow: t.shadow, minWidth: 0 }}>
        <Title t={t} prompt={prompt} />
        <BirdsEyePlan outline={outline} assets={assets} overlays={everybody.layouts} showPieces={everybody.people === 0}
          height="min(70vh, 640px)"
          label={`Everybody's layouts: ${everybody.people}`} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 36, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
            {everybody.people} {everybody.people === 1 ? 'layout' : 'layouts'}
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
              <Btn t={t} variant="outline" size="sm" onClick={() => setTimer(paused ? resumeTimer(timer) : pauseTimer(timer))}>
                {paused ? 'Continue' : 'Pause'}
              </Btn>
              <Btn t={t} variant="primary" size="sm" onClick={() => setTimer(stopTimer())}>Stop</Btn>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <Panel t={t} title="Birds Eye View">
      <p style={{ fontSize: 15, color: t.inkDim, margin: 0, lineHeight: 1.6 }}>
        Birds Eye View runs with a group: create it from Create a tool, draw the place and the pieces that could go in
        it, and publish it. Everybody then answers by laying the pieces out the way they would want them.
      </p>
    </Panel>
  );
}

export default BirdsEyeView;
