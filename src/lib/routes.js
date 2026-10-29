/* PLACER — addresses that both App.jsx and a lazily loaded page need to know, kept here
 * so App can read them without pulling the page into the main bundle. */

/** The case study form's own address: the Resources page, with the form open over it. */
export const CASE_STUDY_FORM_PATH = '/resources/submit-case-study';

/**
 * Toolkit tools that take the whole window once started: no nav bar and no footer, the
 * tool's own top bar the only chrome. Past its cover such a tool's address carries
 * ?start, which is what lets App lay the page out for it without loading the Toolkit's
 * register of tools, and makes the started tool something a link can come back to.
 */
export const FULL_SCREEN_TOOLS = ['reimagine-a-space'];

/** Whether a location (path and query string) is a full-screen tool, started. */
export function isFullScreenTool(path, search) {
  const match = /^\/toolkit\/([^/?#]+)$/.exec(path);
  if (!match || !FULL_SCREEN_TOOLS.includes(match[1])) return false;
  return new URLSearchParams(search ?? '').has('start');
}

/** A full-screen tool's address once started, keeping whatever else its query carries. */
export function startedToolPath(toolId, search) {
  const query = String(search ?? '').replace(/^\?/, '');
  return `/toolkit/${toolId}?${query ? `${query}&` : ''}start`;
}
