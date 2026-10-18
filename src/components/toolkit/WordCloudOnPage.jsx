/* PLACER — a Word Cloud on a project's page.
 *
 * The word cloud an organiser opened for the project, set into its public page rather
 * than behind a link: their prompt, a field to answer it in straight under it, and once
 * this browser has sent its words, the cloud in place of the field, with the answers
 * listed under it by how many times each was given. The room is the
 * project's (services/rooms' readProjectOpenRooms); the words are saved against it with
 * this browser's participant token, so sending again from the same browser would
 * replace the first words rather than add to them — which is why, once it has sent, it
 * is only shown the cloud. What it sent is remembered in this browser (toolkit/rooms'
 * rememberAnswer) so coming back shows the cloud too.
 *
 * Once the cloud is showing, a Full screen button puts it over the whole screen
 * (FullScreenCloud), still filling in as people answer.
 *
 * A room set up with a timer shows its countdown once the facilitator has started it,
 * and the cloud in place of the field once it has run out.
 *
 * The service arrives as a prop, as in OpenVoteOnPage, so a test can hand this a fake.
 */

import { useEffect, useState } from 'react';
import { Btn } from '../UI';
import { Cloud, Countdown, FullScreenCloud, WordCounts, WordEntry, useCountdown } from './WordCloud';
import { addWord, cloudTimer, countWords, isPaused, roomTimer, wordLimit } from '../../lib/wordCloud';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import * as roomService from '../../services/rooms';

export function WordCloudOnPage({ t, room, service = roomService }) {
  const limit = wordLimit(room.config);
  const [answer, setAnswer] = useState(() => rememberedAnswer(room.id));
  const [words, setWords] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'closed' | 'error'
  const [result, setResult] = useState(null);
  const [heard, setHeard] = useState(null);

  // A room set up with a timer is followed from the start, since its facilitator
  // running it is what closes the field (roomTimer in lib/wordCloud.js).
  const seconds = cloudTimer(room.config);
  const timer = seconds ? heard : null;
  const left = useCountdown(timer);
  const over = left === 0;
  const timed = seconds !== null;

  // Once sent: the cloud, kept live while the page is open.
  useEffect(() => {
    if (!answer && !timed) return undefined;
    let cancelled = false;
    const refresh = () => service.readContributions(room.id)
      .then((contributions) => {
        if (cancelled) return;
        const states = contributions.map((entry) => entry.state);
        setResult(countWords(states, limit));
        setHeard(roomTimer(states));
      })
      .catch((err) => console.error('Could not read the word cloud:', err));
    refresh();
    const unsubscribe = service.subscribeToRoom(room.id, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [answer, timed, limit, room.id, service]);

  // A word still in the field when Send is pressed goes with the rest.
  const ready = addWord(words, draft, limit);

  const send = async () => {
    if (ready.length === 0) return;
    setStatus('sending');
    try {
      const saved = await service.saveContribution({
        roomId: room.id, participantToken: participantToken(), displayName: null, state: { words: ready },
      });
      if (!saved) {
        setStatus('closed');
        return;
      }
      rememberAnswer(room.id, { words: ready });
      setAnswer({ words: ready });
      setStatus('idle');
    } catch (err) {
      console.error('Could not send the words:', err);
      setStatus('error');
    }
  };

  const closes = formatRoomDate(room.expiresAt);
  const sent = Array.isArray(answer?.words) ? answer.words : [];

  return (
    <div className="placer-card" style={{ padding: 24 }}>
      <p style={{ fontSize: 22, lineHeight: 1.35, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em',
        marginBottom: 20 }}>
        {room.config?.prompt}
      </p>

      {status === 'closed' ? (
        <p role="status" style={{ fontSize: 15, color: t.inkDim }}>This word cloud has closed.</p>
      ) : answer || over ? (
        <div role="status" aria-live="polite">
          {result ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <FullScreenCloud t={t} prompt={room.config?.prompt} result={result} people={result.people}
                  left={left} paused={isPaused(timer)} />
              </div>
              <Cloud result={result} />
              <div style={{ marginTop: 12 }}>
                <WordCounts t={t} result={result} />
              </div>
              <p style={{ fontSize: 14, color: t.inkDim, marginTop: 12 }}>
                {answer
                  ? <>You said <strong style={{ color: t.ink }}>{sent.join(', ')}</strong>.</>
                  : 'This word cloud has finished, so no more words are being taken.'}
                {' '}{result.people} {result.people === 1 ? 'person has' : 'people have'} answered{answer ? ' so far' : ''}.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 15, color: t.inkDim }}>Loading the cloud…</p>
          )}
        </div>
      ) : (
        <>
          <WordEntry t={t} words={words} limit={limit} draft={draft} onDraft={setDraft} onChange={setWords}
            disabled={status === 'sending'} />
          <div style={{ marginTop: 12 }}>
            <Btn t={t} variant="primary" icon="send" disabled={status === 'sending' || ready.length === 0}
              onClick={send}>
              {ready.length > 1 ? 'Send my words' : 'Send my word'}
            </Btn>
          </div>
          {status === 'error' && (
            <p role="alert" style={{ fontSize: 14, color: t.ink, marginTop: 12 }}>
              Your words did not go through. Please try again.
            </p>
          )}
        </>
      )}

      {left !== null && left > 0 && status !== 'closed' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Countdown t={t} left={left} paused={isPaused(timer)} />
        </div>
      )}

      {closes && status !== 'closed' && (
        <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 16 }}>
          Open until {closes}. {limit === 1 ? 'One word per person.' : `Up to ${limit} words per person.`}
        </p>
      )}
    </div>
  );
}

export default WordCloudOnPage;
