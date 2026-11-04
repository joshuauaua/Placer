/* PLACER — the step after picking a tool in Create a tool: which board it goes on.
 *
 * Create a tool picks a kind (CreateToolMenu), then a tool (ChooseToolDialog), then
 * this: one dropdown of every board you run or collaborate on (readMyProjects), and
 * at its foot "+ Create a new board". Picking a board adds the tool to it; picking
 * the last option brings out what a new board needs. A new board needs a name; it can be made private, and made a group board, which invites
 * collaborators by email as it is created (addCollaborator — there is no directory of
 * people to search, so an address is how somebody is found).
 *
 * `onDone(boardId)` is called once the tool is on the board. Invitations that could not
 * be sent do not undo the board: they are listed, and Continue carries on. `onBack`
 * goes back to the list of tools. Without a Supabase project there are no boards, so
 * it offers to carry on without one (`onDone(null)`).
 *
 * Boards are projects in the code and the database (services/projects.js).
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn, inputStyle, labelStyle } from './UI';
import {
  addCollaborator, addProjectTool, createProject, isSupabaseConfigured, readMyProjects,
} from '../services/projects';
import { findCategory } from '../toolkit/tools';

const NAME_MAX = 80;
// The dropdown's last option, which is not a board but the way to make one.
const NEW_BOARD = '__new__';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An on/off switch with its label beside it and a line under it saying what on means. */
function Switch({ t, id, label, description, checked, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: 0, border: 0,
          background: 'none', cursor: 'pointer', font: 'inherit' }}>
        <span aria-hidden="true" style={{ position: 'relative', width: 44, height: 26, borderRadius: 13,
          flex: '0 0 auto', background: checked ? t.ink : t.line, transition: 'background 0.15s' }}>
          <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20,
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.ink }}>{label}</span>
      </button>
      <div style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.5, marginTop: 6, paddingLeft: 56 }}>
        {description}
      </div>
    </div>
  );
}

