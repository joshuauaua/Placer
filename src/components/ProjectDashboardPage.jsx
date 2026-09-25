/* PLACER — a project's dashboard: its numbers, its roster, and its documentation */

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ProjectSetupPage } from './ProjectSetupPage';
import { EXPERIMENTS, findExperiment } from '../sandbox/experiments';
import {
  codeJoinUrl,
  formatPin,
  formatRoomDate,
  isLongRoom,
  joinUrl,
  rememberHostedRoom,
  timeRemaining,
} from '../sandbox/rooms';
import { downloadQrSvg } from '../lib/qrDownload';
import {
  addCollaborator,
  addLink,
  readCollaborators,
  readLinks,
  readProject,
  readProjectRooms,
  readStats,
  removeCollaborator,
  removeLink,
} from '../services/projects';
import { closeRoom } from '../services/rooms';

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

function Card({ t, title, children }) {
  return (
    <section style={{ padding: 24, marginBottom: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

function StatTile({ t, icon, label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 140, padding: 18, background: t.surfaceAlt, borderRadius: 12 }}>
      <Icon name={icon} size={18} stroke={2} style={{ color: t.inkDim, marginBottom: 8 }} />
      <div className="placer-disp" style={{ fontSize: 26, fontWeight: 700, color: t.ink }}>{value}</div>
      <div style={{ fontSize: 12.5, color: t.inkDim, fontWeight: 500 }}>{label}</div>
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

function ExperimentMenuItem({ t, experiment, onClick }) {
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
      <Icon name={experiment.icon} size={17} stroke={2} style={{ color: experiment.color, flex: '0 0 auto' }} />
      {experiment.name}
    </button>
  );
}

/**
 * "Open Sandbox for this project" needed to become a choice once the Sandbox held
 * more than one experiment — same dismissal shape as UserMenu's dropdown, which is
 * this app's first one.
 */
function AddSandboxExperiment({ t, onChoose }) {
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
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        style={{ height: 42, padding: '0 18px', borderRadius: 12, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8, background: t.accent,
          color: t.accentInk, border: '1px solid transparent', fontFamily: 'var(--placer-font)',
          fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
        <Icon name="sparkle" size={18} stroke={2.1} />
        Add Sandbox Experiment
        <Icon name={open ? 'chevUp' : 'chevDown'} size={15} stroke={2.2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Sandbox experiments"
          style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 10,
            minWidth: 240, padding: '6px 0', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: t.shadow,
            overflow: 'hidden' }}>
          {EXPERIMENTS.map((experiment) => (
            <ExperimentMenuItem key={experiment.id} t={t} experiment={experiment}
              onClick={() => { setOpen(false); onChoose(experiment.id); }} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One open room: its QR code, how it is going, and the three things a project runs it
 * with — open it as the facilitator, save its code to print, and close it. The point of
 * having these here rather than only on the room itself is that a poll left running for
 * a month outlives the browser tab, and often the device, it was opened on.
 */
function RoomRow({ t, room, onOpen, onClose }) {
  const qrRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const experiment = findExperiment(room.experiment);
  const long = isLongRoom(room);
  const url = long ? codeJoinUrl(room.joinCode) : joinUrl(room.pin);
  const left = timeRemaining(room.expiresAt);
  const name = experiment?.name ?? room.experiment;

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
          onClick={() => downloadQrSvg(qrRef.current, `placer-${room.experiment}-qr.svg`)}>
          Download QR
        </Btn>
        {/* The same two-step RoomBar's Close room uses: closing ends it for everybody. */}
        <Btn t={t} variant="quiet" size="sm" icon="close"
          onClick={() => (confirming ? onClose(room) : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          style={confirming ? { borderColor: '#B3261E', color: '#B3261E' } : undefined}>
          {confirming ? 'Close — confirm' : 'Close'}
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
 * Reached cold from a link the way PublicProjectPage is, so `projectId` is all this
 * needs — everything else is read here. `isOwner` gates the roster and delete
 * controls; a plain collaborator sees everything else.
 */
export function ProjectDashboardPage({ t, accountId, projectId,
  onOpenSandbox, onOpenRoom, onNavigateToPublic }) {
  const [project, setProject] = useState(null);
  const [status, setStatus] = useState('loading');
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState(null);
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
    loadEverything(projectId)
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load the project dashboard:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [projectId, loadEverything, loadRooms]);

  const isOwner = project?.ownerId === accountId;

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

  const handleOpenRoom = (room) => {
    // Hands this browser the facilitator's token before going, so the room opens as
    // the facilitator's view — PIN or QR, count, Close — rather than a participant's.
    const long = isLongRoom(room);
    rememberHostedRoom(room.id, { pin: room.pin, token: room.facilitatorToken, code: long ? room.joinCode : null });
    onOpenRoom?.(room.experiment, room.id);
  };

  const handleCloseRoom = async (room) => {
    try {
      await closeRoom(room.id, room.facilitatorToken);
    } catch (err) {
      console.error('Could not close that room:', err);
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
    return <div style={{ padding: 48, fontSize: 14, color: t.inkDim, fontWeight: 500 }}>Loading…</div>;
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
        onSaved={(saved) => { setProject(saved); setEditing(false); }}
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          <StatTile t={t} icon="grid" label="Imaginations" value={stats?.imaginationsCount ?? 0} />
          <StatTile t={t} icon="arrowUp" label="Votes received" value={stats?.imaginationsUpvotes ?? 0} />
          <StatTile t={t} icon="sparkle" label="Sandbox sessions" value={stats?.sandboxRoomsCount ?? 0} />
        </div>

        <Card t={t} title="Sandbox">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 16 }}>
            Open an experiment attached to this project — it shows up in the count
            above, and on the public page once it has run.
          </p>
          <AddSandboxExperiment t={t} onChoose={(experimentId) => onOpenSandbox(project.id, experimentId)} />

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
                  <RoomRow key={room.id} t={t} room={room} onOpen={handleOpenRoom} onClose={handleCloseRoom} />
                ))
              )}
            </div>
          )}
        </Card>

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
      </div>
    </div>
  );
}

export default ProjectDashboardPage;
