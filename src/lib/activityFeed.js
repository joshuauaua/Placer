/* PLACER — the activity feed: notifications, with the inquiries the account has kept
 * from the Toolkit's standalone tools mixed in, newest first. Shared by the dashboard's
 * Activity tab and the full feed at /activity.
 *
 * An inquiry is turned into a notification-shaped row (what NotificationItem draws):
 * already read, since it is something you did, and linking to your profile, whose
 * Activity tab lists your saved inquiries in full.
 */

import { findTool } from '../toolkit/tools';

/** One kept inquiry (services/inquiries.js) as a row of the feed. */
export function inquiryAsActivity(inquiry, accountId = null) {
  const tool = findTool(inquiry.tool);
  return {
    id: `inquiry-${inquiry.id}`,
    category: 'inquiry',
    icon: tool?.icon ?? 'flask',
    title: `You saved ${inquiry.title}`,
    body: [tool?.name ?? inquiry.tool, tool?.inquiry?.summary?.(inquiry.config)].filter(Boolean).join(' · '),
    linkType: accountId ? 'profile' : null,
    linkId: accountId,
    createdAt: inquiry.createdAt,
    readAt: inquiry.createdAt,
  };
}

/** Notifications and inquiries together, newest first; only the first `limit` when given. */
export function mergeActivity(notifications, inquiries, accountId = null, limit = null) {
  const merged = [...notifications, ...inquiries.map((inquiry) => inquiryAsActivity(inquiry, accountId))]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return limit == null ? merged : merged.slice(0, limit);
}
