/* PLACER — Publish, on a tool's setup page: putting the tool out for people to use.
 *
 * What it does depends on the setup page's Live switch:
 *
 *   Live         the tool opens now, as a room run with a group, and stays open until
 *                its facilitator ends the session (Close room, in the room) — or, at
 *                the very latest, after twelve hours (LIVE_SESSION_LIFETIME,
 *                supabase/rooms-live-session.sql). Publishing takes this browser
 *                straight into the room as its facilitator.
 *   Self-paced   the tool opens now at its link and on its project's page, for people
 *                to fill in in their own time, for as long as is picked here: a week,
 *                30 or 90 days (ROOM_LIFETIMES, past the workshop's two hours). It can
 *                be closed sooner from the project's dashboard.
 *
 * Each slide is a room of its own, with that slide's setup, so each has its own
 * results. Either way the room belongs to the tool's project, which it needs: a room
 * open for longer than a workshop has to belong to one, and a tool's results are
 * kept for its project (supabase/room-results.sql).
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn, Field, inputStyle } from './UI';
import { createRoom } from '../services/rooms';
import { LIVE_SESSION_LIFETIME, ROOM_LIFETIMES, formatRoomDate, rememberHostedRoom } from '../toolkit/rooms';

/** How long a Self-paced tool can be left open for: anything past a workshop. */
export const SELF_PACED_LIFETIMES = ROOM_LIFETIMES.filter(({ id }) => id !== '2h');
export const DEFAULT_SELF_PACED_LIFETIME = '30d';
/** A live session's room: joined by its PIN, open until it is closed (12 hours at most). */
export const LIVE_LIFETIME = LIVE_SESSION_LIFETIME;

/**
 * What stands in the way of publishing, as a sentence, or null: an account to open a
 * room with, a project for it to belong to, and a setup on every slide the tool takes.
 */
export function publishProblem({ tool, slides, accountId, projectId }) {
  if (!tool?.room) return `${tool?.name ?? 'This tool'} cannot be published yet.`;
  if (!accountId) return 'Sign in to publish.';
  if (!projectId) return 'Add this tool to a project to publish it.';
  const index = slides.findIndex((slide) => (tool.setup?.problems(slide.setup ?? tool.setup.defaults()) ?? []).length > 0);
  if (index >= 0) {
    return slides.length > 1
      ? `Slide ${index + 1} is not finished: ${tool.setup.problems(slides[index].setup ?? tool.setup.defaults())[0]}`
      : `It is not finished: ${tool.setup.problems(slides[index].setup ?? tool.setup.defaults())[0]}`;
  }
  return null;
}

export function PublishToolDialog({ t, tool, name, slides, live, accountId, projectId, projectName,
  onClose, onGoLive, onOpenProject }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const [lifetime, setLifetime] = useState(DEFAULT_SELF_PACED_LIFETIME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // The rooms opened, once a Self-paced tool is published.
  const [published, setPublished] = useState(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const problem = publishProblem({ tool, slides, accountId, projectId });
  const title = name?.trim() || tool.name;
  const several = slides.length > 1;

  const publish = async (e) => {
    e.preventDefault();
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    try {
      const rooms = [];
      for (const slide of slides) {
        const opened = await createRoom(tool.id, projectId, live ? LIVE_LIFETIME : lifetime,
          slide.setup ?? tool.setup?.defaults() ?? null);
        // This browser runs the room as its facilitator, from here on.
        rememberHostedRoom(opened.id, { pin: opened.pin, token: opened.facilitatorToken, code: opened.joinCode ?? null });
        rooms.push(opened);
      }
      if (live) {
        onGoLive(rooms[0]);
        return;
      }
      setPublished(rooms);
      setBusy(false);
    } catch (err) {
      console.error(`Could not publish ${tool.name}:`, err);
      setError(err?.message ?? `Could not publish ${tool.name}.`);
      setBusy(false);
    }
  };

  let body;
  let actions;
  if (published) {
    const closes = formatRoomDate(published[0]?.expiresAt);
    body = (
      <p style={{ fontSize: 15, color: t.ink, lineHeight: 1.6, margin: 0 }}>
        <strong>{title}</strong> is open{projectName ? <> on {projectName}&rsquo;s page</> : null}
        {closes ? <> until {closes}</> : null}. People can fill it in in their own time;
        its results fill in on the project&rsquo;s dashboard, under My Toolkit.
      </p>
    );
    actions = (
      <>
        <Btn t={t} type="button" variant="ghost" onClick={onClose}>Done</Btn>
        <Btn t={t} type="button" icon="arrowRight" onClick={onOpenProject}>Go to the project</Btn>
      </>
    );
  } else {
    body = (
      <>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
          color: t.inkDim, margin: '0 0 12px' }}>
          <Icon name={live ? 'user' : 'link'} size={16} stroke={2} />
          {live ? 'Live, with a group' : 'Self-paced, by link'}
        </p>
        {live ? (
          <p style={{ fontSize: 15, color: t.ink, lineHeight: 1.6, margin: 0 }}>
            <strong>{title}</strong> goes live now, and people join with its PIN or QR code.
            It stays open until you end the session with <strong>Close room</strong>{' '}
            &mdash; or after 12 hours at the latest.
            {several && ' Each slide opens as a room of its own.'}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 15, color: t.ink, lineHeight: 1.6, margin: '0 0 18px' }}>
              <strong>{title}</strong> opens now, at its link and on the project&rsquo;s page, for people
              to fill in in their own time.{several && ' Each slide opens as a room of its own.'}
            </p>
            <Field t={t} spacing={0} label="Live for" htmlFor="publish-lifetime"
              hint="How long people can take part. You can close it sooner from the project's dashboard.">
              <select id="publish-lifetime" value={lifetime} onChange={(e) => setLifetime(e.target.value)}
                disabled={busy} style={{ ...inputStyle(t), width: 'auto' }}>
                {SELF_PACED_LIFETIMES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </Field>
          </>
        )}
        {problem && (
          <p role="status" style={{ marginTop: 14, fontSize: 14, color: t.inkDim }}>{problem}</p>
        )}
      </>
    );
    actions = (
      <>
        <Btn t={t} type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn t={t} type="submit" icon={live ? 'play' : 'send'} disabled={busy || Boolean(problem)}>
          {busy ? 'Publishing…' : live ? 'Go live' : 'Publish'}
        </Btn>
      </>
    );
  }

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onSubmit={publish} noValidate
        style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', background: t.surface,
          borderRadius: 16, boxShadow: t.shadow, outline: 'none', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '16px 20px', borderBottom: `1px solid ${t.line}` }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.ink }}>
            {published ? 'Published' : `Publish ${title}`}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            style={{ border: 0, background: 'transparent', color: t.ink, cursor: 'pointer', padding: 4, display: 'flex' }}>
            <Icon name="close" size={20} stroke={2} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          {body}
          {error && <p role="alert" style={{ marginTop: 12, fontSize: 14, color: '#B3261E' }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '14px 20px',
          borderTop: `1px solid ${t.line}` }}>
          {actions}
        </div>
      </form>
    </div>
  );
}

export default PublishToolDialog;
