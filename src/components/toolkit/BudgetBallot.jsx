/* PLACER — Toolkit: Co-Budget.
 *
 * A budget, and posts to spend it on at a price per item. The money runs out long
 * before the list does, so the − and + buttons are a set of choices rather than a wishlist.
 * On the Toolkit's own page it is a made-up street: €250,000 and nine things a
 * neighbourhood might ask for.
 *
 * Costs and the tally are in src/lib/budgetBallot.js.
 *
 * In a room (the optional `room` prop, from ToolkitPage) the buttons are still only
 * this person's own ballot. What changes is that it is published to everybody else,
 * and that a second panel appears showing what the room as a whole would fund — the
 * average of every ballot cast, which is itself a ballot that fits the budget.
 *
 * A room can also have been set up by its organiser (`room.config`, see `setup` in
 * toolkit/tools.js): its own budget, and its own posts. Then the ballot is theirs, and
 * the council's draft — a draft for the Toolkit's made-up street, not this one — is
 * left out of it. An organiser can also let people add posts of their own (`ownPosts`):
 * each person's join their own ballot, spent from the same budget, and the room shows
 * everybody's apart from its averaged ballot, as proposals.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PresetRow, Readout } from '../ToolLayout';
import { CopyButton } from '../UI';
import { COUNCIL_DRAFT, emptyBallot, ownPostProposals, summaryText, tally } from '../../lib/budgetBallot';
import { MoneySummary, PostList, ballotState, useBallot } from './BudgetBallotParts';

const PRESETS = [
  { key: 'empty', label: 'Start from nothing', note: 'Every line at zero.' },
  { key: 'draft', label: "The council's draft", note: 'Footway, crossings and lighting — three quarters of the money already committed.' },
];

export function BudgetBallot({ t, tool, room }) {
  const config = room?.config ?? null;
  const state = useBallot(config);
  const { ballot, ownAllowed, quantities, own, result, money } = state;
  const { budget } = ballot;

  const [preset, setPreset] = useState('empty');
  // Until somebody has actually allocated something there is nothing worth sending:
  // a room full of all-zero ballots would count people who have not chosen yet and
  // drag the average down with them.
  const [touched, setTouched] = useState(false);

  // A setup arrives once the room has loaded, after the posts are already on screen.
  // Whatever was chosen before then was chosen against the wrong budget, so the
  // ballot starts again rather than being sent half-fitting.
  const resetRef = useRef(state.reset);
  resetRef.current = state.reset;
  useEffect(() => {
    if (!config) return;
    resetRef.current();
    setPreset('empty');
    setTouched(false);
  }, [config]);

  // Held in a ref rather than an effect dependency: the room object is rebuilt on
  // every render, so depending on it would republish on every incoming change and
  // the two would chase each other round for ever.
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (!touched) return;
    const current = roomRef.current;
    if (current?.status !== 'open') return;
    current.publish(ballotState({ ballot, own, ownAllowed, quantities }));
  }, [quantities, own, ownAllowed, ballot, touched]);

  const inRoom = room?.status === 'open';
  const roomResult = useMemo(
    () => (room?.combined ? tally(room.combined, ballot) : null),
    [room?.combined, ballot]
  );
  const proposals = useMemo(
    () => (inRoom && ownAllowed ? ownPostProposals((room.contributions ?? []).map((entry) => entry.state)) : []),
    [inRoom, ownAllowed, room?.contributions]
  );

  function pickPreset(key) {
    state.setQuantities(key === 'draft' ? COUNCIL_DRAFT : emptyBallot(ballot));
    setPreset(key);
    setTouched(true);
  }

  const summary = summaryText(result);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title="The money" aside={
          <span className="placer-mono" style={{ fontSize: 12, color: result.remaining === 0 ? tool.color : t.inkDim }}>
            {money(result.remaining)} left
          </span>
        }>
          <MoneySummary t={t} tool={tool} state={state} />
          {!config && (
            <PresetRow t={t} presets={PRESETS} active={preset} onPick={pickPreset} color={tool.color} />
          )}
        </Panel>

        <Panel t={t} title={config ? 'What the budget can go on' : 'What the street could have'}>
          <PostList t={t} tool={tool} state={state} onChange={() => { setPreset(null); setTouched(true); }} />
        </Panel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {inRoom && (
          <Panel t={t} title="The room's ballot" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
              {room.participantCount} cast
            </span>
          }>
            {roomResult ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
                  <Readout t={t} label="The room commits" value={money(roomResult.spent)}
                    tone={tool.color} />
                  <Readout t={t} label="You commit" value={money(result.spent)} />
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {roomResult.items.map((item) => (
                    <li key={item.key} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                      <span style={{ color: t.ink, fontWeight: 500, flex: 1, minWidth: 0 }}>
                        {item.label} × {item.quantity}
                      </span>
                      <span className="placer-mono" style={{ color: t.inkDim }}>
                        you {result.quantities[item.key]}
                      </span>
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.6, marginTop: 12 }}>
                  The average of every ballot in the room, which is why it still fits inside
                  {' '}{money(budget)}. Where it differs from yours is the argument worth having.
                </p>
                {proposals.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, marginBottom: 6 }}>
                      Posts people added
                    </div>
                    <ul aria-label="Posts people added"
                      style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {proposals.map((proposal) => (
                        <li key={proposal.label.toLowerCase()} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                          <span style={{ color: t.ink, fontWeight: 500, flex: 1, minWidth: 0 }}>
                            {proposal.label}
                            <span style={{ color: t.inkDim, fontWeight: 400 }}>
                              {' '}· {proposal.people} {proposal.people === 1 ? 'person' : 'people'}
                            </span>
                          </span>
                          <span className="placer-mono" style={{ color: t.inkDim }}>{money(proposal.spent)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
                Nobody has cast a ballot yet. Yours will show up here as soon as you add something.
              </p>
            )}
          </Panel>
        )}

        <Panel t={t} title="Your ballot">
          {result.items.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
              {config
                ? 'Nothing chosen yet. Press + on a post to start spending.'
                : "Nothing chosen yet. Press + on a post, or start from the council's draft and argue with it."}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {result.items.map((item) => (
                <li key={item.key} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                  <span style={{ color: t.ink, fontWeight: 500, flex: 1, minWidth: 0 }}>
                    {item.label} × {item.quantity}
                  </span>
                  <span className="placer-mono" style={{ color: t.inkDim }}>{money(item.cost)}</span>
                </li>
              ))}
            </ul>
          )}

          <CopyButton
            t={t}
            value={summary}
            variant="primary"
            size="sm"
            icon="send"
            label="Copy my ballot"
            copiedLabel="Copied"
            fieldLabel="Your ballot as text"
            multiline
            disabled={result.items.length === 0}
            style={{ alignItems: 'flex-start' }}
          />
        </Panel>
      </div>
    </div>
  );
}

export default BudgetBallot;
