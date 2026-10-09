/* PLACER — a project's dashboard: its numbers, its roster, and its documentation */

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Icon } from './Icon';
import { Btn, LoadingMark } from './UI';
import { ProjectViewsChart } from './ProjectViewsChart';
import { ProjectSetupPage } from './ProjectSetupPage';
import { TOOLS, findTool, isToolLive } from '../toolkit/tools';
import { ConfigureToolDialog } from './ConfigureToolDialog';
import {
  codeJoinUrl,
  formatPin,
  formatRoomDate,
  isLongRoom,
  joinUrl,
  rememberHostedRoom,
  timeRemaining,
} from '../toolkit/rooms';
import { downloadQrSvg } from '../lib/qrDownload';
import {
  addCollaborator,
  addLink,
  deleteProject,
  readCollaborators,
  readAccessRequests,
  decideAccess,
  removeAccess,
  readLinks,
  readProject,
  readProjectRooms,
  readConfiguredProjectTools,
  readProjectTools,
  readStats,
  readProjectViews,
  removeCollaborator,
  removeLink,
  saveProjectTools,
} from '../services/projects';
import { closeRoom, deleteRoom } from '../services/rooms';
import { readPreferences, readProjectResponses, saveProjectResponses } from '../services/notifications';
import { ProjectResponsesChoice } from './ProjectResponsesChoice';

// The alert red used across the app.
const DANGER = '#B3261E';

const inputStyle = (t) => ({
  padding: '10px 14px',
  fontSize: 14,
  border: `1.5px solid ${t.line}`,
  borderRadius: 12,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

// `action`, when given, sits at the far right of the title's row.
function Card({ t, title, action, children }) {
  return (
    <section style={{ padding: 24, marginBottom: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: t.ink, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* How loud answers in this project's Toolkit sessions are for whoever is looking:
 * their own choice for this project, or their default from Settings. Each member
 * sets their own; nobody else's changes. */
function ProjectNotifications({ t, projectId }) {
  // undefined while loading; a level, or null for "use my default", once loaded.
  const [level, setLevel] = useState(undefined);
  const [defaultLevel, setDefaultLevel] = useState('every');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([readProjectResponses(projectId), readPreferences()])
      .then(([own, prefs]) => {
        if (cancelled) return;
        setLevel(own);
        setDefaultLevel(prefs.project_responses ?? 'every');
      })
      .catch((err) => {
        console.error("Could not load this project's notification settings:", err);
        if (!cancelled) setError('Your notification settings for this project could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const choose = async (next) => {
    const previous = level;
    setLevel(next);
    setSaving(true);
    setError(null);
    try {
      await saveProjectResponses(projectId, next);
    } catch (err) {
      console.error("Could not save this project's notification settings:", err);
      setError('Could not save that. Try again.');
      setLevel(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card t={t} title="Notifications">
      <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 16 }}>
        What you hear when people answer this project&rsquo;s tools. Just for you: everyone
        who runs the project chooses their own.
      </p>
      {error && (
        <p role="alert" style={{ fontSize: 13.5, color: DANGER, fontWeight: 500, marginBottom: 12 }}>{error}</p>
      )}
      {level === undefined && !error && <LoadingMark size={28} />}
      {level !== undefined && (
        <ProjectResponsesChoice t={t} name="project-responses" legend="Responses"
          value={level} defaultLevel={defaultLevel} disabled={saving} onChange={choose} />
      )}
    </Card>
  );
}

/**
 * Who may see a private project beyond its collaborators: the people waiting to be let
 * in, with Let in and Decline, and the people already in, who can be taken off again.
 * Only on a private project — a public one is open to everybody. Declined requests are
 * kept but not listed, so a no is not asked again.
 */
function ProjectAccess({ t, projectId }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => readAccessRequests(projectId)
    .then(setRequests)
    .catch((err) => {
      console.error('Could not load who has asked to see the project:', err);
      setError('Could not load who has asked to see this project.');
    }), [projectId]);

  useEffect(() => { load(); }, [load]);

  const act = async (action) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const pending = (requests ?? []).filter((request) => request.status === 'pending');
  const approved = (requests ?? []).filter((request) => request.status === 'approved');
  const linkButton = { background: 'none', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 };

  return (
    <Card t={t} title="Who can see this project">
      <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.55, marginBottom: 16 }}>
        It is private: only collaborators and the people you let in can see it and take part. Share its
        page&rsquo;s link, and people can ask to be let in.
      </p>
      {requests === null && !error && <p style={{ fontSize: 13.5, color: t.inkFaint }}>Loading…</p>}

      {pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: t.inkDim, marginBottom: 4 }}>Asking to be let in</h3>
          {pending.map((request) => (
            <div key={request.userId} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0',
              borderTop: `1px solid ${t.line}` }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: t.ink }}>{request.displayName}</span>
              <button onClick={() => act(() => decideAccess(projectId, request.userId, true))}
                style={{ ...linkButton, color: t.ink }}>
                Let in
              </button>
              <button onClick={() => act(() => decideAccess(projectId, request.userId, false))}
                style={{ ...linkButton, color: t.inkDim }}>
                Decline
              </button>
            </div>
          ))}
        </div>
      )}

      {requests !== null && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: t.inkDim, marginBottom: 4 }}>Let in</h3>
          {approved.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkFaint }}>Nobody yet.</p>
          ) : approved.map((request) => (
            <div key={request.userId} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0',
              borderTop: `1px solid ${t.line}` }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: t.ink }}>{request.displayName}</span>
              <button onClick={() => act(() => removeAccess(projectId, request.userId))}
                style={{ ...linkButton, color: t.inkDim }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{error}</p>}
    </Card>
  );
}

