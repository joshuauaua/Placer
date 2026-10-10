/* PLACER — a project's tool, taken part in on the project's own page.
 *
 * The card opens out in place, with the tool inside it, rather than sending somebody
 * off to the Toolkit — so taking part never leaves the project. A tool the project
 * opened a room for is played in that room, as it would be from the room's link
 * (useRoom), and a tool set up on a site is used on it (useProjectSite).
 *
 * The tool is only made once the card is opened: nothing is loaded for a tool nobody
 * has opened, and closing it puts it away.
 */

import { useId, useState } from 'react';
import { Icon } from '../Icon';
import { RoomBar } from './RoomBar';
import { useRoom } from './useRoom';
import { useProjectSite } from './useProjectSite';

/** The tool itself, in its room if it has one. */
function ProjectToolRun({ t, tool, room, projectId, displayName }) {
  const roomState = useRoom({ tool, roomId: room?.id ?? null, displayName });
  const { site, loading } = useProjectSite(tool, projectId);
  const Tool = tool.component;

  if (loading) {
    return <p style={{ fontSize: 14, color: t.inkDim, margin: 0 }}>Loading the project&rsquo;s site…</p>;
  }
  return (
    <>
      <RoomBar t={t} tool={tool} room={roomState} />
      <Tool t={t} tool={tool} room={roomState} projectSite={site} />
    </>
  );
}

export function ProjectToolCard({ t, tool, room = null, projectId, displayName = null }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="placer-card" style={{ padding: 0, overflow: 'hidden' }}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((was) => !was)}
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center',
          padding: 16, background: 'none', border: 'none', fontFamily: 'var(--placer-font)', color: t.ink }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, flex: '0 0 auto', background: tool.tint,
          boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={tool.icon} size={20} stroke={2} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 16, lineHeight: '24px', fontWeight: 700 }}>{tool.name}</span>
          <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: t.inkDim, marginTop: 2 }}>
            {tool.tagline}
          </span>
        </span>
        <Icon name={open ? 'chevUp' : 'chevDown'} size={18} stroke={2.2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
      </button>

      {open && (
        <div id={panelId} style={{ padding: 20, borderTop: `1px solid ${t.line}` }}>
          <ProjectToolRun t={t} tool={tool} room={room} projectId={projectId} displayName={displayName} />
        </div>
      )}
    </div>
  );
}
