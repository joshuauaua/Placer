/* PLACER — account settings: your name, and what the app is allowed to measure */

import { useState } from 'react';
import { Avatar, AVATAR_ICONS, Btn } from './UI';
import { Icon } from './Icon';
import { readConsent, grantConsent, denyConsent, GRANTED, DENIED } from '../analytics';
import { updatePassword } from '../services/auth';

// The same floor AuthPage and ResetPasswordPage ask for.
const MIN_PASSWORD = 8;

// Copied from DescribePage rather than shared, matching how the form styling is
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

function Card({ t, title, children }) {
  return (
    <section style={{ padding: 28, marginBottom: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  );
}

function DisplayName({ t, profile, onSaveProfile }) {
  const [name, setName] = useState(profile?.name ?? '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const trimmed = name.trim();
  const unchanged = trimmed === (profile?.name ?? '');

  // Saving is a request now, not a localStorage write, so it can be slow and it can
  // fail. Both states are shown rather than swallowed: a name that silently did not
  // save is worse than one that says so.
  const handleSave = async () => {
    setStatus('saving');
    try {
      await onSaveProfile({ name: trimmed });
      setStatus('saved');
    } catch (err) {
      console.error('Could not save your name:', err);
      setStatus('error');
    }
  };

  return (
    <Card t={t} title="Display name">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        The name shown on the imaginations you post from now on. Changing it does not rename
        what you have already posted.
      </p>
      <label htmlFor="settings-display-name"
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Your name
      </label>
      <input
        id="settings-display-name"
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
        style={{ ...inputStyle(t), maxWidth: 380, marginBottom: 20 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Btn t={t} variant="primary" icon="check" onClick={handleSave}
          disabled={!trimmed || unchanged || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save name'}
        </Btn>
        {status === 'saved' && (
          <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
            Saved.
          </span>
        )}
        {status === 'error' && (
          <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>
            Could not save that. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

// Bio and Location share this shape with each other but not with DisplayName: both
// are optional, so there is no "blank is invalid" rule to encode, and one of them
// wants a textarea. DisplayName stays its own component rather than becoming a third
// call to this one — a required field with its own copy is a different enough thing
// that folding it in would mean threading an "isRequired" branch through a function
// two of its three uses do not need.
function ProfileField({ t, profile, onSaveProfile, fieldKey, title, description, label, id, placeholder, multiline }) {
  const [value, setValue] = useState(profile?.[fieldKey] ?? '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const trimmed = value.trim();
  const unchanged = trimmed === (profile?.[fieldKey] ?? '');

  const handleSave = async () => {
    setStatus('saving');
    try {
      await onSaveProfile({ [fieldKey]: trimmed });
      setStatus('saved');
    } catch (err) {
      console.error(`Could not save your ${label.toLowerCase()}:`, err);
      setStatus('error');
    }
  };

  const fieldStyle = { ...inputStyle(t), maxWidth: 380, marginBottom: 20,
    ...(multiline ? { resize: 'vertical', minHeight: 88, fontFamily: 'var(--placer-font)' } : {}) };

  return (
    <Card t={t} title={title}>
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        {description}
      </p>
      <label htmlFor={id}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      {multiline ? (
        <textarea id={id} rows={4} value={value} placeholder={placeholder}
          onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
          style={fieldStyle} />
      ) : (
        <input id={id} type="text" value={value} placeholder={placeholder}
          onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
          style={fieldStyle} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Btn t={t} variant="primary" icon="check" onClick={handleSave}
          disabled={unchanged || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : `Save ${label.toLowerCase()}`}
        </Btn>
        {status === 'saved' && (
          <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
            Saved.
          </span>
        )}
        {status === 'error' && (
          <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>
            Could not save that. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

// Selected and unselected states of one icon choice in the avatar grid.
const avatarOptionStyle = (t, selected) => ({
  width: 46, height: 46, borderRadius: '50%', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: selected ? t.accent + '22' : 'transparent',
  border: `1.5px solid ${selected ? t.accent : t.line}`,
  color: t.ink,
});

function AvatarPicker({ t, profile, onSaveProfile }) {
  const [avatar, setAvatar] = useState(profile?.avatar ?? null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const unchanged = avatar === (profile?.avatar ?? null);

  const choose = (next) => {
    setAvatar(next);
    setStatus('idle');
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      await onSaveProfile({ avatar });
      setStatus('saved');
    } catch (err) {
      console.error('Could not save your avatar:', err);
      setStatus('error');
    }
  };

  return (
    <Card t={t} title="Avatar">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        An icon shown instead of your initials wherever your avatar appears. Optional.
      </p>
      <div role="radiogroup" aria-label="Avatar icon"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button type="button" role="radio" aria-checked={avatar === null}
          aria-label="No icon — show my initials instead" onClick={() => choose(null)}
          style={{ ...avatarOptionStyle(t, avatar === null), padding: 0, background: 'transparent' }}>
          <Avatar name={profile?.name ?? ''} size={44} ring={avatar === null ? t.accent : 'transparent'} />
        </button>
        {AVATAR_ICONS.map(({ key, label }) => (
          <button key={key} type="button" role="radio" aria-checked={avatar === key}
            aria-label={label} onClick={() => choose(key)} style={avatarOptionStyle(t, avatar === key)}>
            <Icon name={key} size={20} stroke={2} />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Btn t={t} variant="primary" icon="check" onClick={handleSave}
          disabled={unchanged || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save avatar'}
        </Btn>
        {status === 'saved' && (
          <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
            Saved.
          </span>
        )}
        {status === 'error' && (
          <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>
            Could not save that. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

// Only reachable on the account path — a local-only visitor has no password to
// change, and no `email` is what tells this apart from that world (see useIdentity.js).
function ChangePassword({ t }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD || busy) return;

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setPassword('');
      setDone(true);
    } catch (err) {
      console.error('Could not change your password:', err);
      setError(err?.message ?? 'Could not change your password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card t={t} title="Password">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        Change the password you sign in with.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="settings-new-password"
          style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
          New password
        </label>
        <input
          id="settings-new-password"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => { setPassword(e.target.value); setDone(false); }}
          style={{ ...inputStyle(t), maxWidth: 380, marginBottom: 8 }}
        />
        <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 20 }}>
          At least {MIN_PASSWORD} characters.
        </div>

        {error && (
          <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 8,
            background: '#D6452F22', borderLeft: '4px solid #D6452F', fontSize: 14,
            color: t.ink, fontWeight: 600, lineHeight: 1.5, maxWidth: 380 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Btn t={t} variant="primary" icon="check" type="submit"
            disabled={password.length < MIN_PASSWORD || busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </Btn>
          {done && (
            <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
              Changed.
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

// The same two calls the Terms and Privacy page makes, so the two screens cannot
// drift apart. The wording stays short here on purpose: the full Article 13 text,
// and the export and erasure controls, live on that page rather than being restated.
function Analytics({ t, onNavigate }) {
  const [decision, setDecision] = useState(() => readConsent());

  const choose = (record, next) => () => {
    record();
    setDecision(next);
  };

  const state = decision === GRANTED
    ? 'Analytics are on for this browser.'
    : decision === DENIED
      ? 'Analytics are off. Nothing is captured or stored.'
      : 'No choice recorded yet. Analytics are off until you accept.';

  return (
    <Card t={t} title="Analytics">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        Whether PLACER may load PostHog to measure how the app is used. You can change this
        whenever you like.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Btn t={t} variant="primary" icon="check" onClick={choose(grantConsent, GRANTED)}
          disabled={decision === GRANTED}>
          Accept analytics
        </Btn>
        <Btn t={t} variant="outline" icon="close" onClick={choose(denyConsent, DENIED)}
          disabled={decision === DENIED}>
          Reject analytics
        </Btn>
      </div>
      <div style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginTop: 16 }}>
        {state}{' '}
        <span
          onClick={() => onNavigate('terms')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('terms'); }}
          style={{ color: t.ink, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
          What is collected, and your rights
        </span>
      </div>
    </Card>
  );
}

function YourData({ t, onNavigate }) {
  const link = (view, label) => (
    <span
      onClick={() => onNavigate(view)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate(view); }}
      style={{ color: t.ink, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
      {label}
    </span>
  );

  return (
    <Card t={t} title="Your data">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6 }}>
        Downloading everything PLACER holds in this browser, and erasing it, are on the{' '}
        {link('terms', 'Terms and Privacy page')} — including this profile, and what is kept and
        why.
      </p>
    </Card>
  );
}

export function SettingsPage({ t, profile, email, onSaveProfile, onNavigate }) {
  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 40 }}>
        <div style={{ marginBottom: 40 }}>
          <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, color: t.ink,
            letterSpacing: '-0.03em', marginBottom: 16 }}>
            Settings
          </h1>
          <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6 }}>
            Your name on the map, and what this browser is allowed to measure.
          </p>
        </div>

        <DisplayName t={t} profile={profile} onSaveProfile={onSaveProfile} />
        <AvatarPicker t={t} profile={profile} onSaveProfile={onSaveProfile} />
        <ProfileField t={t} profile={profile} onSaveProfile={onSaveProfile} fieldKey="bio"
          title="Bio" label="Bio" id="settings-bio" multiline
          description="A couple of lines about you, shown on your profile. Optional."
          placeholder="What you're into, or what brought you here." />
        <ProfileField t={t} profile={profile} onSaveProfile={onSaveProfile} fieldKey="location"
          title="Location" label="Location" id="settings-location"
          description="Where you're based, shown on your profile. Optional."
          placeholder="e.g. Malmö, Sweden" />
        {email && <ChangePassword t={t} />}
        <Analytics t={t} onNavigate={onNavigate} />
        <YourData t={t} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export default SettingsPage;
