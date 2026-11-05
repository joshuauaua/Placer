/* PLACER — who is inviting people into a published tool, kept on its room.
 *
 * Publishing a tool (PublishToolDialog) puts on each room's setup what its invitation
 * cover says (InviteCover):
 *
 *   config.invite = { organiser, project, title }
 *
 * — the name of whoever published it, the project it is part of, and what the tool is
 * called there (its own name, unless it was renamed on its setup page). It is kept on
 * the room rather than read from the project because the people joining with a PIN or
 * a QR code may not be able to read the project, or even know which it is.
 */

const MAX = 120;

const text = (value) => (typeof value === 'string' ? value.trim().slice(0, MAX) : '');

/** A setup, with the invitation its room is to show. */
export function withInvite(setup, { organiser, project, title }) {
  return { ...(setup ?? {}), invite: { organiser: text(organiser), project: text(project), title: text(title) } };
}

/** The invitation a room's setup carries, each part '' where there is none, or null for none at all. */
export function roomInvite(config) {
  const invite = config?.invite;
  if (!invite || typeof invite !== 'object') return null;
  return { organiser: text(invite.organiser), project: text(invite.project), title: text(invite.title) };
}
