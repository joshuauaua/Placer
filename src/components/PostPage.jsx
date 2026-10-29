/* PLACER — Step 4: review the idea and keep it on your profile.
 *
 * Made with the Idea Visualizer on its own, an idea is saved as an inquiry on the
 * signed-in account's profile (services/inquiries.js), private to them, like any other
 * tool used on its own. Publishing it to the community map is for later.
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { Btn, CatTag } from './UI';
import { FlowScreen } from './FlowLayout';
import { AuthForm } from './AuthPage';
import { saveInquiry } from '../services/inquiries';
import { isSupabaseConfigured } from '../services/supabase';
import { ideaInquiryConfig } from '../lib/ideaVisualizer';
import posthog from 'posthog-js';

// The Toolkit tool this flow is (toolkit/tools/reimagine-a-space.js).
const TOOL_ID = 'reimagine-a-space';

// Human-readable stand-in until reverse geocoding exists; the raw coordinates are
// kept on the record separately.
function formatLoc(position) {
  if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return '';
  return `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
}

function Row({ t, label, children }) {
  return (
    <div style={{ display: 'flex', gap: 20, padding: '14px 0', borderTop: `1px solid ${t.line}` }}>
      <div className="placer-mono" style={{ width: 130, flex: '0 0 auto', fontSize: 11,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim, fontWeight: 500, paddingTop: 3 }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 15.5, color: t.ink, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

/**
 * The gate, for somebody who has reached the last step without an account.
 *
 * Deliberately inline rather than a redirect. Everything that has been made so far —
 * the capture, the assets, the lines, the description — lives in Idea Visualizer's
 * state, and sending somebody to /signin and back would be the one thing this screen
 * must not do. Signing in with a password happens here without the page moving at all.
 *
 * Signing up cannot be kept on the page: the confirmation link is opened from a mail
 * client. onLeaving is what parks the imagination before that happens, and `returnTo`
 * is the tool's own address, so the link comes back to it and finds the idea there.
 */
function SignInToSave({ t, mode, onModeChange, onLeaving, returnTo }) {
  const [awaiting, setAwaiting] = useState(null);

  return (
    <section style={{ marginTop: 32, padding: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <h2 className="placer-disp" style={{ fontSize: 20, fontWeight: 700, color: t.ink,
        letterSpacing: '-0.02em', marginBottom: 8 }}>
        {awaiting ? 'Check your inbox' : 'Sign in to save this'}
      </h2>
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 22 }}>
        {awaiting
          ? 'Your idea is kept on this device and will be waiting when you come back.'
          : 'A saved idea is kept on your profile, so it is yours wherever you sign in next. '
            + 'Nothing you have made is lost by signing in here.'}
      </p>
      <AuthForm
        t={t}
        mode={mode}
        onModeChange={onModeChange}
        onLeaving={onLeaving}
        returnTo={returnTo}
        onAwaitingConfirmation={setAwaiting}
        // Nothing to do on success: the account arrives through useIdentity, this panel
        // goes away, and the Save button takes its place.
        onSignedIn={() => {}}
      />
    </section>
  );
}

