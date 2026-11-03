/* PLACER — the second step of Create a tool: the tools there are of the kind picked.
 *
 * Create a tool (the side nav's button, or the dashboard's shortcut) first asks which
 * kind, Understand, Re-Imagine or Plan (CreateToolMenu). This dialog then lists every
 * tool of that kind, A-Z, each with its icon in its category's colours, its tagline and
 * who made it. Choosing one calls `onPick` with its id; App opens its configuration
 * page. Escape, the close button or a click outside the panel closes it.
 */

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { TOOL_KINDS } from './SideNav';
import { TOOLS, filterTools, findCategory, sortTools } from '../toolkit/tools';
import { ARROW_ITEM, moveWithArrows } from '../lib/arrowKeys';

function ToolRow({ t, tool, onPick }) {
  const colour = findCategory(tool.category)?.colour;
  return (
    <li>
      <button type="button" {...ARROW_ITEM} onClick={() => onPick(tool.id)} className="placer-toolkit-row"
        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 20px',
          textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent',
          fontFamily: 'var(--placer-font)', color: t.ink }}>
        <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, flex: '0 0 auto',
          background: colour?.c100, color: colour?.c700, boxShadow: `inset 0 0 0 1px ${colour?.c700}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={tool.icon} size={22} stroke={2.1} />
        </span>
        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{tool.name}</span>
          <span style={{ fontSize: 14, color: t.inkDim }}>{tool.tagline}</span>
          {tool.createdBy && (
            <span className="placer-caption" style={{ color: t.inkDim }}>By {tool.createdBy}</span>
          )}
        </span>
        <Icon name="arrowRight" size={18} stroke={2.2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
      </button>
    </li>
  );
}

export function ChooseToolDialog({ t, category, onPick, onClose }) {
  const panelRef = useRef(null);
  const kind = TOOL_KINDS.find((entry) => entry.category === category);
  const colour = findCategory(category)?.colour;
  const tools = sortTools(filterTools(TOOLS, { category }), 'az', 'asc');
  const titleId = 'choose-tool-title';

  useEffect(() => {
    // The first tool takes focus, so the list can be used from the keyboard straight away.
    (panelRef.current?.querySelector('li button') ?? panelRef.current)?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        style={{ width: '100%', maxWidth: 560, maxHeight: 'min(80vh, 680px)', display: 'flex',
          flexDirection: 'column', background: t.surface, borderRadius: 16, boxShadow: t.shadow,
          outline: 'none', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 16px 16px 20px',
          borderBottom: `1px solid ${t.line}` }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, flex: '0 0 auto',
            background: colour?.c100, color: colour?.c900,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={kind?.icon ?? 'layers'} size={20} stroke={2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} className="placer-h3" style={{ margin: 0, color: t.ink }}>
              {kind?.label ?? findCategory(category)?.name} tools
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 14, color: t.inkDim }}>
              {findCategory(category)?.description}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'none',
              cursor: 'pointer', color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} stroke={2} />
          </button>
        </div>

        {tools.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 14, color: t.inkDim }}>No tools of this kind yet.</p>
        ) : (
          <ul aria-label="Tools" onKeyDown={moveWithArrows} className="placer-scroll"
            style={{ listStyle: 'none', margin: 0, padding: '8px 0', overflowY: 'auto' }}>
            {tools.map((tool) => <ToolRow key={tool.id} t={t} tool={tool} onPick={onPick} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ChooseToolDialog;
