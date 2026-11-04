/* PLACER — Toolkit: Poll.
 *
 * The simplest possible room: type whatever you want to ask, write the answers to
 * pick from (Yes, No and Undecided to begin with), then vote. Here the question and
 * answers are decoration — read them aloud, put them on a slide — and are never
 * published anywhere; only the vote a person picks is sent to the room, so its tally
 * is exactly the split people actually cast.
 *
 * A room set up for a project (`room.config`, see `setup` in toolkit/tools.js) has its
 * question and answers fixed: the organiser wrote them before opening the room, so
 * they are shown rather than typed. A room opened without a setup offers Yes, No and
 * Undecided, since everybody in it has to be choosing between the same answers.
 *
 * The counting is in src/lib/openVote.js.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Meter, Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { AnswersEditor } from './OpenVoteSetup';
import { DEFAULT_ANSWERS, OPTIONS, pollOptions, tally } from '../../lib/openVote';
import { KeepOnProfile, onItsOwn } from './KeepOnProfile';

function VoteMeters({ t, options, result }) {
  return (
    <>
      {options.map((option) => (
        <Meter
          key={option.key}
          t={t}
          label={option.label}
          value={result.shares[option.key]}
          color={option.color}
          caption={`${result.counts[option.key]} · ${Math.round(result.shares[option.key] * 100)}%`}
        />
      ))}
    </>
  );
}

// The example the tally preview starts from, and how many votes it gathers before it
// begins again.
const PREVIEW_START = ['yes', 'yes', 'yes', 'no', 'no', 'undecided'].map((choice) => ({ choice }));
const PREVIEW_MAX = 30;
const PREVIEW_TICK_MS = 1200;

/**
 * A made-up poll filling up on its own, for the tool's introduction in
 * ConfigureToolDialog: what the room's live tally will look like once people pick.
 * Holds still for anybody who has asked for less motion.
 */
export function OpenVotePreview({ t }) {
  const [votes, setVotes] = useState(PREVIEW_START);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => {
      setVotes((current) => {
        if (current.length >= PREVIEW_MAX) return PREVIEW_START;
        // Leaning Yes, so a lead forms and is sometimes caught.
        const roll = Math.random();
        const choice = roll < 0.45 ? 'yes' : roll < 0.8 ? 'no' : 'undecided';
        return [...current, { choice }];
      });
    }, PREVIEW_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const result = tally(votes, OPTIONS);
  return (
    <div role="img" aria-label="An example poll, its tally changing as votes come in"
      style={{ padding: '14px 16px 4px', borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface }}>
      <div aria-hidden="true">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Should the square get more benches?</span>
          <div style={{ flex: 1 }} />
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint, whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, marginRight: 6,
              background: '#B3261E', verticalAlign: 'middle' }} />
            {result.total} {result.total === 1 ? 'vote' : 'votes'}
          </span>
        </div>
        <VoteMeters t={t} options={OPTIONS} result={result} />
      </div>
    </div>
  );
}

export function OpenVote({ t, tool, room }) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const fixedQuestion = room?.config?.question ?? null;
  const [choice, setChoice] = useState(null);

  const inRoom = room?.status === 'open';
  const editable = !room?.config && !inRoom;
  const options = useMemo(
    () => pollOptions(room?.config ? room.config.answers : editable ? answers : null),
    [room?.config, editable, answers],
  );

  // Rewriting or removing the answer that was picked takes the pick away with it.
  useEffect(() => {
    if (choice && !options.some((option) => option.key === choice)) setChoice(null);
  }, [choice, options]);

  // Held in a ref rather than an effect dependency: the room object is rebuilt on
  // every render, so depending on it would republish on every incoming change and
  // the two would chase each other round for ever — the same reason Co-Budget
  // keeps one.
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (!choice) return;
    const current = roomRef.current;
    if (current?.status === 'open') current.publish({ choice });
  }, [choice]);

  const roomResult = room?.combined ?? null;
  const soloResult = useMemo(() => tally(choice ? [{ choice }] : [], options), [choice, options]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {fixedQuestion ? (
          <Panel t={t} title="The question">
            <p style={{ fontSize: 22, fontWeight: 700, color: t.ink, lineHeight: 1.35, letterSpacing: '-0.02em' }}>
              {fixedQuestion}
            </p>
          </Panel>
        ) : (
        <Panel t={t} title="Ask something">
          <label htmlFor="open-vote-question"
            style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: t.inkDim, marginBottom: 8 }}>
            The question
          </label>
          <input
            id="open-vote-question"
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Yes or No?"
            style={{ width: '100%', padding: '12px 14px', fontSize: 18, fontWeight: 700, borderRadius: 12,
              border: `1.5px solid ${t.line}`, background: t.chrome, color: t.ink,
              fontFamily: 'var(--placer-font)', outline: 'none' }}
          />
          <p style={{ fontSize: 12.5, color: t.inkFaint, marginTop: 8, lineHeight: 1.5 }}>
            Shown on this screen only — read it aloud, or put it on a slide. What gets counted is
            the vote below, not the wording.
          </p>
          {editable && (
            <div style={{ marginTop: 20 }}>
              <AnswersEditor t={t} answers={answers} onChange={setAnswers} />
            </div>
          )}
        </Panel>
        )}

        <Panel t={t} title="Cast your vote">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {options.map((option) => {
              const active = choice === option.key;
              return (
                <Btn
                  key={option.key}
                  t={t}
                  variant="outline"
                  ariaPressed={active}
                  onClick={() => setChoice(option.key)}
                  style={{
                    flex: '1 1 140px',
                    height: 64,
                    fontSize: 17,
                    border: `2px solid ${active ? option.color : t.line}`,
                    background: active ? `${option.color}18` : 'transparent',
                    color: active ? option.color : t.ink,
                  }}>
                  {option.label}
                </Btn>
              );
            })}
          </div>
          {choice && (
            <p style={{ fontSize: 12.5, color: t.inkDim, marginTop: 14 }}>
              {inRoom ? 'Sent to the room.' : 'Change your mind any time — only the last vote counts.'}
            </p>
          )}
        </Panel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {inRoom ? (
          <Panel t={t} title="The room's vote" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
              {room.participantCount} cast
            </span>
          }>
            {roomResult && roomResult.total > 0 ? (
              <VoteMeters t={t} options={options} result={roomResult} />
            ) : (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
                Nobody has voted yet. Yours will show up here as soon as you pick one.
              </p>
            )}
          </Panel>
        ) : (
          <Panel t={t} title="Result">
            {choice ? (
              <VoteMeters t={t} options={options} result={soloResult} />
            ) : (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
                Pick an answer to see it here.
              </p>
            )}
          </Panel>
        )}

        <Panel t={t} title="How it works">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            Open a room and share its PIN or QR code, and everybody who joins votes on whatever you
            asked — the tally above updates live as each person picks. Opened from a project, a room
            can stay open for up to 90 days, so its QR code can go on a poster. Closing the room, or
            its time running out, lets go of every vote in it.
          </p>
        </Panel>

        {onItsOwn(room) && (
          <KeepOnProfile t={t} tool={tool.id} intro="Save this question, its answers and your vote on your profile as an inquiry, to come back to later."
            inquiry={question.trim() ? {
              title: question.trim(), note: '', config: { question: question.trim(), answers, choice },
            } : null} />
        )}
      </div>
    </div>
  );
}

export default OpenVote;
