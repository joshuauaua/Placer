/* PLACER — configuring a tool, as a page of its own: /toolkit/<id>/configure.
 *
 * Where Create a tool leads, once a tool has been picked (ChooseToolDialog). It sits
 * under the nav bar, with the rest of the window to itself: no side nav or footer.
 *
 *   slides   — on the left, only for a tool that can run as several slides (`slides`
 *              in toolkit/tools.js): each is the tool with a setup of its own. Add a
 *              slide, pick one to show it on the canvas and configure it in the panel,
 *              or remove one while there are others. It starts with one. Any other
 *              tool is configured as that one slide, with no panel.
 *   top bar  — back to the dashboard; this tool's name, which can be changed (the
 *              tool's own until it is), over the project it is part of; a switch
 *              for whether it is run Live, with a group, or left Self-paced at its
 *              link for people to fill in in their own time; then the avatars
 *              of whoever works on it — the account, and its project's collaborators
 *              — and a + to invite another to the project (a tool has none of its
 *              own: they join through its project); then
 *              of the tool's collaborators, a ⋯ menu of its settings, Preview (the
 *              tool as it would look on a desktop and on a phone, side by side in a
 *              dialog: each a frame of that width, scrollable but not to be used) and,
 *              at the
 *              right-hand end, Publish: open the tool, now — Live, until the session is
 *              ended, or Self-paced, for as long as is picked (PublishToolDialog).
 *              Of the ⋯ menu only Delete tool is built: it asks first
 *              (DeleteToolDialog), then forgets the tool and goes to My Tools. Each
 *              other item only says it is not built yet.
 *   canvas   — a live preview of the slide as it is set up so far, and nothing to
 *              change: it cannot be clicked, typed in or tabbed into (inert). It is
 *              the Toolkit's own component, given the setup the way it would get it
 *              live: a tool that runs in a room gets it as `room.config` on a room that
 *              is not open, any other as `setup`. It is always given one — the setup
 *              as it is, while the tool would take it (roomSetup in
 *              toolkit/useRoom.js), or else the last one it would, or else the tool's
 *              defaults — because a tool handed none offers its own editors, and the
 *              editing is the panel's to do. A tool whose setup is made by pointing
 *              (`Canvas` in toolkit/tools.js) has its editor here instead, to use.
 *   panel    — on the right, the tool's own configuration: each stage of its setup
 *              (setupSteps in toolkit/tools.js) as a section, one under another,
 *              with whatever is wrong with it underneath. A tool without a setup says
 *              there is nothing to configure.
 *
 * Each tool started here is kept (services/startedTools.js) as soon as something in it
 * is changed, and listed under My Tools on the Tools page. From then on its address
 * carries its id, ?draft=<id>, which is how My Tools opens it again.
 *
 * Below 900px any slides become a row over the canvas, and the panel goes under it.
 */

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Avatar, Btn } from './UI';
import { Icon } from './Icon';
import { findCategory, findTool, setupSteps } from '../toolkit/tools';
import { newId, readStartedTool, removeStartedTool, saveStartedTool } from '../services/startedTools';
import { previewRoom } from '../toolkit/previewRoom';
import { PREVIEW_KEY } from './ToolPreviewFrame';
import { toolPreviewFramePath } from '../lib/routes';
import { PublishToolDialog } from './PublishToolDialog';
import { roomPath } from '../toolkit/rooms';
import { addCollaborator, isSupabaseConfigured, readCollaborators, readProjectCrumb } from '../services/projects';

/** The tool id in /toolkit/<id>/configure, or null for any other address. */
export function configuredToolIdFrom(path) {
  const match = /^\/toolkit\/([^/?#]+)\/configure\/?$/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * A tool that breaks on the canvas leaves the rest of the page standing: the panel
 * stays usable, and changing the setup tries the tool again (`resetKey`).
 */
class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, key: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error) {
    console.error('The tool could not be drawn on the canvas:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <p role="status" className="placer-configurator-note">
          This tool could not be shown with this setup.
        </p>
      );
    }
    return this.props.children;
  }
}


