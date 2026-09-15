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

import { useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { Btn } from './UI';
import { SandboxLayout } from './SandboxLayout';
import { RoomBar } from './sandbox/RoomBar';
import { useRoom } from './sandbox/useRoom';
import { EXPERIMENTS, findExperiment } from '../sandbox/experiments';
import { roomIdFrom, roomPath } from '../sandbox/rooms';
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
        border: 'none', borderRadius: 14, padding: '26px 24px 24px', minHeight: 220,
        background: `linear-gradient(150deg, ${experiment.color} 0%, ${experiment.color}D9 100%)`,
        color: '#fff', display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: 'var(--placer-font)', boxShadow: t.shadow,
        transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-4px)';
        event.currentTarget.style.boxShadow = '0 16px 36px rgba(0,0,0,0.18)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.boxShadow = t.shadow;
      }}>
      {/* The experiment's own mark, oversized and half out of frame. */}
      <span aria-hidden="true" style={{ position: 'absolute', right: -18, bottom: -22, opacity: 0.22 }}>
        <Icon name={experiment.icon} size={150} stroke={1.4} />
      </span>

      <Icon name={experiment.icon} size={30} stroke={2.1} />
      <span className="placer-disp" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15, position: 'relative' }}>
        {experiment.name}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.92, lineHeight: 1.45, position: 'relative', maxWidth: 320 }}>
        {experiment.tagline}
      </span>
      <div style={{ flex: 1 }} />
      <span className="placer-mono" style={{ fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        Open <Icon name="arrowRight" size={14} stroke={2.4} />
      </span>
    </button>
  );
}

/**
 * Offered on an experiment that can host a room, when there is a database to host it in
 * and somebody with an account to open it.
 */
function StartRoom({ t, experiment, onStart, busy }) {
  return (
    <Btn
      t={t}
      size="sm"
      icon="user"
      onClick={onStart}
      disabled={busy}
      style={{ background: experiment.color, color: '#fff' }}>
      {busy ? 'Opening…' : 'Start a room'}
    </Btn>
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

  const room = useRoom({
    experiment,
    roomId: roomIdFrom(search),
    // Whatever the person calls themselves, so a facilitator can see who has answered.
    // Passed in from App rather than read here: with accounts the name comes from a
    // request, and this is a render body. It is still a label rather than proof of
    // identity — a room is joined with its PIN, not with an account.
    displayName,
    onOpened: (id) => {
      posthog.capture('sandbox_room_opened', { experiment: experiment.id });
      navigate(roomPath(experiment.id, id));
    },
  });

  useEffect(() => {
    if (!experiment) return;
    posthog.capture('sandbox_experiment_opened', { experiment: experiment.id });
  }, [experiment]);

  const Experiment = experiment?.component;
  // Offered only where a room would mean something, and only with a database behind it.
  const roomIsPossible =
    Boolean(experiment?.room) && isSupabaseConfigured() && room.status === 'none';
  // Opening one also takes an account. Joining one does not — nothing on this page is
  // gated for a participant who arrived with a PIN or a QR code.
  const canStartRoom = roomIsPossible && !needsAccount;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {experiment && Experiment ? (
          <SandboxLayout
            t={t}
            experiment={experiment}
            onBack={() => navigate('/sandbox')}
            actions={canStartRoom ? (
              <StartRoom t={t} experiment={experiment} onStart={room.start} busy={room.status === 'opening'} />
            ) : roomIsPossible ? (
              <StartRoomSignedOut t={t} onSignIn={onSignIn} />
            ) : null}>
            <RoomBar t={t} experiment={experiment} room={room} />
            <Experiment t={t} experiment={experiment} room={room} />
          </SandboxLayout>
        ) : (
          <>
            <div style={{ marginBottom: 40 }}>
              <div className="placer-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDim, marginBottom: 14 }}>
                <Icon name="flask" size={15} stroke={2.1} />
                Experiments
              </div>
              <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, color: t.ink,
                letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.05 }}>
                Sandbox
              </h1>
              <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, maxWidth: 680 }}>
                Small tools for the arguments participatory design keeps having. Each one takes a few
                seconds to understand and makes one point that is hard to make with a drawing. Nothing
                here is a proposal — it is somewhere to find out what you think. Nothing is saved
                either, unless you open a room for other people to join, and a room lasts until you
                close it. Opening one takes an account; joining one never does.
              </p>
            </div>

            {missing && (
              <p role="status" style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 10,
                background: t.surfaceAlt, border: `1px solid ${t.line}`, fontSize: 14, color: t.ink }}>
                There is no experiment called <span className="placer-mono">{missing}</span>. Here is everything there is.
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {EXPERIMENTS.map((entry) => (
                <Tile key={entry.id} t={t} experiment={entry} onOpen={() => navigate(`/sandbox/${entry.id}`)} />
              ))}
            </div>

            <p style={{ marginTop: 32, fontSize: 13.5, color: t.inkFaint, lineHeight: 1.65, maxWidth: 680 }}>
              The figures behind these are deliberately rough — calibrated so the trade-offs behave the
              way real ones do, not so they can size a real scheme.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default SandboxPage;
