/* PLACER — Toolkit: People Moving Count.
 *
 * A field count after Gehl's Public Life Data Protocol: everybody who crosses a line,
 * by how they are moving. After the cover come the instructions; "Get started" moves on
 * to setting up the session (PeopleMovingSetup.jsx): the count line on a map, and the
 * sheet's header. Start counting opens the counting screen: the timer and the tally at
 * the top, then a big button for each way of moving — five kinds of pedestrian, and
 * people on bicycles — with the line beside them on a map that cannot be moved or
 * changed. See results moves on to the count added up, to copy out.
 *
 * A project's line (`setup`, project_tools.config) is fixed: everybody counting for it
 * sees it already drawn. On the configuration page's canvas (`slide`) the tool draws
 * only the line under its location; in the Preview (`answering`) it opens straight on
 * the counting screen, as somebody counting would see it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn, CopyButton } from '../UI';
import { Icon } from '../Icon';
import { CountLineMap, PeopleMovingInstructions, PeopleMovingSessionSetup } from './PeopleMovingSetup';
import {
  COUNT_SECONDS, GROUPS, MODE_BY_KEY, bump, clock, emptyCounts, hasProjectSetup, modesIn, peopleWord,
  sessionFromSetup, sessionLines, summaryText, totals,
} from '../../lib/toolkit/peopleMoving';

// A card inside another card: flat, so it reads as part of the one around it.
const INNER = { boxShadow: 'none', minWidth: 0 };

const smallCaps = (t) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: t.inkDim });

/**
 * The timer: counts up from 0:00 and stops by itself at the protocol's ten minutes.
 * `seconds` is how long it has run; `start` also runs it on from a pause.
 */
function useCountTimer(limit = COUNT_SECONDS) {
  // Time run before the current stretch, and when the current stretch began (or null).
  const [banked, setBanked] = useState(0);
  const [since, setSince] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since === null) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [since]);

  const raw = banked + (since === null ? 0 : Math.max(0, now - since));
  const seconds = Math.min(limit, raw / 1000);
  const done = seconds >= limit;

  // At the limit it stops, rather than running on past the count.
  useEffect(() => {
    if (since !== null && done) {
      setBanked(limit * 1000);
      setSince(null);
    }
  }, [since, done, limit]);

  return {
    seconds,
    running: since !== null,
    done,
    start() {
      if (since !== null || done) return;
      const at = Date.now();
      setNow(at);
      setSince(at);
    },
    pause() {
      if (since === null) return;
      const at = Date.now();
      setBanked((before) => Math.min(limit * 1000, before + (at - since)));
      setSince(null);
      setNow(at);
    },
    reset() {
      setBanked(0);
      setSince(null);
      setNow(Date.now());
    },
  };
}