/* The project's numbers as one small table: a column each, the label in
 * capitals along the top, the number under it, hairlines between. */
function StatTable({ t, stats }) {
  return (
    <div style={{ display: 'flex', marginBottom: 32, border: `1px solid ${t.ink}`, borderRadius: 10,
      overflow: 'hidden', background: t.surface }}>
      {stats.map(({ label, value }, i) => (
        <div key={label} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column',
          borderLeft: i === 0 ? 'none' : `1px solid ${t.ink}` }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '14px 8px', borderBottom: `1px solid ${t.ink}`, fontSize: 12, fontWeight: 500,
            letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', color: t.ink }}>
            {label}
          </div>
          <div className="placer-disp" style={{ padding: '20px 8px', fontSize: 26, fontWeight: 700,
            textAlign: 'center', color: t.ink }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollaboratorRow({ t, collaborator, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderTop: `1px solid ${t.line}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
          {collaborator.displayName || collaborator.email}
        </div>
        {collaborator.displayName && (
          <div style={{ fontSize: 12.5, color: t.inkDim }}>{collaborator.email}</div>
        )}
      </div>
      <button onClick={() => onRemove(collaborator)} style={{ background: 'none', border: 'none',
        color: t.inkDim, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0 }}>
        Remove
      </button>
    </div>
  );
}

function ToolMenuItem({ t, tool, onClick }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 14px', background: 'transparent', color: t.ink, cursor: 'pointer',
        border: 'none', fontFamily: 'var(--placer-font)', fontWeight: 500, fontSize: 14.5,
        letterSpacing: '-0.01em', textAlign: 'left' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <Icon name={tool.icon} size={17} stroke={2} style={{ color: tool.color, flex: '0 0 auto' }} />
      {tool.name}
    </button>
  );
}

/**
 * Adds a tool to the project, from the Toolkit's tools it does not have yet — same
 * dismissal shape as UserMenu's dropdown, which is this app's first one.
 */
function AddToolkitTool({ t, chosen = [], onChoose }) {
  const available = TOOLS.filter((tool) => !chosen.includes(tool.id));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handlePointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={available.length === 0}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        style={{ height: 42, padding: '0 18px', borderRadius: 12, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8, background: t.accent,
          color: t.accentInk, border: '1px solid transparent', fontFamily: 'var(--placer-font)',
          fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
        <Icon name="sparkle" size={18} stroke={2.1} />
        Add a Tool
        <Icon name={open ? 'chevUp' : 'chevDown'} size={15} stroke={2.2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Toolkit tools"
          // Hangs from the button's right edge, as the button sits at the card's.
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 10,
            minWidth: 240, padding: '6px 0', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: t.shadow,
            overflow: 'hidden' }}>
          {available.map((tool) => (
            <ToolMenuItem key={tool.id} t={t} tool={tool}
              onClick={() => { setOpen(false); onChoose(tool.id); }} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One of this project's tools (project_tools): live on the public page, or waiting to
 * be configured for the project first (ConfigureToolDialog). A tool that runs in a room
 * is live while its room is open, and that room is listed under Open rooms; any other
 * live tool can be configured again.
 */
function ChosenToolRow({ t, tool, live, inRoom, onConfigure }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '12px 0', borderTop: `1px solid ${t.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, flex: '0 0 auto', background: tool.tint,
          boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={tool.icon} size={18} stroke={2} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{tool.name}</span>
            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              background: live ? '#E3F4E8' : t.surfaceAlt, color: live ? '#1E6B3A' : t.inkDim }}>
              {live ? 'Live' : 'Not configured'}
            </span>
          </div>
          {tool.tagline && <div style={{ fontSize: 12.5, color: t.inkDim }}>{tool.tagline}</div>}
        </div>
      </div>
      {!live ? (
        <Btn t={t} variant="primary" size="sm" onClick={onConfigure} ariaLabel={`Configure ${tool.name}`}>
          Configure
        </Btn>
      ) : !inRoom && (
        <Btn t={t} variant="secondary" size="sm" onClick={onConfigure} ariaLabel={`Configure ${tool.name} again`}>
          Edit
        </Btn>
      )}
    </div>
  );
}

/**
 * One open room: its QR code, how it is going, and the things a project runs it with —
 * open it as the facilitator, save its code to print, close it, or delete it and
 * everything contributed to it. The point of
 * having these here rather than only on the room itself is that a poll left running for
 * a month outlives the browser tab, and often the device, it was opened on.
 */
function RoomRow({ t, room, onOpen, onClose, onDelete }) {
  const qrRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tool = findTool(room.tool);
  const long = isLongRoom(room);
  const url = long ? codeJoinUrl(room.joinCode) : joinUrl(room.pin);
  const left = timeRemaining(room.expiresAt);
  const name = tool?.name ?? room.tool;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0',
      borderTop: `1px solid ${t.line}`, flexWrap: 'wrap' }}>
      <div ref={qrRef} style={{ background: '#fff', padding: 6, borderRadius: 12,
        border: `1px solid ${t.line}`, flex: '0 0 auto', display: 'flex' }}>
        <QRCode value={url} size={64} bgColor="#ffffff" fgColor="#000000" title={`Join ${name}`} />
      </div>

      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{name}</div>
        <div style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>
          {room.contributions} {room.contributions === 1 ? 'response' : 'responses'}
          {left ? ` · ${left} left` : ''}
          {long ? ` · open until ${formatRoomDate(room.expiresAt)}` : ` · PIN ${formatPin(room.pin)}`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn t={t} variant="outline" size="sm" icon="arrowRight" onClick={() => onOpen(room)}>
          Open
        </Btn>
        <Btn t={t} variant="quiet" size="sm" icon="arrowDown"
          onClick={() => downloadQrSvg(qrRef.current, `placer-${room.tool}-qr.svg`)}>
          Download QR
        </Btn>
        {/* The same two-step RoomBar's Close room uses: closing ends it for everybody. */}
        <Btn t={t} variant="quiet" size="sm" icon="close"
          onClick={() => (confirming ? onClose(room) : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          style={confirming ? { borderColor: '#B3261E', color: '#B3261E' } : undefined}>
          {confirming ? 'Close — confirm' : 'Close'}
        </Btn>
        {/* Deleting takes every response with it, so it asks the same way. */}
        <Btn t={t} variant="quiet" size="sm" icon="trash"
          onClick={() => (confirmingDelete ? onDelete(room) : setConfirmingDelete(true))}
          onBlur={() => setConfirmingDelete(false)}
          style={confirmingDelete ? { borderColor: DANGER, color: DANGER } : undefined}>
          {confirmingDelete ? 'Delete — confirm' : 'Delete'}
        </Btn>
      </div>
    </div>
  );
}

function LinkRow({ t, link, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderTop: `1px solid ${t.line}`, gap: 12 }}>
      <a href={link.url} target="_blank" rel="noreferrer"
        style={{ fontSize: 14, fontWeight: 700, color: t.ink, textDecoration: 'underline',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {link.title}
      </a>
      <button onClick={() => onRemove(link)} style={{ background: 'none', border: 'none',
        color: t.inkDim, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, flex: '0 0 auto' }}>
        Remove
      </button>
    </div>
  );
}

/**
 * The owner's way to remove the project for good: a button that opens a dialog, where
 * typing the project's name unlocks the delete, because a second click on a confirm is
 * too easy to make without reading — and there is no undo. What goes and what stays is
 * spelled out, since the imaginations posted to it are other people's and are kept.
 */
function DeleteProject({ t, project, onDeleted }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Btn t={t} variant="outline" size="sm" icon="trash" onClick={() => setOpen(true)}
        style={{ color: DANGER, borderColor: DANGER }}>
        Delete project
      </Btn>
      {open && <DeleteProjectDialog t={t} project={project} onDeleted={onDeleted}
        onClose={() => setOpen(false)} />}
    </>
  );
}

function DeleteProjectDialog({ t, project, onDeleted, onClose }) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const fieldRef = useRef(null);

  const matches = typed.trim() === project.name.trim();

  // Escape closes it, unless the delete is already under way.
  useEffect(() => {
    fieldRef.current?.focus();
    const handleKeyDown = (e) => { if (e.key === 'Escape' && !deleting) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleting, onClose]);

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!matches || deleting) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteProject(project.id);
      onDeleted?.();
    } catch (err) {
      console.error('Could not delete this project:', err);
      setError(err?.message ?? 'Could not delete this project.');
      setDeleting(false);
    }
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-project-title"
        style={{ width: '100%', maxWidth: 480, padding: 24, background: t.surface, borderRadius: 16,
          boxShadow: t.shadow }}>
        <h2 id="delete-project-title" style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 12 }}>
          Delete project
        </h2>
        <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
          Removes the project, its public page, its image, its news and resources, its
          collaborators and its page views, and takes it off everyone's followed list. The
          imaginations and Toolkit sessions made for it stay, no longer linked to it. This
          cannot be undone.
        </p>
        <form onSubmit={handleDelete}>
          <label htmlFor="delete-project-name"
            style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
            {`Type “${project.name}” to confirm`}
          </label>
          <input id="delete-project-name" ref={fieldRef} value={typed} autoComplete="off"
            onChange={(e) => { setTyped(e.target.value); setError(null); }}
            style={{ ...inputStyle(t), width: '100%', boxSizing: 'border-box' }} />
          {error && <p role="alert" style={{ fontSize: 13, color: DANGER, marginTop: 10 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn t={t} variant="outline" size="sm" type="button" onClick={onClose} disabled={deleting}>Cancel</Btn>
            <Btn t={t} variant="outline" size="sm" icon="trash" type="submit" disabled={!matches || deleting}
              style={{ color: DANGER, borderColor: DANGER }}>
              {deleting ? 'Deleting…' : 'Delete project'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Reached cold from a link the way PublicProjectPage is, so `projectId` is all this
 * needs — everything else is read here. `isOwner` gates the roster and delete
 * controls; a plain collaborator sees everything else.
 */
export function ProjectDashboardPage({ t, accountId, projectId, organisations = [],
  onOpenRoom, onNavigateToPublic, onDeleted }) {
  const [project, setProject] = useState(null);
  const [status, setStatus] = useState('loading');
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState(null);
  // The public page's views: null while loading, false if they could not be read.
  const [views, setViews] = useState(null);
  const [viewDays, setViewDays] = useState(30);
  const [collaborators, setCollaborators] = useState([]);
  const [links, setLinks] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState(null);
  const [addingLink, setAddingLink] = useState(false);
  // Null until loaded, and left null if the database has not had rooms-lifetime.sql
  // yet — the rest of the dashboard does not depend on it, so it should not fail with it.
  const [rooms, setRooms] = useState(null);
  // The tools chosen for it at setup or added since, as registry ids. Like rooms, the
  // dashboard stands without them, so a failure leaves the list empty.
  const [tools, setTools] = useState([]);
  // Which of them have been configured, and the one being configured now.
  const [configured, setConfigured] = useState(new Set());
  const [configuring, setConfiguring] = useState(null);

  const loadTools = useCallback(async (id) => {
    try {
      const [chosen, done] = await Promise.all([readProjectTools(id), readConfiguredProjectTools(id)]);
      setTools(chosen);
      setConfigured(done);
    } catch (err) {
      console.error("Could not load this project's tools:", err);
      setTools([]);
    }
  }, []);

  const loadRooms = useCallback(async (id) => {
    try {
      setRooms(await readProjectRooms(id));
    } catch (err) {
      console.error("Could not load this project's rooms:", err);
      setRooms(null);
    }
  }, []);

  const loadEverything = useCallback(async (id) => {
    const [proj, projStats, roster, docs] = await Promise.all([
      readProject(id),
      readStats(id),
      readCollaborators(id),
      readLinks(id),
    ]);
    setProject(proj);
    setStats(projStats);
    setCollaborators(roster);
    setLinks(docs);
  }, []);

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;

    setStatus('loading');
    loadRooms(projectId);
    loadTools(projectId);
    loadEverything(projectId)
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load the project dashboard:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [projectId, loadEverything, loadRooms, loadTools]);

  // Loaded apart from everything else: the dashboard stands without them, so a
  // failure here is logged and the views simply do not appear.
  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    readProjectViews(projectId, viewDays)
      .then((found) => { if (!cancelled) setViews(found); })
      .catch((err) => {
        if (cancelled) return;
        console.error("Could not load this project's views:", err);
        setViews(false);
      });
    return () => { cancelled = true; };
  }, [projectId, viewDays]);

  const isOwner = project?.ownerId === accountId;
  // A tool the registry no longer has is skipped rather than shown blank.
  const chosenTools = tools.map(findTool).filter(Boolean);
  const viewsInRange = views ? views.daily.reduce((sum, d) => sum + d.views, 0) : 0;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setInviteError(null);
    try {
      await addCollaborator(project.id, inviteEmail.trim());
      setCollaborators(await readCollaborators(project.id));
      setInviteEmail('');
    } catch (err) {
      console.error('Could not add that collaborator:', err);
      setInviteError(err?.message ?? 'Could not add that collaborator.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (collaborator) => {
    setCollaborators((current) => current.filter((c) => c.userId !== collaborator.userId));
    try {
      await removeCollaborator(project.id, collaborator.userId);
    } catch (err) {
      console.error('Could not remove that collaborator:', err);
      setCollaborators(await readCollaborators(project.id));
    }
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim() || addingLink) return;

    setAddingLink(true);
    setLinkError(null);
    try {
      const saved = await addLink(project.id, { title: linkTitle.trim(), url: linkUrl.trim(), addedBy: accountId });
      setLinks((current) => [...current, saved]);
      setLinkTitle('');
      setLinkUrl('');
    } catch (err) {
      console.error('Could not add that link:', err);
      setLinkError(err?.message ?? 'Could not add that link — check the URL starts with http:// or https://.');
    } finally {
      setAddingLink(false);
    }
  };

  // "Add a Tool" adds it to the project and goes straight on to configuring it, since
  // it is not live until it has been. The dialog waits on the save: configuring
  // changes the tool's row, which has to exist first.
  const handleAddTool = async (toolId) => {
    if (tools.includes(toolId)) {
      setConfiguring(toolId);
      return;
    }
    setTools((current) => [...current, toolId]);
    try {
      await saveProjectTools(project.id, [...tools, toolId], accountId);
      setConfiguring(toolId);
    } catch (err) {
      console.error('Could not add that tool to the project:', err);
      loadTools(project.id);
    }
  };

  const handleConfigured = () => {
    setConfiguring(null);
    loadTools(project.id);
    loadRooms(project.id);
  };

  const handleOpenRoom = (room) => {
    // Hands this browser the facilitator's token before going, so the room opens as
    // the facilitator's view — PIN or QR, count, Close — rather than a participant's.
    const long = isLongRoom(room);
    rememberHostedRoom(room.id, { pin: room.pin, token: room.facilitatorToken, code: long ? room.joinCode : null });
    onOpenRoom?.(room.tool, room.id);
  };

  const handleCloseRoom = async (room) => {
    try {
      await closeRoom(room.id, room.facilitatorToken);
    } catch (err) {
      console.error('Could not close that room:', err);
    }
    loadRooms(project.id);
  };

  const handleDeleteRoom = async (room) => {
    try {
      await deleteRoom(room.id, room.facilitatorToken);
    } catch (err) {
      console.error('Could not delete that room:', err);
    }
    loadRooms(project.id);
  };

  const handleRemoveLink = async (link) => {
    setLinks((current) => current.filter((l) => l.id !== link.id));
    try {
      await removeLink(link.id);
    } catch (err) {
      console.error('Could not remove that link:', err);
      setLinks(await readLinks(project.id));
    }
  };

  if (status === 'loading') {
    return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><LoadingMark /></div>;
  }

  if (status === 'error' || !project) {
    return (
      <div role="alert" style={{ padding: 48, fontSize: 14, color: t.ink, fontWeight: 500 }}>
        Could not load this project's dashboard. See the console for details.
      </div>
    );
  }

  if (editing) {
    return (
      <ProjectSetupPage
        t={t}
        project={project}
        accountName={project.ownerName}
        organisations={organisations}
        onSaved={(saved) => { setProject(saved); setEditing(false); loadTools(saved.id); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px 96px' }} className="placer-scroll">
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 16, marginBottom: 32 }}>
          <div>
            <h1 className="placer-disp" style={{ fontSize: 36, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 8 }}>
              {project.name}
            </h1>
            <span
              onClick={() => onNavigateToPublic(project.id)}
              role="link" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigateToPublic(project.id); }}
              style={{ fontSize: 14, color: t.inkDim, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
              View the public page
            </span>
          </div>
          {isOwner && (
            <Btn t={t} variant="outline" size="sm" icon="pencil" onClick={() => setEditing(true)}>
              Edit setup
            </Btn>
          )}
        </div>

        <StatTable t={t} stats={[
          { label: 'Imaginations', value: stats?.imaginationsCount ?? 0 },
          { label: 'Votes received', value: stats?.imaginationsUpvotes ?? 0 },
          { label: 'Toolkit sessions', value: stats?.toolkitRoomsCount ?? 0 },
          ...(views !== false ? [{ label: 'Page views', value: views ? views.total : '–' }] : []),
        ]} />

        {views && (
          <Card t={t} title="Page views">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: t.ink }}>{viewsInRange}</strong>{' '}
                {viewsInRange === 1 ? 'view' : 'views'} of the public page in the last {viewDays} days.
                Visits by you and your collaborators are not counted.
              </p>
              <div role="radiogroup" aria-label="Period" style={{ display: 'flex', gap: 6 }}>
                {[7, 30].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={viewDays === n}
                    onClick={() => setViewDays(n)}
                    style={{ height: 32, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'var(--placer-font)', fontSize: 13, fontWeight: 500, color: t.ink,
                      background: viewDays === n ? t.surfaceAlt : 'transparent',
                      border: `1px solid ${viewDays === n ? t.ink : t.line}` }}>
                    {n} days
                  </button>
                ))}
              </div>
            </div>
            <ProjectViewsChart t={t} daily={views.daily} />
          </Card>
        )}

        <Card t={t} title="Toolkit"
          action={<AddToolkitTool t={t} chosen={tools} onChoose={handleAddTool} />}>
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: 0 }}>
            The tools this project uses. Each is a template: configure it for this project
            and it goes live on the public page.
          </p>

          {chosenTools.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkFaint, marginTop: 16, marginBottom: 0 }}>
              No tools yet. Add one to configure it for this project.
            </p>
          ) : (
            <div style={{ marginTop: 16 }}>
              {chosenTools.map((tool) => {
                const openRoom = (rooms ?? []).find((room) => room.tool === tool.id && room.status === 'open') ?? null;
                return (
                  <ChosenToolRow key={tool.id} t={t} tool={tool}
                    live={isToolLive(tool, { configured: configured.has(tool.id), openRoom })}
                    inRoom={Boolean(openRoom)}
                    onConfigure={() => setConfiguring(tool.id)} />
                );
              })}
            </div>
          )}

          {rooms && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>Open rooms</h3>
              <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55, marginBottom: 8 }}>
                A room opened from here can stay open for up to 90 days — long enough to print
                its QR code on a poster and leave it up.
              </p>
              {rooms.filter((room) => room.status === 'open').length === 0 ? (
                <p style={{ fontSize: 13.5, color: t.inkFaint }}>No rooms are open right now.</p>
              ) : (
                rooms.filter((room) => room.status === 'open').map((room) => (
                  <RoomRow key={room.id} t={t} room={room} onOpen={handleOpenRoom} onClose={handleCloseRoom}
                    onDelete={handleDeleteRoom} />
                ))
              )}
            </div>
          )}
        </Card>

        {configuring && findTool(configuring) && (
          <ConfigureToolDialog t={t} project={project} tool={findTool(configuring)}
            onClose={() => setConfiguring(null)} onConfigured={handleConfigured} />
        )}

        <ProjectNotifications t={t} projectId={project.id} />

        <Card t={t} title="Documentation">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 16 }}>
            News, articles and resources — links only, shown on the public page.
          </p>
          {links.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkFaint, marginBottom: 16 }}>Nothing attached yet.</p>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {links.map((link) => <LinkRow key={link.id} t={t} link={link} onRemove={handleRemoveLink} />)}
            </div>
          )}
          <form onSubmit={handleAddLink} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Title" aria-label="Link title" style={{ ...inputStyle(t), flex: '1 1 160px' }} />
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…" aria-label="Link URL" style={{ ...inputStyle(t), flex: '2 1 220px' }} />
            <Btn t={t} variant="primary" size="sm" icon="plus" disabled={addingLink}
              ariaLabel="Add link">
              {addingLink ? 'Adding…' : 'Add'}
            </Btn>
          </form>
          {linkError && <p role="alert" style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{linkError}</p>}
        </Card>

        <Card t={t} title="Collaborators">
          {collaborators.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkFaint, marginBottom: isOwner ? 16 : 0 }}>
              Just {project.ownerName} so far.
            </p>
          ) : (
            <div style={{ marginBottom: isOwner ? 16 : 0 }}>
              {collaborators.map((collaborator) => (
                isOwner
                  ? <CollaboratorRow key={collaborator.userId} t={t} collaborator={collaborator} onRemove={handleRemoveCollaborator} />
                  : (
                    <div key={collaborator.userId} style={{ padding: '10px 0', borderTop: `1px solid ${t.line}`,
                      fontSize: 14, fontWeight: 700, color: t.ink }}>
                      {collaborator.displayName || collaborator.email}
                    </div>
                  )
              ))}
            </div>
          )}
          {isOwner && (
            <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Invite by email" aria-label="Invite a collaborator by email"
                style={{ ...inputStyle(t), flex: 1 }} />
              <Btn t={t} variant="primary" size="sm" icon="plus" disabled={inviting} ariaLabel="Add collaborator">
                {inviting ? 'Adding…' : 'Add'}
              </Btn>
            </form>
          )}
          {inviteError && <p role="alert" style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{inviteError}</p>}
        </Card>

        {project.visibility === 'private' && <ProjectAccess t={t} projectId={project.id} />}

        {isOwner && <DeleteProject t={t} project={project} onDeleted={onDeleted} />}
      </div>
    </div>
  );
}

export default ProjectDashboardPage;
