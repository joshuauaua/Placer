/* PLACER — Sandbox: a gallery of small experiments about participatory urban design.
 *
 * Each tile is a self-contained toy in the spirit of Chrome Music Lab: no sign-in,
 * nothing saved, and something moving within a second of arriving. The register of
 * experiments is src/sandbox/experiments.js.
 *
 * The exception to "nothing saved" is a room: an experiment whose register entry has
 * a `room` can be opened up to a roomful of people, who join it with a PIN or a QR
 * code and whose answers are held in Supabase until the facilitator closes it. This
 * page owns the room the way it owns the experiment — off the URL, in ?room= — and
 * hands it to the experiment as a prop.
 *
 * The page owns the /sandbox part of the URL itself rather than taking the selected
 * experiment as a prop, so every experiment has a link that can be shared.
 */

import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { Btn } from './UI';
import { SandboxLayout } from './SandboxLayout';
import { RoomBar } from './sandbox/RoomBar';
import { SandboxCover } from './sandbox/SandboxCover';
import { ContributeToolDialog } from './ContributeToolDialog';
import { useRoom } from './sandbox/useRoom';
import { EXPERIMENTS, findExperiment } from '../sandbox/experiments';
import { DEFAULT_LIFETIME, ROOM_LIFETIMES, projectIdFrom, roomIdFrom, roomPath } from '../sandbox/rooms';
import { isSupabaseConfigured } from '../services/rooms';

/** The experiment id in a path like /sandbox/street-mixer, if there is one. */
export function experimentIdFrom(path) {
  const match = /^\/sandbox\/([^/?#]+)/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function Tile({ t, experiment, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${experiment.color}`, borderRadius: 16, padding: 24, minHeight: 220,
        background: experiment.tint,
        color: t.ink, display: 'flex', flexDirection: 'column', gap: 8,
        fontFamily: 'var(--placer-font)', boxShadow: 'none',
        transition: 'box-shadow 0.2s' }}
      onMouseEnter={(event) => { event.currentTarget.style.boxShadow = t.shadow; }}
      onMouseLeave={(event) => { event.currentTarget.style.boxShadow = 'none'; }}>
      {/* The experiment's own mark, oversized and half out of frame. */}
      <span aria-hidden="true" style={{ position: 'absolute', right: -18, bottom: -22, opacity: 0.18 }}>
        <Icon name={experiment.icon} size={150} stroke={1.4} />
      </span>

      <Icon name={experiment.icon} size={30} stroke={2.1} />
      <span className="placer-h3" style={{ position: 'relative' }}>
        {experiment.name}
      </span>
      <span style={{ fontSize: 16, lineHeight: '24px', position: 'relative', maxWidth: 320 }}>
        {experiment.tagline}
      </span>
      {experiment.submittedBy && (
        <span className="placer-caption" style={{ color: t.inkDim, position: 'relative' }}>
          Submitted by {experiment.submittedBy}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span className="placer-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        Open <Icon name="arrowRight" size={14} stroke={2.4} />
      </span>
    </button>
  );
}

/**
 * Offered on an experiment that can host a room, when there is a database to host it in
 * and somebody with an account to open it.
 *
 * Opened from a project, the room can also be left running for weeks — a poll on a
 * poster rather than a workshop — so how long it stays open becomes a choice. Without a
 * project there is no choice to offer: a long room needs somebody who can find it again
 * and close it, and the database refuses one that has no project behind it
 * (supabase/rooms-lifetime.sql).
 */
function StartRoom({ t, experiment, onStart, busy, canStayOpen }) {
  const [lifetime, setLifetime] = useState(DEFAULT_LIFETIME);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {canStayOpen && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13,
          fontWeight: 500, color: t.inkDim }}>
          Open for
          <select
            value={lifetime}
            onChange={(event) => setLifetime(event.target.value)}
            disabled={busy}
            style={{ height: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
              background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14,
              fontWeight: 500 }}>
            {ROOM_LIFETIMES.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      )}
      <Btn
        t={t}
        size="sm"
        icon="user"
        variant="character"
        tone={experiment}
        onClick={() => onStart(lifetime)}
        disabled={busy}>
        {busy ? 'Opening…' : 'Start a room'}
      </Btn>
    </div>
  );
}

