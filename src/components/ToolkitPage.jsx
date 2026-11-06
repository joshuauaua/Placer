/* PLACER — a tool, at /toolkit/<id>: the participatory methods PLACER hosts.
 *
 * Each tool is a method made by an organisation, in one of three categories —
 * Understand, Imagine or Plan. The register of tools is src/toolkit/tools.js. There is
 * no gallery of them any more: tools are found through Create a tool (ChooseToolDialog)
 * and the dashboard, so /toolkit on its own, or a link naming no tool there is, goes
 * home — which, for somebody signed in, is their dashboard.
 *
 * A room a project opened is shown here — this page owns it off the URL, in ?room=, and
 * hands it to the tool as a prop — because that is where people who join with a PIN or
 * a QR code land, and where the dashboard sends its facilitator.
 *
 * A room opens on its invitation (InviteCover) rather than the tool's cover: who invites
 * people, to what, as part of which project. Past it, somebody who joined sees only
 * what answering the tool takes — the tool drawn `answering`, as the configuration
 * page's Preview shows it (ToolPreviewFrame) — with none of the page around it: no
 * header, credits or the strip saying they are in a room, unless the room is not open.
 * Its facilitator gets a page of their own: a top bar with the tool's name and Close
 * and Delete room, the QR code and PIN on the first slide, and the tool `presenting` —
 * what goes up on the screen, with nothing to answer (Word Cloud: the prompt over the
 * cloud, and its timer).
 *
 * The page owns the /toolkit part of the URL itself rather than taking the selected
 * tool as a prop, so every tool has a link that can be shared.
 */

import { useEffect, useState } from 'react';
import { Redirect, useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Breadcrumb, WORKSPACE_CRUMB } from './PageHeader';
import { ToolLayout } from './ToolLayout';
import { CloseRoom, DeleteRoom, RoomBar } from './toolkit/RoomBar';
import { Icon } from './Icon';
import { ToolCover } from './toolkit/ToolCover';
import { InviteCover } from './toolkit/InviteCover';
import { roomInvite } from '../toolkit/invite';
import { useRoom } from './toolkit/useRoom';
import { useProjectToolSetup } from './toolkit/useProjectToolSetup';
import { findTool } from '../toolkit/tools';
import { hostedRoom, projectIdFrom, roomIdFrom } from '../toolkit/rooms';
import { rememberedSequence, roomSequence } from '../toolkit/sequence';
import { closeRoom, isSupabaseConfigured } from '../services/rooms';
import { SlideSteps } from './toolkit/SlideSteps';
import { FieldSessionGate } from './toolkit/FieldSessionGate';
import { asksForFieldSession } from '../lib/toolkit/fieldSession';
import { readProjectCrumb } from '../services/projects';
import { FULL_SCREEN_TOOLS, isFullScreenTool, startedToolPath } from '../lib/routes';

/**
 * The way back from a tool opened for a project. For somebody who can edit it — the
 * organiser who added the tool — that is My Workspace / Projects / the project's
 * dashboard; for anybody else, who came from its public page, just that page. Named
 * "Project" until its name is in.
 */
export function projectTrail(projectId, crumb) {
  const name = crumb?.name || 'Project';
  if (crumb?.canEdit) {
    return [WORKSPACE_CRUMB, { label: 'Projects', href: '/projects' },
      { label: name, href: `/projects/${projectId}/dashboard` }];
  }
  return [{ label: name, href: `/projects/${projectId}` }];
}

// A room in one of these states cannot be taken part in (useRoom).
const ROOM_GONE = ['error', 'closed', 'deleted', 'expired'];

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

