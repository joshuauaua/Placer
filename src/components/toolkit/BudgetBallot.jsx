/* PLACER — Toolkit: Budget Ballot.
 *
 * One street, €250,000, and nine things a neighbourhood might ask for. The money runs
 * out long before the street is full, so the sliders are a set of choices rather than a
 * wishlist — and the "who gains" panel keeps score of who each choice is for.
 *
 * Costs, effects and the tally are in src/lib/budgetBallot.js.
 *
 * In a room (the optional `room` prop, from ToolkitPage) the sliders are still only
 * this person's own ballot. What changes is that it is published to everybody else,
 * and that a second panel appears showing what the room as a whole would fund — the
 * average of every ballot cast, which is itself a ballot that fits the budget.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Meter, Panel, PresetRow, Readout } from '../ToolLayout';
import { CopyButton } from '../UI';
import {
  BUDGET,
  COUNCIL_DRAFT,
  GROUP_LIST,
  INTERVENTION_LIST,
  OUTCOME_LIST,
  affordableQuantity,
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
  const [quantities, setQuantities] = useState(() => emptyBallot());
  const [preset, setPreset] = useState('empty');
  // Until somebody has actually allocated something there is nothing worth sending:
  // a room full of all-zero ballots would count people who have not chosen yet and
  // drag the average down with them.
  const [touched, setTouched] = useState(false);

  const result = useMemo(() => tally(quantities), [quantities]);
  const draft = useMemo(() => tally(COUNCIL_DRAFT), []);
  const spentShare = result.spent / BUDGET;

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
    () => (room?.combined ? tally(room.combined) : null),
    [room?.combined]
  );

  function setQuantity(key, quantity) {
    setPreset(null);
    setTouched(true);
    setQuantities((current) => normalise({ ...current, [key]: quantity }));
  }

  function pickPreset(key) {
    setQuantities(key === 'draft' ? normalise(COUNCIL_DRAFT) : emptyBallot());
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
            <Readout t={t} label="Of a budget of" value={formatEuros(BUDGET)} />
          </div>
          <Meter t={t} label="Budget used" value={spentShare} color={tool.color}
            caption={`${Math.round(spentShare * 100)}%`} />
          <PresetRow t={t} presets={PRESETS} active={preset} onPick={pickPreset} color={tool.color} />
        </Panel>

        <Panel t={t} title="What the street could have">
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {INTERVENTION_LIST.map((item) => {
              const quantity = result.quantities[item.key];
              // The slider stops where the money does, so it cannot overspend — and the
              // row says which of the two limits it has run into.
              const affordable = affordableQuantity(quantities, item.key);
              const ceiling = Math.max(quantity, affordable);
              const atBudget = ceiling < item.max;

              return (
                <li key={item.key} style={{ padding: '12px 0', borderBottom: `1px solid ${t.line}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                    <span style={{ color: quantity > 0 ? tool.color : t.inkFaint, display: 'flex' }}>
                      <Icon name={item.icon} size={17} stroke={2.1} />
                    </span>
                    <label htmlFor={`ballot-${item.key}`} style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>
                      {item.label}
                    </label>
                    <div style={{ flex: 1 }} />
                    <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
                      {formatEuros(item.unitCost)} / {item.unit}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      id={`ballot-${item.key}`}
                      type="range"
                      min={0}
                      max={ceiling}
                      step={1}
                      value={quantity}
                      onChange={(event) => setQuantity(item.key, Number(event.target.value))}
                      style={{ flex: 1, accentColor: tool.color }}
                    />
                    <span className="placer-mono" style={{ fontSize: 13, fontWeight: 700, color: t.ink, minWidth: 74, textAlign: 'right' }}>
                      {quantity} {pluralise(item.unit, quantity)}
                    </span>
                    <span className="placer-mono" style={{ fontSize: 13, color: t.inkDim, minWidth: 74, textAlign: 'right' }}>
                      {formatEuros(item.unitCost * quantity)}
                    </span>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>
                    {item.note}
                    {atBudget && (
                      <span style={{ color: tool.color, fontWeight: 700 }}>
                        {' '}The budget stops at {ceiling}, not the street.
                      </span>
                    )}
                  </div>
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
                {OUTCOME_LIST.map((outcome) => (
                  <Meter
                    key={outcome.key}
                    t={t}
                    label={outcome.label}
                    value={roomResult.outcomes[outcome.key] / 100}
                    color={outcome.color}
                    caption={`${roomResult.outcomes[outcome.key]} · you ${result.outcomes[outcome.key]}`}
                  />
                ))}
                <p style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.6, marginTop: 12 }}>
                  The average of every ballot in the room, which is why it still fits inside
                  &euro;250,000. Where it differs from yours is the argument worth having.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
                Nobody has cast a ballot yet. Yours will show up here as soon as you move a slider.
              </p>
            )}
          </Panel>
        )}

        <Panel t={t} title="What it achieves" aside={
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>vs the draft</span>
        }>
          {OUTCOME_LIST.map((outcome) => (
            <Meter
              key={outcome.key}
              t={t}
              label={outcome.label}
              value={result.outcomes[outcome.key] / 100}
              color={outcome.color}
              caption={`${result.outcomes[outcome.key]} · draft ${draft.outcomes[outcome.key]}`}
            />
          ))}
        </Panel>

        <Panel t={t} title="Who gains">
          {GROUP_LIST.map((group) => {
            const score = result.groups[group.key];
            return (
              <Meter
                key={group.key}
                t={t}
                signed
                label={group.label}
                value={score / 100}
                color={score < 0 ? '#B3261E' : '#1E7B3A'}
                caption={score === 0 ? '—' : `${score > 0 ? '+' : ''}${score}`}
              />
            );
          })}
          <p style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.6, marginTop: 12 }}>
            Turning parking into parklets is the sharpest split in the list: measured trade goes up,
            and the shopkeepers who asked for the parking are still worse off by their own reckoning.
            A scheme that scores well everywhere usually has not chosen anything.
          </p>
        </Panel>

        <Panel t={t} title="Your ballot">
          {result.items.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65 }}>
              Nothing chosen yet. Move a slider, or start from the council's draft and argue with it.
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
