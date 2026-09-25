/* PLACER — Admin: moderate the imaginations people have posted */

import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Btn, CatTag } from './UI';
import { fetchImaginations, deleteImagination } from '../services/api';

// ISO slice rather than toLocaleDateString, so the output does not shift with the
// machine's locale.
const formatDate = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '—');

const sortNewestFirst = (records) =>
  [...records].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

function Meta({ t, children }) {
  return <span style={{ color: t.inkDim, fontWeight: 500 }}>{children}</span>;
}

function Dot({ t }) {
  return <span style={{ margin: '0 8px', color: t.inkFaint }}>·</span>;
}

function Row({ t, imagination, confirming, busy, onAskDelete, onCancelDelete, onConfirmDelete }) {
  const { title, cat, blurb, loc, preview, author, createdAt, upvotes = 0,
    canvasAssets = [], lines = [] } = imagination;
  const name = title || 'Untitled imagination';

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16, background: t.surface,
      border: `1px solid ${confirming ? '#B3261E' : t.line}`, borderRadius: 12,
      boxShadow: t.shadow, opacity: busy ? 0.5 : 1 }}>
      {preview ? (
        <img
          src={preview}
          alt={`Preview of ${name}`}
          style={{ width: 132, height: 92, objectFit: 'cover', borderRadius: 12,
            border: `1px solid ${t.line}`, flex: '0 0 auto' }}
        />
      ) : (
        <div
          aria-label="No preview"
          style={{ width: 132, height: 92, borderRadius: 12, background: t.surfaceAlt,
            border: `1px solid ${t.line}`, flex: '0 0 auto', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: t.inkFaint }}>
          <Icon name="image" size={26} stroke={1.8} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 className="placer-disp" style={{ fontSize: 17, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.01em', margin: 0 }}>
            {name}
          </h2>
          {cat && <CatTag cat={cat} t={t} size="sm" />}
        </div>

        {blurb && (
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.5, margin: '0 0 8px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {blurb}
          </p>
        )}

        <div style={{ fontSize: 12.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          <Meta t={t}>{formatDate(createdAt)}</Meta>
          {author && <><Dot t={t} /><Meta t={t}>{author}</Meta></>}
          {loc && <><Dot t={t} /><Meta t={t}>{loc}</Meta></>}
          <Dot t={t} />
          <Meta t={t}>{canvasAssets.length} assets</Meta>
          <Dot t={t} />
          <Meta t={t}>{lines.length} lines</Meta>
          <Dot t={t} />
          <Meta t={t}>{upvotes} votes</Meta>
        </div>
      </div>

      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {confirming ? (
          <>
            <Btn t={t} variant="outline" size="sm" onClick={onCancelDelete} disabled={busy}>
              Cancel
            </Btn>
            <Btn
              t={t}
              size="sm"
              icon="trash"
              onClick={onConfirmDelete}
              disabled={busy}
              ariaLabel={`Confirm deleting ${name}`}
              style={{ background: '#B3261E', color: '#fff', border: '1px solid transparent' }}>
              {busy ? 'Deleting…' : 'Delete for good'}
            </Btn>
          </>
        ) : (
          <Btn
            t={t}
            variant="outline"
            size="sm"
            icon="trash"
            onClick={onAskDelete}
            ariaLabel={`Delete ${name}`}>
            Delete
          </Btn>
        )}
      </div>
    </div>
  );
}

export function AdminImaginations({ t }) {
  const [imaginations, setImaginations] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchImaginations()
      .then((saved) => {
        if (cancelled) return;
        setImaginations(sortNewestFirst(saved));
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load imaginations:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, []);

  const handleConfirmDelete = async (id) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteImagination(id);
      setImaginations((current) => current.filter((imagination) => imagination.id !== id));
      setConfirmingId(null);
    } catch (err) {
      console.error('Could not delete imagination:', err);
      setError('Could not delete that imagination. See the console for details.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', overflowY: 'auto', background: t.page, color: t.ink }}
      className="placer-scroll">
      {/* Header — matches the main admin dashboard's chrome. */}
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.line}`, padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.02em', marginBottom: 4 }}>
              Imaginations
            </h1>
            <p style={{ fontSize: 14, color: t.inkDim }}>
              Everything people have posted, newest first. Deleting is permanent.
            </p>
          </div>
          <div className="placer-mono" style={{ padding: '8px 16px', background: t.surfaceAlt,
            borderRadius: 12, border: `1px solid ${t.accent}`, fontSize: 13, fontWeight: 700, color: t.ink }}>
            {imaginations.length} saved
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px 64px', maxWidth: 1040 }}>
        {status === 'loading' && (
          <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>Loading imaginations…</div>
        )}

        {status === 'error' && (
          <div role="alert" style={{ padding: 16, borderRadius: 12, background: '#F5F5F5',
            borderLeft: '4px solid #B3261E', fontSize: 14, fontWeight: 500 }}>
            Could not load imaginations. See the console for details.
          </div>
        )}

        {status === 'ready' && imaginations.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12 }}>
            <Icon name="sparkle" size={30} stroke={1.9} style={{ color: t.inkFaint, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nothing posted yet</div>
            <div style={{ fontSize: 14, color: t.inkDim }}>
              Imaginations appear here once someone posts one from the map.
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginBottom: 16, padding: 14, borderRadius: 12,
            background: '#F5F5F5', borderLeft: '4px solid #B3261E', fontSize: 14, fontWeight: 500 }}>
            {error}
          </div>
        )}

        {status === 'ready' && imaginations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {imaginations.map((imagination) => (
              <Row
                key={imagination.id}
                t={t}
                imagination={imagination}
                confirming={confirmingId === imagination.id}
                busy={deletingId === imagination.id}
                onAskDelete={() => { setError(null); setConfirmingId(imagination.id); }}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => handleConfirmDelete(imagination.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminImaginations;
