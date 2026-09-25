/* PLACER — the landing strip for every link Supabase sends somebody back on */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Btn } from './UI';
import { Icon } from './Icon';
import { readSession } from '../services/auth';

/**
 * Where a confirmation link, a Google sign-in and a password reset all come back to.
 *
 * All three arrive as a ?code= to exchange for a session. The exchange itself is not
 * done here: the client is built with detectSessionInUrl, so simply asking for the
 * session is what spends the code — which is why this reads a session it then does
 * nothing with.
 *
 * A top-level route rather than a view inside MainApp, because it is only ever
 * arrived at cold, from another application entirely.
 */
export function AuthCallback({ t }) {
  const [, navigate] = useLocation();
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    // Read before the exchange: it rewrites the URL, taking the parameters with it.
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '/';
    const refused = params.get('error_description') || params.get('error');

    if (refused) {
      setFailed(refused);
      return;
    }

    let cancelled = false;

    readSession()
      .then((account) => {
        if (cancelled) return;
        if (!account) {
          // A link that has already been used, or has expired. Both look like this.
          setFailed('That link has expired or has already been used.');
          return;
        }
        // replace, not push: the code is spent, so going back to this URL would only
        // fail, and nobody wants the browser's back button to land on a dead link.
        navigate(next, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not finish signing in:', err);
        setFailed(err?.message ?? 'Something went wrong finishing your sign in.');
      });

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: t.page, color: t.ink }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 40 }}>
        {failed ? (
          <>
            <Icon name="close" size={44} stroke={2} style={{ color: t.inkDim, margin: '0 auto 16px' }} />
            <h1 className="placer-disp" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              That did not work
            </h1>
            <p style={{ fontSize: 15, color: t.inkDim, marginBottom: 24, lineHeight: 1.6 }}>
              {failed}
            </p>
            <Btn t={t} variant="primary" onClick={() => navigate('/signin', { replace: true })}>
              Back to sign in
            </Btn>
          </>
        ) : (
          <>
            <Icon name="loader" size={40} stroke={2} style={{ color: t.inkDim, margin: '0 auto 16px' }} />
            <p style={{ fontSize: 15, color: t.inkDim }}>Finishing your sign in…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
