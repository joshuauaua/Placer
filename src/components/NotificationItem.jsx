/* PLACER — one notification, as a row: what kind it is, what happened, and when.
 * Shared by the dashboard's Your Activity card and the full feed at /activity.
 *
 * A notification that links to a project opens that project's public page. One that
 * links to an imagination has nowhere of its own to go yet, so it is a plain row.
 */

import { Icon } from './Icon';

// The four categories services/notifications.js knows, each with an icon.
const CATEGORY_ICONS = { engagement: 'comment', activity: 'bell', follower: 'user', system: 'gear' };

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function timeAgo(value, now = new Date()) {
  if (!value) return '';
  const then = new Date(value);
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function NotificationItem({ t, notification, onOpenProject, compact = false }) {
  const unread = !notification.readAt;
  const opensProject = notification.linkType === 'project' && notification.linkId && onOpenProject;

  const content = (
    <>
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.surfaceAlt, color: t.ink }}>
        <Icon name={CATEGORY_ICONS[notification.category] ?? 'bell'} size={17} stroke={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: unread ? 700 : 500, color: t.ink }}>
          {notification.title}
        </span>
        {notification.body && (
          <span style={{ display: 'block', fontSize: 13.5, color: t.inkDim, lineHeight: 1.45, marginTop: 2,
            ...(compact ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : null) }}>
            {notification.body}
          </span>
        )}
        <span style={{ display: 'block', fontSize: 12.5, color: t.inkFaint, marginTop: 4 }}>
          {timeAgo(notification.createdAt)}
        </span>
      </span>
      {unread && (
        <span role="img" aria-label="Unread" style={{ width: 8, height: 8, borderRadius: '50%',
          background: t.ink, flex: '0 0 auto', marginTop: 6 }} />
      )}
    </>
  );

  const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 10px',
    margin: '0 -10px', borderRadius: 12, width: 'calc(100% + 20px)', textAlign: 'left' };

  return opensProject ? (
    <a href={`/projects/${encodeURIComponent(notification.linkId)}`} className="placer-notification-row"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpenProject(notification.linkId);
      }}
      style={{ ...rowStyle, color: 'inherit', textDecoration: 'none' }}>
      {content}
    </a>
  ) : (
    <div style={rowStyle}>{content}</div>
  );
}

export default NotificationItem;
