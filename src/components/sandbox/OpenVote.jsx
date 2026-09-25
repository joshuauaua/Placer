/* PLACER — Sandbox: Open Vote.
 *
 * The simplest possible room: type whatever you want to ask, then Yes, No or
 * Undecided. The question is decoration — read it aloud, put it on a slide — and is
 * never published anywhere; only the vote a person picks is sent to the room, so its
 * tally is exactly the three-way split people actually cast.
 *
 * The counting is in src/lib/openVote.js.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Meter, Panel } from '../SandboxLayout';
import { Btn } from '../UI';
import { DEFAULT_QUESTION, OPTIONS, tally } from '../../lib/openVote';

function VoteMeters({ t, result }) {
  return (
    <>
      {OPTIONS.map((option) => (
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

export function OpenVote({ t, experiment, room }) {
  const [question, setQuestion] = useState('');
  const [choice, setChoice] = useState(null);

  // Held in a ref rather than an effect dependency: the room object is rebuilt on
  // every render, so depending on it would republish on every incoming change and
  // the two would chase each other round for ever — the same reason Budget Ballot
  // keeps one.
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (!choice) return;
    const current = roomRef.current;
    if (current?.status === 'open') current.publish({ choice });
  }, [choice]);

  const inRoom = room?.status === 'open';
  const roomResult = room?.combined ?? null;
  const soloResult = useMemo(() => tally(choice ? [{ choice }] : []), [choice]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
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
            placeholder={DEFAULT_QUESTION}
            style={{ width: '100%', padding: '12px 14px', fontSize: 18, fontWeight: 700, borderRadius: 12,
              border: `1.5px solid ${t.line}`, background: t.chrome, color: t.ink,
              fontFamily: 'var(--placer-font)', outline: 'none' }}
          />
          <p style={{ fontSize: 12.5, color: t.inkFaint, marginTop: 8, lineHeight: 1.5 }}>
            Shown on this screen only — read it aloud, or put it on a slide. What gets
            counted is the vote below, not the wording.
          </p>
        </Panel>

        <Panel t={t} title="Cast your vote">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {OPTIONS.map((option) => {
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
              <VoteMeters t={t} result={roomResult} />
            ) : (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
                Nobody has voted yet. Yours will show up here as soon as you pick one.
              </p>
            )}
          </Panel>
        ) : (
          <Panel t={t} title="Result">
            {choice ? (
              <VoteMeters t={t} result={soloResult} />
            ) : (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
                Pick Yes, No, or Undecided to see it here.
              </p>
            )}
          </Panel>
        )}

        <Panel t={t} title="How it works">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            Open a room and share its PIN or QR code, and everybody who joins votes on
            whatever you asked — the tally above updates live as each person picks.
            Opened from a project, a room can stay open for up to 90 days, so its QR code
            can go on a poster. Closing the room, or its time running out, lets go of
            every vote in it.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default OpenVote;
