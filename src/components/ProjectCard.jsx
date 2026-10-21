/* PLACER — one project, as a card that opens it. Shared by the Projects page and the
 * organisation pages. `label`, when given, is a small tag above
 * the name — the Projects page's "Your project". */

import { ARROW_ITEM } from '../lib/arrowKeys';
import { responsiveImage } from '../lib/responsiveImage';

export function ProjectCard({ t, project, onOpen, label = null }) {
  return (
    // A column from the top, and as tall as whatever holds it allows: a grid can then give
    // every card one height, and a button would otherwise centre what it holds.
    <button onClick={() => onOpen(project.id)} {...ARROW_ITEM} style={{ textAlign: 'left', padding: 20,
      background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: t.shadow,
      cursor: 'pointer', fontFamily: 'var(--placer-font)', overflow: 'hidden', flex: 1,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
      {/* Edge to edge across the top, so the negative margins undo the card's padding. */}
      {project.image && (
        <img {...responsiveImage(project.image, '(max-width: 640px) 100vw, 360px')} alt="" style={{ display: 'block', width: 'calc(100% + 40px)',
          margin: '-20px -20px 16px', flexShrink: 0, aspectRatio: '16 / 9', objectFit: 'cover' }} />
      )}
      {label && (
        <span style={{ alignSelf: 'flex-start', marginBottom: 8, padding: '2px 8px', borderRadius: 999,
          background: t.surfaceAlt, color: t.ink, fontSize: 12, fontWeight: 600 }}>
          {label}
        </span>
      )}
      <h3 style={{ fontSize: 17, fontWeight: 700, color: t.ink, marginBottom: 6 }}>{project.name}</h3>
      {(project.summary || project.description) && (
        <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {project.summary || project.description}
        </p>
      )}
    </button>
  );
}

export default ProjectCard;
