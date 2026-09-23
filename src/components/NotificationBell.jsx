/* PLACER — the notification bell at the nav bar's right-hand end, next to UserMenu.
 *
 * Only ever rendered for a signed-in account, and only does anything with a Supabase
 * project configured — see services/notifications.js's header for why there is no
 * local fallback: a notification is always about something someone else did, and with
 * no backend there is nobody else. isSupabaseConfigured() is checked here rather than
 * left to App.jsx, so an unconfigured deployment renders nothing rather than a bell
 * that always reads zero.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Icon } from './Icon';
import {
  isSupabaseConfigured, listNotifications, unreadCount as fetchUnreadCount,
  markRead, markAllRead, dismissNotification,
} from '../services/notifications';

// Same choice ImaginationPreview's formatCommentDate makes: a date slice rather than
// a relative "3h ago", so it does not need a re-render every minute to stay true and
// does not shift with the machine's locale.
const formatWhen = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

// How often the badge checks for something new while the panel is closed. Not
// realtime — Supabase's realtime channel would be the way to make it push-driven,
// and nothing here opens one yet.
const POLL_MS = 60_000;

// 'system' has no entry — it falls back to the bell itself below, the same icon as
// the trigger that opened this panel.
const CATEGORY_ICON = { engagement: 'heart', activity: 'sparkle', follower: 'user' };

function NotificationRow({ t, item, onOpen, onDismiss }) {
  const unread = !item.readAt;
  const openable = item.linkType === 'project' && item.linkId;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
      background: unread ? t.surfaceAlt : 'transparent', borderTop: `1px solid ${t.line}` }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flex: '0 0 auto',
        background: unread ? t.accent : 'transparent' }} />
      <div
        role={openable ? 'link' : undefined}
        tabIndex={openable ? 0 : undefined}
        onClick={() => onOpen(item)}
        onKeyDown={openable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(item); } : undefined}
        style={{ flex: 1, minWidth: 0, cursor: openable || unread ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Icon name={CATEGORY_ICON[item.category] ?? 'bell'} size={13} stroke={2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{item.title}</span>
        </div>
        <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.4, margin: 0 }}>{item.body}</p>
        <span style={{ fontSize: 11.5, color: t.inkFaint }}>{formatWhen(item.createdAt)}</span>
      </div>
      <button
        aria-label="Dismiss notification"
        onClick={(e) => { e.stopPropagation(); onDismiss(item); }}
        style={{ flex: '0 0 auto', background: 'transparent', border: 'none', cursor: 'pointer',
          color: t.inkFaint, padding: 4 }}>
        <Icon name="close" size={14} stroke={2} />
      </button>
    </div>
  );
}

export function NotificationBell({ t, enabled, onOpenProject }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState(null); // null = never loaded
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);

  const active = enabled && isSupabaseConfigured();

  const refreshUnread = useCallback(() => {
    fetchUnreadCount().then(setUnread).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    refreshUnread();
    const id = window.setInterval(refreshUnread, POLL_MS);
    return () => window.clearInterval(id);
  }, [active, refreshUnread]);

  useEffect(() => {
    if (!open || items !== null) return;
    setLoading(true);
    setError(null);
    listNotifications()
      .then((list) => setItems(list))
      .catch((err) => {
        console.error('Could not load notifications:', err);
        setError('Could not load notifications. Try again.');
      })
      .finally(() => setLoading(false));
  }, [open, items]);

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

  if (!active) return null;

  const handleOpenItem = (item) => {
    if (!item.readAt) {
      markRead(item.id).catch((err) => console.error('Could not mark notification read:', err));
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)));
      setUnread((count) => Math.max(0, count - 1));
    }
    if (item.linkType === 'project' && item.linkId) {
      setOpen(false);
      onOpenProject?.(item.linkId);
    }
  };

  const handleDismiss = (item) => {
    dismissNotification(item.id).catch((err) => console.error('Could not dismiss notification:', err));
    setItems((list) => list.filter((i) => i.id !== item.id));
    if (!item.readAt) setUnread((count) => Math.max(0, count - 1));
  };

  const handleMarkAllRead = () => {
    markAllRead().catch((err) => console.error('Could not mark notifications read:', err));
    setItems((list) => (list ?? []).map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })));
    setUnread(0);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, background: 'transparent', border: 'none', borderRadius: 999,
          cursor: 'pointer', color: t.ink }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <Icon name="bell" size={20} stroke={2} />
        {unread > 0 && (
          <span aria-hidden="true" style={{ position: 'absolute', top: 4, right: 4, minWidth: 15, height: 15,
            padding: '0 3px', borderRadius: 999, background: t.accent, color: '#fff', fontSize: 10,
            fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 70,
            width: 340, maxHeight: 420, overflowY: 'auto', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: t.shadow }}
          className="placer-scroll">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: t.ink }}>Notifications</span>
            <button
              onClick={handleMarkAllRead}
              disabled={unread === 0}
              style={{ background: 'transparent', border: 'none', cursor: unread === 0 ? 'default' : 'pointer',
                color: unread === 0 ? t.inkFaint : t.ink, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
              Mark all read
            </button>
          </div>

          {loading && (
            <div style={{ padding: '18px 14px', fontSize: 13, color: t.inkDim, borderTop: `1px solid ${t.line}` }}>
              Loading…
            </div>
          )}

          {error && !loading && (
            <div role="alert" style={{ padding: '18px 14px', fontSize: 13, color: t.ink, borderTop: `1px solid ${t.line}` }}>
              {error}
            </div>
          )}

          {!loading && !error && items?.length === 0 && (
            <div style={{ padding: '18px 14px', fontSize: 13, color: t.inkDim, lineHeight: 1.5, borderTop: `1px solid ${t.line}` }}>
              Nothing yet. Comments, votes, new followers and posts from people you follow will show up here.
            </div>
          )}

          {!loading && !error && items?.map((item) => (
            <NotificationRow key={item.id} t={t} item={item} onOpen={handleOpenItem} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
