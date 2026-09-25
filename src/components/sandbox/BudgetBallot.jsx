/* PLACER — Sandbox: Budget Ballot.
 *
 * One street, €250,000, and nine things a neighbourhood might ask for. The money runs
 * out long before the street is full, so the sliders are a set of choices rather than a
 * wishlist — and the "who gains" panel keeps score of who each choice is for.
 *
 * Costs, effects and the tally are in src/lib/budgetBallot.js.
 */

import { useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { Meter, Panel, PresetRow, Readout } from '../SandboxLayout';
import { copyText } from '../../lib/clipboard';
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

export function BudgetBallot({ t, experiment }) {
  const [quantities, setQuantities] = useState(() => emptyBallot());
  const [preset, setPreset] = useState('empty');
  const [copied, setCopied] = useState(null);

  const result = useMemo(() => tally(quantities), [quantities]);
  const draft = useMemo(() => tally(COUNCIL_DRAFT), []);
  const spentShare = result.spent / BUDGET;

  function setQuantity(key, quantity) {
    setPreset(null);
    setCopied(null);
    setQuantities((current) => normalise({ ...current, [key]: quantity }));
  }

  function pickPreset(key) {
    setQuantities(key === 'draft' ? normalise(COUNCIL_DRAFT) : emptyBallot());
    setPreset(key);
    setCopied(null);
  }

  const summary = summaryText(result);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title="The money" aside={
          <span className="placer-mono" style={{ fontSize: 12, color: result.remaining === 0 ? experiment.color : t.inkDim }}>
            {formatEuros(result.remaining)} left
          </span>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
            <Readout t={t} label="Committed" value={formatEuros(result.spent)}
              tone={result.remaining === 0 ? experiment.color : undefined} />
            <Readout t={t} label="Of a budget of" value={formatEuros(BUDGET)} />
          </div>
          <Meter t={t} label="Budget used" value={spentShare} color={experiment.color}
            caption={`${Math.round(spentShare * 100)}%`} />
          <PresetRow t={t} presets={PRESETS} active={preset} onPick={pickPreset} color={experiment.color} />
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
                    <span style={{ color: quantity > 0 ? experiment.color : t.inkFaint, display: 'flex' }}>
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
                      style={{ flex: 1, accentColor: experiment.color }}
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
                      <span style={{ color: experiment.color, fontWeight: 700 }}>
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

          <button
            onClick={async () => setCopied(await copyText(summary))}
            disabled={result.items.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px',
              borderRadius: 12, border: 'none', background: t.primaryBg, color: t.primaryFg, cursor: 'pointer',
              fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: 14,
              opacity: result.items.length === 0 ? 0.45 : 1 }}>
            <Icon name={copied ? 'check' : 'send'} size={16} stroke={2.2} />
            {copied ? 'Copied' : 'Copy my ballot'}
          </button>

          {copied === false && (
            <textarea
              readOnly
              value={summary}
              aria-label="Your ballot as text"
              rows={8}
              style={{ width: '100%', marginTop: 12, padding: 10, borderRadius: 12, border: `1.5px solid ${t.line}`,
                background: t.chrome, color: t.inkDim, fontFamily: 'var(--placer-font)', fontSize: 11.5, resize: 'vertical' }}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

export default BudgetBallot;
