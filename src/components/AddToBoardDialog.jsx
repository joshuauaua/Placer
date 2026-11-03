/* PLACER — the step after picking a tool in Create a tool: which board it goes on.
 *
 * Create a tool picks a kind (CreateToolMenu), then a tool (ChooseToolDialog), then
 * this: add the tool to one of your boards, picked from a dropdown of every board you
 * run or collaborate on (readMyProjects), or create a new board for it. A new board
 * needs a name; it can be made private, and made a group board, which invites
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

/**
 * One of the two ways to go, as a card with a radio in it. The label is the radio and
 * its title only: what goes under it (the dropdown) is a control of its own.
 */
function Choice({ t, name, value, checked, onChange, title, children }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 14,
      border: `1.5px solid ${checked ? t.ink : t.line}`, background: checked ? t.surfaceAlt : 'transparent',
      marginBottom: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)}
          style={{ width: 18, height: 18, margin: 0, accentColor: t.ink }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: t.ink }}>{title}</span>
      </label>
      {children && <div style={{ marginTop: 10, paddingLeft: 28 }}>{children}</div>}
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
        Invite collaborators to join this board
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

  const [mode, setMode] = useState(null); // 'existing' | 'new'; null until the boards are in
  const [boardId, setBoardId] = useState('');
  // With boards to pick from, the dropdown comes first; with none, a new board.
  if (boards && mode === null) {
    setMode(boards.length > 0 ? 'existing' : 'new');
    if (boards.length > 0) setBoardId(boards[0].id);
  }

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
    if (mode === 'new' && !name.trim()) { setError('Give the board a name.'); return; }
    if (mode === 'existing' && !boardId) { setError('Pick a board.'); return; }
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
        <h2 id={titleId} className="placer-h3" style={{ margin: 0, color: t.ink }}>Add {tool.name} to a board</h2>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: t.inkDim }}>
          A board is where a tool is run, shared and its answers gathered.
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
        Boards need an account, and this copy of PLACER has no Supabase project to keep them in.
        You can still set the tool up on its own.
      </p>
    );
    actions = <Btn t={t} type="button" icon="arrowRight" onClick={() => onDone(null)}>Continue without a board</Btn>;
  } else if (partly) {
    body = (
      <div role="alert" style={{ fontSize: 15, color: t.ink, lineHeight: 1.55 }}>
        <p style={{ marginBottom: 8 }}>The board is made and {tool.name} is on it, but these invitations could not be sent:</p>
        <ul style={{ margin: '0 0 8px 20px' }}>{partly.failed.map((email) => <li key={email}>{email}</li>)}</ul>
        <p style={{ color: t.inkDim }}>You can invite them again from the board&rsquo;s dashboard.</p>
      </div>
    );
    actions = <Btn t={t} type="button" icon="arrowRight" onClick={() => onDone(partly.boardId)}>Continue</Btn>;
  } else if (!boards) {
    body = <p style={{ fontSize: 15, color: t.inkDim }}>Loading your boards…</p>;
  } else {
    body = (
      <div role="radiogroup" aria-label="Board">
        <Choice t={t} name="board-mode" value="existing" checked={mode === 'existing'} onChange={setMode}
          title="Add to an existing board">
          {boards.length > 0 ? (
            mode === 'existing' ? (
              <select aria-label="Your boards" value={boardId} onChange={(e) => setBoardId(e.target.value)}
                style={{ ...inputStyle(t), padding: '10px 14px', fontSize: 15 }}>
                {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
              </select>
            ) : null
          ) : (
            <span style={{ fontSize: 14, color: t.inkDim }}>
              {loadFailed ? 'Your boards could not be loaded.' : 'You have no boards yet.'}
            </span>
          )}
        </Choice>
        <Choice t={t} name="board-mode" value="new" checked={mode === 'new'} onChange={setMode}
          title="Create a new board" />
        {mode === 'new' && (
          <div style={{ padding: '8px 4px 0' }}>
            <label htmlFor="board-name" style={labelStyle(t)}>Board name</label>
            <input id="board-name" type="text" value={name} maxLength={NAME_MAX} required
              onChange={(e) => setName(e.target.value)} placeholder="e.g. Rethinking Möllevångstorget"
              style={{ ...inputStyle(t), marginBottom: 20 }} />
            <Switch t={t} id="board-private" label="Private" checked={isPrivate} onChange={setPrivate}
              description={isPrivate
                ? 'Only you, your collaborators and people you let in can see it.'
                : 'Anyone can find the board, see its page and take part.'} />
            <Switch t={t} id="board-group" label="Group board" checked={group} onChange={setGroup}
              description="Run it with others: invite collaborators to join this board." />
            {group && <Invitees t={t} emails={emails} onChange={setEmails} />}
          </div>
        )}
      </div>
    );
    actions = (
      <Btn t={t} type="submit" icon={mode === 'new' ? 'plus' : 'arrowRight'} disabled={busy || (mode === 'existing' && boards.length === 0)}>
        {busy ? 'Saving…' : mode === 'new' ? 'Create' : 'Add to board'}
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
