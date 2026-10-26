import { DesireLines } from '../../components/toolkit/DesireLines';
import { DesireLinesOnPage } from '../../components/toolkit/DesireLinesOnPage';
import { DesireLinesSetup } from '../../components/toolkit/DesireLinesSetup';
import { PALETTE } from '../../theme';
import { combineDesire, defaultSetup, emptyDesire, setupProblems, sitesOf } from '../../lib/desireLines';
import { counted, roomText, tone } from '../toolParts';

// "A", "A and B", "A, B and C".
const naturalList = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export default {
  id: 'desire-lines',
  added: '2026-08-27',
  category: 'understand',
  name: 'Desire Lines',
  tagline: 'The path people take, not the one that got paved.',
  blurb: 'Pick a site on the map and draw the walks you actually make across it — the shortcuts, the detours around what was built. Run for a project, its organisers choose the sites and everyone draws on them, and you can lay the others’ walks over your own to see where you walk the same way and where you do not.',
  ...tone(PALETTE.purple),
  icon: 'path',
  createdBy: 'PLACER',
  component: DesireLines,
  setup: {
    defaults: defaultSetup,
    problems: setupProblems,
    Form: DesireLinesSetup,
  },
  inquiry: {
    summary: (config) => [
      config?.walks?.length > 0 && counted(config.walks.length, 'walk', 'walks'),
      config?.site?.elements?.length > 0 && counted(config.site.elements.length, 'mark', 'marks'),
    ].filter(Boolean).join(' · '),
  },
  onProjectPage: {
    heading: 'Draw the way you walk',
    wide: true,
    intro: 'A desire line is the path people actually take, not the one that was paved. Draw the walks you really make across the site, and mark the entrances and obstacles you meet on the way.',
    why: (config) => roomText(config?.note)
      ?? (sitesOf(config).length > 0
        ? `The project team wants to see how people really move through ${naturalList(sitesOf(config).map((site) => site.name))}, to plan around it.`
        : null),
    Embed: DesireLinesOnPage,
  },
  room: {
    empty: emptyDesire,
    combine: (states) => combineDesire(states),
    label: (config) => roomText(config?.prompt)
      ?? roomText(Array.isArray(config?.sites) ? config.sites.map((site) => site?.name).filter(Boolean).join(', ') : null),
  },
};
