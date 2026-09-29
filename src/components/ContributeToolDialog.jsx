/* PLACER — the Sandbox's "Contribute" pop-up: offer a tool for the PLACER Toolkit.
 *
 * Three fields, all required: the tool's title, what it does, and an email address to
 * reach whoever sent it. Sending files it with services/toolSubmissions.js; with no
 * Supabase project configured the same button opens an email instead, so it is never
 * a button that does nothing — the same arrangement as the "Report a bug" panel.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import {
  MAX_DESCRIPTION_LENGTH, MAX_EMAIL_LENGTH, MAX_TITLE_LENGTH, isSupabaseConfigured,
  submitTool, submitToolByEmailHref, validateToolSubmission,
} from '../services/toolSubmissions';

const EMPTY = { title: '', description: '', email: '' };

export function ContributeToolDialog({ t, onClose }) {
  const [fields, setFields] = useState(EMPTY);
  // 'idle' | 'sending' | 'sent' | 'error'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const titleRef = useRef(null);

  // Apart from the Escape handler below, so a parent re-render handing in a new
  // onClose does not pull focus back to the title mid-sentence.
  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const configured = isSupabaseConfigured();
  const set = (key) => (e) => setFields((current) => ({ ...current, [key]: e.target.value }));

  const send = async (e) => {
    e.preventDefault();
    if (status === 'sending') return;
    const problem = validateToolSubmission(fields);
    if (problem) {
      setError(problem);
      setStatus('error');
      return;
    }
    if (!configured) {
      window.location.href = submitToolByEmailHref(fields);
      return;
    }
    setStatus('sending');
    setError('');
    try {
      await submitTool(fields);
      setFields(EMPTY);
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const label = { display: 'block', fontSize: 14, fontWeight: 500, color: t.ink, marginBottom: 6 };
  const input = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
    border: `1.5px solid ${t.lineStrong}`, background: t.surfaceAlt, color: t.ink,
    fontFamily: 'var(--placer-font)', fontSize: 15, lineHeight: 1.5,
  };

  return (
    // The backdrop closes the dialog; clicks inside it stop before they reach it.
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(17,17,17,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="placer-contribute-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto',
          background: t.surface, color: t.ink, border: `1px solid ${t.line}`, borderRadius: 16,
          boxShadow: t.shadow, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          marginBottom: 8 }}>
          <h2 id="placer-contribute-title" className="placer-disp"
            style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            Contribute a tool
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', color: t.inkDim }}>
            <Icon name="close" size={20} stroke={2} />
          </button>
        </div>

        {status === 'sent' ? (
          <div role="status">
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, margin: '0 0 20px' }}>
              Thanks — we have it, and we will be in touch by email.
            </p>
            <Btn t={t} size="sm" variant="outline" onClick={onClose}>Close</Btn>
          </div>
        ) : (
          <form onSubmit={send} noValidate>
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, margin: '0 0 20px' }}>
              Have a placemaking or participatory design tool that belongs in the PLACER
              Toolkit? Tell us about it.
            </p>

            <label htmlFor="placer-contribute-name" style={label}>Title</label>
            <input id="placer-contribute-name" ref={titleRef} type="text" required
              value={fields.title} onChange={set('title')} maxLength={MAX_TITLE_LENGTH}
              style={{ ...input, marginBottom: 16 }} />

            <label htmlFor="placer-contribute-description" style={label}>Description</label>
            <textarea id="placer-contribute-description" required rows={5}
              value={fields.description} onChange={set('description')} maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="What the tool does, who it is for, and how it is used."
              style={{ ...input, resize: 'vertical', marginBottom: 16 }} />

            <label htmlFor="placer-contribute-email" style={label}>Email address</label>
            <input id="placer-contribute-email" type="email" required autoComplete="email"
              value={fields.email} onChange={set('email')} maxLength={MAX_EMAIL_LENGTH}
              style={input} />

            {status === 'error' && (
              <p role="alert" style={{ fontSize: 13.5, color: '#B3261E', margin: '12px 0 0' }}>{error}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <Btn t={t} size="sm" variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
              <Btn t={t} size="sm" variant="primary" type="submit" icon="send"
                disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : configured ? 'Submit' : 'Submit by email'}
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ContributeToolDialog;
