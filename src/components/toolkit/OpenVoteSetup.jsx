/* PLACER — Toolkit: setting up an Open Vote room.
 *
 * The question people will be asked. On a project's page it sits above the three
 * buttons, so it is written here, once, before the room opens. Shown by ToolkitPage's
 * RoomSetup, which checks it with the registry entry's `setup.problems` and opens the
 * room with it — this only edits it.
 */

import { useId } from 'react';
import { DEFAULT_QUESTION, MAX_QUESTION_LENGTH } from '../../lib/openVote';

export function OpenVoteSetup({ t, setup, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-question`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        The question
      </label>
      <input
        id={`${id}-question`}
        aria-describedby={`${id}-question-hint`}
        type="text"
        maxLength={MAX_QUESTION_LENGTH}
        value={setup.question}
        onChange={(event) => onChange({ ...setup, question: event.target.value })}
        placeholder={DEFAULT_QUESTION}
        style={{ height: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
          background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 700 }} />
      <span id={`${id}-question-hint`} style={{ fontSize: 12.5, color: t.inkDim }}>
        People answer Yes, No or Undecided. On the project's page it is shown above the buttons.
      </span>
    </div>
  );
}

export default OpenVoteSetup;
