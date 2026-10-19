/* PLACER — a project's dashboard, in three tabs under its name, opening on the first.
 *
 *   Project Settings  its setup, collaborators, reference material, notifications, who
 *                     may see a private project, and deleting it
 *   My Toolkit        the tools it uses, and the rooms open for them
 *   Project Insights  a table of its insights — who has seen it, who has taken part and
 *                     how, and where it stands
 *
 * The dialogs a tab opens (configuring a tool, changing a room) are drawn outside the
 * tabs, so switching tab never loses one half-way.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Icon } from './Icon';
import { Btn, LoadingMark, PageLoader } from './UI';
import { ProjectSetupPage } from './ProjectSetupPage';
import { TOOLS, findTool, isToolLive, projectSetupKind } from '../toolkit/tools';
import { ConfigureToolDialog } from './ConfigureToolDialog';
import { ToolsByCategory } from './toolkit/ToolsByCategory';
import {
  closingRange,
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
  readProjectToolConfig,
  readConfiguredProjectTools,
  readProjectTools,
  readStats,
  readProjectViews,
  removeCollaborator,
  removeLink,
  removeProjectImageFile,
  saveProjectTools,
} from '../services/projects';
import { closeRoom, deleteRoom, setRoomCloses } from '../services/rooms';
import { readComments, readProjectSummary, readUpdates } from '../services/projectPage';
import { projectProgress } from '../lib/projectTimeline';
import { DatePicker } from './DatePicker';
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
const NUMBER = new Intl.NumberFormat('en-GB');

const DASHBOARD_TABS = [
  { id: 'settings', label: 'Project Settings' },
  { id: 'toolkit', label: 'My Toolkit' },
  { id: 'general', label: 'Project Insights' },
];

/** A card on the dashboard. `danger` rules it, and heads it, in the alert red. */
function Card({ t, title, action, danger = false, children }) {
  return (
    <section aria-label={title} style={{ padding: 24, marginBottom: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${danger ? DANGER : t.line}`, boxShadow: t.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: danger ? DANGER : t.ink, margin: 0 }}>{title}</h2>
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
/**
 * Everything the dashboard knows about how the project is doing, as one table in three
 * groups — who has seen it, who has taken part, and where it stands. `groups` is
 * [{ title, rows: [{ label, value, note }] }]; a value still loading or that could not
 * be read is '–'.
 */
function InsightsTable({ t, groups }) {
  return (
    <section aria-labelledby="dashboard-insights" style={{ marginBottom: 24 }}>
      <h2 id="dashboard-insights" style={{ fontSize: 16, fontWeight: 700, color: t.ink, margin: '0 0 12px' }}>
        Insights
      </h2>
      {/* The frame is on a box around the table: a collapsed table's own border takes no
          rounded corners. */}
      <div style={{ border: `1px solid ${t.line}`, borderRadius: 12, overflow: 'hidden', background: t.surface }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--placer-font)' }}>
          {groups.map(({ title, rows }, index) => (
            <tbody key={title} style={{ borderTop: index === 0 ? 'none' : `1px solid ${t.line}` }}>
              <tr>
                <th scope="colgroup" colSpan={2} style={{ textAlign: 'left', padding: '14px 20px 8px',
                  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: t.inkDim, background: t.surfaceAlt }}>
                  {title}
                </th>
              </tr>
              {rows.map(({ label, value, note }) => (
                <tr key={label} style={{ borderTop: `1px solid ${t.line}` }}>
                  <th scope="row" style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500, color: t.ink,
                    fontSize: 14.5 }}>
                    {label}
                    {note && (
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 400, color: t.inkDim,
                        marginTop: 2 }}>
                        {note}
                      </span>
                    )}
                  </th>
                  <td className="placer-disp" style={{ padding: '12px 20px', textAlign: 'right', fontSize: 20,
                    fontWeight: 700, color: t.ink, whiteSpace: 'nowrap' }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
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

/**
 * Adds a tool to the project: a button that opens the Toolkit's tools in a dialog.
 * Choosing one it does not have yet only adds it to the list, waiting to be configured.
 * A tool that runs in a room is offered even once the project has it, since a project
 * can run several — two Polls asking different questions — and choosing it again sets
 * up one more room (handleAddTool).
 */
function AddToolkitTool({ t, chosen = [], onChoose }) {
  const available = TOOLS.filter((tool) => !chosen.includes(tool.id) || projectSetupKind(tool) === 'room');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="Add a tool"
        title="Add a tool"
        disabled={available.length === 0}
        onClick={() => setOpen(true)}
        style={{ width: 42, height: 42, borderRadius: 12, cursor: available.length ? 'pointer' : 'default',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: t.accent,
          color: t.accentInk, border: '1px solid transparent', opacity: available.length ? 1 : 0.5 }}>
        <Icon name="plus" size={20} stroke={2.4} />
      </button>
      {open && (
        <AddToolDialog t={t} tools={available} onClose={() => setOpen(false)}
          onChoose={(id) => { setOpen(false); onChoose(id); }} />
      )}
    </>
  );
}

function AddToolDialog({ t, tools, onChoose, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.focus();
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="add-tool-title" tabIndex={-1}
        style={{ width: '100%', maxWidth: 480, maxHeight: 'min(90vh, 720px)', overflowY: 'auto', padding: 24,
          background: t.surface, borderRadius: 16, boxShadow: t.shadow, outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          marginBottom: 12 }}>
          <h2 id="add-tool-title" style={{ fontSize: 18, fontWeight: 700, color: t.ink, margin: 0 }}>Add a tool</h2>
          <button type="button" aria-label="Close" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.inkDim, padding: 4,
              display: 'flex' }}>
            <Icon name="close" size={18} stroke={2.2} />
          </button>
        </div>
        <ToolsByCategory t={t} tools={tools} onPick={onChoose} idPrefix="add-tool" />
      </div>
    </div>
  );
}

/**
 * One of this project's tools (project_tools): live on the public page, or waiting to
 * be configured for the project first (ConfigureToolDialog). A tool that runs in a room
 * is live while a room of it is open; its row then opens out on click to show its
 * rooms, and any scheduled to start, with what the project runs them with (RoomRow).
 * It can have several at once, each set up on its own — two Polls asking different
 * questions — and one more is added from the Add a tool dialog, not from here.
 *
 * Its one button is Configure until it is set up, and Edit after: for a tool that runs
 * in a room, Edit changes its room, or opens the row out to its rooms when it has
 * several, each with its own Edit; any other tool is configured again.
 */
// A room still to come counts as well as one running: its QR code can go up early.
const isCurrentRoom = (room) => room.status === 'open' || room.status === 'scheduled';

function ChosenToolRow({ t, tool, live, scheduled = null, rooms = [], onConfigure, onOpenRoom,
  onEditRoom, onCloseRoom, onDeleteRoom, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  // Removing asks once more, in the row, since it takes the tool's setup with it.
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const panelId = useId();
  const expandable = rooms.length > 0;
  const liveRooms = rooms.filter((room) => room.status === 'open').length;
  const badge = live ? (liveRooms > 1 ? `${liveRooms} live` : 'Live')
    : scheduled ? `Starts ${formatRoomDate(scheduled.opensAt)}` : 'Not configured';
  const roomTool = projectSetupKind(tool) === 'room';

  const summary = (
    <>
      <span style={{ width: 36, height: 36, borderRadius: 10, flex: '0 0 auto', background: tool.tint,
        boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.ink }}>
        <Icon name={tool.icon} size={18} stroke={2} />
      </span>
      <span style={{ minWidth: 0, display: 'block' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{tool.name}</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            background: live ? '#E3F4E8' : scheduled ? '#E8EEFB' : t.surfaceAlt,
            color: live ? '#1E6B3A' : scheduled ? '#2F4F9E' : t.inkDim }}>
            {badge}
          </span>
        </span>
        {tool.tagline && <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim }}>{tool.tagline}</span>}
      </span>
    </>
  );

  return (
    <div style={{ borderTop: `1px solid ${t.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '12px 0' }}>
        {expandable ? (
          <button type="button" aria-expanded={expanded} aria-controls={panelId}
            onClick={() => setExpanded((was) => !was)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, padding: 0,
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--placer-font)' }}>
            {summary}
            <Icon name={expanded ? 'chevUp' : 'chevDown'} size={16} stroke={2.2}
              style={{ color: t.inkDim, marginLeft: 'auto', flex: '0 0 auto' }} />
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>{summary}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
          {confirmingRemove ? (
            <>
              <span style={{ fontSize: 13, color: t.inkDim }}>Remove {tool.name} and its setup?</span>
              <Btn t={t} variant="secondary" size="sm" icon="trash" ariaLabel={`Yes, remove ${tool.name}`}
                onClick={() => { setConfirmingRemove(false); onRemove(); }} style={{ color: DANGER }}>
                Remove
              </Btn>
              <Btn t={t} variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)}>Cancel</Btn>
            </>
          ) : (
            <>
              {roomTool && rooms.length > 0 ? (
                <Btn t={t} variant="secondary" size="sm" icon="pencil" ariaLabel={`Edit ${tool.name}`}
                  onClick={() => (rooms.length === 1 ? onEditRoom(rooms[0]) : setExpanded(true))}>
                  Edit
                </Btn>
              ) : live || scheduled ? (
                <Btn t={t} variant="secondary" size="sm" icon="pencil" onClick={onConfigure} ariaLabel={`Edit ${tool.name}`}>
                  Edit
                </Btn>
              ) : (
                <Btn t={t} variant="primary" size="sm" onClick={onConfigure} ariaLabel={`Configure ${tool.name}`}>
                  Configure
                </Btn>
              )}
              {onRemove && (
                <Btn t={t} variant="ghost" size="sm" icon="trash" ariaLabel={`Remove ${tool.name}`}
                  title={`Remove ${tool.name}`} onClick={() => setConfirmingRemove(true)} />
              )}
            </>
          )}
        </div>
      </div>
      {expandable && expanded && (
        <div id={panelId} role="region" aria-label={`${tool.name} rooms`} style={{ padding: '0 0 8px 48px' }}>
          {rooms.map((room) => (
            <RoomRow key={room.id} t={t} room={room} named={false} onOpen={onOpenRoom} onEdit={onEditRoom}
              onClose={onCloseRoom} onDelete={onDeleteRoom} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One room: its QR code, how it is going, and the things a project runs it with —
 * open it as the facilitator, save its code to print, close it, or delete it and
 * everything contributed to it. The point of
 * having these here rather than only on the room itself is that a poll left running for
 * a month outlives the browser tab, and often the device, it was opened on.
 */
function RoomRow({ t, room, named = true, onOpen, onEdit, onClose, onDelete }) {
  const qrRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tool = findTool(room.tool);
  const long = isLongRoom(room);
  const url = long ? codeJoinUrl(room.joinCode) : joinUrl(room.pin);
  const scheduled = room.status === 'scheduled';
  // Before it starts, all of it can change; once open, a long room's closing day can.
  const editable = Boolean(onEdit) && (scheduled || (room.status === 'open' && long));
  const left = scheduled ? null : timeRemaining(room.expiresAt);
  const name = tool?.name ?? room.tool;
  // Which of the tool's rooms this is, from its setup: a Poll's question.
  const label = room.config ? tool?.room?.label?.(room.config) ?? null : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0',
      borderTop: `1px solid ${t.line}`, flexWrap: 'wrap' }}>
      <div ref={qrRef} style={{ background: '#fff', padding: 6, borderRadius: 12,
        border: `1px solid ${t.line}`, flex: '0 0 auto', display: 'flex' }}>
        <QRCode value={url} size={64} bgColor="#ffffff" fgColor="#000000" title={`Join ${name}`} />
      </div>

      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        {named && <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{name}</div>}
        {label && (
          <div style={{ fontSize: named ? 13.5 : 14, fontWeight: named ? 500 : 700, color: t.ink,
            overflowWrap: 'anywhere' }}>
            {label}
          </div>
        )}
        <div style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>
          {scheduled
            ? `Starts ${formatRoomDate(room.opensAt)}`
            : `${room.contributions} ${room.contributions === 1 ? 'response' : 'responses'}`}
          {left ? ` · ${left} left` : ''}
          {long ? ` · open until ${formatRoomDate(room.expiresAt)}` : ` · PIN ${formatPin(room.pin)}`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn t={t} variant="outline" size="sm" icon="arrowRight" onClick={() => onOpen(room)}>
          Open
        </Btn>
        {editable && (
          <Btn t={t} variant="quiet" size="sm" icon="pencil" onClick={() => onEdit(room)}
            ariaLabel={scheduled ? `Edit ${label ?? name}` : `Change when ${label ?? name} closes`}>
            Edit
          </Btn>
        )}
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

/**
 * When an open room closes, moved: the one thing about it that can change once people
 * may have answered it (supabase/rooms-edit.sql). It closes at the end of the day chosen.
 */
function RoomClosesDialog({ t, room, onClose, onSaved }) {
  const range = closingRange(room);
  const [day, setDay] = useState(range?.current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  const tool = findTool(room.tool);
  const label = room.config ? tool?.room?.label?.(room.config) ?? null : null;

  useEffect(() => {
    panelRef.current?.focus();
    const handleKeyDown = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  const save = async (e) => {
    e.preventDefault();
    if (busy || !day) return;
    setBusy(true);
    setError(null);
    try {
      await setRoomCloses(room.id, day);
      onSaved();
    } catch (err) {
      console.error('Could not change when that room closes:', err);
      setError(err?.message ?? 'Could not change when that room closes.');
      setBusy(false);
    }
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="room-closes-title" tabIndex={-1}
        onSubmit={save}
        style={{ width: '100%', maxWidth: 440, padding: 24, background: t.surface, borderRadius: 16,
          boxShadow: t.shadow, outline: 'none' }}>
        <h2 id="room-closes-title" style={{ fontSize: 18, fontWeight: 700, color: t.ink, margin: '0 0 6px' }}>
          Change when it closes
        </h2>
        <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: '0 0 18px' }}>
          {label ? <><strong style={{ color: t.ink }}>{label}</strong> · </> : null}
          {tool?.name ?? room.tool} is live, so what it asks stays as it is: people have
          answered it. It can run on longer, or end sooner, up to 90 days from when it opened.
        </p>
        {error && <p role="alert" style={{ fontSize: 13.5, color: '#B3261E', margin: '0 0 12px' }}>{error}</p>}
        <label htmlFor="room-closes-day"
          style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.inkDim, marginBottom: 6 }}>
          Closes at the end of
        </label>
        <DatePicker t={t} id="room-closes-day" value={day} min={range?.min} max={range?.max}
          label="Choose the closing day" placeholder="Pick a day" clearable={false} disabled={busy}
          onChange={setDay}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.line}`,
            background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Btn t={t} variant="outline" size="sm" type="button" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn t={t} variant="primary" size="sm" type="submit" disabled={busy || !day || day === range?.current}>
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </form>
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
export function ProjectDashboardPage({ t, accountId, projectId, organisations = [], initialTab = 'settings',
  onOpenRoom, onNavigateToPublic, onDeleted }) {
  const [project, setProject] = useState(null);
  const [status, setStatus] = useState('loading');
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [stats, setStats] = useState(null);
  // The public page's views: null while loading, false if they could not be read.
  const [views, setViews] = useState(null);
  // The public page's followers and interactions, and how many updates and comments it
  // has (services/projectPage.js): null while loading or when they could not be read.
  const [summary, setSummary] = useState(null);
  const [postCounts, setPostCounts] = useState(null);
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
  // A room being changed: a scheduled one in the configure dialog, an open one's
  // closing day in its own.
  const [editingRoom, setEditingRoom] = useState(null);

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
    readProjectViews(projectId, 30)
      .then((found) => { if (!cancelled) setViews(found); })
      .catch((err) => {
        if (cancelled) return;
        console.error("Could not load this project's views:", err);
        setViews(false);
      });
    readProjectSummary(projectId)
      .then((found) => { if (!cancelled) setSummary(found); })
      .catch((err) => console.error("Could not load this project's followers and interactions:", err));
    Promise.all([readUpdates(projectId), readComments(projectId)])
      .then(([updates, comments]) => {
        if (!cancelled) setPostCounts({ updates: updates.length, comments: comments.length });
      })
      .catch((err) => console.error("Could not count this project's updates and comments:", err));
    return () => { cancelled = true; };
  }, [projectId]);

  const isOwner = project?.ownerId === accountId;
  // A tool the registry no longer has is skipped rather than shown blank.
  const chosenTools = tools.map(findTool).filter(Boolean);
  const otherRooms = (rooms ?? []).filter((room) => isCurrentRoom(room) && !tools.includes(room.tool));
  // The daily views run oldest to newest, a day each for the last 30 days.
  const viewsOver = (days) => (views ? views.daily.slice(-days).reduce((sum, d) => sum + d.views, 0) : null);
  const shown = (value) => (value === null || value === undefined ? '–' : NUMBER.format(value));

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

  // Adding a tool only puts it on the list, waiting to be configured: its row's
  // Configure is how it goes live.
  const handleAddTool = async (toolId) => {
    // Already on the list: only a tool that runs in a room is offered again, and
    // choosing it sets up one more room of it.
    if (tools.includes(toolId)) {
      if (projectSetupKind(findTool(toolId)) === 'room') setConfiguring(toolId);
      return;
    }
    setTools((current) => [...current, toolId]);
    try {
      await saveProjectTools(project.id, [...tools, toolId], accountId);
    } catch (err) {
      console.error('Could not add that tool to the project:', err);
      loadTools(project.id);
    }
  };

  // Taking a tool off the project takes its setup with it (its project_tools row). Its
  // rooms stay as they are: closing or deleting them is each room's own. Idea
  // Visualizer's base image is deleted too, since nothing points at it any more.
  const handleRemoveTool = async (toolId) => {
    const remaining = tools.filter((id) => id !== toolId);
    const scene = toolId === 'reimagine-a-space'
      ? await readProjectToolConfig(project.id, toolId).catch(() => null)
      : null;
    setTools(remaining);
    try {
      await saveProjectTools(project.id, remaining, accountId);
      if (scene?.imagePath) {
        removeProjectImageFile(scene.imagePath).catch((err) => console.error('Could not remove the base image:', err));
      }
    } catch (err) {
      console.error('Could not remove that tool from the project:', err);
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

  const handleRoomEdited = () => {
    setEditingRoom(null);
    loadRooms(project.id);
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

  const liveTools = chosenTools.filter((tool) => {
    const openRoom = (rooms ?? []).find((room) => room.tool === tool.id && room.status === 'open') ?? null;
    return isToolLive(tool, { configured: configured.has(tool.id), openRoom });
  }).length;
  const responses = rooms ? rooms.reduce((sum, room) => sum + (room.contributions ?? 0), 0) : null;
  const insightGroups = project ? [
    { title: 'Audience', rows: [
      { label: 'Page views', value: shown(views ? views.total : null),
        note: 'All time. Visits by you and your collaborators are not counted.' },
      { label: 'Page views, last 30 days', value: shown(viewsOver(30)) },
      { label: 'Page views, last 7 days', value: shown(viewsOver(7)) },
      { label: 'Followers', value: shown(summary?.followers) },
    ] },
    { title: 'Participation', rows: [
      { label: 'Interactions', value: shown(summary?.interactions),
        note: 'Toolkit responses, imaginations and comments together.' },
      { label: 'Toolkit responses', value: shown(responses), note: 'Answers given in its tools\' rooms.' },
      { label: 'Toolkit sessions', value: shown(stats?.toolkitRoomsCount), note: 'Rooms opened for its tools.' },
      { label: 'Rooms open now', value: shown(rooms ? rooms.filter((room) => room.status === 'open').length : null) },
      { label: 'Imaginations', value: shown(stats?.imaginationsCount) },
      { label: 'Votes on imaginations', value: shown(stats?.imaginationsUpvotes) },
      { label: 'Comments', value: shown(postCounts?.comments) },
    ] },
    { title: 'Project', rows: [
      { label: 'Tools live', value: `${NUMBER.format(liveTools)} of ${NUMBER.format(chosenTools.length)}` },
      { label: 'Updates posted', value: shown(postCounts?.updates) },
      { label: 'People involved', value: shown(1 + collaborators.length), note: 'The owner and collaborators.' },
      { label: 'Timeline', value: projectProgress(project).label },
    ] },
  ] : [];

  const onTabKey = (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = DASHBOARD_TABS.findIndex(({ id }) => id === tab);
    const next = DASHBOARD_TABS[(index + step + DASHBOARD_TABS.length) % DASHBOARD_TABS.length].id;
    setTab(next);
    document.getElementById(`dashboard-tab-${next}`)?.focus();
  };

  if (status === 'loading') {
    return <PageLoader />;
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
        </div>

        <div role="tablist" aria-label="Dashboard sections" onKeyDown={onTabKey}
          style={{ display: 'flex', gap: 4, overflowX: 'auto', borderBottom: `1px solid ${t.line}`, marginBottom: 32 }}>
          {DASHBOARD_TABS.map(({ id, label }) => {
            const current = id === tab;
            return (
              <button key={id} id={`dashboard-tab-${id}`} type="button" role="tab" aria-selected={current}
                aria-controls={`dashboard-panel-${id}`} tabIndex={current ? 0 : -1} onClick={() => setTab(id)}
                className="placer-project-tab"
                style={{ color: current ? t.ink : t.inkDim, fontWeight: current ? 700 : 500,
                  boxShadow: current ? `inset 0 -3px 0 ${t.ink}` : 'none' }}>
                {label}
              </button>
            );
          })}
        </div>

        <div id={`dashboard-panel-${tab}`} role="tabpanel" aria-labelledby={`dashboard-tab-${tab}`}>
          {tab === 'general' && (
            <InsightsTable t={t} groups={insightGroups} />
          )}

          {tab === 'toolkit' && (
            <Card t={t} title="My Toolkit"
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
                    const scheduled = openRoom ? null
                      : (rooms ?? []).find((room) => room.tool === tool.id && room.status === 'scheduled') ?? null;
                    return (
                      <ChosenToolRow key={tool.id} t={t} tool={tool}
                        live={isToolLive(tool, { configured: configured.has(tool.id), openRoom })}
                        scheduled={scheduled}
                        rooms={(rooms ?? []).filter((room) => room.tool === tool.id && isCurrentRoom(room))}
                        onConfigure={() => setConfiguring(tool.id)}
                        onOpenRoom={handleOpenRoom} onEditRoom={setEditingRoom} onCloseRoom={handleCloseRoom}
                        onDeleteRoom={handleDeleteRoom} onRemove={() => handleRemoveTool(tool.id)} />
                    );
                  })}
                </div>
              )}

              {/* A room whose tool has since been taken off the list has no row to open out
                  under, so it is listed on its own rather than lost from sight. */}
              {otherRooms.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>Other rooms</h3>
                  <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55, marginBottom: 8 }}>
                    Still open for tools no longer on this list.
                  </p>
                  {otherRooms.map((room) => (
                    <RoomRow key={room.id} t={t} room={room} onOpen={handleOpenRoom} onEdit={setEditingRoom}
                      onClose={handleCloseRoom} onDelete={handleDeleteRoom} />
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'settings' && (
            <>
              {isOwner && (
                <Card t={t} title="Project setup" action={(
                  <Btn t={t} variant="outline" size="sm" icon="pencil" onClick={() => setEditing(true)}>
                    Edit setup
                  </Btn>
                )}>
                  <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: 0 }}>
                    Its name, description, goals, dates, place, picture and who can see it.
                  </p>
                </Card>
              )}
              <Card t={t} title="Collaborators">
                {collaborators.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: t.inkFaint, marginBottom: isOwner ? 16 : 0 }}>
                    Just {project.ownerName} so far.
                  </p>
                ) : (
                  <div style={{ marginBottom: isOwner ? 16 : 0 }}>
                    {collaborators.map((collaborator) => (
                      isOwner
                        ? <CollaboratorRow key={collaborator.userId} t={t} collaborator={collaborator}
                          onRemove={handleRemoveCollaborator} />
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
                {inviteError && (
                  <p role="alert" style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{inviteError}</p>
                )}
              </Card>

              <Card t={t} title="Reference Material">
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

              <ProjectNotifications t={t} projectId={project.id} />

              {project.visibility === 'private' && <ProjectAccess t={t} projectId={project.id} />}

              {/* Last, and apart from the rest: what cannot be undone. */}
              {isOwner && (
                <Card t={t} title="Danger zone" danger>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: 0, flex: '1 1 260px' }}>
                      Delete this project, its page and everything set up for it. This cannot be undone.
                    </p>
                    <DeleteProject t={t} project={project} onDeleted={onDeleted} />
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {configuring && findTool(configuring) && (
          <ConfigureToolDialog t={t} project={project} tool={findTool(configuring)}
            onClose={() => setConfiguring(null)} onConfigured={handleConfigured} />
        )}
        {editingRoom?.status === 'scheduled' && findTool(editingRoom.tool) && (
          <ConfigureToolDialog t={t} project={project} tool={findTool(editingRoom.tool)} room={editingRoom}
            onClose={() => setEditingRoom(null)} onConfigured={handleRoomEdited} />
        )}
        {editingRoom?.status === 'open' && (
          <RoomClosesDialog t={t} room={editingRoom} onClose={() => setEditingRoom(null)}
            onSaved={handleRoomEdited} />
        )}
      </div>
    </div>
  );
}

export default ProjectDashboardPage;
