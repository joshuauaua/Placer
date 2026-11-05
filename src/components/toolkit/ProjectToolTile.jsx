/* PLACER — a project's tool on its page, as a card and nothing more.
 *
 * Each tool on a project's page (lib/projectSections.js: a tool, an open room or a run
 * of them, or the results of one that has ended) is a card with its title, the tool
 * it is and where it stands. Choosing it does what there is to do:
 *
 *   - live, and not answered from this browser yet: on to the tool, to take part —
 *     the room's own page, where it is answered as it would be from its PIN or link
 *     (ToolkitPage), or the tool's page for one that runs on its own
 *   - answered from here, or no longer live: its results, everybody's together, in a
 *     dialog — the tool's own results view (`results` in toolkit/tools.js) for each of
 *     its rooms, or, for a tool without one that is still live, its embed, which shows
 *     the results once answered
 *
 * Whether this browser has answered is what it remembers (rememberedAnswer in
 * toolkit/rooms.js), as the room keeps one answer per browser.
 */

import { useEffect, useId, useRef } from 'react';
import { Icon } from '../Icon';
import { findCategory } from '../../toolkit/tools';
import { rememberedAnswer } from '../../toolkit/rooms';

/** The rooms a section is about, in order: a run's, its own, or the ended one's. */
export function sectionRooms(section) {
  if (section.kind === 'results') return [{ id: section.result.roomId, config: section.result.config }];
  if (section.run?.length) return section.run;
  return section.room ? [section.room] : [];
}

/** Where a tool on a project's page stands for this browser. */
export function tileState(section) {
  if (section.kind === 'results') return 'completed';
  const rooms = sectionRooms(section);
  if (rooms.length === 0) return 'open';
  return rooms.some((room) => rememberedAnswer(room.id) !== null) ? 'answered' : 'live';
}

const TAGS = { live: 'Live', open: 'Open', answered: 'Answered', completed: 'Completed' };

export function ProjectToolTile({ t, section, onOpen }) {
  const { tool } = section;
  const colour = findCategory(tool.category)?.colour;
  const state = tileState(section);
  return (
    <button type="button" onClick={() => onOpen(section, state)} className="placer-project-tool-tile"
      aria-label={`${section.title}, ${tool.name}, ${TAGS[state]}`}>
      <span aria-hidden="true" className="placer-project-tool-tile-icon" style={{ background: colour?.c100, color: colour?.c700 }}>
        <Icon name={tool.icon} size={26} stroke={2} />
      </span>
      <span className="placer-project-tool-tile-text">
        <span className="placer-project-tool-tile-title" style={{ color: t.ink }}>{section.title}</span>
        <span className="placer-project-tool-tile-tool" style={{ color: colour?.c700 }}>{tool.name}</span>
      </span>
      <span className={`placer-project-tool-tile-tag is-${state}`}>{TAGS[state]}</span>
    </button>
  );
}

/**
 * The results of a tool on a project's page: each of its rooms' (`results` from
 * useToolResults), through the tool's results view; or, for a tool without one that is
 * still live, `fallback` — its embed.
 */
export function ToolResultsDialog({ t, section, results, fallback = null, onClose }) {
  const titleId = useId();
  const panelRef = useRef(null);
  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { tool } = section;
  const View = tool.results?.View;
  const found = sectionRooms(section)
    .map((room) => (results ?? []).find((result) => result.roomId === room.id))
    .filter(Boolean);

  let body;
  if (View && found.length > 0) {
    body = found.map((result) => <View key={result.roomId} t={t} tool={tool} result={result} />);
  } else if (View && results === null) {
    body = <p style={{ margin: 0, color: t.inkDim }}>Loading the results…</p>;
  } else if (fallback) {
    body = fallback;
  } else {
    body = <p style={{ margin: 0, color: t.inkDim }}>There are no results to show for this tool yet.</p>;
  }

  return (
    <div onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        style={{ width: '100%', maxWidth: 880, maxHeight: 'min(90vh, 900px)', display: 'flex', flexDirection: 'column',
          background: t.surface, borderRadius: 16, boxShadow: t.shadow, outline: 'none', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px',
          borderBottom: `1px solid ${t.line}` }}>
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.ink, overflowWrap: 'anywhere' }}>
              {section.title}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: t.inkDim }}>{tool.name} · results</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ border: 0, background: 'transparent', color: t.ink, cursor: 'pointer', padding: 4, display: 'flex' }}>
            <Icon name="close" size={20} stroke={2} />
          </button>
        </div>
        <div className="placer-scroll" style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

export default ProjectToolTile;
