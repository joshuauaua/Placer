/* PLACER — a project's updates and comments, as its public page's tabs show them.
 *
 * One list for both, newest first, with a box to write in above it for whoever may
 * post: updates from the project's organisers (`canPost`), comments from anybody
 * signed in. A post can be removed by whoever may remove it (`canRemove`);
 * the database decides in the end (supabase/project-public-page.sql), this only
 * decides what to offer.
 *
 * An organiser of a project run for an organisation chooses, above the box, whether
 * to post as the organisation or as themselves (`postAs`); a post made as the
 * organisation shows its name and picture and links to it.
 *
 * Under each post are the replies to it, oldest first (supabase/project-replies.sql),
 * and for anybody who may reply (`canReply`) a Reply button that opens a box of its
 * own. One level only: a reply is to the post, not to another reply.
 */

import { useState } from 'react';
import { Avatar, Btn } from './UI';

const POSTED_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function postedOn(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : POSTED_FORMAT.format(date);
}

/** The two names an organiser can post under, as a pair of choices with their pictures. */
function PostAs({ t, id, postAs, asOrganisation, onChange }) {
  const options = [
    { key: 'organisation', label: postAs.organisation.name, photo: postAs.organisation.photo, role: 'Organisation' },
    { key: 'me', label: postAs.me.name, photo: postAs.me.photo, role: 'Yourself' },
  ];
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
      <legend className="placer-label" style={{ color: t.ink, marginBottom: 8 }}>Post as</legend>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map((option) => {
          const chosen = (option.key === 'organisation') === asOrganisation;
          return (
            <label key={option.key} className="placer-post-as"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px 6px 6px',
                borderRadius: 999, cursor: 'pointer', fontSize: 14, color: t.ink,
                border: `1.5px solid ${chosen ? t.ink : t.lineStrong}`, background: chosen ? t.surfaceAlt : t.surface }}>
              <input type="radio" name={`${id}-as`} value={option.key} checked={chosen}
                onChange={() => onChange(option.key === 'organisation')} className="placer-visually-hidden" />
              <Avatar name={option.label} photo={option.photo} size={28} />
              <span>
                <span style={{ display: 'block', fontWeight: 700, lineHeight: 1.2 }}>{option.label}</span>
                <span className="placer-caption" style={{ display: 'block', color: t.inkDim }}>{option.role}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Composer({
  t, id, label, placeholder, submitLabel, max, onPost, postAs, organisationFirst, rows = 3, onCancel = null,
  autoFocus = false, style = { marginBottom: 24 },
}) {
  const [body, setBody] = useState('');
  const [asOrganisation, setAsOrganisation] = useState(organisationFirst);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const send = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onPost(body, postAs && asOrganisation ? postAs.organisation.id : null);
      setBody('');
    } catch (err) {
      console.error(err);
      setError('That did not go through. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={send} style={style}>
      {postAs && <PostAs t={t} id={id} postAs={postAs} asOrganisation={asOrganisation} onChange={setAsOrganisation} />}
      <label htmlFor={id} className="placer-label" style={{ display: 'block', color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      <textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} maxLength={max} rows={rows}
        placeholder={placeholder} autoFocus={autoFocus}
        style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, resize: 'vertical',
          border: `1px solid ${t.lineStrong}`, fontFamily: 'var(--placer-font)', fontSize: 15, lineHeight: 1.5,
          color: t.ink, background: t.surface }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        {error && <p role="alert" style={{ fontSize: 14, color: t.ink, marginRight: 'auto' }}>{error}</p>}
        {onCancel && (
          <Btn t={t} type="button" size="sm" variant="ghost" onClick={onCancel} disabled={sending}>Cancel</Btn>
        )}
        <Btn t={t} type="submit" size="sm" icon="send" disabled={sending || !body.trim()}>
          {sending ? 'Posting…' : submitLabel}
        </Btn>
      </div>
    </form>
  );
}

/**
 * One post or reply: who wrote it, when, a Remove for whoever may, and what it says.
 * A reply is drawn smaller. `children` go under the text — a post's replies.
 */
function Entry({ t, post, small = false, what, canRemove, removing, onRemove, onOpenProfile, onOpenOrganisation,
  organisation, children }) {
  const asOrganisation = Boolean(post.organisationId);
  const nameStyle = { fontSize: small ? 14 : 15, fontWeight: 700, color: t.ink, textDecoration: 'none' };
  return (
    <div style={{ display: 'flex', gap: small ? 10 : 14 }}>
      <Avatar name={post.authorName} size={small ? 30 : 40}
        photo={asOrganisation
          ? (organisation?.id === post.organisationId ? organisation.photo : null)
          : post.authorPhoto} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          {asOrganisation ? (
            onOpenOrganisation ? (
              <a href={`/organisations/${post.organisationId}`}
                onClick={(e) => { e.preventDefault(); onOpenOrganisation(post.organisationId); }} style={nameStyle}>
                {post.authorName}
              </a>
            ) : <span style={nameStyle}>{post.authorName}</span>
          ) : post.authorId && onOpenProfile ? (
            <a href={`/people/${post.authorId}`}
              onClick={(e) => { e.preventDefault(); onOpenProfile(post.authorId); }} style={nameStyle}>
              {post.authorName}
            </a>
          ) : <span style={nameStyle}>{post.authorName}</span>}
          <span className="placer-caption" style={{ color: t.inkDim }}>{postedOn(post.createdAt)}</span>
          {canRemove && (
            <button type="button" onClick={() => onRemove(post)} disabled={removing}
              aria-label={`Remove ${what} by ${post.authorName}`}
              style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'var(--placer-font)', fontSize: 13, color: t.inkDim, textDecoration: 'underline' }}>
              Remove
            </button>
          )}
        </div>
        <p style={{ fontSize: small ? 14.5 : 15.5, lineHeight: 1.6, color: t.ink, whiteSpace: 'pre-line',
          overflowWrap: 'anywhere' }}>
          {post.body}
        </p>
        {children}
      </div>
    </div>
  );
}

