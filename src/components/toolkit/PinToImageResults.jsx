/* PLACER — Pin to Image's results: everybody's pins on the picture, in one view.
 *
 * As WordCloudResults is for a Word Cloud: whether the room is Live or Completed (and
 * when), how many pinned, the question, and the picture with every pin on it. On the
 * project's dashboard (My Toolkit) and, once a room has ended, on its public page.
 */

import { useMemo } from 'react';
import { PinBoard } from './PinToImage';
import { combinePins, DEFAULT_PROMPT } from '../../lib/pinToImage';
import { mediaUrl } from '../../services/media';
import { formatRoomDate } from '../../toolkit/rooms';

export function PinToImageResults({ t, result }) {
  const { pins, people } = useMemo(() => combinePins(result.states), [result.states]);
  const live = result.status === 'open';
  const prompt = result.config?.prompt?.trim() || DEFAULT_PROMPT;
  const url = mediaUrl(result.config?.imagePath);

  return (
    <section aria-label={`Results: ${prompt}`} className="placer-results">
      <div className="placer-results-head">
        <span className={`placer-results-status${live ? ' is-live' : ''}`}>
          {live ? 'Live' : `Completed${result.endsAt ? ` ${formatRoomDate(result.endsAt)}` : ''}`}
        </span>
        <span className="placer-results-count">{people} {people === 1 ? 'pin' : 'pins'}</span>
      </div>
      <h3 className="placer-results-prompt" style={{ color: t.ink }}>{prompt}</h3>
      {people === 0 && (
        <p className="placer-results-empty">
          {live ? 'No pins yet. They will appear here as people add them.' : 'Nobody pinned anything.'}
        </p>
      )}
      {url && <PinBoard t={t} imageUrl={url} pins={pins} label={prompt} maxHeight={480} />}
    </section>
  );
}

export default PinToImageResults;
