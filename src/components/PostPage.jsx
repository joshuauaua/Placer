/* PLOT — Step 3: review and post the imagination */

import { useState } from 'react';
import { Btn, CatTag } from './UI';
import { FlowScreen } from './FlowLayout';
import { saveImagination } from '../services/api';
import posthog from 'posthog-js';

// Human-readable stand-in until reverse geocoding exists; the raw coordinates are
// kept on the record separately.
function formatLoc(position) {
  if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return '';
  return `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
}

function Row({ t, label, children }) {
  return (
    <div style={{ display: 'flex', gap: 20, padding: '14px 0', borderTop: `1px solid ${t.line}` }}>
      <div className="plot-mono" style={{ width: 130, flex: '0 0 auto', fontSize: 11,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim, fontWeight: 600, paddingTop: 3 }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 15.5, color: t.ink, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export function PostPage({ t, draft, preview, capturedView, canvasAssets = [], lines = [], onBack, onPosted }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'error'
  const [error, setError] = useState(null);

  const loc = formatLoc(capturedView?.position);

  const handlePost = async () => {
    setStatus('saving');
    setError(null);
    try {
      await saveImagination({
        title: draft.title,
        cat: draft.cat,
        blurb: draft.blurb,
        loc,
        author: 'You There',
        source: capturedView?.source ?? null,
        position: capturedView?.position ?? null,
        pov: capturedView?.pov ?? null,
        fov: capturedView?.fov ?? null,
        // Kept so the imagination can be reopened on the canvas later.
        canvasAssets,
        lines,
        preview: preview ?? capturedView?.screenshot ?? null,
      });
      posthog.capture('imagination_posted', {
        category: draft.cat,
        assets_count: canvasAssets.length,
        lines_count: lines.length,
        source: capturedView?.source ?? null,
      });
      onPosted();
    } catch (err) {
      // Realistically a QuotaExceededError: every record carries a preview image and
      // localStorage only has a few megabytes.
      console.error('Could not post imagination:', err);
      posthog.capture('imagination_post_failed', {
        error_name: err?.name ?? 'unknown',
      });
      setError(
        err?.name === 'QuotaExceededError'
          ? 'Out of local storage space. Delete an older imagination and try again.'
          : 'Could not save your imagination. See the console for details.'
      );
      setStatus('error');
    }
  };

  return (
    <FlowScreen
      t={t}
      step={3}
      onBack={onBack}
      backLabel="Back to describe"
      actions={
        <Btn t={t} variant="primary" size="sm" icon="share" onClick={handlePost} disabled={status === 'saving'}>
          {status === 'saving' ? 'Posting…' : 'Post to community'}
        </Btn>
      }
    >
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '40px 40px 96px' }}
        className="plot-scroll">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 36 }}>
            <h1 className="plot-disp" style={{ fontSize: 36, fontWeight: 900, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
              Ready to post
            </h1>
            <p style={{ fontSize: 17, color: t.inkDim, lineHeight: 1.6 }}>
              Have a last look. You can go back and change anything before posting.
            </p>
          </div>

          {(preview || capturedView?.screenshot) && (
            <img
              src={preview || capturedView.screenshot}
              alt="Your imagination"
              style={{ width: '100%', borderRadius: 12, border: `1px solid ${t.line}`,
                boxShadow: t.shadow, marginBottom: 32, display: 'block' }}
            />
          )}

          <h2 className="plot-disp" style={{ fontSize: 26, fontWeight: 800, color: t.ink,
            letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.2 }}>
            {draft.title}
          </h2>

          <Row t={t} label="Category"><CatTag cat={draft.cat} t={t} /></Row>
          <Row t={t} label="Description">{draft.blurb}</Row>
          <Row t={t} label="Location">
            {loc || <span style={{ color: t.inkDim }}>Not recorded</span>}
          </Row>
          <Row t={t} label="On the canvas">
            <span className="plot-disp" style={{ fontWeight: 700 }}>{canvasAssets.length}</span> assets placed
            <span style={{ margin: '0 8px', color: t.inkFaint }}>·</span>
            <span className="plot-disp" style={{ fontWeight: 700 }}>{lines.length}</span> lines
          </Row>

          {error && (
            <div role="alert" style={{ marginTop: 24, padding: 14, borderRadius: 8,
              background: '#D6452F22', borderLeft: '4px solid #D6452F', fontSize: 14, color: t.ink, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 32, padding: 14, background: t.surfaceAlt, borderRadius: 8,
            fontSize: 13.5, color: t.inkDim, lineHeight: 1.55 }}>
            Posting saves this imagination to your browser. Nothing is uploaded to a
            server yet.
          </div>
        </div>
      </div>
    </FlowScreen>
  );
}

export default PostPage;
