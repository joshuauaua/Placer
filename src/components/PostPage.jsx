/* PLACER — Step 3: review and post the imagination */

import { useState } from 'react';
import { Btn, CatTag } from './UI';
import { FlowScreen } from './FlowLayout';
import { AuthForm } from './AuthPage';
import { postImagination, postsAreShared } from '../services/imaginations';
import { DEFAULT_NAME } from '../services/profile';
import posthog from 'posthog-js';

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
 * the capture, the assets, the lines, the description — lives in MainApp's state, and
 * sending somebody to /signin and back would be the one thing this screen must not do.
 * Signing in with a password happens here without the page moving at all.
 *
 * The other two ways in cannot be kept on the page: Google redirects, and a confirmation
 * link is opened from a mail client. onLeaving is what parks the imagination before
 * either of those happens, so it is still here on the way back.
 */
function SignInToPost({ t, mode, onModeChange, onLeaving }) {
  const [awaiting, setAwaiting] = useState(null);

  return (
    <section style={{ marginTop: 32, padding: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <h2 className="placer-disp" style={{ fontSize: 20, fontWeight: 700, color: t.ink,
        letterSpacing: '-0.02em', marginBottom: 8 }}>
        {awaiting ? 'Check your inbox' : 'Sign in to post this'}
      </h2>
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 22 }}>
        {awaiting
          ? 'Your imagination is saved on this device and will be waiting when you come back.'
          : 'A posted imagination belongs to an account, so it is yours wherever you sign in next. '
            + 'Nothing you have made is lost by signing in here.'}
      </p>
      <AuthForm
        t={t}
        mode={mode}
        onModeChange={onModeChange}
        onLeaving={onLeaving}
        onAwaitingConfirmation={setAwaiting}
        // Nothing to do on success: the account arrives through useIdentity, this panel
        // goes away, and the Post button takes its place.
        onSignedIn={() => {}}
      />
    </section>
  );
}

export function PostPage({ t, draft, preview, capturedView, canvasAssets = [],
  onBack, onPosted, authorName = DEFAULT_NAME, accountId = null,
  needsAccount = false, checkingAccount = false, onStashDraft, projectId = null }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'error'
  const [error, setError] = useState(null);
  const [authMode, setAuthMode] = useState('signin');

  const loc = formatLoc(capturedView?.position);
  // Whether posting means anything to anybody else. The button has always said "Post to
  // community"; this is the first version where that is true.
  const shared = postsAreShared();

  const handlePost = async () => {
    setStatus('saving');
    setError(null);
    try {
      await postImagination({
        title: draft.title,
        cat: draft.cat,
        blurb: draft.blurb,
        loc,
        author: authorName,
        userId: accountId,
        source: capturedView?.source ?? null,
        position: capturedView?.position ?? null,
        pov: capturedView?.pov ?? null,
        fov: capturedView?.fov ?? null,
        canvasAssets,
        preview: preview ?? capturedView?.screenshot ?? null,
        projectId,
      });
      posthog.capture('imagination_posted', {
        category: draft.cat,
        assets_count: canvasAssets.length,
        source: capturedView?.source ?? null,
      });
      onPosted();
    } catch (err) {
      console.error('Could not post imagination:', err);
      posthog.capture('imagination_post_failed', {
        error_name: err?.name ?? 'unknown',
      });
      setError(
        // Only reachable on the localStorage path, where every record carries its own
        // preview image against a budget of a few megabytes.
        err?.name === 'QuotaExceededError'
          ? 'Out of local storage space. Delete an older imagination and try again.'
          : shared
            ? 'Could not post your imagination. Check your connection and try again.'
            : 'Could not save your imagination. See the console for details.'
      );
      setStatus('error');
    }
  };

  return (
    <FlowScreen
      t={t}
      step={3}
      onBack={onBack}
      backLabel="Back to describe"
      actions={
        needsAccount ? (
          <span style={{ fontSize: 13.5, color: t.inkDim, fontWeight: 500 }}>
            Sign in below to post
          </span>
        ) : (
          <Btn t={t} variant="primary" size="sm" icon="share" onClick={handlePost}
            disabled={status === 'saving' || checkingAccount}>
            {status === 'saving' ? 'Posting…' : 'Post to community'}
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
              Ready to post
            </h1>
            <p style={{ fontSize: 17, color: t.inkDim, lineHeight: 1.6 }}>
              Have a last look. You can go back and change anything before posting.
            </p>
          </div>

          {(preview || capturedView?.screenshot) && (
            <img
              src={preview || capturedView.screenshot}
              alt="Your imagination"
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

          {needsAccount ? (
            <SignInToPost
              t={t}
              mode={authMode}
              onModeChange={setAuthMode}
              onLeaving={onStashDraft}
            />
          ) : (
            <div style={{ marginTop: 32, padding: 14, background: t.surfaceAlt, borderRadius: 12,
              fontSize: 13.5, color: t.inkDim, lineHeight: 1.55 }}>
              {shared ? (
                <>
                  Posting puts this on the community map, where anyone can see it, credited
                  to {authorName}. You can remove it again from your profile at any time.
                </>
              ) : (
                <>
                  Posting saves this imagination to your browser. Nothing is uploaded to a
                  server yet.
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </FlowScreen>
  );
}

export default PostPage;
