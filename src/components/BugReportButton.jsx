/* PLACER — the floating "Report a bug" button, bottom right on every screen.
 *
 * Opens a small panel with one text box. Sending files the report with the page and
 * browser it came from (services/bugReports.js); with no Supabase project configured
 * the same button opens an email instead, so it is never a button that does nothing.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import {
  MAX_MESSAGE_LENGTH, isSupabaseConfigured, reportBugByEmailHref, submitBugReport,
} from '../services/bugReports';

export function BugReportButton({ t }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  // 'idle' | 'sending' | 'sent' | 'error'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const textRef = useRef(null);
  const buttonRef = useRef(null);

  // An unsent message is kept when the panel closes, in case that was an accident;
  // a sent one was already cleared.
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const openPanel = () => {
    if (status === 'sent') setStatus('idle');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    textRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const configured = isSupabaseConfigured();
  const empty = !message.trim();

  const send = async (e) => {
    e.preventDefault();
    if (empty || status === 'sending') return;
    if (!configured) {
      window.location.href = reportBugByEmailHref(message);
      return;
    }
    setStatus('sending');
    setError('');
    try {
      await submitBugReport(message);
      setMessage('');
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  // Clears the cookie banner while it is up, the same way the map's controls do.
  const bottom = 'calc(20px + var(--placer-consent-inset, 0px))';

  return (
    <>
      {open && (
        <div role="dialog" aria-label="Report a bug"
          style={{
            position: 'fixed', right: 20, bottom: `calc(${bottom} + 60px)`, zIndex: 150,
            width: 340, maxWidth: 'calc(100vw - 40px)',
            background: t.surface, color: t.ink, border: `1px solid ${t.line}`,
            borderRadius: 14, boxShadow: t.shadow, padding: 18,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Report a bug</div>
            <button type="button" onClick={close} aria-label="Close"
              style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', color: t.inkDim }}>
              <Icon name="close" size={18} stroke={2} />
            </button>
          </div>

          {status === 'sent' ? (
            <div role="status">
              <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.55, margin: '0 0 14px' }}>
                Thanks — it&rsquo;s with us. We read every one.
              </p>
              <Btn t={t} size="sm" variant="outline" onClick={close}>Close</Btn>
            </div>
          ) : (
            <form onSubmit={send}>
              <label htmlFor="placer-bug-message"
                style={{ display: 'block', fontSize: 13.5, color: t.inkDim, lineHeight: 1.5, marginBottom: 8 }}>
                What went wrong, and what did you expect? The page you are on and your browser
                are sent with it.
              </label>
              <textarea id="placer-bug-message" ref={textRef} value={message}
                onChange={(e) => setMessage(e.target.value)} maxLength={MAX_MESSAGE_LENGTH} rows={5}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 10,
                  borderRadius: 9, border: `1.5px solid ${t.lineStrong}`, background: t.surfaceAlt,
                  color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14, lineHeight: 1.5,
                }} />
              {status === 'error' && (
                <p role="alert" style={{ fontSize: 13, color: '#C0392B', margin: '8px 0 0' }}>{error}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Btn t={t} size="sm" variant="ghost" type="button" onClick={close}>Cancel</Btn>
                <Btn t={t} size="sm" variant="primary" type="submit" icon="send"
                  disabled={empty || status === 'sending'}>
                  {status === 'sending' ? 'Sending…' : configured ? 'Send' : 'Send by email'}
                </Btn>
              </div>
            </form>
          )}
        </div>
      )}

      <button ref={buttonRef} type="button" onClick={open ? close : openPanel}
        aria-label="Report a bug" aria-expanded={open} title="Report a bug"
        style={{
          position: 'fixed', right: 20, bottom, zIndex: 150,
          width: 48, height: 48, borderRadius: 999, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: t.primaryBg, color: t.primaryFg, border: 0, boxShadow: t.shadow,
        }}>
        <Icon name={open ? 'close' : 'bug'} size={22} stroke={1.9} />
      </button>
    </>
  );
}

export default BugReportButton;
