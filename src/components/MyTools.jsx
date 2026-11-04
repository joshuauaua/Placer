/* PLACER — My Tools, on the Tools page: the tools this account has started on the
 * configuration page (services/startedTools.js), the most recently changed first.
 *
 * Each card has the tool's icon on its category's colour, what it is about — its first
 * slide's question or prompt, where the tool can say (`room.label` in toolkit/tools.js),
 * or else the tool's name — then the tool, its slides if more than one, and when it was
 * last changed. Choosing one calls `onOpen(toolId, id)`. A tool since taken off the
 * platform is left out.
 *
 * After them, in the next place in the grid, is the outline of a card, dashed, with a +
 * in it: Create a tool. With nothing started it is the only card. It opens the same
 * choice of Understand, Re-Imagine and Plan as the side nav's button, beside it, and
 * `onCreateTool` gets the kind picked.
 */

import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { CreateToolMenu } from './SideNav';
import { ARROW_ITEM } from '../lib/arrowKeys';
import { listStartedTools } from '../services/startedTools';
import { findCategory, findTool } from '../toolkit/tools';

/**
 * What a started tool is called: the name its owner gave it, or else what it is about,
 * from its first slide, or else the tool's name.
 */
export function startedToolTitle(tool, started) {
  if (started.name) return started.name;
  const setup = started.slides?.[0]?.setup;
  let label = null;
  try {
    label = setup ? tool.room?.label?.(setup) ?? null : null;
  } catch {
    label = null;
  }
  return label || tool.name;
}

function edited(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `Edited ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

function StartedToolCard({ started, tool, onOpen }) {
  const colour = findCategory(tool.category)?.colour;
  const title = startedToolTitle(tool, started);
  const slides = started.slides?.length ?? 1;
  const details = [tool.name, slides > 1 ? `${slides} slides` : null, edited(started.updatedAt)].filter(Boolean);
  return (
    <li>
      <button type="button" {...ARROW_ITEM} onClick={() => onOpen(tool.id, started.id)}
        className="placer-template-card" aria-label={`${title}, ${details.join(', ')}`}>
        <span className="placer-template-image placer-started-cover"
          style={{ background: colour?.c100, color: colour?.c700 }}>
          <Icon name={tool.icon} size={40} stroke={1.8} />
        </span>
        <span className="placer-template-text">
          <span className="placer-template-title">{title}</span>
          <span className="placer-template-tool" style={{ color: colour?.c700 }}>
            <Icon name={tool.icon} size={15} stroke={2.2} />
            {tool.name}
          </span>
          {details.length > 1 && (
            <span className="placer-started-details">{details.slice(1).join(' · ')}</span>
          )}
        </span>
      </button>
    </li>
  );
}

/** The outline of a card, dashed, to start a new tool from. */
function AddToolCard({ onCreateTool }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return (
    <li>
      <button ref={ref} type="button" {...ARROW_ITEM} onClick={() => setOpen((was) => !was)}
        className="placer-template-card placer-add-tool-card"
        aria-haspopup="menu" aria-expanded={open}>
        <span className="placer-template-image placer-add-tool-plus">
          <span className="placer-add-tool-circle"><Icon name="plus" size={28} stroke={2.2} /></span>
        </span>
        <span className="placer-template-text">
          <span className="placer-template-title">Create a tool</span>
          <span className="placer-started-details">Understand, Re-Imagine or Plan</span>
        </span>
      </button>
      {open && (
        <CreateToolMenu anchor={ref} onClose={() => setOpen(false)}
          onChoose={(category) => { setOpen(false); onCreateTool?.(category); }} />
      )}
    </li>
  );
}

export function MyTools({ t, accountId = null, onOpen, onCreateTool }) {
  // Read once, when the page opens: nothing here changes them.
  const [started] = useState(() => listStartedTools(accountId)
    .map((entry) => ({ entry, tool: findTool(entry.tool) }))
    .filter(({ tool }) => tool));

  return (
    <section aria-labelledby="my-tools-title" style={{ marginBottom: 32 }}>
      <h2 id="my-tools-title" className="placer-caption" style={{ textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 700, color: t.inkDim, marginBottom: 12 }}>
        My Tools
      </h2>
      <ul className="placer-template-grid">
        {started.map(({ entry, tool }) => (
          <StartedToolCard key={entry.id} started={entry} tool={tool} onOpen={onOpen} />
        ))}
        <AddToolCard onCreateTool={onCreateTool} />
      </ul>
    </section>
  );
}

export default MyTools;
