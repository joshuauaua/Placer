/* PLACER — Toolkit: setting up a Budget Ballot room.
 *
 * What the organiser fills in before the room opens: how much money there is, and
 * which of the catalogue is on the ballot. Shown by ToolkitPage's RoomSetup, which
 * owns the setup, checks it with the registry entry's `setup.problems` and opens
 * the room with it — this only edits it.
 */

import { useId } from 'react';
import { Icon } from '../Icon';
import { BUDGET, INTERVENTION_LIST, formatEuros } from '../../lib/budgetBallot';

export function BudgetBallotSetup({ t, tool, setup, onChange }) {
  const id = useId();
  const toggle = (key) => {
    const items = setup.items.includes(key)
      ? setup.items.filter((item) => item !== key)
      // Kept in catalogue order, whatever order they were ticked in.
      : INTERVENTION_LIST.map((item) => item.key).filter((item) => item === key || setup.items.includes(item));
    onChange({ ...setup, items });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 280 }}>
        <label htmlFor={`${id}-budget`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Budget, in euros</label>
        <input
          id={`${id}-budget`}
          aria-describedby={`${id}-budget-hint`}
          type="number"
          inputMode="numeric"
          min={1}
          step={1000}
          value={Number.isFinite(setup.budget) ? setup.budget : ''}
          onChange={(event) => {
            const value = event.target.value === '' ? NaN : Number(event.target.value);
            onChange({ ...setup, budget: value });
          }}
          style={{ height: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
            background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15 }} />
        <span id={`${id}-budget-hint`} style={{ fontSize: 12.5, color: t.inkDim }}>
          The Toolkit's own street has {formatEuros(BUDGET)}.
        </span>
      </div>

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>On the ballot</legend>
        <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {INTERVENTION_LIST.map((item) => {
            const on = setup.items.includes(item.key);
            return (
              <li key={item.key}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 12, border: `1px solid ${on ? tool.color : t.line}`,
                  background: on ? tool.wash : t.surface, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(item.key)}
                    style={{ accentColor: tool.color }} />
                  <Icon name={item.icon} size={17} stroke={2.1} style={{ color: on ? tool.color : t.inkFaint }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: t.ink }}>{item.label}</span>
                  <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
                    {formatEuros(item.unitCost)}/{item.unit}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}

export default BudgetBallotSetup;
