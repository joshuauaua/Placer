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
import { COUNCIL_DRAFT, emptyBallot, ownPostProposals, postLabel, summaryText, tally } from '../../lib/budgetBallot';
import { MoneySummary, PostList, ballotState, useBallot } from './BudgetBallotParts';
import { useText } from '../../i18n';

const PRESETS = ['empty', 'draft'];

export function BudgetBallot({ t, tool, room }) {
  const { text } = useText();
  const presets = PRESETS.map((key) => ({
    key, label: text(`budgetBallot.presets.${key}.label`), note: text(`budgetBallot.presets.${key}.note`),
  }));
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
        <Panel t={t} title={text('budgetBallot.theMoney')} aside={
          <span className="placer-mono" style={{ fontSize: 12, color: result.remaining === 0 ? tool.color : t.inkDim }}>
            {text('budgetBallot.left', { amount: money(result.remaining) })}
          </span>
        }>
          <MoneySummary t={t} tool={tool} state={state} />
          {!config && (
            <PresetRow t={t} presets={presets} label={text('common.presets')} active={preset} onPick={pickPreset} color={tool.color} />
          )}
        </Panel>

        <Panel t={t} title={text(config ? 'budgetBallot.whatBudgetCanGoOn' : 'budgetBallot.whatStreetCouldHave')}>
          <PostList t={t} tool={tool} state={state} onChange={() => { setPreset(null); setTouched(true); }} />
        </Panel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {inRoom && (
          <Panel t={t} title={text('budgetBallot.roomsBallot')} aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
              {text('openVote.cast', { count: room.participantCount })}
            </span>
          }>
            {roomResult ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
                  <Readout t={t} label={text('budgetBallot.roomCommits')} value={money(roomResult.spent)}
                    tone={tool.color} />
                  <Readout t={t} label={text('budgetBallot.youCommit')} value={money(result.spent)} />
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {roomResult.items.map((item) => (
                    <li key={item.key} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                      <span style={{ color: t.ink, fontWeight: 500, flex: 1, minWidth: 0 }}>
                        {postLabel(item)} × {item.quantity}
                      </span>
                      <span className="placer-mono" style={{ color: t.inkDim }}>
                        {text('budgetBallot.you', { count: result.quantities[item.key] })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.6, marginTop: 12 }}>
                  {text('budgetBallot.averageHint', { budget: money(budget) })}
                </p>
                {proposals.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, marginBottom: 6 }}>
                      {text('budgetBallot.postsPeopleAdded')}
                    </div>
                    <ul aria-label={text('budgetBallot.postsPeopleAdded')}
                      style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {proposals.map((proposal) => (
                        <li key={proposal.label.toLowerCase()} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                          <span style={{ color: t.ink, fontWeight: 500, flex: 1, minWidth: 0 }}>
                            {proposal.label}
                            <span style={{ color: t.inkDim, fontWeight: 400 }}>
                              {' '}· {text('common.people', { count: proposal.people })}
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
                {text('budgetBallot.emptyRoom')}
              </p>
            )}
          </Panel>
        )}

        <Panel t={t} title={text('budgetBallot.yourBallot')}>
          {result.items.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
              {text(config ? 'budgetBallot.emptyBallotSetUp' : 'budgetBallot.emptyBallot')}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {result.items.map((item) => (
                <li key={item.key} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                  <span style={{ color: t.ink, fontWeight: 500, flex: 1, minWidth: 0 }}>
                    {postLabel(item)} × {item.quantity}
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
            label={text('budgetBallot.copyBallot')}
            copiedLabel={text('common.copied')}
            fieldLabel={text('budgetBallot.ballotAsText')}
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
