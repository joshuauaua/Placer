/* PLACER — account settings: your name, and what the app is allowed to measure */

import { useState } from 'react';
import { Btn } from './UI';
import { readConsent, grantConsent, denyConsent, GRANTED, DENIED } from '../analytics';

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

// The same two calls the GDPR page makes, so the two screens cannot drift apart.
// The wording stays short here on purpose: the full Article 13 text, and the export
// and erasure controls, live on the GDPR page rather than being restated.
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
          onClick={() => onNavigate('gdpr')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('gdpr'); }}
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
        {link('gdpr', 'GDPR page')} — including this profile. The{' '}
        {link('privacy', 'Privacy Policy')} explains what is kept and why.
      </p>
    </Card>
  );
}

export function SettingsPage({ t, profile, onSaveProfile, onNavigate }) {
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
        <Analytics t={t} onNavigate={onNavigate} />
        <YourData t={t} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export default SettingsPage;
