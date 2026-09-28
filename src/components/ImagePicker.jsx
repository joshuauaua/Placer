/* PLACER — the upload / replace / remove controls for one picture.
 *
 * Shared by the cover and the profile photo in Settings and the project image on the
 * project setup page. It owns only the buttons, the busy state and the error line;
 * the preview, and what uploading and removing actually do, belong to the caller —
 * `onUpload(file)` and `onRemove()` are async and throw a readable sentence on failure.
 */

import { useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';

// Anything a browser may be able to decode, since every picture is re-encoded before
// upload (lib/imageEncode.js). HEIC is what an iPhone camera saves; Safari decodes it,
// and elsewhere the encoder says plainly that it could not read the file.
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif';

export function ImagePicker({ t, hasImage, uploadLabel, replaceLabel, onUpload, onRemove, disabled = false }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'removing'
  const [error, setError] = useState(null);

  const run = (next, action, fallback) => async (arg) => {
    setStatus(next);
    setError(null);
    try {
      await action(arg);
    } catch (err) {
      console.error(fallback, err);
      setError(err?.message ?? fallback);
    } finally {
      setStatus('idle');
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    e.target.value = '';
    if (file) run('uploading', onUpload, 'Could not upload that. Try again.')(file);
  };

  const busy = disabled || status !== 'idle';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {/* A label rather than a button, so the native file picker opens on click. */}
      <label className="placer-btn placer-btn-primary" style={{ display: 'inline-flex',
        alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 12,
        background: t.primaryBg, color: t.primaryFg, fontSize: 15, fontWeight: 500,
        cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        <Icon name="image" size={18} stroke={2} />
        {status === 'uploading' ? 'Uploading…' : (hasImage ? replaceLabel : uploadLabel)}
        <input type="file" accept={IMAGE_ACCEPT} onChange={handleFile} disabled={busy}
          style={{ display: 'none' }} />
      </label>
      {hasImage && (
        <Btn t={t} variant="outline" icon="trash" disabled={busy}
          onClick={() => run('removing', onRemove, 'Could not remove it. Try again.')()}>
          {status === 'removing' ? 'Removing…' : 'Remove'}
        </Btn>
      )}
      {error && (
        <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>{error}</span>
      )}
    </div>
  );
}

export default ImagePicker;
