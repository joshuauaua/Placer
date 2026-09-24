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
import { SandboxLayout, Panel } from './SandboxLayout';
import { RoomBar } from './sandbox/RoomBar';
import { SandboxCover } from './sandbox/SandboxCover';
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

const isContributePath = (path) => /^\/sandbox\/contribute\/?$/.test(path);

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
      {experiment.submittedBy && (
        <span className="placer-mono" style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase', position: 'relative' }}>
          Submitted by {experiment.submittedBy}
        </span>
      )}
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
          fontWeight: 600, color: t.inkDim }}>
          Open for
          <select
            value={lifetime}
            onChange={(event) => setLifetime(event.target.value)}
            disabled={busy}
            style={{ height: 34, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${t.line}`,
              background: t.chrome, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 13.5,
              fontWeight: 600 }}>
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
        onClick={() => onStart(lifetime)}
        disabled={busy}
        style={{ background: experiment.color, color: '#fff' }}>
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

function ContributePage({ t, onBack }) {
  return (
    <>
      <div style={{ marginBottom: 40 }}>
        <div className="placer-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDim, marginBottom: 14 }}>
          <Icon name="flask" size={15} stroke={2.1} />
          Sandbox
        </div>
        <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, color: t.ink,
          letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.05 }}>
          Contribute
        </h1>
        <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, maxWidth: 680 }}>
          The Sandbox is open to new experiments. If you have an idea for a quick,
          interactive tool that explores a question about public space, here is how to
          build it and get it into the gallery.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>
        <Panel t={t} title="1. Clone and branch">
          <pre style={{ margin: 0, padding: 16, background: t.surfaceAlt, borderRadius: 8,
            fontSize: 13.5, lineHeight: 1.6, overflow: 'auto', fontFamily: 'var(--placer-font)',
            color: t.ink, border: `1px solid ${t.line}` }}>
{`git clone https://github.com/joshuauaua/Placer.git
cd Placer
git checkout -b my-experiment`}
          </pre>
        </Panel>

        <Panel t={t} title="2. Read the agent">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 12 }}>
            Open <code style={{ padding: '2px 6px', borderRadius: 4, background: t.surfaceAlt,
              fontSize: 13, color: t.ink, border: `1px solid ${t.line}` }}>sandboxagent.md</code> in
            the repo root. It explains the cover page every experiment opens on, the
            experiment registry, component structure, styling conventions, file layout,
            and scope rules.
          </p>
          <Btn t={t} size="sm" variant="outline" icon="arrowRight"
            onClick={() => window.open('https://github.com/joshuauaua/Placer/blob/Development/sandboxagent.md', '_blank')}>
            Open sandboxagent.md
          </Btn>
        </Panel>

        <Panel t={t} title="3. Create your experiment">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            Prompt your coding assistant with:{" "}
            <em>"Create a new sandbox experiment referencing sandboxagent.md for
            instructions"</em>, or follow the guide manually. Your experiment needs a
            registry entry, which also fills its cover page, a component, and a logic
            module.
          </p>
        </Panel>

        <Panel t={t} title="4. Test locally">
          <pre style={{ margin: 0, padding: 16, background: t.surfaceAlt, borderRadius: 8,
            fontSize: 13.5, lineHeight: 1.6, overflow: 'auto', fontFamily: 'var(--placer-font)',
            color: t.ink, border: `1px solid ${t.line}` }}>
{`npm run dev`}
          </pre>
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginTop: 12 }}>
            Visit <code style={{ padding: '2px 6px', borderRadius: 4, background: t.surfaceAlt,
              fontSize: 13, color: t.ink, border: `1px solid ${t.line}` }}>/sandbox/your-experiment</code> to
            see it in the gallery. Make sure it renders, responds to interaction, and
            passes the existing tests:
          </p>
          <pre style={{ margin: '12px 0 0', padding: 16, background: t.surfaceAlt, borderRadius: 8,
            fontSize: 13.5, lineHeight: 1.6, overflow: 'auto', fontFamily: 'var(--placer-font)',
            color: t.ink, border: `1px solid ${t.line}` }}>
{`npm run test:run`}
          </pre>
        </Panel>

        <Panel t={t} title="5. Open a pull request">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            Commit your changes, push to your branch, and open a PR against{" "}
            <code style={{ padding: '2px 6px', borderRadius: 4, background: t.surfaceAlt,
              fontSize: 13, color: t.ink, border: `1px solid ${t.line}` }}>Development</code>.
            The CI scope checker will verify your files stay within sandbox boundaries.
            Describe what the experiment explores and include a screenshot or GIF if
            the UI is visual.
          </p>
        </Panel>
      </div>

      <div style={{ marginTop: 32 }}>
        <Btn t={t} variant="ghost" icon="arrowLeft" onClick={onBack}>
          Back to Sandbox
        </Btn>
      </div>
    </>
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
        ) : isContributePath(location) ? (
          <ContributePage t={t} onBack={() => navigate('/sandbox')} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, gap: 20 }}>
              <div>
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
                  An experimental space for digital versions of placemaking and participatory
                  urban design tools and methods.
                </p>
              </div>
              <Btn t={t} variant="outline" icon="arrowRight"
                onClick={() => navigate('/sandbox/contribute')}>
                Contribute
              </Btn>
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

          </>
        )}
      </div>
    </div>
  );
}

export default SandboxPage;