// `identity` is { status, accountId, name } from useIdentity, for a Gehl field tool's
// room, which only its project's team can take part in (FieldSessionGate).
export function ToolkitPage({ t, displayName = null, identity = null }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const requestedId = toolIdFrom(location);
  const tool = requestedId ? findTool(requestedId) : null;

  const projectId = projectIdFrom(search);

  // The project's name and whether this account can edit it, for the breadcrumb. The
  // page stands without it: a failure leaves the crumb reading "Project".
  const [crumb, setCrumb] = useState(null);
  useEffect(() => {
    setCrumb(null);
    if (!projectId || !isSupabaseConfigured()) return undefined;
    let cancelled = false;
    readProjectCrumb(projectId)
      .then((found) => { if (!cancelled) setCrumb(found); })
      .catch((err) => console.error('Could not load the project for the breadcrumb:', err));
    return () => { cancelled = true; };
  }, [projectId]);

  const thisRoom = useRoom({
    tool,
    roomId: roomIdFrom(search),
    // Whatever the person calls themselves, so a facilitator can see who has answered.
    // Passed in from App rather than read here: with accounts the name comes from a
    // request, and this is a render body. It is still a label rather than proof of
    // identity — a room is joined with its PIN, not with an account.
    displayName,
  });
  // One slide of a run (toolkit/sequence.js): Next goes on to the slide after it, and
  // its host ending the session here ends every slide's room this browser opened.
  const sequence = roomSequence(thisRoom.config);
  const room = sequence && thisRoom.isHost ? {
    ...thisRoom,
    close: async () => {
      const others = rememberedSequence(sequence.id).filter((id) => id !== thisRoom.roomId);
      await Promise.all(others.map((id) => {
        const token = hostedRoom(id)?.token;
        return token ? closeRoom(id, token).catch((err) => console.error('Could not close a slide\'s room:', err)) : null;
      }));
      return thisRoom.close();
    },
  } : thisRoom;
  const goToNextSlide = () => {
    const query = new URLSearchParams(search);
    query.set('room', sequence.next);
    navigate(`${location}?${query.toString()}`);
  };

  // Opened for a project, a tool it has set up starts from that (useProjectToolSetup).
  const projectSetup = useProjectToolSetup(projectId, tool);

  useEffect(() => {
    if (!tool) return;
    posthog.capture('sandbox_experiment_opened', { experiment: tool.id });
  }, [tool]);

  // Which tool has been started past its cover. An id rather than a flag, so
  // opening a different tool lands on that one's cover rather than skipping it,
  // and opening a room (which only changes the query string) does not bring it back.
  const [startedId, setStartedId] = useState(null);
  // A Gehl field tool's session, filled in on its first screen in a room
  // (FieldSessionGate): kept per tool, so it carries on from one slide's room to the next.
  const [fieldSession, setFieldSession] = useState(null);

  // No tool named, or none by that name: there is no gallery to fall back to, so home.
  // Only from under /toolkit: on the way out to somewhere else there is nothing to do.
  if (!tool?.component) return location.startsWith('/toolkit') ? <Redirect to="/" replace /> : null;

  const Tool = tool.component;
  // A full-screen tool (lib/routes.js) is started by its address rather than by
  // startedId, and App gives it the whole window: it is all there is on the page.
  if (isFullScreenTool(location, search)) {
    return <Tool t={t} tool={tool} />;
  }

  const breadcrumb = projectId ? (
    <Breadcrumb t={t} trail={projectTrail(projectId, crumb)} current={tool.name} style={{ marginBottom: 24 }} />
  ) : null;
  // Back from a tool goes home: the dashboard, for somebody signed in.
  const goBack = () => navigate('/');

  // Known from the address, so the page never shows the tool's own cover first while
  // the room is being read.
  const inRoom = Boolean(roomIdFrom(search));

  // A room opens on its invitation, whoever comes in: the people taking part, and its
  // facilitator, who can put it up for the group.
  if (inRoom && startedId !== tool.id) {
    return <InviteCover t={t} tool={tool} invite={roomInvite(room.config)} onStart={() => setStartedId(tool.id)} />;
  }

  // A Gehl field tool asks who is observing, when and in what weather before anything
  // else — and only its project's team can answer (FieldSessionGate).
  if (inRoom && !room.isHost && asksForFieldSession(tool) && fieldSession?.tool !== tool.id) {
    return (
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '24px 16px 64px',
        boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {room.status !== 'open' && room.status !== 'opening' && <RoomBar t={t} tool={tool} room={room} />}
          {/* A room that is gone, or never was, says only that: nobody signs in to nothing. */}
          {!ROOM_GONE.includes(room.status) && (
            <FieldSessionGate t={t} tool={tool} roomId={room.roomId} identity={identity}
              onReady={(session) => setFieldSession({ tool: tool.id, session })} />
          )}
        </div>
      </div>
    );
  }

  // Somebody taking part: the tool as they answer it, and nothing else (as Preview shows).
  if (inRoom && !room.isHost) {
    return (
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '24px 16px 64px',
        boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Only to say it is not open (yet, or any more): no strip saying they are in it. */}
          {room.status !== 'open' && <RoomBar t={t} tool={tool} room={room} />}
          {projectSetup.ready && (
            <Tool t={t} tool={tool} room={room} setup={projectSetup.setup} answering
              fieldSession={fieldSession?.tool === tool.id ? fieldSession.session : null} />
          )}
          {sequence && (
            <SlideSteps t={t} index={sequence.index} count={sequence.count}
              onNext={sequence.next ? goToNextSlide : undefined} />
          )}
        </div>
      </div>
    );
  }

  // Its facilitator, presenting it: a bar along the top with the tool's name and Close
  // and Delete room; on the first slide the QR code and the PIN (or, for a room open for
  // weeks, its link) for people to join by; then the tool as it is put up for the room
  // (`presenting`) — for Word Cloud, the prompt over the cloud, with nothing to answer.
  if (inRoom && room.isHost) {
    const open = room.status === 'open';
    const firstSlide = !sequence || sequence.index === 0;
    const title = roomInvite(room.config)?.title || tool.name;
    return (
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page }}>
        <header aria-label="Room" style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center',
          gap: 12, flexWrap: 'wrap', padding: '12px 24px', background: t.surface, borderBottom: `1px solid ${t.line}` }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: tool.tint, color: t.ink,
            boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon name={tool.icon} size={20} stroke={2.2} />
          </span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.ink, lineHeight: 1.2, minWidth: 0,
            overflowWrap: 'anywhere' }}>
            {title}
          </h1>
          {sequence && (
            <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
              Slide {sequence.index + 1} of {sequence.count}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {open && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <CloseRoom t={t} onClose={room.close} />
              <DeleteRoom t={t} onDelete={room.remove} />
            </div>
          )}
        </header>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 80px', boxSizing: 'border-box' }}>
          {(!open || firstSlide) && <RoomBar t={t} tool={tool} room={room} controls={false} />}
          {projectSetup.ready && <Tool t={t} tool={tool} room={room} setup={projectSetup.setup} presenting />}
          {sequence && open && (
            <SlideSteps t={t} index={sequence.index} count={sequence.count}
              onNext={sequence.next ? goToNextSlide : undefined} />
          )}
        </div>
      </div>
    );
  }

  // Every tool opens on its cover, full-bleed rather than inside the padded
  // column the tool itself sits in.
  if (startedId !== tool.id) {
    return (
      <ToolCover t={t} tool={tool} breadcrumb={breadcrumb}
        onStart={() => {
          if (FULL_SCREEN_TOOLS.includes(tool.id)) navigate(startedToolPath(tool.id, search));
          else setStartedId(tool.id);
        }}
        onBack={goBack} />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <ToolLayout t={t} tool={tool} breadcrumb={breadcrumb} onBack={goBack}>
          <RoomBar t={t} tool={tool} room={room} />
          {projectSetup.ready && <Tool t={t} tool={tool} room={room} setup={projectSetup.setup} />}
          {sequence && room.status !== 'none' && (
            <SlideSteps t={t} index={sequence.index} count={sequence.count}
              onNext={sequence.next ? goToNextSlide : undefined} />
          )}
        </ToolLayout>
      </div>
    </div>
  );
}

export default ToolkitPage;
