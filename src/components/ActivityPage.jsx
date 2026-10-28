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
import { mergeActivity } from '../lib/activityFeed';

const FEED_LIMIT = 100;

export function ActivityPage({ t, accountId = null, onOpenProject, onOpenOrganisation, onOpenProfile }) {
  const [notifications, setNotifications] = useState([]);
  const [status, setStatus] = useState(() => (isSupabaseConfigured() ? 'loading' : 'unavailable'));

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;
    // Inquiries are extra: if they cannot be read, the notifications still show.
    const inquiries = readInquiries().catch((err) => {
      console.error('Could not load your saved inquiries:', err);
      return [];
    });
    Promise.all([listNotifications({ limit: FEED_LIMIT }), inquiries])
      .then(([found, kept]) => {
        if (cancelled) return;
        setNotifications(mergeActivity(found, kept, accountId));
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
        {status === 'ready' && notifications.length === 0 && (
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
