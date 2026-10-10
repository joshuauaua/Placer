/* PLACER — a Poll on a project's page.
 *
 * The poll an organiser opened for the project, set into its public page rather than
 * behind a link: their question, its answers as buttons straight under it, and once this
 * browser has voted, the tally in place of the buttons. The room is the project's
 * (services/rooms' readProjectOpenRooms); the vote is saved against it with this
 * browser's participant token, so voting again from the same browser would replace
 * the first vote rather than add one — which is why, once it has voted, it is only
 * shown the results. What it voted is remembered in this browser (toolkit/rooms'
 * rememberAnswer) so coming back shows the results too.
 *
 * The service arrives as a prop, as in useRoom, so a test can hand this a fake.
 */

import { useEffect, useMemo, useState } from 'react';
import { Meter } from '../ToolLayout';
import { Btn } from '../UI';
import { pollOptions, tally } from '../../lib/openVote';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import * as roomService from '../../services/rooms';

export function OpenVoteOnPage({ t, room, service = roomService }) {
  const options = useMemo(() => pollOptions(room.config?.answers), [room.config?.answers]);
  const [answer, setAnswer] = useState(() => rememberedAnswer(room.id));
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'closed' | 'error'
  const [result, setResult] = useState(null);

  // Once voted: the tally, kept live while the page is open.
  useEffect(() => {
    if (!answer) return undefined;
    let cancelled = false;
    const refresh = () => service.readContributions(room.id)
      .then((contributions) => {
        if (!cancelled) setResult(tally(contributions.map((entry) => entry.state), options));
      })
      .catch((err) => console.error('Could not read the poll:', err));
    refresh();
    const unsubscribe = service.subscribeToRoom(room.id, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [answer, options, room.id, service]);

  const vote = async (choice) => {
    setStatus('sending');
    try {
      const saved = await service.saveContribution({
        roomId: room.id, participantToken: participantToken(), displayName: null, state: { choice },
      });
      if (!saved) {
        setStatus('closed');
        return;
      }
      rememberAnswer(room.id, { choice });
      setAnswer({ choice });
      setStatus('idle');
    } catch (err) {
      console.error('Could not send the vote:', err);
      setStatus('error');
    }
  };

  const closes = formatRoomDate(room.expiresAt);
  const voted = options.find((option) => option.key === answer?.choice);

  return (
    <div className="placer-card" style={{ padding: 24 }}>
      <p style={{ fontSize: 22, lineHeight: 1.35, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em',
        marginBottom: 20 }}>
        {room.config?.question}
      </p>

      {status === 'closed' ? (
        <p role="status" style={{ fontSize: 15, color: t.inkDim }}>This poll has closed.</p>
      ) : answer ? (
        <div role="status" aria-live="polite">
          {result ? (
            <>
              {options.map((option) => (
                <Meter key={option.key} t={t} label={option.label} value={result.shares[option.key]}
                  color={option.color}
                  caption={`${result.counts[option.key]} · ${Math.round(result.shares[option.key] * 100)}%`} />
              ))}
              <p style={{ fontSize: 14, color: t.inkDim, marginTop: 12 }}>
                You voted <strong style={{ color: t.ink }}>{voted?.label ?? answer.choice}</strong>.
                {' '}{result.total} {result.total === 1 ? 'vote' : 'votes'} so far.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 15, color: t.inkDim }}>Loading the results…</p>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {options.map((option) => (
              <Btn key={option.key} t={t} variant="outline" disabled={status === 'sending'}
                onClick={() => vote(option.key)}
                style={{ flex: '1 1 120px', height: 56, fontSize: 17, border: `2px solid ${option.color}`,
                  color: option.color }}>
                {option.label}
              </Btn>
            ))}
          </div>
          {status === 'error' && (
            <p role="alert" style={{ fontSize: 14, color: t.ink, marginTop: 12 }}>
              Your vote did not go through. Please try again.
            </p>
          )}
        </>
      )}

      {closes && status !== 'closed' && (
        <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 16 }}>
          Open until {closes}. One vote per person.
        </p>
      )}
    </div>
  );
}

export default OpenVoteOnPage;