/**
 * What stands in for the button when nobody is signed in.
 *
 * Shown rather than hiding the control, because a feature that silently is not there
 * reads as a feature that is broken. Opening a room is the one thing in the Sandbox that
 * takes an account — it creates something other people join, and it is enforced in
 * supabase/rooms.sql, where sandbox_room_create is the only function the anon role may
 * not call. Joining a room needs nothing, which is the point: a participant scans a code
 * and starts, and being asked to make an account at that moment would cost the room the
 * people it was opened for.
 */
function StartRoomSignedOut({ t, onSignIn }) {
  return (
    <Btn t={t} size="sm" variant="outline" icon="user" onClick={onSignIn}>
      Sign in to start a room
    </Btn>
  );
}

export function SandboxPage({ t, displayName = null, needsAccount = false, onSignIn }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const requestedId = experimentIdFrom(location);
  const experiment = requestedId ? findExperiment(requestedId) : null;
  const missing = requestedId && !experiment ? requestedId : null;

  const projectId = projectIdFrom(search);

  const room = useRoom({
    experiment,
    roomId: roomIdFrom(search),
    // Whatever the person calls themselves, so a facilitator can see who has answered.
    // Passed in from App rather than read here: with accounts the name comes from a
    // request, and this is a render body. It is still a label rather than proof of
    // identity — a room is joined with its PIN, not with an account.
    displayName,
    // Only meaningful for a room being opened, not one being joined — see
    // projectIdFrom's own comment. A ProjectDashboardPage link is what sets this.
    projectId,
    onOpened: (id) => {
      posthog.capture('sandbox_room_opened', { experiment: experiment.id });
      navigate(roomPath(experiment.id, id));
    },
  });

  useEffect(() => {
    if (!experiment) return;
    posthog.capture('sandbox_experiment_opened', { experiment: experiment.id });
  }, [experiment]);

  // Which experiment has been started past its cover. An id rather than a flag, so
  // opening a different experiment lands on that one's cover rather than skipping it,
  // and opening a room (which only changes the query string) does not bring it back.
  const [startedId, setStartedId] = useState(null);

  // The Contribute button's pop-up form, for offering a tool to the PLACER Toolkit.
  const [contributing, setContributing] = useState(false);

  const Experiment = experiment?.component;
  // Offered only where a room would mean something, and only with a database behind it.
  const roomIsPossible =
    Boolean(experiment?.room) && isSupabaseConfigured() && room.status === 'none';
  // Opening one also takes an account. Joining one does not — nothing on this page is
  // gated for a participant who arrived with a PIN or a QR code.
  const canStartRoom = roomIsPossible && !needsAccount;

  // Every experiment opens on its cover, full-bleed rather than inside the padded
  // column the tool itself sits in.
  if (experiment && Experiment && startedId !== experiment.id) {
    return (
      <SandboxCover t={t} experiment={experiment}
        onStart={() => setStartedId(experiment.id)}
        onBack={() => navigate('/sandbox')} />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {experiment && Experiment ? (
          <SandboxLayout
            t={t}
            experiment={experiment}
            onBack={() => navigate('/sandbox')}
            actions={canStartRoom ? (
              <StartRoom t={t} experiment={experiment} onStart={room.start} busy={room.status === 'opening'}
                canStayOpen={Boolean(projectId)} />
            ) : roomIsPossible ? (
              <StartRoomSignedOut t={t} onSignIn={onSignIn} />
            ) : null}>
            <RoomBar t={t} experiment={experiment} room={room} />
            <Experiment t={t} experiment={experiment} room={room} />
          </SandboxLayout>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, gap: 20 }}>
              <div>
                <div className="placer-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5,
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDim, marginBottom: 14 }}>
                  <Icon name="flask" size={15} stroke={2.1} />
                  Experiments
                </div>
                <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
                  letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.05 }}>
                  Sandbox
                </h1>
                <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, maxWidth: 680 }}>
                  An experimental space for digital versions of placemaking and participatory
                  urban design tools and methods.
                </p>
              </div>
              <Btn t={t} variant="outline" icon="arrowRight"
                onClick={() => setContributing(true)}>
                Contribute
              </Btn>
            </div>

            {missing && (
              <p role="status" style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12,
                background: t.surfaceAlt, border: `1px solid ${t.line}`, fontSize: 14, color: t.ink }}>
                There is no experiment called <span className="placer-mono">{missing}</span>. Here is everything there is.
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {EXPERIMENTS.map((entry) => (
                <Tile key={entry.id} t={t} experiment={entry} onOpen={() => navigate(`/sandbox/${entry.id}`)} />
              ))}
            </div>

            {contributing && (
              <ContributeToolDialog t={t} onClose={() => setContributing(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SandboxPage;
