import { PinToImage } from '../../components/toolkit/PinToImage';
import { PinToImageResults } from '../../components/toolkit/PinToImageResults';
import {
  PinImageCanvas, PinImageStep, PinPromptStep, PinTimerStep, PinToImageSetup,
} from '../../components/toolkit/PinToImageSetup';
import { PALETTE } from '../../theme';
import {
  DEFAULT_PROMPT, MAX_PROMPT_LENGTH, combinePins, defaultPinSetup, emptyPin, imageProblems, pinSetupProblems,
  promptProblems, timerProblems,
} from '../../lib/pinToImage';
import { roomText, tone } from '../toolParts';

export default {
  id: 'pin-to-image',
  added: '2026-11-05',
  category: 'imagine',
  setting: 'public',
  delivery: ['live', 'self-paced'],
  name: 'Pin to Image',
  tagline: 'A picture, a question, and everybody’s answer as a pin.',
  blurb: 'Put up a photo or a plan of the place and ask a question about it. Everybody answers by pinning a dot where they would put it, and the dots fill the picture as they come in.',
  ...tone(PALETTE.purple),
  icon: 'pin',
  createdBy: 'PLACER',
  component: PinToImage,
  // One picture and question per slide, for a run of them (ToolConfiguratorPage).
  slides: true,
  setup: {
    defaults: defaultPinSetup,
    problems: pinSetupProblems,
    Form: PinToImageSetup,
    // The question is the slide's title, typed into on the canvas as well as in the panel.
    title: { key: 'prompt', placeholder: DEFAULT_PROMPT, max: MAX_PROMPT_LENGTH },
    // The picture is added on the canvas, under the title.
    Canvas: PinImageCanvas,
    steps: [
      { title: 'Prompt', Form: PinPromptStep, problems: promptProblems },
      // On the canvas on the configuration page, so not in its panel.
      { title: 'Picture', Form: PinImageStep, problems: imageProblems, inPanel: false },
      { title: 'Timer', panelTitle: null, Form: PinTimerStep, problems: timerProblems },
    ],
  },
  // Everybody's pins, live or once it has ended (PinToImageResults).
  results: { View: PinToImageResults },
  onProjectPage: {
    heading: 'Pin it on the picture',
  },
  room: {
    empty: emptyPin,
    combine: (states) => combinePins(states),
    label: (config) => roomText(config?.prompt),
  },
};
