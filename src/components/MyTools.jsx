/* PLACER — My Tools, on the Tools page: the tools this account has started on the
 * configuration page (services/startedTools.js), the most recently changed first.
 *
 * Each card has the tool's icon on its category's colour, what it is about — its first
 * slide's question or prompt, where the tool can say (`room.label` in toolkit/tools.js),
 * or else the tool's name — then the tool, its slides if more than one, and when it was
 * last changed. Choosing one calls `onOpen(toolId, id)`. A tool since taken off the
 * platform is left out.
 */

import { useState } from 'react';
import { Icon } from './Icon';
import { ARROW_ITEM } from '../lib/arrowKeys';
import { listStartedTools } from '../services/startedTools';
import { findCategory, findTool } from '../toolkit/tools';

/** What a started tool is about, from its first slide, or the tool's name. */
export function startedToolTitle(tool, started) {
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

export function MyTools({ t, accountId = null, onOpen }) {
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
      {started.length === 0 ? (
        <p className="placer-started-empty">
          Nothing started yet. Create a tool, or start from one of the templates below.
        </p>
      ) : (
        <ul className="placer-template-grid">
          {started.map(({ entry, tool }) => (
            <StartedToolCard key={entry.id} started={entry} tool={tool} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default MyTools;
