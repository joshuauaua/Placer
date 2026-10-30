/* PLACER — Activity, at /activity: every notification an account has, and every inquiry
 * it has kept from the Toolkit's standalone tools (lib/activityFeed.js), newest first.
 * The dashboard's Your Activity card shows the latest few and its View All comes
 * here. Opening the page does not mark anything read; Mark all as read does.
 *
 * Notifications need a Supabase project (see services/notifications.js), so with none
 * configured the page says so rather than trying.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { PageHeader } from './PageHeader';
import { NotificationItem } from './NotificationItem';
import { isSupabaseConfigured, listNotifications, markAllRead } from '../services/notifications';
import { readInquiries } from '../services/inquiries';
import { readPendingCollaboratorInvitations, respondToCollaboratorInvitation } from '../services/projects';
import { mergeActivity } from '../lib/activityFeed';

const FEED_LIMIT = 100;

export function ActivityPage({ t, accountId = null, onOpenProject, onOpenProjectDashboard,
  onOpenOrganisation, onOpenProfile }) {
  const [notifications, setNotifications] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [respondingTo, setRespondingTo] = useState(null);
  const [invitationError, setInvitationError] = useState(null);
  const [status, setStatus] = useState(() => (isSupabaseConfigured() ? 'loading' : 'unavailable'));

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;
    // Inquiries are extra: if they cannot be read, the notifications still show.
    const inquiries = readInquiries().catch((err) => {
      console.error('Could not load your saved inquiries:', err);
      return [];
    });
    const invitations = accountId
      ? readPendingCollaboratorInvitations().catch((err) => {
        console.error('Could not load project invitations:', err);
        if (!cancelled) setInvitationError(err?.message ?? 'Could not load project invitations.');
        return [];
      })
      : Promise.resolve([]);
    Promise.all([listNotifications({ limit: FEED_LIMIT }), inquiries, invitations])
      .then(([found, kept, pendingInvitations]) => {
        if (cancelled) return;
        setNotifications(mergeActivity(found, kept, accountId));
        setInvitations(pendingInvitations);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your activity:', err);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [accountId]);

  const unread = notifications.filter((item) => !item.readAt).length;

  const respond = async (invitation, accept) => {
    if (respondingTo) return;
    setRespondingTo(invitation.projectId);
    setInvitationError(null);
    try {
      await respondToCollaboratorInvitation(invitation.projectId, accept);
      setInvitations((current) => current.filter((item) => item.projectId !== invitation.projectId));
      if (accept) onOpenProjectDashboard?.(invitation.projectId);
    } catch (err) {
      console.error('Could not respond to the project invitation:', err);
      setInvitationError(err?.message ?? 'Could not respond to the project invitation.');
    } finally {
      setRespondingTo(null);
    }
  };

  const readAll = async () => {
    const before = notifications;
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => (item.readAt ? item : { ...item, readAt: now })));
    try {
      await markAllRead();
    } catch (err) {
      console.error('Could not mark your activity as read:', err);
      setNotifications(before);
    }
  };

  const message = {
    loading: 'Loading your activity…',
    unavailable: 'Activity needs a PLACER account, which this copy of the app is not set up for.',
    error: 'Your activity could not be loaded. Try again in a moment.',
  }[status];

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '0 32px 48px' }} className="placer-scroll">
      <PageHeader t={t} title="Activity" inset={32} maxWidth="none"
        actions={unread > 0 ? (
          <Btn t={t} variant="outline" size="sm" icon="check" onClick={readAll}>Mark all as read</Btn>
        ) : null} />
      <div style={{ maxWidth: 760 }}>
        {message && <p style={{ fontSize: 15, color: t.inkDim }}>{message}</p>}
        {status === 'ready' && invitations.length > 0 && (
          <section aria-labelledby="project-invitations-heading"
            style={{ margin: '0 0 24px', padding: 20, borderRadius: 16, background: t.surface,
              border: `1px solid ${t.line}` }}>
            <h2 id="project-invitations-heading" style={{ fontSize: 18, fontWeight: 700, color: t.ink,
              margin: '0 0 8px' }}>
              Project invitations
            </h2>
            <p style={{ fontSize: 14, color: t.inkDim, margin: '0 0 8px' }}>
              Accept to join a project as a collaborator, or decline to leave it unchanged.
            </p>
            {invitations.map((invitation) => (
              <div key={invitation.projectId} style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16, padding: '12px 0',
                borderTop: `1px solid ${t.line}` }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{invitation.projectName}</div>
                  <div style={{ fontSize: 13, color: t.inkDim }}>
                    Invited by {invitation.inviterName}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
                  <Btn t={t} variant="outline" size="sm" disabled={respondingTo !== null}
                    onClick={() => respond(invitation, false)}>
                    {respondingTo === invitation.projectId ? 'Saving…' : 'Decline'}
                  </Btn>
                  <Btn t={t} variant="primary" size="sm" disabled={respondingTo !== null}
                    onClick={() => respond(invitation, true)}>
                    {respondingTo === invitation.projectId ? 'Saving…' : 'Accept'}
                  </Btn>
                </div>
              </div>
            ))}
            {invitationError && (
              <p role="alert" style={{ fontSize: 13, color: '#B3261E', margin: '10px 0 0' }}>
                {invitationError}
              </p>
            )}
          </section>
        )}
        {status === 'ready' && invitationError && invitations.length === 0 && (
          <p role="alert" style={{ fontSize: 13, color: '#B3261E', margin: '0 0 16px' }}>
            {invitationError}
          </p>
        )}
        {status === 'ready' && notifications.length === 0 && invitations.length === 0 && (
          <p style={{ fontSize: 15, color: t.inkDim }}>
            Nothing yet. Comments, follows, news from the projects you are part of and the tools you
            save from the Toolkit will show up here.
          </p>
        )}
        {status === 'ready' && notifications.length > 0 && (
          <ul aria-label="Activity" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {notifications.map((notification) => (
              <li key={notification.id} style={{ borderBottom: `1px solid ${t.line}` }}>
                <NotificationItem t={t} notification={notification} onOpenProject={onOpenProject}
                  onOpenOrganisation={onOpenOrganisation} onOpenProfile={onOpenProfile} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ActivityPage;
