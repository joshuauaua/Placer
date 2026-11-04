/* PLACER — a titled row of cards on the dashboard, with ‹ and › to move along it.
 *
 * The title on the left, as written (not in capitals), and at the far right two round
 * buttons that move the row a screenful back or on, each greyed out when there is
 * nothing more that way. The cards are one row that scrolls sideways and snaps to a
 * card: `perView` of them across on a laptop (index.css: two on a tablet, and on a phone
 * one with the next peeking in), so a swipe or a trackpad moves it too. `children` are
 * the cards, each its own <li>.
 *
 * `action`, if given, sits before the arrows — My Tools' View all.
 *
 * Used for Getting Started (DashboardPage), My Tools, Popular Templates and Tutorials.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CardRow({ t, id, title, perView = 4, action = null, children }) {
  const track = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  // Again whenever the row or what is in it changes size.
  useEffect(() => {
    update();
    const el = track.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, children]);

  const move = (direction) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const titleId = `${id}-title`;
  const trackId = `${id}-cards`;
  return (
    <section id={id} aria-labelledby={titleId} className="placer-card-row-section">
      <div className="placer-card-row-head">
        <h2 id={titleId} className="placer-card-row-title" style={{ color: t.ink }}>{title}</h2>
        <div className="placer-card-row-arrows">
          {action}
          <button type="button" onClick={() => move(-1)} disabled={atStart} aria-controls={trackId}
            aria-label={`${title}: back`} className="placer-card-row-arrow">
            <Icon name="chevLeft" size={18} stroke={2.2} />
          </button>
          <button type="button" onClick={() => move(1)} disabled={atEnd} aria-controls={trackId}
            aria-label={`${title}: more`} className="placer-card-row-arrow">
            <Icon name="chevRight" size={18} stroke={2.2} />
          </button>
        </div>
      </div>
      <ul id={trackId} ref={track} onScroll={update} className="placer-card-row" style={{ '--placer-per-view': perView }}>
        {children}
      </ul>
    </section>
  );
}

export default CardRow;
