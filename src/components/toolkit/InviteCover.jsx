/* PLACER — the cover of a published tool: an invitation to take part.
 *
 * Whoever opens a room — scanning its QR code, following its link, typing its PIN, or
 * the organiser going live — lands here first, whichever tool it is. Who is inviting
 * them, to what, and for which project come from the room (toolkit/invite.js), with
 * the tool's own name, and no project, for a room opened without them. It has the
 * same layout as ToolCover: the tool's colour on one side, the words and Get started
 * on the other.
 */

import { Icon } from '../Icon';
import { Btn } from '../UI';

export function InviteCover({ t, tool, invite = null, onStart }) {
  const title = invite?.title || tool.name;
  const organiser = invite?.organiser || '';
  const project = invite?.project || '';

  return (
    <div className="placer-cover" style={{ background: t.page }}>
      <div className="placer-cover-color" style={{ background: tool.tint }}>
        <Icon name={tool.icon} size={120} stroke={1.5} style={{ color: t.ink }} />
      </div>

      <div className="placer-cover-copy">
        <div className="placer-caption" style={{ textTransform: 'uppercase', color: tool.color,
          fontWeight: 700, marginBottom: 12 }}>
          You&rsquo;re invited
        </div>
        <h1 style={{ color: t.ink }}>
          {organiser
            ? <>{organiser} invites you to take part in {title}</>
            : <>Take part in {title}</>}
        </h1>
        <p className="placer-body-lg" style={{ marginTop: 16, color: t.inkDim }}>
          {project
            ? <>It&rsquo;s part of the <strong style={{ color: t.ink }}>{project}</strong> project. Add your voice, and see it join everyone else&rsquo;s.</>
            : <>Add your voice, and see it join everyone else&rsquo;s.</>}
        </p>

        <div className="placer-cover-action">
          <Btn t={t} size="lg" onClick={onStart}>Get started</Btn>
        </div>
      </div>
    </div>
  );
}

export default InviteCover;
