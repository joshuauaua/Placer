/* PLACER — Tutorials: short videos on making and running tools, shown on the Tools page
 * under My Tools (components/Tutorials.jsx).
 *
 *   id        — the tutorial's own id
 *   title     — what it shows how to do
 *   duration  — how long it runs, as shown ('3 min'), or null
 *   embedUrl  — the video's embed address (a YouTube or Vimeo player URL), or null
 *               while it has not been made: the card then shows a placeholder
 *
 * None of the videos exist yet, so every one is a placeholder for now.
 */

export const TUTORIALS = [
  { id: 'create-your-first-tool', title: 'Create your first tool', duration: '3 min', embedUrl: null },
  { id: 'add-slides', title: 'Ask several questions with slides', duration: '2 min', embedUrl: null },
  { id: 'start-from-a-template', title: 'Start from a template', duration: '2 min', embedUrl: null },
  { id: 'run-a-tool-with-a-group', title: 'Run a tool live with a group', duration: '4 min', embedUrl: null },
];