/** The emails to invite: typed one at a time, each shown as a chip that can be taken off. */
function Invitees({ t, emails, onChange }) {
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState('');

  const add = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL.test(email)) { setProblem('That does not look like an email address.'); return; }
    if (emails.includes(email)) { setProblem('They are already on the list.'); return; }
    onChange([...emails, email]);
    setDraft('');
    setProblem('');
  };

  return (
    <div style={{ margin: '-4px 0 20px 56px' }}>
      <label htmlFor="board-invite" style={{ ...labelStyle(t), fontSize: 14 }}>
        Invite collaborators to join this project
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="board-invite" type="email" value={draft} placeholder="name@example.org"
          onChange={(e) => { setDraft(e.target.value); setProblem(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          }}
          aria-invalid={problem ? true : undefined} aria-describedby="board-invite-hint"
          style={{ ...inputStyle(t), flex: 1, minWidth: 0, padding: '10px 14px', fontSize: 15 }} />
        <Btn t={t} type="button" variant="outline" size="sm" icon="plus" onClick={add}>Add</Btn>
      </div>
      <div id="board-invite-hint" role={problem ? 'alert' : undefined}
        style={{ fontSize: 13, marginTop: 6, color: problem ? '#B3261E' : t.inkDim }}>
        {problem || 'By email: they get an invitation to accept from their Activity.'}
      </div>
      {emails.length > 0 && (
        <ul aria-label="Invited" style={{ listStyle: 'none', margin: '10px 0 0', padding: 0,
          display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {emails.map((email) => (
            <li key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 4px 4px 12px', borderRadius: 999, background: t.surfaceAlt,
              fontSize: 14, color: t.ink }}>
              {email}
              <button type="button" aria-label={`Remove ${email}`}
                onClick={() => onChange(emails.filter((entry) => entry !== email))}
                style={{ width: 24, height: 24, borderRadius: 999, border: 'none', background: 'none',
                  cursor: 'pointer', color: t.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={14} stroke={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AddToBoardDialog({ t, tool, accountId, ownerName = '', onDone, onBack, onClose }) {
  const panelRef = useRef(null);
  const available = isSupabaseConfigured() && Boolean(accountId);
  const colour = findCategory(tool.category)?.colour;

  // The boards this account can add a tool to, for the dropdown.
  const [boards, setBoards] = useState(null); // null while loading
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    if (!available) return undefined;
    let cancelled = false;
    readMyProjects(accountId)
      .then((found) => { if (!cancelled) setBoards(found); })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your boards:', err);
        setBoards([]);
        setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [available, accountId]);

  // What the dropdown has picked: a board's id, or NEW_BOARD. Null until the boards are
  // in; then the first board, or a new one when there are none.
  const [picked, setPicked] = useState(null);
  if (boards && picked === null) setPicked(boards.length > 0 ? boards[0].id : NEW_BOARD);
  const mode = picked === NEW_BOARD ? 'new' : 'existing';
  const boardId = mode === 'existing' ? picked : '';

  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [group, setGroup] = useState(false);
  const [emails, setEmails] = useState([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // A new board whose invitations did not all go: its id, and the addresses that failed.
  const [partly, setPartly] = useState(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, busy]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'new' && !name.trim()) { setError('Give the project a name.'); return; }
    if (mode === 'existing' && !boardId) { setError('Pick a project.'); return; }
    setBusy(true);
    try {
      if (mode === 'existing') {
        await addProjectTool(boardId, tool.id, accountId);
        onDone(boardId);
        return;
      }
      const board = await createProject({
        ownerId: accountId, ownerName, name: name.trim(), visibility: isPrivate ? 'private' : 'public',
      });
      await addProjectTool(board.id, tool.id, accountId);
      const failed = [];
      for (const email of group ? emails : []) {
        try {
          await addCollaborator(board.id, email);
        } catch (err) {
          console.error(`Could not invite ${email}:`, err);
          failed.push(email);
        }
      }
      if (failed.length > 0) {
        setPartly({ boardId: board.id, failed });
        setBusy(false);
        return;
      }
      onDone(board.id);
    } catch (err) {
      console.error('Could not put the tool on a board:', err);
      setError(err?.message ?? 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  const titleId = 'add-to-board-title';
  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 16px 16px 20px',
      borderBottom: `1px solid ${t.line}` }}>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, flex: '0 0 auto',
        background: colour?.c100, color: colour?.c700,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={tool.icon} size={20} stroke={2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 id={titleId} className="placer-h3" style={{ margin: 0, color: t.ink }}>Add {tool.name} to a project</h2>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: t.inkDim }}>
          A project is where a tool is run, shared and its answers gathered.
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" disabled={busy}
        style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'none',
          cursor: 'pointer', color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={18} stroke={2} />
      </button>
    </div>
  );

  let body;
  let actions;
  if (!available) {
    body = (
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.55 }}>
        Projects need an account, and this copy of PLACER has no Supabase project to keep them in.
        You can still set the tool up on its own.
      </p>
    );
    actions = <Btn t={t} type="button" icon="arrowRight" onClick={() => onDone(null)}>Continue without a project</Btn>;
  } else if (partly) {
    body = (
      <div role="alert" style={{ fontSize: 15, color: t.ink, lineHeight: 1.55 }}>
        <p style={{ marginBottom: 8 }}>The project is made and {tool.name} is on it, but these invitations could not be sent:</p>
        <ul style={{ margin: '0 0 8px 20px' }}>{partly.failed.map((email) => <li key={email}>{email}</li>)}</ul>
        <p style={{ color: t.inkDim }}>You can invite them again from the project&rsquo;s dashboard.</p>
      </div>
    );
    actions = <Btn t={t} type="button" icon="arrowRight" onClick={() => onDone(partly.boardId)}>Continue</Btn>;
  } else if (!boards) {
    body = <p style={{ fontSize: 15, color: t.inkDim }}>Loading your projects…</p>;
  } else {
    body = (
      <div>
        <label htmlFor="board-pick" style={labelStyle(t)}>Project</label>
        <select id="board-pick" value={picked ?? NEW_BOARD} onChange={(e) => setPicked(e.target.value)}
          style={{ ...inputStyle(t), marginBottom: 8 }}>
          {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
          <option value={NEW_BOARD}>+ Create a new project</option>
        </select>
        {boards.length === 0 && (
          <p style={{ fontSize: 14, color: t.inkDim, margin: '0 0 8px' }}>
            {loadFailed ? 'Your projects could not be loaded, but you can make a new one.' : 'You have no projects yet.'}
          </p>
        )}
        {mode === 'new' && (
          <div style={{ marginTop: 16, padding: '18px 18px 2px', borderRadius: 14, background: t.surfaceAlt }}>
            <label htmlFor="board-name" style={labelStyle(t)}>Project name</label>
            <input id="board-name" type="text" value={name} maxLength={NAME_MAX} required
              onChange={(e) => setName(e.target.value)} placeholder="e.g. Rethinking Möllevångstorget"
              style={{ ...inputStyle(t), marginBottom: 20 }} />
            <Switch t={t} id="board-private" label="Private" checked={isPrivate} onChange={setPrivate}
              description={isPrivate
                ? 'Only you, your collaborators and people you let in can see it.'
                : 'Anyone can find the project, see its page and take part.'} />
            <Switch t={t} id="board-group" label="Group project" checked={group} onChange={setGroup}
              description="Run it with others: invite collaborators to join this project." />
            {group && <Invitees t={t} emails={emails} onChange={setEmails} />}
          </div>
        )}
      </div>
    );
    actions = (
      <Btn t={t} type="submit" icon={mode === 'new' ? 'plus' : 'arrowRight'} disabled={busy}>
        {busy ? 'Saving…' : mode === 'new' ? 'Create' : 'Add to project'}
      </Btn>
    );
  }

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onSubmit={submit} noValidate
        style={{ width: '100%', maxWidth: 520, maxHeight: 'min(88vh, 760px)', display: 'flex',
          flexDirection: 'column', background: t.surface, borderRadius: 16, boxShadow: t.shadow,
          outline: 'none', overflow: 'hidden' }}>
        {header}
        <div className="placer-scroll" style={{ padding: '20px', overflowY: 'auto' }}>
          {body}
          {error && (
            <p role="alert" style={{ marginTop: 12, fontSize: 14, color: '#B3261E' }}>{error}</p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 20px',
          borderTop: `1px solid ${t.line}` }}>
          <Btn t={t} type="button" variant="ghost" icon="chevLeft" onClick={onBack} disabled={busy || Boolean(partly)}>Back</Btn>
          {actions}
        </div>
      </form>
    </div>
  );
}

export default AddToBoardDialog;
