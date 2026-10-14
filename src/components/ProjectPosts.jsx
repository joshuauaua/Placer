/* PLACER — a project's updates and comments, as its public page's tabs show them.
 *
 * One list for both, newest first, with a box to write in above it for whoever may
 * post: updates from the project's organisers (`canPost`), comments from anybody
 * signed in. A post can be removed by whoever may remove it (`canRemove`);
 * the database decides in the end (supabase/project-public-page.sql), this only
 * decides what to offer.
 */

import { useState } from 'react';
import { Avatar, Btn } from './UI';

const POSTED_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function postedOn(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : POSTED_FORMAT.format(date);
}

function Composer({ t, id, label, placeholder, submitLabel, max, onPost }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const send = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onPost(body);
      setBody('');
    } catch (err) {
      console.error(err);
      setError('That did not go through. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={send} style={{ marginBottom: 24 }}>
      <label htmlFor={id} className="placer-label" style={{ display: 'block', color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      <textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} maxLength={max} rows={3}
        placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, resize: 'vertical',
          border: `1px solid ${t.lineStrong}`, fontFamily: 'var(--placer-font)', fontSize: 15, lineHeight: 1.5,
          color: t.ink, background: t.surface }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        {error && <p role="alert" style={{ fontSize: 14, color: t.ink, marginRight: 'auto' }}>{error}</p>}
        <Btn t={t} type="submit" size="sm" icon="send" disabled={sending || !body.trim()}>
          {sending ? 'Posting…' : submitLabel}
        </Btn>
      </div>
    </form>
  );
}

/**
 * `kind` is 'update' or 'comment', for the words. `posts` are from services/projectPage.js.
 * Without `canPost` there is no box, and `prompt` (a way to sign in, say) is shown
 * in its place.
 */
export function ProjectPosts({ t, kind, posts, status, canPost, prompt = null, max, onPost, canRemove, onRemove,
  onOpenProfile }) {
  const update = kind === 'update';
  const [removing, setRemoving] = useState(null);

  const remove = async (post) => {
    setRemoving(post.id);
    try {
      await onRemove(post);
    } catch (err) {
      console.error(err);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div>
      {canPost ? (
        <Composer t={t} id={`project-${kind}-body`} max={max} onPost={onPost}
          label={update ? 'Post an update' : 'Add a comment'}
          placeholder={update ? 'What is new with the project?' : 'Say what you think'}
          submitLabel={update ? 'Post update' : 'Comment'} />
      ) : prompt}

      {status === 'loading' && <p style={{ fontSize: 15, color: t.inkDim }}>Loading…</p>}
      {status === 'error' && (
        <p role="alert" style={{ fontSize: 15, color: t.inkDim }}>
          {update ? 'Updates' : 'Comments'} could not be loaded. Try again in a moment.
        </p>
      )}
      {status === 'ready' && posts.length === 0 && (
        <div className="placer-card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, color: t.inkDim }}>
            {update ? 'No updates yet.' : 'No comments yet. Be the first to say something.'}
          </p>
        </div>
      )}
      {status === 'ready' && posts.length > 0 && (
        <ul aria-label={update ? 'Updates' : 'Comments'} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {posts.map((post) => (
            <li key={post.id} style={{ display: 'flex', gap: 14, padding: '18px 0', borderTop: `1px solid ${t.line}` }}>
              <Avatar name={post.authorName} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  {post.authorId && onOpenProfile ? (
                    <a href={`/people/${post.authorId}`}
                      onClick={(e) => { e.preventDefault(); onOpenProfile(post.authorId); }}
                      style={{ fontSize: 15, fontWeight: 700, color: t.ink, textDecoration: 'none' }}>
                      {post.authorName}
                    </a>
                  ) : <span style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{post.authorName}</span>}
                  <span className="placer-caption" style={{ color: t.inkDim }}>{postedOn(post.createdAt)}</span>
                  {canRemove(post) && (
                    <button type="button" onClick={() => remove(post)} disabled={removing === post.id}
                      aria-label={`Remove ${update ? 'update' : 'comment'} by ${post.authorName}`}
                      style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                        fontFamily: 'var(--placer-font)', fontSize: 13, color: t.inkDim, textDecoration: 'underline' }}>
                      Remove
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: t.ink, whiteSpace: 'pre-line',
                  overflowWrap: 'anywhere' }}>
                  {post.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProjectPosts;