export function PostPage({ t, draft, preview, capturedView, canvasAssets = [],
  onBack, onPosted, accountId = null,
  needsAccount = false, checkingAccount = false, onStashDraft, returnTo, projectId = null }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [error, setError] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [, navigate] = useLocation();

  const loc = formatLoc(capturedView?.position);
  // With no Supabase project there are no accounts, and so no profile to keep it on.
  const canSave = isSupabaseConfigured();

  const handleSave = async () => {
    setStatus('saving');
    setError(null);
    try {
      await saveInquiry({
        tool: TOOL_ID,
        title: draft.title,
        note: draft.blurb ?? '',
        config: ideaInquiryConfig({ category: draft.cat, loc, capturedView, canvasAssets, projectId }),
        preview: preview ?? capturedView?.screenshot ?? null,
      });
      posthog.capture('idea_saved', {
        category: draft.cat,
        assets_count: canvasAssets.length,
        source: capturedView?.source ?? null,
      });
      setStatus('saved');
    } catch (err) {
      console.error('Could not save the idea:', err);
      posthog.capture('idea_save_failed', { error_name: err?.name ?? 'unknown' });
      setError('Could not save your idea. Check your connection and try again.');
      setStatus('error');
    }
  };

  return (
    <FlowScreen
      t={t}
      step={4}
      onBack={onBack}
      backLabel="Back to describe"
      actions={
        status === 'saved' ? (
          <Btn t={t} variant="primary" size="sm" icon="check" onClick={onPosted}>Done</Btn>
        ) : needsAccount ? (
          <span style={{ fontSize: 13.5, color: t.inkDim, fontWeight: 500 }}>
            Sign in below to save
          </span>
        ) : (
          <Btn t={t} variant="primary" size="sm" icon="bookmark" onClick={handleSave}
            disabled={!canSave || status === 'saving' || checkingAccount}>
            {status === 'saving' ? 'Saving…' : 'Save to my profile'}
          </Btn>
        )
      }
    >
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '40px 40px 96px' }}
        className="placer-scroll">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 36 }}>
            <h1 className="placer-disp" style={{ fontSize: 36, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
              {status === 'saved' ? 'Saved to your profile' : 'Ready to save'}
            </h1>
            <p style={{ fontSize: 17, color: t.inkDim, lineHeight: 1.6 }}>
              {status === 'saved'
                ? 'It is with your saved inquiries, where only you can see it.'
                : 'Have a last look. You can go back and change anything before saving.'}
            </p>
          </div>

          {(preview || capturedView?.screenshot) && (
            <img
              src={preview || capturedView.screenshot}
              alt="Your idea"
              style={{ width: '100%', borderRadius: 12, border: `1px solid ${t.line}`,
                boxShadow: t.shadow, marginBottom: 32, display: 'block' }}
            />
          )}

          <h2 className="placer-disp" style={{ fontSize: 26, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.2 }}>
            {draft.title}
          </h2>

          <Row t={t} label="Category"><CatTag cat={draft.cat} t={t} /></Row>
          <Row t={t} label="Description">{draft.blurb}</Row>
          <Row t={t} label="Location">
            {loc || <span style={{ color: t.inkDim }}>Not recorded</span>}
          </Row>
          <Row t={t} label="On the canvas">
            <span className="placer-disp" style={{ fontWeight: 700 }}>{canvasAssets.length}</span> assets placed
          </Row>

          {error && (
            <div role="alert" style={{ marginTop: 24, padding: 14, borderRadius: 12,
              background: '#F5F5F5', borderLeft: '4px solid #B3261E', fontSize: 14, color: t.ink, fontWeight: 500 }}>
              {error}
            </div>
          )}

          {status === 'saved' ? (
            accountId && (
              <p role="status" style={{ marginTop: 32, fontSize: 15, color: t.ink }}>
                <a href={`/people/${accountId}`} style={{ color: t.ink, fontWeight: 700 }}
                  onClick={(event) => { event.preventDefault(); onPosted(); navigate(`/people/${accountId}`); }}>
                  See your saved inquiries
                </a>
              </p>
            )
          ) : needsAccount ? (
            <SignInToSave
              t={t}
              mode={authMode}
              onModeChange={setAuthMode}
              onLeaving={onStashDraft}
              returnTo={returnTo}
            />
          ) : (
            <div style={{ marginTop: 32, padding: 14, background: t.surfaceAlt, borderRadius: 12,
              fontSize: 13.5, color: t.inkDim, lineHeight: 1.55 }}>
              {canSave
                ? 'Saving keeps this on your profile as an inquiry, where only you can see it. '
                  + 'You can delete it there at any time.'
                : 'Saving needs accounts, and this copy of PLACER has no Supabase project to keep them in.'}
            </div>
          )}
        </div>
      </div>
    </FlowScreen>
  );
}

export default PostPage;
