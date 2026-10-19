/* PLACER — the photos on a project's page, as a gallery.
 *
 * One photo at a time, as large as the column, with buttons either side to go to the
 * one before or after (wrapping round at the ends), how far through it is, and a row
 * of thumbnails underneath to jump to any of them. The arrow keys do the same once the
 * gallery has focus, and on a touchscreen a swipe does. The photo shown opens full
 * size in a tab of its own. A single photo is just the photo.
 *
 * A photo's caption, if it has one, is under it. When any of them has one the line is
 * kept for all, so the thumbnails do not jump as the gallery moves through them.
 *
 * `photos` are the project's, each { path, url, caption } (services/projects.js), in
 * the order its organisers put them.
 */

import { useRef, useState } from 'react';
import { Icon } from './Icon';

// How far a finger has to travel sideways for a swipe, rather than a tap or a scroll.
const SWIPE_PX = 40;

export function ProjectGallery({ t, photos }) {
  const [index, setIndex] = useState(0);
  const touchRef = useRef(null);
  const count = photos.length;
  // Kept in range if photos are taken away while it is open.
  const current = Math.min(index, count - 1);
  const photo = photos[current];
  if (!photo) return null;

  const anyCaption = photos.some(({ caption }) => caption);

  const go = (by) => setIndex((current + by + count) % count);

  const onKeyDown = (event) => {
    if (count < 2) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
  };

  const onTouchStart = (event) => {
    const touch = event.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || count < 2) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(touch.clientY - start.y)) go(dx < 0 ? 1 : -1);
  };

  return (
    <div className="placer-gallery" role="group" aria-roledescription="gallery" aria-label="Photo gallery"
      tabIndex={count > 1 ? 0 : undefined} onKeyDown={onKeyDown}>
      <div className="placer-gallery-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ background: t.surfaceAlt, border: `1px solid ${t.line}` }}>
        <a href={photo.url} target="_blank" rel="noreferrer"
          aria-label={`Photo ${current + 1} of ${count}${photo.caption ? `: ${photo.caption}` : ''}, full size`}>
          <img key={photo.path} src={photo.url} alt="" />
        </a>
        {count > 1 && (
          <>
            <button type="button" className="placer-gallery-arrow placer-gallery-prev"
              aria-label="Previous photo" onClick={() => go(-1)}>
              <Icon name="chevLeft" size={22} stroke={2.4} />
            </button>
            <button type="button" className="placer-gallery-arrow placer-gallery-next"
              aria-label="Next photo" onClick={() => go(1)}>
              <Icon name="chevRight" size={22} stroke={2.4} />
            </button>
            <span className="placer-gallery-count" aria-live="polite">
              {current + 1} / {count}
            </span>
          </>
        )}
      </div>

      {anyCaption && (
        <p className="placer-gallery-caption" style={{ color: t.inkDim }}>
          {photo.caption || '\u00a0'}
        </p>
      )}

      {count > 1 && (
        <ul className="placer-gallery-thumbs" aria-label="All photos">
          {photos.map((each, i) => (
            <li key={each.path}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
                style={{ outline: i === current ? `2px solid ${t.ink}` : 'none' }}>
                <img src={each.url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProjectGallery;
