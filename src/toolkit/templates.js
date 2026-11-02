/* PLACER — Popular Templates: ready-made starting points for creating a tool.
 *
 * Shown on the Tools page (PopularTemplates). Each is a tool from the register
 * (toolkit/tools.js) put to a particular use, with a picture and a title saying what
 * for. Choosing one opens that tool's configuration page (ToolConfiguratorPage).
 * For now a template only picks the tool: it opens on the tool's own defaults.
 *
 *   id     — the template's own id
 *   title  — what it is for, in a few words
 *   tool   — the id of the tool it uses
 *   image  — optional { small, large, alt }: the picture, 800 and 1600 pixels wide.
 *            Without one, the card shows its tool's category colour in its place —
 *            which every template does for now, until they have pictures of their own.
 */

import { findTool } from './tools';

const ALL_TEMPLATES = [
  {
    id: 'interior-shared-space-ideation',
    title: 'Interior Shared Space Ideation',
    tool: 'reimagine-a-space',
  },
  {
    id: 'split-a-group-budget',
    title: 'Split a group budget for an event',
    tool: 'budget-ballot',
  },
  {
    id: 'community-event-ice-breaker',
    title: 'Community Event Ice-breaker',
    tool: 'pop-quiz',
  },
  {
    id: 'how-does-this-street-feel',
    title: 'How does this street feel?',
    tool: 'word-cloud',
  },
];

/** The templates whose tool is on the platform: one taken off (`hidden`) takes its templates with it. */
export const TEMPLATES = ALL_TEMPLATES.filter((template) => findTool(template.tool));
