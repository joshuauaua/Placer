/* PLACER — My Tools, on the Tools page: the tools this account has started on the
 * configuration page (services/startedTools.js), the most recently changed first.
 *
 * Each card has the tool's icon on its category's colour, what it is about — its first
 * slide's question or prompt, where the tool can say (`room.label` in toolkit/tools.js),
 * or else the tool's name — then the tool, its slides if more than one, and when it was
 * last changed. Choosing one calls `onOpen(toolId, id)`. A tool since taken off the
 * platform is left out.
 *
 * The tools are read when the row opens (services/startedTools.js keeps them in the
 * database for a signed-in account, else in the browser); until then, and if they
 * cannot be read, only the Create a tool card shows.
 *
 * In each card's top corner is a bin, shown on hover or focus (always, on a touch
 * screen). It asks before it deletes: the first press turns it to Delete? in red, the
 * second deletes the tool, and leaving it puts it back. Deleting cannot be undone.
 *
 * After them, in the next place in the grid, is the outline of a card, dashed, with a +
 * in it: Create a tool. With nothing started it is the only card. It opens the same
 * choice of Understand, Imagine and Plan as the side nav's button, beside it, and
 * `onCreateTool` gets the kind picked.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { CreateToolMenu } from './SideNav';
import { CardRow } from './CardRow';
import { ARROW_ITEM } from '../lib/arrowKeys';
import { listStartedTools, removeStartedTool } from '../services/startedTools';
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

export function StartedToolCard({ started, tool, onOpen, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const colour = findCategory(tool.category)?.colour;
  const title = startedToolTitle(tool, started);
  const slides = started.slides?.length ?? 1;
  const details = [tool.name, slides > 1 ? `${slides} slides` : null, edited(started.updatedAt)].filter(Boolean);
  return (
    <li className="placer-started-item">
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
      {onDelete && (
        <button type="button" className="placer-started-delete" data-confirming={confirming || undefined}
          aria-label={confirming ? `Delete ${title}? Press again to delete` : `Delete ${title}`}
          title={confirming ? 'Press again to delete' : 'Delete'}
          onClick={() => (confirming ? onDelete(started.id) : setConfirming(true))}
          onBlur={() => setConfirming(false)}>
          <Icon name="trash" size={16} stroke={2} />
          {confirming && <span>Delete?</span>}
        </button>
      )}
    </li>
  );
}

/** The outline of a card, dashed, to start a new tool from. */
export function AddToolCard({ onCreateTool }) {
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
        </span>
      </button>
      {open && (
        <CreateToolMenu anchor={ref} onClose={() => setOpen(false)}
          onChoose={(category) => { setOpen(false); onCreateTool?.(category); }} />
      )}
    </li>
  );
}

/**
 * The account's started tools whose tool is still on the platform, newest first; a
 * function that deletes one by its id; and whether they are 'loading', 'ready' or
 * 'failed' (the database could not be reached). Read when the page opens, and again
 * if the account changes. A tool deleted here goes at once, and comes back if the
 * delete fails.
 */
export function useStartedTools(accountId) {
  const [started, setStarted] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    listStartedTools(accountId)
      .then((list) => {
        if (cancelled) return;
        setStarted(list.map((entry) => ({ entry, tool: findTool(entry.tool) })).filter(({ tool }) => tool));
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Could not read the started tools:', err);
        if (!cancelled) setStatus('failed');
      });
    return () => { cancelled = true; };
  }, [accountId]);

  const remove = (id) => {
    const was = started;
    setStarted((list) => list.filter(({ entry }) => entry.id !== id));
    removeStartedTool(accountId, id).catch((err) => {
      console.error('Could not delete the started tool:', err);
      setStarted(was);
    });
  };
  return [started, remove, status];
}

// `onViewAll`, if given, puts View all beside the row's arrows: the My Tools page.
export function MyTools({ t, accountId = null, onOpen, onCreateTool, onViewAll }) {
  const [started, remove] = useStartedTools(accountId);

  return (
    <CardRow t={t} id="my-tools" title="My Tools" action={onViewAll && (
      <button type="button" onClick={onViewAll} className="placer-card-row-link">View all</button>
    )}>
      {started.map(({ entry, tool }) => (
        <StartedToolCard key={entry.id} started={entry} tool={tool} onOpen={onOpen} onDelete={remove} />
      ))}
      <AddToolCard onCreateTool={onCreateTool} />
    </CardRow>
  );
}

export default MyTools;
