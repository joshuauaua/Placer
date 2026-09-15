/* PLACER — choosing a new password, having arrived from a reset link */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Btn } from './UI';
import { Icon } from './Icon';
import { readSession, updatePassword } from '../services/auth';

// The same floor AuthPage asks for.
const MIN_PASSWORD = 8;

const inputStyle = (t) => ({
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  border: `1.5px solid ${t.line}`,
  borderRadius: 8,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

/**
 * A reset link signs somebody in before it gets here — that session is the proof that
 * they can read the address, and it is all the authorisation changing the password
 * needs. So the only thing this screen has to establish is that the session exists;
 * without one, the link was stale and there is nothing to do but ask for another.
 */
export function ResetPasswordPage({ t }) {
  const [, navigate] = useLocation();
  const [allowed, setAllowed] = useState('checking'); // 'checking' | 'yes' | 'no'
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    readSession()
      .then((account) => {
        if (cancelled) return;
        setAllowed(account ? 'yes' : 'no');
      })
      .catch(() => {
        if (cancelled) return;
        setAllowed('no');
      });

    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD || busy) return;

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      console.error('Could not change your password:', err);
      setError(err?.message ?? 'Could not change your password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <h1 className="placer-disp" style={{ fontSize: 36, fontWeight: 900, color: t.ink,
          letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.15 }}>
          Choose a new password
        </h1>

        {allowed === 'checking' && (
          <p style={{ fontSize: 16, color: t.inkDim }}>One moment…</p>
        )}

        {allowed === 'no' && (
          <>
            <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6, marginBottom: 24 }}>
              This reset link has expired or has already been used. Ask for a new one and it
              will work the same way.
            </p>
            <Btn t={t} variant="primary" onClick={() => navigate('/signin')}>
              Back to sign in
            </Btn>
          </>
        )}

        {allowed === 'yes' && !done && (
          <>
            <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
              Pick something you have not used elsewhere. You are already signed in on this
              device, so this is the last step.
            </p>
            <section style={{ padding: 28, background: t.surface, borderRadius: 12,
              border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
              <form onSubmit={handleSubmit}>
                <label htmlFor="reset-password"
                  style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle(t), marginBottom: 8 }}
                />
                <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 20 }}>
                  At least {MIN_PASSWORD} characters.
                </div>

                {error && (
                  <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 8,
                    background: '#D6452F22', borderLeft: '4px solid #D6452F', fontSize: 14,
                    color: t.ink, fontWeight: 600, lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}

                <Btn t={t} variant="primary" icon="check" full type="submit"
                  disabled={password.length < MIN_PASSWORD || busy}>
                  {busy ? 'Saving…' : 'Save new password'}
                </Btn>
              </form>
            </section>
          </>
        )}

        {done && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
              <Icon name="check" size={26} stroke={2.4} style={{ color: t.ink }} />
              <p role="status" style={{ fontSize: 16, color: t.inkDim, margin: 0 }}>
                Your password has been changed.
              </p>
            </div>
            <Btn t={t} variant="primary" onClick={() => navigate('/')}>
              Back to PLACER
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
