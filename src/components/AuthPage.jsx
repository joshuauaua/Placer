/* PLACER — signing in, and signing up */

import { useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import {
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../services/auth';

// Copied from SettingsPage rather than shared, matching how the form styling is
// already duplicated across the pages that need it.
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

// Supabase's own floor is six. Eight is asked for here because this password is the
// only thing standing in front of somebody's account, and the difference in
// inconvenience is two characters.
const MIN_PASSWORD = 8;

function Field({ t, id, label, type, value, onChange, autoComplete, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label htmlFor={id}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle(t)}
      />
      {hint && (
        <div style={{ fontSize: 13, color: t.inkDim, marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

function Shell({ t, title, blurb, children }) {
  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <h1 className="placer-disp" style={{ fontSize: 36, fontWeight: 900, color: t.ink,
          letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.15 }}>
          {title}
        </h1>
        <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
          {blurb}
        </p>
        <section style={{ padding: 28, background: t.surface, borderRadius: 12,
          border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
          {children}
        </section>
      </div>
    </div>
  );
}

/**
 * The form itself, with no page around it.
 *
 * Separate from AuthPage because it is rendered in two places: on the account view, and
 * inline on the Post step, where somebody who has to sign in before posting gets it in
 * the panel where the Post button would be. That second case is the reason it carries no
 * heading of its own — the Post step already has one — and the reason for onLeaving:
 * two of the three ways in navigate the whole page away, and the caller needs a chance
 * to write down whatever it would rather not lose first.
 */
export function AuthForm({ t, mode = 'signin', onModeChange, onSignedIn, onLeaving,
  onAwaitingConfirmation }) {
  const signingUp = mode === 'signup';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null); // null | 'password' | 'google' | 'reset'
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  if (sentTo) {
    return (
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Icon name="send" size={22} stroke={2} style={{ color: t.inkDim, flex: '0 0 auto', marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 15, color: t.ink, lineHeight: 1.6, margin: '0 0 10px', fontWeight: 600 }}>
            We have sent a confirmation link to {sentTo}.
          </p>
          <p style={{ fontSize: 14.5, color: t.inkDim, lineHeight: 1.6, margin: 0 }}>
            Opening it finishes your account and signs you in. The link opens in whichever
            browser handles your mail, and works once. If nothing arrives in a few minutes,
            check the spam folder — and check the address for a typo, because a confirmation
            sent to the wrong address cannot be recovered.
          </p>
        </div>
      </div>
    );
  }

  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  const ready = trimmedEmail && password.length >= MIN_PASSWORD
    && (!signingUp || trimmedName.length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;

    setBusy('password');
    setError(null);
    setNotice(null);
    try {
      if (signingUp) {
        // The confirmation link is opened from a mail client, which means arriving back
        // as a fresh page load with nothing in memory.
        if (onLeaving) await onLeaving();
        const { needsConfirmation } = await signUpWithPassword({
          email: trimmedEmail,
          password,
          displayName: trimmedName,
        });
        if (needsConfirmation) {
          setSentTo(trimmedEmail);
          if (onAwaitingConfirmation) onAwaitingConfirmation(trimmedEmail);
          return;
        }
        // Confirmation is switched off on this project, so there is already a session
        // and the auth listener in useIdentity has the rest.
        onSignedIn();
        return;
      }

      const account = await signInWithPassword({ email: trimmedEmail, password });
      if (!account) {
        setError(
          'Those details do not match an account. If you have just signed up, open the '
          + 'confirmation link in your email first.'
        );
        return;
      }
      onSignedIn();
    } catch (err) {
      console.error('Could not complete sign in:', err);
      setError(err?.message ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setBusy('google');
    setError(null);
    try {
      // Navigates away, so nothing after this runs on success — including anything that
      // might have saved unfinished work. Hence the warning shot first.
      if (onLeaving) await onLeaving();
      await signInWithGoogle();
    } catch (err) {
      console.error('Could not reach Google:', err);
      setError(err?.message ?? 'Could not reach Google. Try again.');
      setBusy(null);
    }
  };

  const handleReset = async () => {
    if (!trimmedEmail) {
      setError('Type your email address first, and we will send a reset link to it.');
      return;
    }
    setBusy('reset');
    setError(null);
    try {
      await sendPasswordReset(trimmedEmail);
      setNotice(`If ${trimmedEmail} has an account, a reset link is on its way to it.`);
    } catch (err) {
      console.error('Could not send the reset email:', err);
      setError(err?.message ?? 'Could not send the reset email. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const link = (label, onClick) => (
    <span
      onClick={onClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{ color: t.ink, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
      {label}
    </span>
  );

  return (
    <>
      <form onSubmit={handleSubmit}>
        {signingUp && (
          <Field
            t={t} id="auth-name" label="Your name" type="text" value={name} onChange={setName}
            autoComplete="name"
            hint="Shown on the imaginations you post. You can change it later."
          />
        )}
        <Field
          t={t} id="auth-email" label="Email address" type="email" value={email} onChange={setEmail}
          autoComplete="email"
        />
        <Field
          t={t} id="auth-password" label="Password" type="password" value={password}
          onChange={setPassword}
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          hint={signingUp ? `At least ${MIN_PASSWORD} characters.` : undefined}
        />

        {error && (
          <div role="alert" style={{ margin: '4px 0 18px', padding: 14, borderRadius: 8,
            background: '#D6452F22', borderLeft: '4px solid #D6452F', fontSize: 14,
            color: t.ink, fontWeight: 600, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {notice && (
          <div role="status" style={{ margin: '4px 0 18px', fontSize: 14, color: t.inkDim,
            lineHeight: 1.5, fontWeight: 600 }}>
            {notice}
          </div>
        )}

        {/* type="submit" and no onClick: Btn leaves `type` unset by default, which in a
            form means submit, so an onClick here would run handleSubmit twice. */}
        <Btn t={t} variant="primary" icon="check" full
          type="submit" disabled={!ready || Boolean(busy)}>
          {busy === 'password'
            ? (signingUp ? 'Creating your account…' : 'Signing you in…')
            : (signingUp ? 'Create account' : 'Sign in')}
        </Btn>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
        <div style={{ flex: 1, height: 1, background: t.line }} />
        <span className="placer-mono" style={{ fontSize: 11, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: t.inkFaint, fontWeight: 600 }}>
          or
        </span>
        <div style={{ flex: 1, height: 1, background: t.line }} />
      </div>

      <Btn t={t} variant="outline" full type="button" onClick={handleGoogle} disabled={Boolean(busy)}>
        {busy === 'google' ? 'Taking you to Google…' : 'Continue with Google'}
      </Btn>

      <div style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${t.line}`,
        fontSize: 14.5, color: t.inkDim, lineHeight: 1.7 }}>
        {signingUp ? (
          <>Already have an account? {link('Sign in', () => onModeChange('signin'))}</>
        ) : (
          <>
            New here? {link('Create an account', () => onModeChange('signup'))}
            <br />
            Forgotten your password? {link('Email me a reset link', handleReset)}
          </>
        )}
      </div>
    </>
  );
}

/**
 * Sign in and sign up as a view of their own.
 *
 * A view inside MainApp rather than a route, which is what lets somebody reach this from
 * the middle of making an imagination without it being unmounted. See the comment above
 * ACCOUNT_PATHS in App.jsx.
 */
export function AuthPage({ t, mode = 'signin', onNavigate }) {
  const [awaiting, setAwaiting] = useState(null);
  const signingUp = mode === 'signup';

  const title = awaiting
    ? 'Check your inbox'
    : (signingUp ? 'Create an account' : 'Sign in');

  const blurb = awaiting
    ? 'Your account is made. One more click and it is yours.'
    : (signingUp
      ? 'An account is what lets an imagination you post belong to you, and follow you to another device.'
      : 'Welcome back. Your imaginations are waiting wherever you left them.');

  return (
    <Shell t={t} title={title} blurb={blurb}>
      <AuthForm
        t={t}
        mode={mode}
        onModeChange={onNavigate}
        onSignedIn={() => onNavigate('dashboard')}
        onAwaitingConfirmation={setAwaiting}
      />
    </Shell>
  );
}

export default AuthPage;