const linkButton = (t) => ({
  border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--placer-font)',
  fontSize: 13.5, fontWeight: 700, color: t.inkDim,
});

/**
 * `kind` is 'update' or 'comment', for the words. `posts` are from services/projectPage.js.
 * Without `canPost` there is no box, and `prompt` (a way to sign in, say) is shown
 * in its place.
 *
 * `replies` are every reply on the project (services/projectPage.js's readReplies);
 * each post shows the ones to it. Without `canReply` there is no Reply button, unless
 * `onReplySignIn` is given, which a Reply button then calls instead (to sign in).
 */
export function ProjectPosts({ t, kind, posts, status, canPost, prompt = null, max, onPost, canRemove, onRemove,
  onOpenProfile, onOpenOrganisation, postAs = null, organisation = null, replies = [], canReply = false,
  replyMax = max, onReply, onReplySignIn = null, canRemoveReply = () => false, onRemoveReply }) {
  const update = kind === 'update';
  const [removing, setRemoving] = useState(null);
  // The post whose reply box is open, by id; one at a time.
  const [replyingTo, setReplyingTo] = useState(null);

  const run = (action) => async (post) => {
    setRemoving(post.id);
    try {
      await action(post);
    } catch (err) {
      console.error(err);
    } finally {
      setRemoving(null);
    }
  };
  const remove = run(onRemove);
  const removeReply = run((reply) => onRemoveReply(reply));

  const repliesTo = (post) => replies.filter((reply) =>
    (update ? reply.updateId : reply.commentId) === post.id);

  return (
    <div>
      {canPost ? (
        <Composer t={t} id={`project-${kind}-body`} max={max} onPost={onPost} postAs={postAs}
          organisationFirst={update}
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
          {posts.map((post) => {
            const answers = repliesTo(post);
            const open = replyingTo === post.id;
            return (
              <li key={post.id} style={{ padding: '18px 0', borderTop: `1px solid ${t.line}` }}>
                <Entry t={t} post={post} what={update ? 'update' : 'comment'} canRemove={canRemove(post)}
                  removing={removing === post.id} onRemove={remove} onOpenProfile={onOpenProfile}
                  onOpenOrganisation={onOpenOrganisation} organisation={organisation}>
                  {(canReply || onReplySignIn) && !open && (
                    <button type="button" style={{ ...linkButton(t), marginTop: 8 }}
                      aria-label={`Reply to ${update ? 'update' : 'comment'} by ${post.authorName}`}
                      onClick={() => (canReply ? setReplyingTo(post.id) : onReplySignIn())}>
                      Reply
                    </button>
                  )}

                  {answers.length > 0 && (
                    <ul aria-label={`Replies to ${post.authorName}`}
                      style={{ listStyle: 'none', margin: '12px 0 0', padding: '0 0 0 14px',
                        borderLeft: `2px solid ${t.line}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {answers.map((reply) => (
                        <li key={reply.id}>
                          <Entry t={t} post={reply} small what="reply" canRemove={canRemoveReply(reply)}
                            removing={removing === reply.id} onRemove={removeReply} onOpenProfile={onOpenProfile}
                            onOpenOrganisation={onOpenOrganisation} organisation={organisation} />
                        </li>
                      ))}
                    </ul>
                  )}

                  {open && (
                    <Composer t={t} id={`project-${kind}-${post.id}-reply`} max={replyMax} postAs={postAs}
                      organisationFirst={false} rows={2} autoFocus style={{ marginTop: 12 }}
                      label={`Reply to ${post.authorName}`} placeholder="Write a reply" submitLabel="Reply"
                      onCancel={() => setReplyingTo(null)}
                      onPost={async (body, organisationId) => {
                        await onReply(post, body, organisationId);
                        setReplyingTo(null);
                      }} />
                  )}
                </Entry>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ProjectPosts;
