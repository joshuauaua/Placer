/* PLACER — the floating "Report a bug" button, bottom right on every screen.
 *
 * Opens a small panel with one text box. Sending files the report with the page and
 * browser it came from (services/bugReports.js); with no Supabase project configured
 * the same button opens an email instead, so it is never a button that does nothing.
 *
 * Somebody signed in can attach a screenshot, picked or pasted into the text box. It is
 * checked when picked, so a file that is not a picture is turned away at once, and
 * re-encoded smaller when the report is sent (services/bugReports.js).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import {
  MAX_MESSAGE_LENGTH, canAttachScreenshot, isSupabaseConfigured, readSignedIn, reportBugByEmailHref,
  submitBugReport,
} from '../services/bugReports';
import { checkPickedImage } from '../services/media';

// How long the thanks stays up after a report is sent before the panel closes itself.
export const SENT_DISMISS_MS = 3000;

export function BugReportButton({ t }) {
  const [open, setOpen] = useState(false);
  // Checked each time the panel opens, since somebody may have signed in or out since.
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotError, setScreenshotError] = useState('');
  const fileRef = useRef(null);
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
    let cancelled = false;
    if (canAttachScreenshot()) {
      readSignedIn()
        .then((yes) => { if (!cancelled) setSignedIn(yes); })
        .catch(() => { if (!cancelled) setSignedIn(false); });
    }
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // The thanks needs no answer, so it goes away by itself.
  useEffect(() => {
    if (!open || status !== 'sent') return undefined;
    const timer = setTimeout(close, SENT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [open, status]);

  const configured = isSupabaseConfigured();
  const empty = !message.trim();
  const attachable = signedIn && canAttachScreenshot();

  // The thumbnail of the attached screenshot, released when it changes or goes.
  const screenshotUrl = useMemo(() => (screenshot ? URL.createObjectURL(screenshot) : null), [screenshot]);
  useEffect(() => () => { if (screenshotUrl) URL.revokeObjectURL(screenshotUrl); }, [screenshotUrl]);

  const attach = (file) => {
    if (!file) return;
    try {
      checkPickedImage(file, 'A screenshot');
      setScreenshot(file);
      setScreenshotError('');
    } catch (err) {
      setScreenshotError(err.message);
    }
  };

  // A screenshot pasted into the text box is attached; pasted text is left to the box.
  const onPaste = (e) => {
    if (!attachable) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    attach(file);
  };

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
      await submitBugReport(message, { screenshot: attachable ? screenshot : null });
      setMessage('');
      setScreenshot(null);
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

          {/* The × above is the one way out; the thanks also closes itself (SENT_DISMISS_MS). */}
          {status === 'sent' ? (
            <div role="status">
              <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.55, margin: 0 }}>
                Thanks — it&rsquo;s with us. We read every one.
              </p>
            </div>
          ) : (
            <form onSubmit={send}>
              <label htmlFor="placer-bug-message"
                style={{ display: 'block', fontSize: 13.5, color: t.inkDim, lineHeight: 1.5, marginBottom: 8 }}>
                What went wrong, and what did you expect? The page you are on and your browser
                are sent with it.
              </label>
              <textarea id="placer-bug-message" ref={textRef} value={message}
                onChange={(e) => setMessage(e.target.value)} onPaste={onPaste} maxLength={MAX_MESSAGE_LENGTH} rows={5}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 10,
                  borderRadius: 9, border: `1.5px solid ${t.lineStrong}`, background: t.surfaceAlt,
                  color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14, lineHeight: 1.5,
                }} />
              {attachable && (
                <div style={{ marginTop: 10 }}>
                  <input ref={fileRef} type="file" accept="image/*" hidden aria-label="Screenshot"
                    onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }} />
                  {screenshot ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={screenshotUrl} alt="The screenshot to send"
                        style={{ width: 64, height: 44, objectFit: 'cover', borderRadius: 6,
                          border: `1px solid ${t.line}` }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: t.inkDim, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {screenshot.name || 'Pasted screenshot'}
                      </span>
                      <Btn t={t} size="sm" variant="ghost" type="button" onClick={() => setScreenshot(null)}>
                        Remove
                      </Btn>
                    </div>
                  ) : (
                    <Btn t={t} size="sm" variant="outline" type="button" icon="image"
                      onClick={() => fileRef.current?.click()}>
                      Attach a screenshot
                    </Btn>
                  )}
                  {!screenshot && (
                    <p style={{ fontSize: 12.5, color: t.inkFaint, margin: '6px 0 0' }}>
                      Or paste one into the box above.
                    </p>
                  )}
                  {screenshotError && (
                    <p role="alert" style={{ fontSize: 13, color: '#C0392B', margin: '6px 0 0' }}>{screenshotError}</p>
                  )}
                </div>
              )}
              {status === 'error' && (
                <p role="alert" style={{ fontSize: 13, color: '#C0392B', margin: '8px 0 0' }}>{error}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
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
          background: t.surfaceAlt, color: t.inkDim, border: `1px solid ${t.lineStrong}`, boxShadow: t.shadow,
        }}>
        <Icon name="bug" size={22} stroke={1.9} />
      </button>
    </>
  );
}

export default BugReportButton;
