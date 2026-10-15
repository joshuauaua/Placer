import { DesireLines } from '../../components/toolkit/DesireLines';
import { DesireLinesOnPage } from '../../components/toolkit/DesireLinesOnPage';
import { DesireLinesSetup } from '../../components/toolkit/DesireLinesSetup';
import { CHARACTER } from '../../theme';
import { combineDesire, defaultSetup, emptyDesire, setupProblems } from '../../lib/desireLines';
import { roomText, tone } from '../toolParts';

export default {
  id: 'desire-lines',
  added: '2026-08-27',
  category: 'understand',
  name: 'Desire Lines',
  tagline: 'The path people take, not the one that got paved.',
  blurb: 'Pick a site on the map and draw the walks you actually make across it — the shortcuts, the detours around what was built. Run for a project, its organisers choose the sites and everyone draws on them, and you can lay the others’ walks over your own to see where you walk the same way and where you do not.',
  ...tone(CHARACTER.practitioner),
  icon: 'path',
  createdBy: 'PLACER',
  component: DesireLines,
  setup: {
    defaults: defaultSetup,
    problems: setupProblems,
    Form: DesireLinesSetup,
  },
  onProjectPage: {
    heading: 'Draw the way you walk',
    Embed: DesireLinesOnPage,
  },
  room: {
    empty: emptyDesire,
    combine: (states) => combineDesire(states),
    label: (config) => roomText(config?.prompt)
      ?? roomText(Array.isArray(config?.sites) ? config.sites.map((site) => site?.name).filter(Boolean).join(', ') : null),
  },
};
