/* PLACER — "Work in Progress", on the picture of a tool that is not finished yet.
 *
 * Every tool carries it unless its register entry says `ready: true` — so a new tool is
 * labelled until somebody says it is done. It sits in a corner of the tool's picture
 * wherever that is drawn: the Create a tool cards (ChooseToolDialog), Popular
 * templates, My Tools and the tool's cover (ToolCover). The picture's box must be
 * positioned (relative) for it to sit in its corner.
 */

/** Whether a tool is still being made: anything not marked `ready`. */
export const isWorkInProgress = (tool) => Boolean(tool) && tool.ready !== true;

export function WorkInProgressLabel({ tool, corner = 'left', size = 'sm' }) {
  if (!isWorkInProgress(tool)) return null;
  return (
    <span className={`placer-wip-label placer-wip-label-${corner} placer-wip-label-${size}`}>Work in Progress</span>
  );
}

export default WorkInProgressLabel;
