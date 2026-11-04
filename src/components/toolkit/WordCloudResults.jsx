/* PLACER — a Word Cloud's results: everything a room of it was told, in one cloud.
 *
 * The prompt, whether the room is Live (and filling in) or Completed (and when), how
 * many people answered with how many words, then the cloud of them all and every word
 * with how many times it was given. `result` is one of readProjectToolResults's: its
 * `states` are folded the same way the room folds them (combineWords), so live and
 * kept results read alike. On the project's dashboard (My Toolkit) and, once a room
 * has ended, on its public page.
 */

import { useMemo } from 'react';
import { Cloud, WordCounts } from './WordCloud';
import { combineWords, DEFAULT_PROMPT } from '../../lib/wordCloud';
import { formatRoomDate } from '../../toolkit/rooms';

export function WordCloudResults({ t, result }) {
  const counted = useMemo(() => combineWords(result.states, result.config), [result.states, result.config]);
  const live = result.status === 'open';
  const prompt = result.config?.prompt?.trim() || DEFAULT_PROMPT;
  const people = counted.people;
  const words = counted.words.length;

  return (
    <section aria-label={`Results: ${prompt}`} className="placer-results">
      <div className="placer-results-head">
        <span className={`placer-results-status${live ? ' is-live' : ''}`}>
          {live ? 'Live' : `Completed${result.endsAt ? ` ${formatRoomDate(result.endsAt)}` : ''}`}
        </span>
        <span className="placer-results-count">
          {people} {people === 1 ? 'person' : 'people'} · {words} {words === 1 ? 'word' : 'words'}
        </span>
      </div>
      <h3 className="placer-results-prompt" style={{ color: t.ink }}>{prompt}</h3>
      {counted.total === 0 ? (
        <p className="placer-results-empty">
          {live ? 'No words yet. They will appear here as people add them.' : 'Nobody added a word.'}
        </p>
      ) : (
        <div className="placer-results-body">
          <Cloud result={counted} minHeight={220} scale={1.3} />
          <WordCounts t={t} result={counted} />
        </div>
      )}
    </section>
  );
}

export default WordCloudResults;
