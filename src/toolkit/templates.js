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
 *   image  — { small, large, alt }: the picture, 800 and 1600 pixels wide
 *
 * The pictures are photos from PLACER's own sessions, until templates have their own.
 */

import ideasBoard from '../assets/placemaking-trends-cover.webp';
import ideasBoardSmall from '../assets/placemaking-trends-cover-800.webp';
import groupDinner from '../assets/about-team.webp';
import groupDinnerSmall from '../assets/about-team-800.webp';
import workshop from '../assets/user-labs.webp';
import workshopSmall from '../assets/user-labs-800.webp';
import streetTalk from '../assets/about-malmo.webp';
import streetTalkSmall from '../assets/about-malmo-800.webp';
import { findTool } from './tools';

const ALL_TEMPLATES = [
  {
    id: 'interior-shared-space-ideation',
    title: 'Interior Shared Space Ideation',
    tool: 'reimagine-a-space',
    image: { small: ideasBoardSmall, large: ideasBoard,
      alt: 'Idea cards clipped to a wooden board beside a map with pins in it.' },
  },
  {
    id: 'split-a-group-budget',
    title: 'Split a group budget for an event',
    tool: 'budget-ballot',
    image: { small: groupDinnerSmall, large: groupDinner,
      alt: 'A group of friends around a restaurant table, smiling at the camera.' },
  },
  {
    id: 'community-event-ice-breaker',
    title: 'Community Event Ice-breaker',
    tool: 'pop-quiz',
    image: { small: workshopSmall, large: workshop,
      alt: 'People at an outdoor workshop table against an orange wall.' },
  },
  {
    id: 'how-does-this-street-feel',
    title: 'How does this street feel?',
    tool: 'word-cloud',
    image: { small: streetTalkSmall, large: streetTalk,
      alt: 'A small group talking on a street outside old brick buildings.' },
  },
];

/** The templates whose tool is on the platform: one taken off (`hidden`) takes its templates with it. */
export const TEMPLATES = ALL_TEMPLATES.filter((template) => findTool(template.tool));