// How many collaborators' avatars show before the rest are a count.
const MAX_AVATARS = 3;

/** The collaborators' avatars, overlapping, with a count for any past MAX_AVATARS. */
function Collaborators({ people }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, MAX_AVATARS);
  const more = people.length - shown.length;
  const names = people.map((person) => person.name).join(', ');
  return (
    <div role="group" aria-label={`Collaborators: ${names}`} title={names} className="placer-configurator-people">
      {shown.map((person, index) => (
        <span key={person.id ?? `${person.name}-${index}`} className="placer-configurator-person">
          <Avatar name={person.name} photo={person.photo} size={32} ring="#FFFFFF" />
        </span>
      ))}
      {more > 0 && <span className="placer-configurator-person placer-configurator-more-people">+{more}</span>}
    </div>
  );
}

// The desktop the Preview shows: a window this wide, drawn at this scale.
const DESKTOP = { width: 1280, height: 800, scale: 0.56 };
// The phone: an iPhone's width and height, at this scale.
const PHONE = { width: 390, height: 844, scale: 0.72 };

/**
 * Preview: the slide as it would look on a desktop, on the left, and on a phone, on the
 * right, each a frame of that width (ToolPreviewFrame) that scrolls but cannot be used.
 * The slide is handed to the frames on `window[PREVIEW_KEY]` as the dialog opens.
 * Escape, the close button or a press outside closes it.
 */
