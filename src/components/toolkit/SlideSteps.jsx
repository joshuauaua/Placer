/* PLACER — going through a published tool's slides, in order.
 *
 * A tool published as several slides is a run of rooms, one per slide
 * (toolkit/sequence.js). Under each, SlideSteps says which slide this is of how many
 * and offers Next, to the slide after it; the last says it is the last. There is no
 * going back or skipping ahead in the list: everybody answers them in order.
 *
 * SlideRun is the same on a project's page, where a run is one section: it shows the
 * run's rooms there one at a time, `render`ing each, starting from the first.
 */

import { useState } from 'react';
import { Btn } from '../UI';

export function SlideSteps({ t, index, count, onNext }) {
  const last = index >= count - 1;
  return (
    <nav aria-label="Slides" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap', marginTop: 20, padding: '14px 18px', borderRadius: 14,
      border: `1px solid ${t.line}`, background: t.surface }}>
      <span aria-live="polite" style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        Slide {index + 1} of {count}
      </span>
      {last ? (
        <span style={{ fontSize: 13.5, color: t.inkDim }}>That was the last one. Thank you!</span>
      ) : (
        <Btn t={t} size="sm" icon="arrowRight" onClick={onNext}>Next</Btn>
      )}
    </nav>
  );
}

export function SlideRun({ t, rooms, render }) {
  const [index, setIndex] = useState(0);
  const at = Math.min(index, rooms.length - 1);
  const room = rooms[at];
  if (!room) return null;
  return (
    <>
      {/* Keyed by room, so each slide starts afresh. */}
      <div key={room.id}>{render(room)}</div>
      <SlideSteps t={t} index={at} count={rooms.length} onNext={() => setIndex(at + 1)} />
    </>
  );
}

export default SlideSteps;
