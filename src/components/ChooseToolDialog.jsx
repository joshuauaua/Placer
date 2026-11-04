/* PLACER — the second step of Create a tool: the tools there are of the kind picked.
 *
 * Create a tool (the side nav's button, or the dashboard's shortcut) first asks which
 * kind, Understand, Imagine or Plan (CreateToolMenu). This dialog then shows every
 * tool of that kind, A-Z, as a card in a grid: its picture, or its icon on its
 * category's colour, then its name, tagline, its tags — a field audit or public
 * feedback, and whether it runs live, self-paced on a phone, or both (toolTags) — and
 * who made it. The dialog is large —
 * nearly the window on a laptop — under a header in the category's colour; on a phone
 * the grid is one column. Choosing one calls `onPick` with its id; App opens its configuration
 * page. Escape, the close button or a click outside the panel closes it.
 */

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { TOOL_KINDS } from './SideNav';
import { TOOLS, filterTools, findCategory, sortTools, toolTags } from '../toolkit/tools';
import { ARROW_ITEM, moveWithArrows } from '../lib/arrowKeys';

function ToolCard({ t, tool, onPick }) {
  const colour = findCategory(tool.category)?.colour;
  return (
    <li style={{ display: 'flex' }}>
      <button type="button" {...ARROW_ITEM} onClick={() => onPick(tool.id)} className="placer-choose-tool-card"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, textAlign: 'left',
          cursor: 'pointer', border: `1px solid ${t.line}`, borderRadius: 16, background: t.surface,
          overflow: 'hidden', fontFamily: 'var(--placer-font)', color: t.ink }}>
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 132, background: colour?.c100, color: colour?.c700 }}>
          {tool.image
            ? <img src={tool.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name={tool.icon} size={44} stroke={1.8} />}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px 18px', flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{tool.name}</h3>
            <Icon name="arrowRight" size={18} stroke={2.2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.5, color: t.inkDim }}>{tool.tagline}</span>
          <span className="placer-tool-tags" aria-label="Tags">
            {toolTags(tool).map((tag) => (
              <span key={tag.id} className="placer-tool-tag">
                <Icon name={tag.icon} size={12} stroke={2.2} />
                {tag.name}
              </span>
            ))}
          </span>
          {tool.createdBy && (
            <span className="placer-caption" style={{ color: t.inkDim, marginTop: 'auto', paddingTop: 6 }}>
              By {tool.createdBy}
            </span>
          )}
        </span>
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
        className="placer-choose-tool-panel"
        style={{ width: '100%', maxWidth: 960, maxHeight: 'min(88vh, 900px)', display: 'flex',
          flexDirection: 'column', background: t.surface, borderRadius: 20, boxShadow: t.shadow,
          outline: 'none', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '28px 20px 24px 28px',
          background: colour?.c100 }}>
          <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 16, flex: '0 0 auto',
            background: t.surface, color: colour?.c700,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={kind?.icon ?? 'layers'} size={28} stroke={2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* The kind, small, over what its tools are for, in bold. */}
            <h2 id={titleId} style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.3,
              letterSpacing: '0.02em', color: colour?.c900 ?? t.ink }}>
              {kind?.label ?? findCategory(category)?.name}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, lineHeight: 1.35, color: t.ink }}>
              {findCategory(category)?.description}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer', color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={20} stroke={2} />
          </button>
        </div>

        {tools.length === 0 ? (
          <p style={{ padding: 28, fontSize: 15, color: t.inkDim }}>No tools of this kind yet.</p>
        ) : (
          <ul aria-label="Tools" onKeyDown={moveWithArrows} className="placer-scroll placer-choose-tool-grid"
            style={{ listStyle: 'none', margin: 0, overflowY: 'auto' }}>
            {tools.map((tool) => <ToolCard key={tool.id} t={t} tool={tool} onPick={onPick} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ChooseToolDialog;
