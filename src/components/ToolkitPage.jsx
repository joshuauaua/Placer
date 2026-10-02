/* PLACER — Toolkit: the participatory methods PLACER hosts, as tools to use.
 *
 * Each tool is a method made by an organisation, in one of three categories —
 * Understand, Imagine or Plan — and the gallery lists them under those headings.
 * Each is self-contained: no sign-in, nothing saved, and something moving within a
 * second of arriving. The register of tools is src/toolkit/tools.js.
 *
 * The exception to "nothing saved" is a room: a tool whose register entry has
 * a `room` can be opened up to a roomful of people, who join it with a PIN or a QR
 * code and whose answers are held in Supabase until the facilitator closes it. This
 * page owns the room the way it owns the tool — off the URL, in ?room= — and
 * hands it to the tool as a prop.
 *
 * The page owns the /toolkit part of the URL itself rather than taking the selected
 * tool as a prop, so every tool has a link that can be shared.
 */

import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ToolLayout } from './ToolLayout';
import { RoomBar } from './toolkit/RoomBar';
import { ToolCover } from './toolkit/ToolCover';
import { ContributeToolDialog } from './ContributeToolDialog';
import { useRoom } from './toolkit/useRoom';
import { CATEGORIES, TOOLS, findTool } from '../toolkit/tools';
import { DEFAULT_LIFETIME, ROOM_LIFETIMES, projectIdFrom, roomIdFrom, roomPath } from '../toolkit/rooms';
import { isSupabaseConfigured } from '../services/rooms';

/** The tool id in a path like /toolkit/street-mixer, if there is one. */
export function toolIdFrom(path) {
  const match = /^\/toolkit\/([^/?#]+)/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function Tile({ t, tool, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${tool.color}`, borderRadius: 16, padding: 24, minHeight: 220,
        background: tool.tint,
        color: t.ink, display: 'flex', flexDirection: 'column', gap: 8,
        fontFamily: 'var(--placer-font)', boxShadow: 'none',
        transition: 'box-shadow 0.2s' }}
      onMouseEnter={(event) => { event.currentTarget.style.boxShadow = t.shadow; }}
      onMouseLeave={(event) => { event.currentTarget.style.boxShadow = 'none'; }}>
      {/* The tool's own mark, oversized and half out of frame. */}
      <span aria-hidden="true" style={{ position: 'absolute', right: -18, bottom: -22, opacity: 0.18 }}>
        <Icon name={tool.icon} size={150} stroke={1.4} />
      </span>

      <Icon name={tool.icon} size={30} stroke={2.1} />
      <span className="placer-h3" style={{ position: 'relative' }}>
        {tool.name}
      </span>
      <span style={{ fontSize: 16, lineHeight: '24px', position: 'relative', maxWidth: 320 }}>
        {tool.tagline}
      </span>
      {tool.createdBy && (
        <span className="placer-caption" style={{ color: t.inkDim, position: 'relative' }}>
          By {tool.createdBy}
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
 * Offered on a tool that can host a room, when there is a database to host it in
 * and somebody with an account to open it.
 *
 * Opened from a project, the room can also be left running for weeks — a poll on a
 * poster rather than a workshop — so how long it stays open becomes a choice. Without a
 * project there is no choice to offer: a long room needs somebody who can find it again
 * and close it, and the database refuses one that has no project behind it
 * (supabase/rooms-lifetime.sql).
 */
function StartRoom({ t, tool, onStart, busy, canStayOpen }) {
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
        tone={tool}
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
 * reads as a feature that is broken. Opening a room is the one thing in the Toolkit that
 * takes an account — it creates something other people join, and it is enforced in
 * supabase/rooms.sql, where toolkit_room_create is the only function the anon role may
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

export function ToolkitPage({ t, displayName = null, needsAccount = false, onSignIn }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const requestedId = toolIdFrom(location);
  const tool = requestedId ? findTool(requestedId) : null;
  const missing = requestedId && !tool ? requestedId : null;

  const projectId = projectIdFrom(search);

  const room = useRoom({
    tool,
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
      posthog.capture('sandbox_room_opened', { experiment: tool.id });
      navigate(roomPath(tool.id, id));
    },
  });

  useEffect(() => {
    if (!tool) return;
    posthog.capture('sandbox_experiment_opened', { experiment: tool.id });
  }, [tool]);

  // Which tool has been started past its cover. An id rather than a flag, so
  // opening a different tool lands on that one's cover rather than skipping it,
  // and opening a room (which only changes the query string) does not bring it back.
  const [startedId, setStartedId] = useState(null);

  // The Contribute button's pop-up form, for offering a tool to the PLACER Toolkit.
  const [contributing, setContributing] = useState(false);

  const Tool = tool?.component;
  // Offered only where a room would mean something, and only with a database behind it.
  const roomIsPossible =
    Boolean(tool?.room) && isSupabaseConfigured() && room.status === 'none';
  // Opening one also takes an account. Joining one does not — nothing on this page is
  // gated for a participant who arrived with a PIN or a QR code.
  const canStartRoom = roomIsPossible && !needsAccount;

  // Every tool opens on its cover, full-bleed rather than inside the padded
  // column the tool itself sits in.
  if (tool && Tool && startedId !== tool.id) {
    return (
      <ToolCover t={t} tool={tool}
        onStart={() => setStartedId(tool.id)}
        onBack={() => navigate('/toolkit')} />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {tool && Tool ? (
          <ToolLayout
            t={t}
            tool={tool}
            onBack={() => navigate('/toolkit')}
            actions={canStartRoom ? (
              <StartRoom t={t} tool={tool} onStart={room.start} busy={room.status === 'opening'}
                canStayOpen={Boolean(projectId)} />
            ) : roomIsPossible ? (
              <StartRoomSignedOut t={t} onSignIn={onSignIn} />
            ) : null}>
            <RoomBar t={t} tool={tool} room={room} />
            <Tool t={t} tool={tool} room={room} />
          </ToolLayout>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, gap: 20 }}>
              <div>
                <div className="placer-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5,
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDim, marginBottom: 14 }}>
                  <Icon name="flask" size={15} stroke={2.1} />
                  Methods for shaping shared spaces
                </div>
                <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
                  letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.05 }}>
                  Toolkit
                </h1>
                <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, maxWidth: 680 }}>
                  Participatory placemaking methods from organisations around the world, as
                  tools you can use: to understand how a place is used, to imagine how it
                  could change, and to plan that change in one place.
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
                There is no tool called <span className="placer-mono">{missing}</span>. Here is everything there is.
              </p>
            )}

            {CATEGORIES.map((category) => {
              const tools = TOOLS.filter((entry) => entry.category === category.id);
              if (tools.length === 0) return null;
              return (
                <section key={category.id} aria-labelledby={`toolkit-${category.id}`} style={{ marginBottom: 48 }}>
                  <h2 id={`toolkit-${category.id}`} className="placer-h2" style={{ color: t.ink }}>
                    {category.name}
                  </h2>
                  <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6, marginTop: 4, marginBottom: 20 }}>
                    {category.description}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {tools.map((entry) => (
                      <Tile key={entry.id} t={t} tool={entry} onOpen={() => navigate(`/toolkit/${entry.id}`)} />
                    ))}
                  </div>
                </section>
              );
            })}

            {contributing && (
              <ContributeToolDialog t={t} onClose={() => setContributing(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ToolkitPage;