/** The timer and the tally, at the top of the counting screen. */
function CountHeader({ t, tool, timer, sums }) {
  const share = Math.min(1, timer.seconds / COUNT_SECONDS);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
      <Panel t={t} style={{ ...INNER, flex: '1 1 260px' }}>
        <div style={smallCaps(t)}>Timer</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <span role="timer" aria-label="Time counted" className="placer-disp"
            style={{ fontSize: 44, fontWeight: 700, color: t.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {clock(timer.seconds)}
          </span>
          <span className="placer-mono" style={{ fontSize: 13, color: t.inkFaint }}>of {clock(COUNT_SECONDS)}</span>
        </div>
        <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: t.surfaceAlt, margin: '10px 0 12px', overflow: 'hidden' }}>
          <div style={{ width: `${share * 100}%`, height: '100%', background: tool.color, transition: 'width 0.25s linear' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {timer.running ? (
            <Btn t={t} size="sm" variant="outline" onClick={timer.pause}>Pause</Btn>
          ) : (
            <Btn t={t} size="sm" icon="play" disabled={timer.done} onClick={timer.start}>
              {timer.seconds > 0 && !timer.done ? 'Resume' : 'Start'}
            </Btn>
          )}
          <Btn t={t} size="sm" variant="ghost" icon="undo" disabled={timer.seconds === 0} onClick={timer.reset}>
            Reset timer
          </Btn>
          {timer.done && (
            <span role="status" style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Time is up.</span>
          )}
        </div>
      </Panel>

      <Panel t={t} style={{ ...INNER, flex: '1 1 260px' }}>
        <div style={smallCaps(t)}>Tally</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <span aria-label="Total crossed" className="placer-disp"
            style={{ fontSize: 44, fontWeight: 700, color: t.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {sums.total}
          </span>
          <span style={{ fontSize: 13, color: t.inkDim }}>{peopleWord(sums.total)} crossed</span>
        </div>
        <dl style={{ display: 'flex', gap: 20, margin: '12px 0 0', flexWrap: 'wrap' }}>
          {GROUPS.map((group) => (
            <div key={group.key}>
              <dt style={{ fontSize: 12, color: t.inkDim }}>{group.label}</dt>
              <dd aria-label={group.label} className="placer-disp"
                style={{ margin: 0, fontSize: 22, fontWeight: 700, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
                {sums[group.key]}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

/** One way of moving: a big button that adds one, and a small one that takes one off. */
function ModeButton({ t, tool, mode, count, onAdd, onRemove }) {
  return (
    // As tall as the tallest in its row, so a row of them lines up.
    <div style={{ position: 'relative', display: 'flex' }}>
      <button type="button" onClick={onAdd}
        aria-label={`${mode.label}${mode.example ? ` (${mode.example})` : ''}: ${count}. Add one`}
        className="placer-btn placer-btn-tinted"
        style={{
          flex: 1, width: '100%', minHeight: 100, padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
          background: tool.tint, border: `1px solid ${tool.color}`, color: t.ink, textAlign: 'left',
          fontFamily: 'var(--placer-font)', touchAction: 'manipulation', userSelect: 'none',
          '--placer-btn-hover': tool.hover,
        }}>
        <span style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>{mode.label}</span>
          {mode.example && <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim, marginTop: 2 }}>{mode.example}</span>}
        </span>
        <span className="placer-disp" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </span>
      </button>
      <button type="button" onClick={onRemove} disabled={count === 0}
        aria-label={`One fewer: ${mode.label}`} title={`One fewer: ${mode.label}`}
        style={{
          // Bottom-right, beside the count, so the label has the button's whole width.
          position: 'absolute', bottom: 10, right: 10, width: 32, height: 32, borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          background: '#FFFFFF', border: `1px solid ${count === 0 ? t.line : t.lineStrong}`,
          color: count === 0 ? t.inkFaint : t.ink, cursor: count === 0 ? 'not-allowed' : 'pointer',
        }}>
        <Icon name="minus" size={16} stroke={2.2} />
      </button>
    </div>
  );
}

// `setup` is a project's (project_tools.config): the line and location everybody
// counting for it shares. Without one, the observer draws their own.
export function PeopleMovingCount({ t, tool, setup = null, slide = false, answering = false }) {
  const fixed = hasProjectSetup(setup);
  // Which step after the cover: the instructions, setting up the session, the count,
  // or the results. Somebody answering in the Preview starts on the count.
  const [step, setStep] = useState(answering ? 'count' : 'instructions');
  const [session, setSession] = useState(() => sessionFromSetup(setup));
  const [counts, setCounts] = useState(emptyCounts);
  // Each tap in order, so Undo can take off the last.
  const history = useRef([]);
  const [last, setLast] = useState(null);
  const timer = useCountTimer();
  const sums = useMemo(() => totals(counts), [counts]);

  // The configuration page's canvas: the line as counters will see it, as it changes.
  if (slide) {
    const line = setup?.line ?? [];
    return (
      <div style={{ fontFamily: 'var(--placer-font)' }}>
        <Panel t={t} title={setup?.location?.trim() || tool.name}>
          {line.length >= 2 ? (
            <CountLineMap t={t} tool={tool} line={line} readOnly height={460} />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: t.inkDim, lineHeight: 1.5 }}>
              Draw the count line in the Configure panel. It shows here as everybody counting will see it.
            </p>
          )}
        </Panel>
      </div>
    );
  }

  function add(mode) {
    setCounts((current) => bump(current, mode));
    history.current.push(mode);
    setLast(mode);
    // The first tap starts the clock, if it has not been started.
    if (!timer.running && timer.seconds === 0) timer.start();
  }

  function remove(mode) {
    if ((counts[mode] ?? 0) === 0) return;
    setCounts((current) => bump(current, mode, -1));
    const at = history.current.lastIndexOf(mode);
    if (at >= 0) history.current.splice(at, 1);
    setLast(null);
  }

  function undo() {
    const mode = history.current.pop();
    if (!mode) return;
    setCounts((current) => bump(current, mode, -1));
    setLast(null);
  }

  function clearAll() {
    setCounts(emptyCounts());
    history.current = [];
    setLast(null);
    timer.reset();
  }

  if (step === 'instructions') {
    return (
      <div style={{ fontFamily: 'var(--placer-font)' }}>
        <Panel t={t} title="Instructions">
          <PeopleMovingInstructions t={t} />
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <Btn t={t} onClick={() => setStep('configure')}>Get started</Btn>
          </div>
        </Panel>
      </div>
    );
  }

  if (step === 'configure') {
    return (
      <PeopleMovingSessionSetup t={t} tool={tool} session={session} fixed={fixed} onChange={setSession}
        onBack={() => setStep('instructions')} onStart={() => setStep('count')} />
    );
  }

  if (step === 'results') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--placer-font)' }}>
        <div>
          <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={() => setStep('count')}>Count</Btn>
        </div>

        <p aria-label="Session" className="placer-mono" style={{ margin: 0, fontSize: 12, color: t.inkDim, lineHeight: 1.6 }}>
          {[...sessionLines(session), `Counted for ${clock(timer.seconds)}`].join(' · ')}
        </p>

        <Panel t={t} title="Count Tally" aside={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
              {sums.total} {peopleWord(sums.total)} crossed
            </span>
            <Btn t={t} variant="ghost" size="sm" icon="trash" disabled={sums.total === 0 && timer.seconds === 0} onClick={clearAll}>
              Clear
            </Btn>
          </div>
        }>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--placer-font)' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.lineStrong}` }}>
                <HeadCell t={t} align="left" pad="8px 10px 8px 0">Moving</HeadCell>
                <HeadCell t={t} align="right" pad="8px 0">Tally</HeadCell>
              </tr>
            </thead>
            {GROUPS.map((group) => {
              const modes = modesIn(group.key);
              return (
                <tbody key={group.key}>
                  <tr style={{ borderBottom: `1px solid ${t.line}` }}>
                    <th scope="row" style={{ padding: '10px 10px 8px 0', textAlign: 'left', fontSize: 13.5, fontWeight: 700, color: t.ink }}>
                      {group.label}
                    </th>
                    <td className="placer-disp" style={{ padding: '10px 0 8px', textAlign: 'right', fontSize: 16, fontWeight: 700, color: t.ink }}>
                      {sums[group.key]}
                    </td>
                  </tr>
                  {modes.length > 1 && modes.map((mode) => (
                    <tr key={mode.key} style={{ borderBottom: `1px solid ${t.line}` }}>
                      <th scope="row" style={{ padding: '6px 10px 6px 16px', textAlign: 'left', fontSize: 13, fontWeight: 400, color: t.inkDim }}>
                        {mode.label}
                        {mode.example && <span style={{ color: t.inkFaint }}> ({mode.example})</span>}
                      </th>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontSize: 13.5, color: counts[mode.key] > 0 ? t.ink : t.inkFaint }}>
                        {counts[mode.key]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
            <tfoot>
              <tr>
                <td className="placer-mono" style={{ padding: '10px 10px 0 0', ...smallCaps(t) }}>Total</td>
                <td className="placer-disp" style={{ padding: '10px 0 0', textAlign: 'right', fontSize: 18, fontWeight: 700, color: t.ink }}>
                  {sums.total}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: 14 }}>
            <CopyButton
              t={t} value={summaryText(counts, session, timer.seconds)} variant="primary" size="sm" icon="send"
              label="Copy tally" copiedLabel="Copied" fieldLabel="Your tally as text"
              multiline disabled={sums.total === 0}
              style={{ alignItems: 'flex-start' }} />
          </div>
        </Panel>
      </div>
    );
  }

  // The count: the timer and the tally at the top, the buttons, and the line beside them.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--placer-font)' }}>
      {!answering && (
        <>
          <div>
            <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={() => setStep('configure')}>Session</Btn>
          </div>
          <p aria-label="Session" className="placer-mono" style={{ margin: 0, fontSize: 12, color: t.inkDim, lineHeight: 1.6 }}>
            {sessionLines(session).join(' · ')}
          </p>
        </>
      )}

      <CountHeader t={t} tool={tool} timer={timer} sums={sums} />

      <Panel t={t} title="Count" aside={
        <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>tap once per person crossing</span>
      }>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '3 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {GROUPS.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h3 className="placer-mono" style={{ ...smallCaps(t), margin: '0 0 10px', display: 'flex', gap: 8 }}>
                  {group.label}
                  <span style={{ color: t.ink }}>{sums[group.key]}</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                  {modesIn(group.key).map((mode) => (
                    <ModeButton key={mode.key} t={t} tool={tool} mode={mode} count={counts[mode.key]}
                      onAdd={() => add(mode.key)} onRemove={() => remove(mode.key)} />
                  ))}
                </div>
              </section>
            ))}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn t={t} variant="ghost" size="sm" icon="undo" disabled={sums.total === 0} onClick={undo}>
                Undo last
              </Btn>
              <div style={{ flex: 1 }} />
              <div role="status" aria-live="polite" style={{ fontSize: 12, color: t.inkDim }}>
                {last ? `Added: ${MODE_BY_KEY[last].label}` : sums.total > 0 ? `${sums.total} counted` : 'Nothing yet'}
              </div>
            </div>
          </div>

          <Panel t={t} style={{ ...INNER, flex: '2 1 280px' }} title="Count line">
            {session.line.length >= 2 ? (
              <CountLineMap t={t} tool={tool} line={session.line} readOnly height={320} />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: t.inkDim, lineHeight: 1.5 }}>No line has been drawn yet.</p>
            )}
          </Panel>
        </div>

        {!answering && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn t={t} onClick={() => setStep('results')}>See results</Btn>
          </div>
        )}
      </Panel>
    </div>
  );
}

function HeadCell({ t, children, align, pad }) {
  return (
    <th scope="col" className="placer-mono" style={{ textAlign: align, padding: pad,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
      {children}
    </th>
  );
}

export default PeopleMovingCount;
