import { BirdsEyeView } from '../../components/toolkit/BirdsEyeView';
import { BirdsEyeResults } from '../../components/toolkit/BirdsEyeResults';
import {
  BirdsEyeEditor, BirdsEyePlanStep, BirdsEyePromptStep, BirdsEyeSetup, BirdsEyeTimerStep,
} from '../../components/toolkit/BirdsEyeSetup';
import { PALETTE } from '../../theme';
import {
  DEFAULT_PROMPT, MAX_PROMPT_LENGTH, birdsEyeSetupProblems, combineLayouts, defaultBirdsEyeSetup, emptyLayout,
  planProblems, promptProblems, readAssets, timerProblems,
} from '../../lib/birdsEye';
import { counted, roomText, tone } from '../toolParts';

export default {
  id: 'birds-eye-view',
  added: '2026-11-05',
  category: 'imagine',
  setting: 'public',
  delivery: ['live', 'self-paced'],
  name: 'Birds Eye View',
  tagline: 'Lay a place out from above, piece by piece.',
  blurb: 'Draw the place from above at its real size, and the pieces that could go in it: benches, stalls, a stage, planters. Everybody then moves and turns the pieces into the layout they would want, and the layouts gather on the plan.',
  ...tone(PALETTE.purple),
  icon: 'grid',
  createdBy: 'PLACER',
  component: BirdsEyeView,
  setup: {
    defaults: defaultBirdsEyeSetup,
    problems: birdsEyeSetupProblems,
    Form: BirdsEyeSetup,
    // The question is the slide's title, typed into on the canvas as well as in the panel.
    title: { key: 'prompt', placeholder: DEFAULT_PROMPT, max: MAX_PROMPT_LENGTH },
    // The plan is drawn on the canvas, under the title.
    Canvas: BirdsEyeEditor,
    steps: [
      { title: 'Prompt', Form: BirdsEyePromptStep, problems: promptProblems },
      // On the canvas on the configuration page, so not in its panel.
      { title: 'Plan', Form: BirdsEyePlanStep, problems: planProblems, inPanel: false },
      { title: 'Timer', panelTitle: null, Form: BirdsEyeTimerStep, problems: timerProblems },
    ],
  },
  inquiry: {
    summary: (config) => {
      const pieces = readAssets(config?.assets).length;
      return pieces > 0 ? counted(pieces, 'piece', 'pieces') : '';
    },
  },
  // Everybody's layouts over the plan, live or once it has ended (BirdsEyeResults).
  results: { View: BirdsEyeResults },
  onProjectPage: {
    heading: 'Lay out this place',
  },
  room: {
    empty: emptyLayout,
    combine: combineLayouts,
    label: (config) => roomText(config?.prompt),
  },
};
