/* PLACER — one posted imagination as a card: its picture, title, category, place,
 * comment count and votes. Opens it on click. Shared by the dashboard and the
 * public profile page. */

import { Icon } from './Icon';
import { CatTag, Vote } from './UI';

export function ImaginationCard({ t, imagination, onOpen }) {
  const { title, cat, blurb, loc, preview, upvotes = 0, comments = [] } = imagination;
  const commentCount = Array.isArray(comments) ? comments.length : 0;

  return (
    <article
      onClick={() => onOpen(imagination)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(imagination); } }}
      style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
        overflow: 'hidden', boxShadow: t.shadow, cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = t.shadow;
      }}>
      {preview && (
        <img src={preview} alt={`Preview of ${title || 'this imagination'}`}
          style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 20, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cat && <div style={{ marginBottom: 10 }}><CatTag cat={cat} t={t} size="sm" /></div>}
          <h3 style={{ fontSize: 20, fontWeight: 700, color: t.ink, lineHeight: 1.3, marginBottom: 6 }}>
            {title || 'Untitled imagination'}
          </h3>
          {blurb && (
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 10,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {blurb}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: t.inkDim }}>
            {loc && <span>{loc}</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="comment" size={14} stroke={2.1} />
              {commentCount}
            </span>
          </div>
        </div>
        <Vote t={t} count={upvotes} size="sm" />
      </div>
    </article>
  );
}

export default ImaginationCard;
