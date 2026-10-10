/* PLACER — a Co-Budget on a project's page.
 *
 * The ballot an organiser opened for the project, set into its public page as a card
 * that opens out on a tap rather than behind a link. Open, it is the ballot itself:
 * the money at the top — what is committed, of what budget — and the posts below it
 * with − and +, and a form for posts of one's own when the setup allows them. Next
 * shows the ballot as it would be sent, and Submit sends it.
 *
 * The room is the project's (services/rooms' readProjectOpenRooms), and the ballot is
 * saved against it with this browser's participant token, so submitting again from the
 * same browser would replace the first rather than add a second. A ballot is submitted
 * once: after that the card offers no way back to the posts, and it opens on the
 * room's results. What was submitted is remembered in this browser (toolkit/rooms'
 * rememberAnswer), so coming back shows the results too, already open, with this
 * person's own ballot kept to the list of individual ones.
 *
 * Once a ballot is in, the card shows the room's — kept live while the page is open, as
 * the Poll shows its tally: the average of every ballot submitted, which still fits the
 * budget (combineBallots), the posts people added of their own, and every ballot on its
 * own, numbered in the order they came in, each opening out to what it bought.
 *
 * The service arrives as a prop, as in OpenVoteOnPage, so a test can hand this a fake.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { Meter } from '../ToolLayout';
import { Btn } from '../UI';
import {
  ballotOf, combineBallots, formatMoney, ownPostProposals, readBallot, tally,
} from '../../lib/budgetBallot';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import * as roomService from '../../services/rooms';
import { MoneySummary, PostList, ballotState, useBallot } from './BudgetBallotParts';

/** A ballot as a list: each post bought, how many, and what it costs. */
function BallotLines({ t, items, money, theirs = false }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <li key={item.key ?? item.label} style={{ display: 'flex', gap: 12, fontSize: 15, paddingBottom: 8,
          borderBottom: `1px solid ${t.line}` }}>
          <span style={{ flex: 1, minWidth: 0, color: t.ink, fontWeight: 500 }}>
            {item.label} × {item.quantity}
            {item.own && (
              <span style={{ color: t.inkDim, fontWeight: 400 }}>{theirs ? ' · their own post' : ' · your post'}</span>
            )}
          </span>
          <span className="placer-mono" style={{ color: t.inkDim }}>{money(item.cost)}</span>
        </li>
      ))}
    </ul>
  );
}

/** One submitted ballot, closed to its number and total until it is opened. */
function IndividualBallot({ t, title, ballot, money, yours = false }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li style={{ borderBottom: `1px solid ${t.line}` }}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((was) => !was)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', background: 'none',
          border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--placer-font)', color: t.ink }}>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: yours ? 700 : 600 }}>{title}</span>
        <span className="placer-mono" style={{ fontSize: 13, color: t.inkDim }}>{money(ballot.spent)}</span>
        <Icon name={open ? 'chevUp' : 'chevDown'} size={16} stroke={2.2} style={{ color: t.inkDim }} />
      </button>
      {open && (
        <div id={panelId} style={{ padding: '0 0 12px 12px' }}>
          {ballot.items.length === 0
            ? <p style={{ fontSize: 13.5, color: t.inkDim }}>Nothing bought.</p>
            : <BallotLines t={t} items={ballot.items} money={money} theirs={!yours} />}
        </div>
      )}
    </li>
  );
}

/** The room's ballots once this browser has submitted one: their average, then each on its own. */
// The same ballot, whatever order its keys came back from the database in.
const sameState = (a, b) => {
  const canonical = (value) => JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)))
    : v));
  return canonical(a) === canonical(b);
};

