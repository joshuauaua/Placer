/* PLACER — preview card for an imagination picked off the map or a profile: the
 * picture, the description, a vote, and the comments underneath it. */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Btn, CatTag } from './UI';
import {
  postComment, postsAreShared, readComments, readMyVote, removeImagination, voteImagination,
} from '../services/imaginations';
import { DEFAULT_NAME } from '../services/profile';

// ISO slice rather than toLocaleDateString, so a comment's date does not shift with
// the machine's locale — the same choice AdminImaginations makes for createdAt.
const formatCommentDate = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

const voteWeight = (direction) => (direction === 'up' ? 1 : direction === 'down' ? -1 : 0);

function VoteControl({ t, score, myVote, disabled, onVote }) {
  const buttonStyle = (active) => ({
    width: 30, height: 30, borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
    border: `1.5px solid ${active ? t.accent : t.line}`,
    background: active ? t.surfaceAlt : 'transparent',
    color: active ? t.ink : t.inkDim,
    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={() => onVote('up')}
        disabled={disabled}
        aria-label="Vote up"
        aria-pressed={myVote === 'up'}
        style={buttonStyle(myVote === 'up')}>
        <Icon name="arrowUp" size={16} stroke={2.4} />
      </button>
      <span className="placer-disp" style={{ fontSize: 17, fontWeight: 700, color: t.ink,
        minWidth: 22, textAlign: 'center' }}>
        {score}
      </span>
      <button
        type="button"
        onClick={() => onVote('down')}
        disabled={disabled}
        aria-label="Vote down"
        aria-pressed={myVote === 'down'}
        style={buttonStyle(myVote === 'down')}>
        <Icon name="arrowDown" size={16} stroke={2.4} />
      </button>
    </div>
  );
}

function CommentRow({ t, comment }) {
  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${t.line}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{comment.author || 'Anonymous'}</span>
        {comment.createdAt && (
          <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>
            {formatCommentDate(comment.createdAt)}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
        {comment.text}
      </p>
    </div>
  );
}

/**
 * The author's way to take an imagination down, with its picture. Asks once first —
 * the same two-step closing a Toolkit room uses — because there is no undo, and the
 * votes and comments on it go too.
 */
function DeleteImagination({ t, imagination, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    if (!confirming) { setConfirming(true); return; }

    setDeleting(true);
    setError(null);
    try {
      await removeImagination(imagination.id, { local: imagination.shared === false });
      onDeleted?.(imagination.id);
    } catch (err) {
      console.error('Could not delete this imagination:', err);
      setError('Could not delete this imagination. Try again.');
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <Btn t={t} variant="quiet" size="sm" icon="trash" onClick={handleClick} disabled={deleting}
        onBlur={() => setConfirming(false)}
        style={confirming ? { borderColor: '#B3261E', color: '#B3261E' } : undefined}>
        {deleting ? 'Deleting…' : confirming ? 'Delete — confirm' : 'Delete'}
      </Btn>
      {error && (
        <div role="alert" style={{ fontSize: 12.5, color: '#B3261E', fontWeight: 500, marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function ImaginationPreview({ t, imagination, onClose, accountId = null,
  authorName = DEFAULT_NAME, onSignIn, onDeleted }) {
  const {
    id,
    title,
    cat,
    blurb,
    loc,
    preview,
    author,
    canvasAssets = [],
  } = imagination;

  // Voting and commenting need an account only once posting is shared with everybody
  // else — the same gate PostPage puts on posting an imagination in the first place.
  // With no project configured there is always an account of a kind, the browser
  // itself, so nothing here is ever gated in that world.
  const canInteract = !postsAreShared() || !!accountId;

  // Only its author may delete it — the delete policy on public.imaginations says the
  // same. One still only in this browser is this browser's to delete.
  const canDelete = imagination.shared === false || (!!accountId && imagination.userId === accountId);

  const [score, setScore] = useState(imagination.upvotes ?? 0);
  const [myVote, setMyVote] = useState(null);
  const [voteBusy, setVoteBusy] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsStatus, setCommentsStatus] = useState('loading'); // loading | ready | error
  const [commentDraft, setCommentDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState(null);

  // Reloads whenever the modal is pointed at a different imagination — MapContainer
  // and DashboardPage both swap `imagination` on this same open instance rather than
  // remounting it, so a stale thread or vote from the last one opened must not linger.
  useEffect(() => {
    let cancelled = false;
    setScore(imagination.upvotes ?? 0);
    setMyVote(null);
    setCommentDraft('');
    setCommentError(null);
    setCommentsStatus('loading');

    Promise.all([readComments(id), readMyVote(id, { accountId })])
      .then(([loadedComments, vote]) => {
        if (cancelled) return;
        setComments(loadedComments);
        setMyVote(vote);
        setCommentsStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load comments:', err);
        setCommentsStatus('error');
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imagination.upvotes only
    // seeds the initial score; refetching this effect when it moves (which voting
    // itself causes) would fight the optimistic update below.
  }, [id, accountId]);

  const handleVote = async (direction) => {
    if (!canInteract || voteBusy) return;

    const previousScore = score;
    const previousVote = myVote;
    const nextVote = myVote === direction ? null : direction;

    // Optimistic: a vote should feel instant, and the request below corrects this
    // if it turns out to be wrong.
    setScore(previousScore - voteWeight(previousVote) + voteWeight(nextVote));
    setMyVote(nextVote);
    setVoteBusy(true);

    try {
      const result = await voteImagination(id, direction, { accountId });
      if (result) {
        setScore(result.upvotes);
        setMyVote(result.myVote);
      }
    } catch (err) {
      console.error('Could not register your vote:', err);
      setScore(previousScore);
      setMyVote(previousVote);
    } finally {
      setVoteBusy(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!canInteract || commentBusy || !commentDraft.trim()) return;

    setCommentBusy(true);
    setCommentError(null);

    try {
      const saved = await postComment(id, { authorName, accountId, text: commentDraft });
      setComments((current) => [...current, saved]);
      setCommentDraft('');
    } catch (err) {
      console.error('Could not post your comment:', err);
      setCommentError('Could not post your comment. Try again.');
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    // A true modal: a full-viewport backdrop above everything else, so this reads the
    // same whether it was opened from a map pin or a card in Profile. Clicking the
    // backdrop closes it; clicking the card itself must not, so that click is stopped
    // from bubbling up to the backdrop's own handler.
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(15,14,10,0.55)' }}>
      <div
        role="dialog"
        aria-label={`Imagination: ${title || 'Untitled'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto',
          background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
          boxShadow: t.shadow, color: t.ink }}
        className="placer-scroll">
        <div style={{ position: 'relative' }}>
          {preview && (
            <img
              src={preview}
              alt={`Preview of ${title || 'this imagination'}`}
              style={{ width: '100%', display: 'block', borderRadius: '12px 12px 0 0' }}
            />
          )}
          <button
            onClick={onClose}
            aria-label="Close preview"
            style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              // Legible whether it lands on the image or on the card itself.
              background: 'rgba(22,21,15,0.62)', color: '#FFFFFF' }}>
            <Icon name="close" size={17} stroke={2.4} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              {cat && <div style={{ marginBottom: 10 }}><CatTag cat={cat} t={t} size="sm" /></div>}

              <h2 className="placer-disp" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
                lineHeight: 1.25, marginBottom: blurb ? 8 : 0 }}>
                {title || 'Untitled imagination'}
              </h2>
            </div>

            <VoteControl t={t} score={score} myVote={myVote} disabled={!canInteract || voteBusy}
              onVote={handleVote} />
          </div>

          {blurb && (
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.55, marginBottom: 12,
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {blurb}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 12,
            borderTop: `1px solid ${t.line}`, fontSize: 12.5, color: t.inkDim, fontWeight: 500 }}>
            {loc && <div>{loc}</div>}
            <div>
              <span className="placer-disp" style={{ color: t.ink, fontWeight: 700 }}>{canvasAssets.length}</span> assets
              {author && <> <span style={{ margin: '0 6px', color: t.inkFaint }}>·</span> {author}</>}
            </div>
          </div>

          {canDelete && <DeleteImagination t={t} imagination={imagination} onDeleted={onDeleted} />}

          {!canInteract && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              marginTop: 14, padding: '10px 12px', background: t.surfaceAlt, borderRadius: 12,
              fontSize: 13, color: t.inkDim }}>
              <span>Sign in to vote or comment.</span>
              {onSignIn && <Btn t={t} variant="outline" size="sm" onClick={onSignIn}>Sign in</Btn>}
            </div>
          )}

          <h3 className="placer-disp" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
            color: t.ink, marginTop: 18, marginBottom: 2 }}>
            Comments{commentsStatus === 'ready' && comments.length > 0 ? ` · ${comments.length}` : ''}
          </h3>

          {commentsStatus === 'loading' && (
            <p style={{ fontSize: 13, color: t.inkDim, marginTop: 8 }}>Loading comments…</p>
          )}
          {commentsStatus === 'error' && (
            <p role="alert" style={{ fontSize: 13, color: t.inkDim, marginTop: 8 }}>
              Could not load the comments.
            </p>
          )}
          {commentsStatus === 'ready' && comments.length === 0 && (
            <p style={{ fontSize: 13, color: t.inkFaint, marginTop: 8 }}>
              No comments yet. Be the first to say something.
            </p>
          )}
          {commentsStatus === 'ready' && comments.map((comment) => (
            <CommentRow key={comment.id} t={t} comment={comment} />
          ))}

          {canInteract && (
            <form onSubmit={handleAddComment} style={{ marginTop: 12, display: 'flex',
              flexDirection: 'column', gap: 8 }}>
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                aria-label="Add a comment"
                style={{ width: '100%', resize: 'vertical', padding: '8px 10px', borderRadius: 12,
                  border: `1.5px solid ${t.line}`, fontFamily: 'var(--placer-font)', fontSize: 13.5,
                  color: t.ink, background: t.surface }}
              />
              {commentError && (
                <div role="alert" style={{ fontSize: 12.5, color: '#B3261E', fontWeight: 500 }}>
                  {commentError}
                </div>
              )}
              <Btn t={t} variant="primary" size="sm" icon="send" type="submit"
                disabled={commentBusy || !commentDraft.trim()}>
                {commentBusy ? 'Posting…' : 'Comment'}
              </Btn>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImaginationPreview;
