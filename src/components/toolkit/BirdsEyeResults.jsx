/* PLACER — Birds Eye View's results: everybody's layouts, laid over the plan.
 *
 * As the other tools' results: Live or Completed (and when), how many sent a layout,
 * the question, and the plan with every layout drawn faintly on it, so where the
 * pieces gather shows. On the project's dashboard and, once ended, its public page.
 */

import { useMemo } from 'react';
import { BirdsEyePlan } from './BirdsEyePlan';
import { DEFAULT_PROMPT, combineLayouts, readAssets, readOutline } from '../../lib/birdsEye';
import { formatRoomDate } from '../../toolkit/rooms';

export function BirdsEyeResults({ t, result }) {
  const { layouts, people } = useMemo(() => combineLayouts(result.states, result.config), [result.states, result.config]);
  const live = result.status === 'open';
  const prompt = result.config?.prompt?.trim() || DEFAULT_PROMPT;

  return (
    <section aria-label={`Results: ${prompt}`} className="placer-results">
      <div className="placer-results-head">
        <span className={`placer-results-status${live ? ' is-live' : ''}`}>
          {live ? 'Live' : `Completed${result.endsAt ? ` ${formatRoomDate(result.endsAt)}` : ''}`}
        </span>
        <span className="placer-results-count">{people} {people === 1 ? 'layout' : 'layouts'}</span>
      </div>
      <h3 className="placer-results-prompt" style={{ color: t.ink }}>{prompt}</h3>
      {people === 0 && (
        <p className="placer-results-empty">
          {live ? 'No layouts yet. They will appear here as people send them.' : 'Nobody sent a layout.'}
        </p>
      )}
      <BirdsEyePlan outline={readOutline(result.config?.outline)} assets={readAssets(result.config?.assets)}
        layout={{}} overlays={layouts} showPieces={people === 0} height={420} label={`${prompt}, with ${people} ${people === 1 ? 'layout' : 'layouts'}`} />
    </section>
  );
}

export default BirdsEyeResults;