function RoomBallots({ t, tool, room, service, submitted }) {
  const [contributions, setContributions] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const config = room.config;
  const ballot = useMemo(() => ballotOf(config), [config]);
  const money = (amount) => formatMoney(amount, ballot.currency);

  // Every ballot, kept live while the page is open.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => service.readContributions(room.id)
      .then((rows) => { if (!cancelled) setContributions(rows); })
      .catch((err) => console.error('Could not read the ballots:', err));
    refresh();
    const unsubscribe = service.subscribeToRoom(room.id, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [room.id, service]);

  if (!contributions) return <p style={{ fontSize: 14, color: t.inkDim }}>Loading everybody's ballots…</p>;

  const ordered = [...contributions].sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')));
  const states = ordered.map((entry) => entry.state);
  const average = tally(combineBallots(states, config), ballot);
  const proposals = config?.ownPosts ? ownPostProposals(states) : [];
  const count = states.length;
  // This browser's own ballot heads the list as "Your ballot", and is left out of the
  // numbered ones: the room's ballots carry no names, so it is found by being exactly
  // what was sent.
  const yours = submitted?.state ? states.findIndex((state) => sameState(state, submitted.state)) : -1;
  const others = states.filter((_, index) => index !== yours);

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: t.ink, margin: '0 0 4px' }}>Everybody's average</h3>
      <p style={{ fontSize: 14, color: t.inkDim, marginBottom: 16 }}>
        {count} {count === 1 ? 'ballot' : 'ballots'} so far. The average spends {money(average.spent)} of
        {' '}{money(ballot.budget)} — still within the budget, since every ballot is.
      </p>
      {average.items.length === 0 ? (
        <p style={{ fontSize: 14, color: t.inkDim }}>Nothing is bought on average yet.</p>
      ) : average.items.map((item) => (
        <Meter key={item.key} t={t} label={`${item.label} × ${item.quantity}`} value={item.cost / ballot.budget}
          color={tool.color} caption={`${money(item.cost)} · ${Math.round((item.cost / ballot.budget) * 100)}%`} />
      ))}

      {proposals.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: t.ink, margin: '0 0 6px' }}>Posts people added</h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {proposals.map((proposal) => (
              <li key={proposal.label.toLowerCase()} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                <span style={{ flex: 1, minWidth: 0, color: t.ink }}>
                  {proposal.label}
                  <span style={{ color: t.inkDim }}> · {proposal.people} {proposal.people === 1 ? 'person' : 'people'}</span>
                </span>
                <span className="placer-mono" style={{ color: t.inkDim }}>{money(proposal.spent)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Btn t={t} type="button" variant="outline" size="sm" icon={showAll ? 'chevUp' : 'chevDown'}
          ariaPressed={showAll} onClick={() => setShowAll((was) => !was)}>
          {showAll ? 'Hide individual ballots' : `See individual ballots (${count})`}
        </Btn>
        {showAll && (
          <ul id={listId} aria-label="Individual ballots"
            style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, borderTop: `1px solid ${t.line}` }}>
            {submitted && (
              <IndividualBallot t={t} title="Your ballot" yours
                ballot={{ items: submitted.items, spent: submitted.spent }} money={money} />
            )}
            {others.map((state, index) => (
              <IndividualBallot key={index} t={t} title={`Ballot ${index + 1}`}
                ballot={readBallot(state, config)} money={money} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function BudgetBallotOnPage({ t, tool, room, service = roomService }) {
  const panelId = useId();
  const state = useBallot(room.config);
  const { result, money, mine } = state;
  const [submitted, setSubmitted] = useState(() => rememberedAnswer(room.id)?.ballot ?? null);
  // Closed until somebody opens it to take part; open on the results once they have.
  const [open, setOpen] = useState(() => Boolean(submitted));
  // 'spend' | 'review' | 'done', and whether the send is under way or failed.
  const [stage, setStage] = useState(() => (submitted ? 'done' : 'spend'));
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'closed' | 'error'

  const ownKeys = new Set(mine.posts.filter((post) => post.own).map((post) => post.key));
  const lines = result.items.map((item) => ({ ...item, own: ownKeys.has(item.key) }));

  const submit = async () => {
    setStatus('sending');
    const sent = ballotState(state);
    try {
      const saved = await service.saveContribution({
        roomId: room.id, participantToken: participantToken(), displayName: null, state: sent,
      });
      if (!saved) {
        setStatus('closed');
        return;
      }
      const record = { items: lines, spent: result.spent, budget: result.budget, currency: result.currency, state: sent };
      rememberAnswer(room.id, { ballot: record });
      setSubmitted(record);
      setStage('done');
      setStatus('idle');
    } catch (err) {
      console.error('Could not send the ballot:', err);
      setStatus('error');
    }
  };

  const closes = formatRoomDate(room.expiresAt);

  return (
    <div className="placer-card" style={{ padding: 0, overflow: 'hidden' }}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((was) => !was)}
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center',
          padding: 16, background: 'none', border: 'none', fontFamily: 'var(--placer-font)', color: t.ink }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, flex: '0 0 auto', background: tool.tint,
          boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={tool.icon} size={20} stroke={2} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 16, lineHeight: '24px', fontWeight: 700 }}>{tool.name}</span>
          <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: t.inkDim, marginTop: 2 }}>
            {submitted
              ? 'Your ballot is in.'
              : `Spend ${formatMoney(result.budget, result.currency)} the way you would.`}
          </span>
        </span>
        <Icon name={open ? 'chevUp' : 'chevDown'} size={18} stroke={2.2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
      </button>

      {open && (
        <div id={panelId} style={{ padding: '4px 20px 20px', borderTop: `1px solid ${t.line}` }}>
          {status === 'closed' ? (
            <p role="status" style={{ fontSize: 15, color: t.inkDim, marginTop: 16 }}>This ballot has closed.</p>
          ) : stage === 'done' && submitted ? (
            <div style={{ marginTop: 16 }}>
              <p role="status" aria-live="polite" style={{ fontSize: 15, fontWeight: 600, color: t.ink, marginBottom: 16 }}>
                Thank you — your ballot is in.
              </p>
              <RoomBallots t={t} tool={tool} room={room} service={service} submitted={submitted} />
            </div>
          ) : stage === 'review' ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.ink, margin: '0 0 4px' }}>Your ballot</h3>
              <p style={{ fontSize: 14, color: t.inkDim, marginBottom: 16 }}>
                {money(result.spent)} of {money(result.budget)}, {money(result.remaining)} left unspent.
                Check it over, then submit it.
              </p>
              <BallotLines t={t} items={lines} money={money} />
              {status === 'error' && (
                <p role="alert" style={{ fontSize: 14, color: t.ink, marginTop: 12 }}>
                  Your ballot did not go through. Please try again.
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
                <Btn t={t} type="button" variant="outline" size="sm" icon="chevLeft" disabled={status === 'sending'}
                  onClick={() => setStage('spend')}>
                  Back
                </Btn>
                <Btn t={t} type="button" variant="primary" size="sm" icon="send" disabled={status === 'sending'}
                  onClick={submit}>
                  {status === 'sending' ? 'Submitting…' : 'Submit'}
                </Btn>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <MoneySummary t={t} tool={tool} state={state} />
              <div style={{ marginTop: 16 }}>
                <PostList t={t} tool={tool} state={state} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                {result.items.length === 0 && (
                  <span style={{ fontSize: 13, color: t.inkDim }}>Press + on a post to start.</span>
                )}
                <Btn t={t} type="button" variant="primary" size="sm" icon="arrowRight"
                  disabled={result.items.length === 0} onClick={() => setStage('review')}>
                  Next
                </Btn>
              </div>
            </div>
          )}

          {closes && status !== 'closed' && (
            <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 16 }}>
              Open until {closes}. One ballot per person.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BudgetBallotOnPage;
