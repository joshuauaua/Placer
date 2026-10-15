/* PLACER — Toolkit: the parts of a Co-Budget ballot, shared by the tool's own screen
 * (BudgetBallot) and its card on a project's page (BudgetBallotOnPage).
 *
 *   useBallot(config)  — one person's ballot against a room's setup: the posts, the
 *                        quantities chosen, their own posts when the setup allows them,
 *                        and what it all adds up to (src/lib/budgetBallot.js)
 *   MoneySummary       — what is committed, of what budget, and the share used
 *   PostList           — every post with − and +, and the form for adding one's own
 *   ballotState        — the ballot as a room is sent it
 */

import { useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Meter, Readout } from '../ToolLayout';
import { Btn } from '../UI';
import {
  MAX_OWN_POSTS,
  MAX_OWN_POST_LABEL,
  affordableQuantity,
  ballotOf,
  currencySymbol,
  emptyBallot,
  formatMoney,
  normalise,
  ownPostProblems,
  ownPostsState,
  pluralise,
  postLabel,
  postNote,
  tally,
  withOwnPosts,
} from '../../lib/budgetBallot';
import { useText } from '../../i18n';

export function useBallot(config) {
  const ballot = useMemo(() => ballotOf(config), [config]);
  const ownAllowed = Boolean(config?.ownPosts);
  // This person's own posts, when the organiser allows them: { key, label, unitCost }.
  const [own, setOwn] = useState([]);
  const nextOwnKey = useRef(1);
  // The ballot as this person has it — the organiser's posts, then their own.
  const mine = useMemo(() => withOwnPosts(ballot, own), [ballot, own]);
  const [quantities, setQuantities] = useState(() => emptyBallot(ballot));
  const result = useMemo(() => tally(quantities, mine), [quantities, mine]);

  return {
    ballot,
    mine,
    own,
    ownAllowed,
    quantities,
    result,
    money: (amount) => formatMoney(amount, mine.currency),
    setQuantities: (next) => setQuantities(normalise(next, mine)),
    setQuantity: (key, quantity) => setQuantities((current) => normalise({ ...current, [key]: quantity }, mine)),
    addOwn: (post) => {
      const key = `own-${nextOwnKey.current++}`;
      setOwn((current) => [...current, { key, ...post }]);
      setQuantities((current) => ({ ...current, [key]: 0 }));
    },
    removeOwn: (key) => {
      setOwn((current) => current.filter((post) => post.key !== key));
      setQuantities((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    reset: () => {
      setOwn([]);
      setQuantities(emptyBallot(ballot));
    },
  };
}

/**
 * The ballot as a room is sent it: the organiser's posts as quantities, the way the
 * room averages them, and this person's own beside them, which it does not.
 */
export function ballotState({ ballot, own, ownAllowed, quantities }) {
  const state = normalise(quantities, ballot);
  return ownAllowed ? { ...state, own: ownPostsState(own, quantities) } : state;
}

export function MoneySummary({ t, tool, state }) {
  const { text } = useText();
  const { result, money } = state;
  const spentShare = result.spent / result.budget;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
        <Readout t={t} label={text('budgetBallot.committed')} value={money(result.spent)}
          tone={result.remaining === 0 ? tool.color : undefined} />
        <Readout t={t} label={text('budgetBallot.ofABudgetOf')} value={money(result.budget)} />
      </div>
      <Meter t={t} label={text('budgetBallot.budgetUsed')} value={spentShare} color={tool.color}
        caption={`${Math.round(spentShare * 100)}% · ${text('budgetBallot.left', { amount: money(result.remaining) })}`} />
    </>
  );
}

/** Adding a post of one's own: its name and cost per item, checked on Add. */
function OwnPostForm({ t, ballot, own, onAdd }) {
  const { text } = useText();
  const id = useId();
  const [label, setLabel] = useState('');
  const [cost, setCost] = useState('');
  const [tried, setTried] = useState(false);
  const post = { label, unitCost: cost === '' ? NaN : Number(cost) };
  const problems = ownPostProblems(post, ballot, own);
  const field = { height: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
    background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14 };

  const add = (event) => {
    event.preventDefault();
    setTried(true);
    if (problems.length > 0) return;
    onAdd({ label: label.trim(), unitCost: post.unitCost });
    setLabel('');
    setCost('');
    setTried(false);
  };

  if (own.length >= MAX_OWN_POSTS) {
    return (
      <p style={{ fontSize: 13, color: t.inkDim }}>
        {text('budgetBallot.ownFull', { count: MAX_OWN_POSTS })}
      </p>
    );
  }

  return (
    <form onSubmit={add} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input id={`${id}-name`} aria-label={text('budgetBallot.ownName')} type="text" maxLength={MAX_OWN_POST_LABEL}
          value={label} onChange={(event) => setLabel(event.target.value)} placeholder={text('budgetBallot.ownNamePlaceholder')}
          style={{ ...field, flex: '1 1 180px', minWidth: 0 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.inkDim }}>
          {currencySymbol(ballot.currency)}
          <input aria-label={text('budgetBallot.ownCost')} type="number" inputMode="numeric" min={1}
            step={100} value={cost} onChange={(event) => setCost(event.target.value)}
            style={{ ...field, width: 110 }} />
          {text('budgetBallot.perItem')}
        </label>
        <Btn t={t} type="submit" variant="outline" size="sm" icon="plus">{text('common.add')}</Btn>
      </div>
      {tried && problems.length > 0 && (
        <ul role="alert" style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: '#B3261E' }}>
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}
    </form>
  );
}

/** Every post with − and +, and — when the setup allows it — the form for adding one's own. */
export function PostList({ t, tool, state, onChange }) {
  const { text } = useText();
  const { ballot, mine, own, ownAllowed, quantities, result, money } = state;
  const offered = mine.posts;
  const setQuantity = (key, quantity) => { state.setQuantity(key, quantity); onChange?.(); };
  const removeOwn = (key) => { state.removeOwn(key); onChange?.(); };

  return (
    <>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {offered.map((item) => {
          const quantity = result.quantities[item.key];
          // The + stops where the money does, so it cannot overspend — and the
          // row says which of the two limits it has run into.
          const affordable = affordableQuantity(quantities, item.key, mine);
          const ceiling = Math.max(quantity, affordable);
          const atBudget = ceiling < item.max;
          const label = postLabel(item);
          const note = postNote(item);

          return (
            <li key={item.key} style={{ padding: '12px 0', borderBottom: `1px solid ${t.line}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span style={{ color: quantity > 0 ? tool.color : t.inkFaint, display: 'flex' }}>
                  <Icon name={item.icon} size={17} stroke={2.1} />
                </span>
                <span id={`ballot-${item.key}`} style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>
                  {label}
                </span>
                <div style={{ flex: 1 }} />
                <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
                  {money(item.unitCost)} / {pluralise(item.unit, 1)}
                </span>
                {item.own && (
                  <Btn t={t} type="button" variant="quiet" size="sm" icon="close"
                    ariaLabel={text('budgetBallot.removeOwn', { label })} onClick={() => removeOwn(item.key)}
                    style={{ width: 32, height: 32, padding: 0 }} />
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div role="group" aria-labelledby={`ballot-${item.key}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Btn t={t} type="button" variant="outline" size="sm" icon="minus"
                    ariaLabel={text('budgetBallot.oneFewer', { label })} disabled={quantity <= 0}
                    onClick={() => setQuantity(item.key, quantity - 1)}
                    style={{ width: 40, padding: 0 }} />
                  <span aria-label={text('budgetBallot.howMany', { label })} className="placer-mono"
                    style={{ fontSize: 15, fontWeight: 700, color: t.ink, minWidth: 32, textAlign: 'center' }}>
                    {quantity}
                  </span>
                  <Btn t={t} type="button" variant="outline" size="sm" icon="plus"
                    ariaLabel={text('budgetBallot.oneMore', { label })} disabled={quantity >= ceiling}
                    onClick={() => setQuantity(item.key, quantity + 1)}
                    style={{ width: 40, padding: 0, color: quantity < ceiling ? tool.color : undefined }} />
                  <span style={{ fontSize: 13, color: t.inkDim }}>{pluralise(item.unit, quantity)}</span>
                </div>
                <span className="placer-mono" style={{ fontSize: 13, color: t.inkDim, minWidth: 74, textAlign: 'right' }}>
                  {money(item.unitCost * quantity)}
                </span>
              </div>

              {(note || atBudget) && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>
                  {note}
                  {atBudget && (
                    <span style={{ color: tool.color, fontWeight: 700 }}>
                      {note ? ' ' : ''}{text('budgetBallot.budgetStops', { count: ceiling })}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {ownAllowed && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>{text('budgetBallot.addOwn')}</div>
          <p style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.5, marginBottom: 10 }}>
            {text('budgetBallot.addOwnHint')}
          </p>
          <OwnPostForm t={t} ballot={ballot} own={own} onAdd={state.addOwn} />
        </div>
      )}
    </>
  );
}
