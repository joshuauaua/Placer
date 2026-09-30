/* PLACER — an organisation's dashboard: its details, its projects, its admins, and
 * closing it.
 *
 * Admins only. Somebody else who reaches the URL is told so and pointed at the public
 * page — the database would refuse them every change here anyway (see
 * supabase/organisations.sql), so this only saves them the confusion.
 */

import { useCallback, useEffect, useState } from 'react';
import { Btn, LoadingMark } from './UI';
import { ProjectCard } from './ProjectCard';
import { OrganisationSetupPage } from './OrganisationSetupPage';
import {
  addAdmin, closeOrganisation, readAdmins, readOrganisation, removeAdmin,
} from '../services/organisations';
import { readOrganisationProjects } from '../services/projects';

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

function Card({ t, title, children }) {
  return (
    <section style={{ padding: 24, marginBottom: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

function AdminRow({ t, admin, isYou, canRemove, onRemove }) {
  const label = admin.displayName || admin.email || 'An admin';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '10px 0', borderTop: `1px solid ${t.line}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
          {label}{isYou ? ' (you)' : ''}
        </div>
        {admin.displayName && admin.email && (
          <div style={{ fontSize: 12.5, color: t.inkDim }}>{admin.email}</div>
        )}
      </div>
      {canRemove && (
        <button type="button" onClick={() => onRemove(admin)} style={{ background: 'none', border: 'none',
          color: t.inkDim, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, flex: '0 0 auto' }}>
          {isYou ? 'Leave' : 'Remove'}
        </button>
      )}
    </div>
  );
}

/**
 * Closing deletes the organisation. Typing its name unlocks the button, the same as
 * deleting a project, because there is no undo.
 */
function CloseOrganisation({ t, organisation, onClosed }) {
  const [typed, setTyped] = useState('');
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);

  const matches = typed.trim() === organisation.name.trim();

  const handleClose = async (e) => {
    e.preventDefault();
    if (!matches || closing) return;

    setClosing(true);
    setError(null);
    try {
      await closeOrganisation(organisation.id);
      onClosed?.();
    } catch (err) {
      console.error('Could not close this organisation:', err);
      setError(err?.message ?? 'Could not close this organisation.');
      setClosing(false);
    }
  };

  return (
    <Card t={t} title="Close organisation">
      <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 16 }}>
        Removes the organisation, its public page and its list of admins. Its projects stay,
        run by whoever started each one, and no longer in the organisation&rsquo;s name.
        This cannot be undone.
      </p>
      <form onSubmit={handleClose}>
        <label htmlFor="close-organisation-name"
          style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
          {`Type “${organisation.name}” to confirm`}
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input id="close-organisation-name" value={typed} autoComplete="off"
            onChange={(e) => { setTyped(e.target.value); setError(null); }}
            style={{ ...inputStyle(t), flex: '1 1 240px' }} />
          <Btn t={t} variant="outline" size="sm" icon="trash" type="submit" disabled={!matches || closing}
            style={{ color: DANGER, borderColor: DANGER }}>
            {closing ? 'Closing…' : 'Close organisation'}
          </Btn>
        </div>
      </form>
      {error && <p role="alert" style={{ fontSize: 13, color: DANGER, marginTop: 10 }}>{error}</p>}
    </Card>
  );
}

/**
 * Reached cold from a link, so `organisationId` is all this needs. `onChanged` tells
 * App.jsx its list of this account's organisations may be out of date (a new name);
 * `onLeft` that this account is no longer an admin at all (left, or closed it).
 */
export function OrganisationDashboardPage({ t, accountId, organisationId,
  onNavigateToPublic, onNewProject, onOpenProjectDashboard, onChanged, onLeft }) {
  const [organisation, setOrganisation] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'notFound' | 'error'
  const [editing, setEditing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [adminError, setAdminError] = useState(null);

  const load = useCallback(async (id) => {
    const [found, roster, run] = await Promise.all([
      readOrganisation(id),
      readAdmins(id),
      readOrganisationProjects(id),
    ]);
    setOrganisation(found);
    setAdmins(roster);
    setProjects(run);
    return found;
  }, []);

  useEffect(() => {
    if (!organisationId) return undefined;
    let cancelled = false;

    setStatus('loading');
    load(organisationId)
      .then((found) => { if (!cancelled) setStatus(found ? 'ready' : 'notFound'); })
      .catch((err) => {
        if (cancelled) return;
        if (/invalid input syntax for type uuid/i.test(err?.message ?? '')) {
          setStatus('notFound');
          return;
        }
        console.error('Could not load the organisation dashboard:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [organisationId, load]);

  const isAdmin = admins.some((admin) => admin.userId === accountId);
  const onlyAdmin = admins.length <= 1;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setAdminError(null);
    try {
      await addAdmin(organisation.id, inviteEmail.trim());
      setAdmins(await readAdmins(organisation.id));
      setInviteEmail('');
    } catch (err) {
      console.error('Could not add that admin:', err);
      setAdminError(err?.message ?? 'Could not add that admin.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (admin) => {
    const leaving = admin.userId === accountId;
    setAdminError(null);
    try {
      await removeAdmin(organisation.id, admin.userId);
      if (leaving) {
        onLeft?.();
        return;
      }
      setAdmins((current) => current.filter((a) => a.userId !== admin.userId));
    } catch (err) {
      console.error(`Could not ${leaving ? 'leave' : 'remove that admin'}:`, err);
      setAdminError(err?.message ?? `Could not ${leaving ? 'leave the organisation' : 'remove that admin'}.`);
    }
  };

  if (status === 'loading') {
    return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><LoadingMark /></div>;
  }

  if (status === 'notFound') {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h1 style={{ color: t.ink, marginBottom: 8 }}>Organisation not found</h1>
        <p style={{ fontSize: 16, color: t.inkDim }}>It may have been closed.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" style={{ padding: 48, fontSize: 14, color: t.ink, fontWeight: 500 }}>
        Could not load this organisation&rsquo;s dashboard. See the console for details.
      </div>
    );
  }

  const publicLink = (
    <span
      onClick={() => onNavigateToPublic(organisation.id)}
      role="link" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigateToPublic(organisation.id); }}
      style={{ fontSize: 14, color: t.inkDim, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
      View the public page
    </span>
  );

  if (!isAdmin) {
    return (
      <div style={{ padding: '96px 40px', textAlign: 'center' }}>
        <h1 className="placer-disp" style={{ fontSize: 32, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
          {organisation.name}
        </h1>
        <p style={{ fontSize: 16, color: t.inkDim, marginBottom: 16 }}>
          Only this organisation&rsquo;s admins can open its dashboard.
        </p>
        {publicLink}
      </div>
    );
  }

  if (editing) {
    return (
      <OrganisationSetupPage t={t} accountId={accountId} organisation={organisation}
        onSaved={(saved) => { setOrganisation(saved); setEditing(false); onChanged?.(); }}
        onCancel={() => setEditing(false)} />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px 96px' }} className="placer-scroll">
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="placer-disp" style={{ fontSize: 36, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 8, overflowWrap: 'anywhere' }}>
              {organisation.name}
            </h1>
            {publicLink}
          </div>
          <Btn t={t} variant="outline" size="sm" icon="pencil" onClick={() => setEditing(true)}>
            Edit details
          </Btn>
        </div>

        <Card t={t} title="Projects">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: projects.length > 0 ? 20 : 0 }}>
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: 0, flex: '1 1 280px' }}>
              {projects.length === 0
                ? 'No projects are run in this organisation’s name yet.'
                : 'Projects run in this organisation’s name, shown on its public page.'}
            </p>
            {onNewProject && (
              <Btn t={t} variant="primary" size="sm" icon="plus" onClick={() => onNewProject(organisation.id)}>
                Start a project
              </Btn>
            )}
          </div>
          {projects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {projects.map((project) => (
                <ProjectCard key={project.id} t={t} project={project} onOpen={onOpenProjectDashboard} />
              ))}
            </div>
          )}
        </Card>

        <Card t={t} title="Admins">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 12 }}>
            Every admin can edit the organisation, add and remove admins, start projects in its
            name, and close it. There is always at least one: to leave as the only admin, add
            somebody else first, or close the organisation.
          </p>
          <div style={{ marginBottom: 16 }}>
            {admins.map((admin) => (
              <AdminRow key={admin.userId} t={t} admin={admin} isYou={admin.userId === accountId}
                canRemove={!onlyAdmin} onRemove={handleRemove} />
            ))}
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Add an admin by email" aria-label="Add an admin by email"
              style={{ ...inputStyle(t), flex: 1 }} />
            <Btn t={t} variant="primary" size="sm" icon="plus" type="submit" disabled={inviting} ariaLabel="Add admin">
              {inviting ? 'Adding…' : 'Add'}
            </Btn>
          </form>
          {adminError && <p role="alert" style={{ fontSize: 13, color: DANGER, marginTop: 10 }}>{adminError}</p>}
        </Card>

        <CloseOrganisation t={t} organisation={organisation} onClosed={onLeft} />
      </div>
    </div>
  );
}

export default OrganisationDashboardPage;
