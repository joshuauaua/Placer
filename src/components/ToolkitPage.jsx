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
 * The page owns the /toolkit part of the URL itself rather than taking the selected
 * tool as a prop, so every tool has a link that can be shared.
 */

import { useEffect, useState } from 'react';
import { Redirect, useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Breadcrumb, WORKSPACE_CRUMB } from './PageHeader';
import { ToolLayout } from './ToolLayout';
import { RoomBar } from './toolkit/RoomBar';
import { ToolCover } from './toolkit/ToolCover';
import { useRoom } from './toolkit/useRoom';
import { useProjectToolSetup } from './toolkit/useProjectToolSetup';
import { findTool } from '../toolkit/tools';
import { projectIdFrom, roomIdFrom } from '../toolkit/rooms';
import { isSupabaseConfigured } from '../services/rooms';
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

export function ToolkitPage({ t, displayName = null }) {
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

  const room = useRoom({
    tool,
    roomId: roomIdFrom(search),
    // Whatever the person calls themselves, so a facilitator can see who has answered.
    // Passed in from App rather than read here: with accounts the name comes from a
    // request, and this is a render body. It is still a label rather than proof of
    // identity — a room is joined with its PIN, not with an account.
    displayName,
  });

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
        </ToolLayout>
      </div>
    </div>
  );
}

export default ToolkitPage;
