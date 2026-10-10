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
 * left out of it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Meter, Panel, PresetRow, Readout } from '../ToolLayout';
import { Btn, CopyButton } from '../UI';
import {
  COUNCIL_DRAFT,
  affordableQuantity,
  ballotOf,
  emptyBallot,
  formatEuros,
  normalise,
  pluralise,
  summaryText,
  tally,
} from '../../lib/budgetBallot';

const PRESETS = [
  { key: 'empty', label: 'Start from nothing', note: 'Every line at zero.' },
  { key: 'draft', label: "The council's draft", note: 'Footway, crossings and lighting — three quarters of the money already committed.' },
];

export function BudgetBallot({ t, tool, room }) {
  const config = room?.config ?? null;
  const ballot = useMemo(() => ballotOf(config), [config]);
  const { budget, posts: offered } = ballot;

  const [quantities, setQuantities] = useState(() => emptyBallot(ballot));
  const [preset, setPreset] = useState('empty');
  // Until somebody has actually allocated something there is nothing worth sending:
  // a room full of all-zero ballots would count people who have not chosen yet and
  // drag the average down with them.
  const [touched, setTouched] = useState(false);

  // A setup arrives once the room has loaded, after the posts are already on screen.
  // Whatever was chosen before then was chosen against the wrong budget, so the
  // ballot starts again rather than being sent half-fitting.
  useEffect(() => {
    if (!config) return;
    setQuantities(emptyBallot(ballot));
    setPreset('empty');
    setTouched(false);
  }, [config, ballot]);

  const result = useMemo(() => tally(quantities, ballot), [quantities, ballot]);
  const spentShare = result.spent / budget;

  // Held in a ref rather than an effect dependency: the room object is rebuilt on
  // every render, so depending on it would republish on every incoming change and
  // the two would chase each other round for ever.
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (!touched) return;
    const current = roomRef.current;
    if (current?.status === 'open') current.publish(quantities);
  }, [quantities, touched]);

  const inRoom = room?.status === 'open';
  const roomResult = useMemo(
    () => (room?.combined ? tally(room.combined, ballot) : null),
    [room?.combined, ballot]
  );

  function setQuantity(key, quantity) {
    setPreset(null);
    setTouched(true);
    setQuantities((current) => normalise({ ...current, [key]: quantity }, ballot));
  }

  function pickPreset(key) {
    setQuantities(key === 'draft' ? normalise(COUNCIL_DRAFT, ballot) : emptyBallot(ballot));
    setPreset(key);
    setTouched(true);
  }

  const summary = summaryText(result);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title="The money" aside={
          <span className="placer-mono" style={{ fontSize: 12, color: result.remaining === 0 ? tool.color : t.inkDim }}>
            {formatEuros(result.remaining)} left
          </span>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
            <Readout t={t} label="Committed" value={formatEuros(result.spent)}
              tone={result.remaining === 0 ? tool.color : undefined} />
            <Readout t={t} label="Of a budget of" value={formatEuros(budget)} />
          </div>
          <Meter t={t} label="Budget used" value={spentShare} color={tool.color}
            caption={`${Math.round(spentShare * 100)}%`} />
          {!config && (
            <PresetRow t={t} presets={PRESETS} active={preset} onPick={pickPreset} color={tool.color} />
          )}
        </Panel>

        <Panel t={t} title={config ? 'What the budget can go on' : 'What the street could have'}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {offered.map((item) => {
              const quantity = result.quantities[item.key];
              // The + stops where the money does, so it cannot overspend — and the
              // row says which of the two limits it has run into.
              const affordable = affordableQuantity(quantities, item.key, ballot);
              const ceiling = Math.max(quantity, affordable);
              const atBudget = ceiling < item.max;

              return (
                <li key={item.key} style={{ padding: '12px 0', borderBottom: `1px solid ${t.line}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                    <span style={{ color: quantity > 0 ? tool.color : t.inkFaint, display: 'flex' }}>
                      <Icon name={item.icon} size={17} stroke={2.1} />
                    </span>
                    <span id={`ballot-${item.key}`} style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>
                      {item.label}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
                      {formatEuros(item.unitCost)} / {item.unit}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div role="group" aria-labelledby={`ballot-${item.key}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Btn t={t} type="button" variant="outline" size="sm" icon="minus"
                        ariaLabel={`One fewer: ${item.label}`} disabled={quantity <= 0}
                        onClick={() => setQuantity(item.key, quantity - 1)}
                        style={{ width: 40, padding: 0 }} />
                      <span aria-label={`${item.label}: how many`} className="placer-mono"
                        style={{ fontSize: 15, fontWeight: 700, color: t.ink, minWidth: 32, textAlign: 'center' }}>
                        {quantity}
                      </span>
                      <Btn t={t} type="button" variant="outline" size="sm" icon="plus"
                        ariaLabel={`One more: ${item.label}`} disabled={quantity >= ceiling}
                        onClick={() => setQuantity(item.key, quantity + 1)}
                        style={{ width: 40, padding: 0, color: quantity < ceiling ? tool.color : undefined }} />
                      <span style={{ fontSize: 13, color: t.inkDim }}>{pluralise(item.unit, quantity)}</span>
                    </div>
                    <span className="placer-mono" style={{ fontSize: 13, color: t.inkDim, minWidth: 74, textAlign: 'right' }}>
                      {formatEuros(item.unitCost * quantity)}
                    </span>
                  </div>

                  {(item.note || atBudget) && (
                    <div style={{ marginTop: 6, fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>
                      {item.note}
                      {atBudget && (
                        <span style={{ color: tool.color, fontWeight: 700 }}>
                          {item.note ? ' ' : ''}The budget stops at {ceiling}, not the street.
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
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
                  <Readout t={t} label="The room commits" value={formatEuros(roomResult.spent)}
                    tone={tool.color} />
                  <Readout t={t} label="You commit" value={formatEuros(result.spent)} />
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
                  {' '}{formatEuros(budget)}. Where it differs from yours is the argument worth having.
                </p>
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
                  <span className="placer-mono" style={{ color: t.inkDim }}>{formatEuros(item.cost)}</span>
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
