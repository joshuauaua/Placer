/* PLACER — preview card for an imagination picked off the map */

import { Icon } from './Icon';
import { CatTag } from './UI';

export function ImaginationPreview({ t, imagination, onClose }) {
  const {
    title,
    cat,
    blurb,
    loc,
    preview,
    author,
    canvasAssets = [],
  } = imagination;

  return (
    <div
      role="dialog"
      aria-label={`Imagination: ${title || 'Untitled'}`}
      // Sits over the map, above the floating search and capture controls.
      style={{ position: 'absolute', top: 16, left: 16, zIndex: 6, width: 320,
        maxWidth: 'calc(100% - 32px)', maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
        background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
        boxShadow: t.shadow, color: t.ink }}
      className="placer-scroll">
      <div style={{ position: 'relative' }}>
        {preview && (
          <img
            src={preview}
            alt={`Preview of ${title || 'this imagination'}`}
            style={{ width: '100%', display: 'block', borderRadius: '12px 12px 0 0' }}
          />
        )}
        <button
          onClick={onClose}
          aria-label="Close preview"
          style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            // Legible whether it lands on the image or on the card itself.
            background: 'rgba(22,21,15,0.62)', color: '#FFFFFF' }}>
          <Icon name="close" size={17} stroke={2.4} />
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {cat && <div style={{ marginBottom: 10 }}><CatTag cat={cat} t={t} size="sm" /></div>}

        <h2 className="placer-disp" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
          lineHeight: 1.25, marginBottom: blurb ? 8 : 0 }}>
          {title || 'Untitled imagination'}
        </h2>

        {blurb && (
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.55, marginBottom: 12,
            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {blurb}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 12,
          borderTop: `1px solid ${t.line}`, fontSize: 12.5, color: t.inkDim, fontWeight: 600 }}>
          {loc && <div>{loc}</div>}
          <div>
            <span className="placer-disp" style={{ color: t.ink, fontWeight: 700 }}>{canvasAssets.length}</span> assets
            {author && <> <span style={{ margin: '0 6px', color: t.inkFaint }}>·</span> {author}</>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImaginationPreview;