function PreviewDialog({ tool, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const src = toolPreviewFramePath(tool.id);
  const frame = (device, title) => (
    <div className="placer-preview-screen" style={{ width: device.width * device.scale, height: device.height * device.scale }}>
      <iframe title={title} src={src} width={device.width} height={device.height}
        style={{ transform: `scale(${device.scale})` }} />
    </div>
  );

  return (
    <div className="placer-preview-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Preview: ${tool.name}`} tabIndex={-1}
        className="placer-preview-dialog">
        <div className="placer-preview-head">
          <div>
            <h2 className="placer-preview-title">Preview</h2>
            <p className="placer-preview-note">How this slide looks to the people taking part. Scroll each to see it all.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="placer-preview-close">
            <Icon name="close" size={20} stroke={2} />
          </button>
        </div>
        <div className="placer-preview-devices">
          <figure className="placer-preview-device">
            <div className="placer-preview-desktop">
              <div className="placer-preview-desktop-bar" aria-hidden="true"><span /><span /><span /></div>
              {frame(DESKTOP, 'Desktop preview')}
            </div>
            <figcaption><Icon name="monitor" size={15} stroke={2} /> Desktop</figcaption>
          </figure>
          <figure className="placer-preview-device">
            <div className="placer-preview-phone">{frame(PHONE, 'Phone preview')}</div>
            <figcaption><Icon name="phone" size={15} stroke={2} /> Phone</figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The + after the avatars, and what it opens: an email to invite to the tool's project
 * as a collaborator (addCollaborator — by address, as there is no directory to search).
 * A tool not in a project says that is how collaborators join. Escape, or a press
 * anywhere else, closes it.
 */
function AddCollaborator({ projectId, projectName }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, said: '', failed: false });
  const wrapRef = useRef(null);
  const canInvite = Boolean(projectId) && isSupabaseConfigured();

  useEffect(() => {
    if (!open) return undefined;
    wrapRef.current?.querySelector('input')?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onPointerDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const invite = async (e) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) { setState({ busy: false, said: 'That does not look like an email address.', failed: true }); return; }
    setState({ busy: true, said: '', failed: false });
    try {
      await addCollaborator(projectId, address);
      setEmail('');
      setState({ busy: false, said: `Invited ${address}. They accept from their Activity.`, failed: false });
    } catch (err) {
      console.error('Could not invite a collaborator:', err);
      setState({ busy: false, said: err?.message ?? 'Could not send that invitation.', failed: true });
    }
  };

  return (
    <div ref={wrapRef} className="placer-configurator-invite-wrap">
      <button type="button" onClick={() => setOpen((was) => !was)} aria-label="Add a collaborator"
        aria-expanded={open} aria-haspopup="dialog" title="Add a collaborator" className="placer-configurator-add-person">
        <Icon name="plus" size={16} stroke={2.4} />
      </button>
      {open && (
        <div role="dialog" aria-label="Invite a collaborator" className="placer-configurator-invite">
          <p className="placer-configurator-invite-title">Invite a collaborator</p>
          {canInvite ? (
            <form onSubmit={invite} noValidate>
              <p className="placer-configurator-invite-note">
                They join {projectName ? <strong>{projectName}</strong> : 'its project'}, and can work on its tools.
              </p>
              <div className="placer-configurator-invite-row">
                <input type="email" value={email} placeholder="name@example.org" aria-label="Their email"
                  onChange={(e) => { setEmail(e.target.value); setState({ busy: false, said: '', failed: false }); }} />
                <button type="submit" disabled={state.busy} className="placer-configurator-invite-send">
                  {state.busy ? 'Inviting…' : 'Invite'}
                </button>
              </div>
              {state.said && (
                <p role={state.failed ? 'alert' : 'status'}
                  className={`placer-configurator-invite-said${state.failed ? ' is-error' : ''}`}>{state.said}</p>
              )}
            </form>
          ) : (
            <p className="placer-configurator-invite-note">
              Collaborators join through a project. Add this tool to a project to invite them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// What the ⋯ menu offers. Only Delete tool is built yet.
const TOOL_SETTINGS = [
  { key: 'rename', label: 'Rename', icon: 'pencil' },
  { key: 'duplicate', label: 'Duplicate', icon: 'layers' },
  { key: 'collaborators', label: 'Manage collaborators', icon: 'user' },
  { key: 'delete', label: 'Delete tool', icon: 'trash', divided: true },
];

/**
 * The ⋯ button and its menu of the tool's settings. Escape, or a press anywhere
 * else, closes it, the same as UserMenu.
 */
function SettingsMenu({ onChoose }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    wrapRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const onMenuKeyDown = (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const items = [...wrapRef.current.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    items[(at + step + items.length) % items.length]?.focus();
  };

  return (
    <div ref={wrapRef} className="placer-configurator-settings">
      <button ref={buttonRef} onClick={() => setOpen((was) => !was)} aria-label="Tool settings"
        aria-haspopup="menu" aria-expanded={open} title="Tool settings" className="placer-configurator-dots">
        <Icon name="more" size={20} stroke={2} />
      </button>
      {open && (
        <div role="menu" aria-label="Tool settings" onKeyDown={onMenuKeyDown} className="placer-configurator-menu">
          {TOOL_SETTINGS.map(({ key, label, icon, divided }) => (
            <button key={key} role="menuitem" onClick={() => { setOpen(false); onChoose(key, label); }}
              className={`placer-configurator-menu-item${divided ? ' is-divided' : ''}`}>
              <Icon name={icon} size={17} stroke={2} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DANGER = '#B3261E';

/**
 * Asks before deleting the tool, which cannot be undone. Escape, Cancel or a press
 * outside it closes it; Delete calls `onDelete`.
 */
function DeleteToolDialog({ t, title, onDelete, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    // Cancel first, so Enter on arrival does not delete.
    dialogRef.current?.querySelector('button')?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-tool-title" aria-describedby="delete-tool-text"
        style={{ width: '100%', maxWidth: 440, padding: 24, background: t.surface, borderRadius: 16,
          boxShadow: t.shadow }}>
        <h2 id="delete-tool-title" style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 12 }}>
          {`Delete “${title}”?`}
        </h2>
        <p id="delete-tool-text" style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
          Its slides and their setup go, and it leaves My Tools. Any session already
          published from it stays open. This cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn t={t} variant="outline" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn t={t} variant="outline" size="sm" icon="trash" onClick={onDelete}
            style={{ color: DANGER, borderColor: DANGER }}>
            Delete tool
          </Btn>
        </div>
      </div>
    </div>
  );
}

/**
 * This tool's name, as a field that reads as the title: the tool's own name until it is
 * changed. Typing changes it as you go; leaving it empty, or as the tool's own name,
 * goes back to that. Enter or Escape is done.
 */
function NameField({ tool, name, onRename }) {
  const [draft, setDraft] = useState(name ?? tool.name);
  const [shownFor, setShownFor] = useState(name);
  if (name !== shownFor) { setShownFor(name); setDraft(name ?? tool.name); }
  const settle = () => {
    const trimmed = draft.trim();
    const next = trimmed && trimmed !== tool.name ? trimmed : null;
    setDraft(next ?? tool.name);
    if (next !== name) onRename(next);
  };
  return (
    <input className="placer-configurator-name" aria-label="Tool name" value={draft}
      maxLength={80} spellCheck={false} title="Rename this tool"
      onChange={(e) => { setDraft(e.target.value); }}
      onBlur={settle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
      // Sized to the name, with room to spare: a ch is a narrow 0, and names have Ws.
      style={{ width: `${Math.max(8, Math.min(34, Math.ceil(draft.length * 1.15) + 2))}ch` }} />
  );
}

/** Live with a group, or Self-paced at its link: a switch, saying which it is. */
function LiveSwitch({ t, live, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={live} onClick={() => onChange(!live)}
      className="placer-configurator-live"
      title={live ? 'Run live, with a group, as a presentation' : 'Open at its link, for anyone to fill in in their own time'}>
      <span aria-hidden="true" className="placer-configurator-live-track"
        style={{ background: live ? t.ink : 'var(--placer-grey-300)' }}>
        <span className="placer-configurator-live-thumb" style={{ left: live ? 18 : 2 }} />
      </span>
      <span className="placer-configurator-live-label">
        <strong>Live</strong>
        <span className="placer-configurator-live-hint">{live ? 'With a group' : 'Self-paced, by link'}</span>
      </span>
    </button>
  );
}

function TopBar({ t, tool, name, onRename, projectId, projectName, live, onLive, people, notice, onBack, onSetting,
  onPreview, onPublish }) {
  return (
    <header aria-label="Configure a tool" className="placer-configurator-bar">
      <div className="placer-configurator-bar-start">
        <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onBack} ariaLabel="Back to the dashboard"
          title="Back to the dashboard" />
        {tool && (
          <div className="placer-configurator-title">
            <NameField tool={tool} name={name} onRename={onRename} />
            <span className="placer-configurator-project">
              {projectName === undefined ? '\u00a0' : projectName ? `In ${projectName}` : 'Not in a project'}
            </span>
          </div>
        )}
        {tool && <LiveSwitch t={t} live={live} onChange={onLive} />}
      </div>
      <div className="placer-configurator-bar-end">
        <span role="status" className="placer-configurator-notice">{notice}</span>
        {tool && (
          <>
            <Collaborators people={people} />
            <AddCollaborator projectId={projectId} projectName={projectName} />
            <SettingsMenu onChoose={onSetting} />
            {/* Their words go below 600px (index.css), leaving the icons; the names stay. */}
            <Btn t={t} variant="quiet" size="sm" icon="eye" onClick={onPreview} ariaLabel="Preview">
              <span className="placer-configurator-btn-label">Preview</span>
            </Btn>
            <Btn t={t} variant="primary" size="sm" icon="send" onClick={onPublish} ariaLabel="Publish">
              <span className="placer-configurator-btn-label">Publish</span>
            </Btn>
          </>
        )}
      </div>
    </header>
  );
}

function ConfigPanel({ t, tool, setup, onChange }) {
  const steps = setupSteps(tool).filter((step) => step.inPanel !== false);
  return (
    <aside aria-label="Configuration" className="placer-configurator-panel">
      <h2 className="placer-configurator-panel-heading">Configure</h2>
      {steps.length === 0 ? (
        <p className="placer-configurator-note">This tool has nothing to configure. It is ready as it is.</p>
      ) : (
        steps.map((step, index) => {
          const problems = step.problems(setup);
          const Form = step.Form;
          // Its heading here, which a step can leave out (`panelTitle: null`).
          const heading = step.panelTitle !== undefined ? step.panelTitle : step.title;
          return (
            <section key={step.title ?? index} className="placer-configurator-section"
              aria-label={step.title ?? tool.name}>
              {heading && <h3 className="placer-configurator-section-heading">{heading}</h3>}
              <Form t={t} tool={tool} setup={setup} onChange={onChange} compact />
              {problems.length > 0 && (
                <ul className="placer-configurator-problems">
                  {problems.map((problem) => <li key={problem}>{problem}</li>)}
                </ul>
              )}
            </section>
          );
        })
      )}
    </aside>
  );
}

// Slides need ids of their own, so removing one never confuses which is which.
function newSlide(tool) {
  return { id: newId('slide'), setup: tool?.setup?.defaults() ?? null };
}

/**
 * What the page opens on: the started tool in ?draft= when it is this tool's, or a
 * fresh one, not yet kept, of one slide of the tool's defaults.
 */
function opening(tool, accountId, draftId, projectId = null) {
  const kept = tool && draftId ? readStartedTool(accountId, draftId) : null;
  // Live to begin with for a tool that runs in a room, with a group; Self-paced for
  // the rest.
  const live = Boolean(tool?.room);
  if (kept && kept.tool === tool.id && Array.isArray(kept.slides) && kept.slides.length > 0) {
    return { draftId: kept.id, slides: kept.slides, name: kept.name ?? null,
      projectId: kept.projectId ?? projectId, live: typeof kept.live === 'boolean' ? kept.live : live };
  }
  return { draftId: null, slides: [newSlide(tool)], name: null, projectId, live };
}

function SlidesPanel({ tool, slides, selectedId, onSelect, onAdd, onRemove }) {
  const category = findCategory(tool.category);
  return (
    <nav aria-label="Slides" className="placer-configurator-slides">
      <h2 className="placer-configurator-slides-heading">Slides</h2>
      <ol className="placer-configurator-slide-list">
        {slides.map((slide, index) => {
          const selected = slide.id === selectedId;
          return (
            <li key={slide.id} className="placer-configurator-slide-item">
              <button onClick={() => onSelect(slide.id)} aria-current={selected ? 'true' : undefined}
                aria-label={`Slide ${index + 1}`}
                className={`placer-configurator-slide${selected ? ' is-selected' : ''}`}>
                <span className="placer-configurator-slide-number">{index + 1}</span>
                <span className="placer-configurator-slide-thumb"
                  style={{ background: category?.colour?.c50, color: category?.colour?.c700 }}>
                  <Icon name={tool.icon} size={22} stroke={2} />
                </span>
              </button>
              {slides.length > 1 && (
                <button onClick={() => onRemove(slide.id)} aria-label={`Remove slide ${index + 1}`}
                  title="Remove slide" className="placer-configurator-slide-remove">
                  <Icon name="close" size={14} stroke={2.4} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <button onClick={onAdd} className="placer-configurator-slide-add">
        <Icon name="plus" size={16} stroke={2.2} />
        <span>Add slide</span>
      </button>
    </nav>
  );
}

export function ToolConfiguratorPage({ t, profile = null, accountId = null }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const tool = findTool(configuredToolIdFrom(location));
  const Tool = tool?.component;
  const requestedDraft = new URLSearchParams(search).get('draft');
  // The project it was added to, on the way in (AddToBoardDialog), until it is kept.
  const requestedProject = new URLSearchParams(search).get('project');

  // The tool's slides, each with its own setup, and the one on the canvas; and the id
  // it is kept under, null until it has been changed and so kept.
  const [start] = useState(() => opening(tool, accountId, requestedDraft, requestedProject));
  const [draftId, setDraftId] = useState(start.draftId);
  const [slides, setSlidesNow] = useState(start.slides);
  const [name, setNameNow] = useState(start.name);
  const [projectId, setProjectId] = useState(start.projectId);
  const [live, setLiveNow] = useState(start.live);
  const [selectedId, setSelectedId] = useState(() => start.slides[0].id);
  const [changed, setChanged] = useState(false);
  // Another tool, from the same page: start again on it.
  const [slidesFor, setSlidesFor] = useState(tool?.id ?? null);
  if ((tool?.id ?? null) !== slidesFor) {
    const next = opening(tool, accountId, requestedDraft, requestedProject);
    setSlidesFor(tool?.id ?? null);
    setDraftId(next.draftId);
    setSlidesNow(next.slides);
    setNameNow(next.name);
    setProjectId(next.projectId);
    setLiveNow(next.live);
    setSelectedId(next.slides[0].id);
    setChanged(false);
  }
  // Every change to the slides goes through here, which is what starts keeping them.
  const setSlides = (update) => {
    setSlidesNow(update);
    setChanged(true);
  };
  const setName = (next) => { setNameNow(next); setChanged(true); };
  const setLive = (next) => { setLiveNow(next); setChanged(true); };

  // The project's collaborators, for the avatars beside the signed-in account's.
  const [projectPeople, setProjectPeople] = useState([]);
  useEffect(() => {
    setProjectPeople([]);
    if (!projectId || !isSupabaseConfigured()) return undefined;
    let cancelled = false;
    readCollaborators(projectId)
      .then((found) => {
        if (cancelled) return;
        setProjectPeople(found.map((person) => ({ id: person.userId, name: person.displayName || person.email, photo: null })));
      })
      .catch((err) => console.error('Could not read the project\'s collaborators:', err));
    return () => { cancelled = true; };
  }, [projectId]);

  // The project's name, for under the tool's. undefined while it is being read; null
  // for none, or one that cannot be read (no Supabase project, or not allowed to see it).
  const [projectName, setProjectName] = useState(projectId ? undefined : null);
  useEffect(() => {
    if (!projectId || !isSupabaseConfigured()) { setProjectName(null); return undefined; }
    let cancelled = false;
    setProjectName(undefined);
    readProjectCrumb(projectId)
      .then((crumb) => { if (!cancelled) setProjectName(crumb?.name ?? null); })
      .catch((err) => {
        console.error('Could not read the project this tool is part of:', err);
        if (!cancelled) setProjectName(null);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  // Keep the tool once something has changed, and from then on with every change. The
  // first time, it gets its id, and the address takes it, in place.
  useEffect(() => {
    if (!changed || !tool) return;
    const id = draftId ?? newId('tool');
    saveStartedTool(accountId, { id, tool: tool.id, slides, name, projectId, live });
    if (!draftId) {
      setDraftId(id);
      const query = new URLSearchParams(search);
      query.set('draft', id);
      navigate(`${location}?${query.toString()}`, { replace: true });
    }
  }, [changed, slides, name, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = slides.find((slide) => slide.id === selectedId) ?? slides[0];
  const setup = selected.setup;
  const setSetup = (next) => setSlides((all) => all.map((slide) => (slide.id === selected.id ? { ...slide, setup: next } : slide)));

  const addSlide = () => {
    const slide = newSlide(tool);
    setSlides((all) => [...all, slide]);
    setSelectedId(slide.id);
  };
  // Removing the slide on the canvas puts the one before it there (or the next, for the first).
  const removeSlide = (id) => {
    const at = slides.findIndex((slide) => slide.id === id);
    const rest = slides.filter((slide) => slide.id !== id);
    if (rest.length === 0) return;
    setSlides(rest);
    if (id === selected.id) setSelectedId(rest[Math.max(0, at - 1)].id);
  };

  // What the canvas previews: the setup while the tool would accept it, or else the
  // last one it would on this slide, or else the tool's defaults. Never nothing, which
  // would bring the tool's own editors onto the canvas.
  const lastUsable = useRef({});
  const usable = useMemo(() => {
    if (!tool?.setup) return null;
    if (setup && tool.setup.problems(setup).length === 0) {
      lastUsable.current[selected.id] = setup;
      return setup;
    }
    return lastUsable.current[selected.id] ?? tool.setup.defaults();
  }, [tool, setup, selected.id]);

  const [notice, setNotice] = useState('');
  // Preview: the slide on the canvas, handed to the frames it opens.
  const [previewing, setPreviewing] = useState(false);
  const openPreview = () => {
    window[PREVIEW_KEY] = { toolId: tool.id, setup: usable };
    setPreviewing(true);
  };
  const closePreview = useCallback(() => setPreviewing(false), []);
  // Publish: open the tool, Live or Self-paced (PublishToolDialog).
  const [publishing, setPublishing] = useState(false);
  const closePublish = useCallback(() => setPublishing(false), []);
  const back = () => navigate('/dashboard');
  // Delete tool, from the ⋯ menu: forget it, if it was ever kept, and go to My Tools.
  const [deleting, setDeleting] = useState(false);
  const closeDelete = useCallback(() => setDeleting(false), []);
  const deleteTool = () => {
    if (draftId) removeStartedTool(accountId, draftId);
    navigate('/my-tools');
  };

  return (
    <div className="placer-configurator">
      <TopBar t={t} tool={tool} notice={notice} onBack={back}
        name={name} onRename={setName} projectId={projectId} projectName={projectName} live={live} onLive={setLive}
        people={[
          ...(profile?.name ? [{ id: profile.id ?? 'me', name: profile.name, photo: profile.photo ?? null }] : []),
          ...projectPeople.filter((person) => person.id !== (profile?.id ?? accountId)),
        ]}
        onSetting={(key, label) => (key === 'delete' ? setDeleting(true) : setNotice(`${label} is not built yet.`))}
        onPreview={openPreview}
        onPublish={() => setPublishing(true)} />

      {!tool ? (
        <main className="placer-configurator-missing">
          <p>There is no tool here to configure.</p>
          <Btn t={t} variant="outline" icon="arrowRight" onClick={back}>Go to the dashboard</Btn>
        </main>
      ) : (
        <div className="placer-configurator-body">
          {tool.slides && (
            <SlidesPanel tool={tool} slides={slides} selectedId={selected.id}
              onSelect={setSelectedId} onAdd={addSlide} onRemove={removeSlide} />
          )}
          <main aria-label="Canvas" className="placer-configurator-canvas">
            {tool.setup?.Canvas ? (
              // A setup made by pointing: its editor, on the canvas (`Canvas` in toolkit/tools.js).
              <div className="placer-configurator-frame" aria-label="Live preview of the slide">
                <tool.setup.Canvas key={selected.id} t={t} tool={tool} setup={setup ?? tool.setup.defaults()} onChange={setSetup} />
              </div>
            ) : (
              /* A preview only: nothing in it can be clicked, typed in or reached. */
              <div className="placer-configurator-frame" inert aria-label="Live preview of the slide">
                {/* Keyed by slide, so each slide's tool starts afresh rather than keeping
                    what was typed into the one before. */}
                <CanvasBoundary key={selected.id} resetKey={usable}>
                  {/* `slide`: just the slide, for a tool that can draw it alone (Word Cloud). */}
                  {Tool && (tool.room
                    ? <Tool t={t} tool={tool} room={previewRoom(usable)} slide />
                    : <Tool t={t} tool={tool} setup={usable} slide />)}
                </CanvasBoundary>
              </div>
            )}
          </main>
          <ConfigPanel t={t} tool={tool} setup={setup} onChange={setSetup} />
        </div>
      )}

      {deleting && tool && (
        <DeleteToolDialog t={t} title={name ?? tool.name} onDelete={deleteTool} onClose={closeDelete} />
      )}
      {previewing && tool && <PreviewDialog tool={tool} onClose={closePreview} />}
      {publishing && tool && (
        <PublishToolDialog t={t} tool={tool} name={name} slides={slides} live={live} accountId={accountId}
          projectId={projectId} projectName={projectName} organiser={profile?.name ?? ''} onClose={closePublish}
          onGoLive={(room) => navigate(roomPath(tool.id, room.id))}
          onOpenProject={() => navigate(`/projects/${encodeURIComponent(projectId)}/dashboard`)} />
      )}
    </div>
  );
}

export default ToolConfiguratorPage;
