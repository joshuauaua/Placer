import { ReimagineASpace } from '../../components/toolkit/ReimagineASpace';
import { IdeaVisualizerOnPage } from '../../components/toolkit/IdeaVisualizerOnPage';
import { SceneStep } from '../../components/toolkit/IdeaVisualizerSetup';
import { ASSET_LIB } from '../../data';
import { PALETTE } from '../../theme';
import { combineVisuals, defaultSceneSetup, emptyVisual, sceneProblems } from '../../lib/ideaVisualizer';
import { counted, roomText, tone } from '../toolParts';

const KNOWN_TYPES = new Set(ASSET_LIB.map((asset) => asset.type));

export default {
  id: 'reimagine-a-space',
  added: '2026-10-06',
  category: 'imagine',
  name: 'Idea Visualizer',
  tagline: 'A tool to help anyone quickly create a visualization of an idea they have.',
  blurb: 'Pick a spot on the map and step into its Street View. Place benches, trees, lighting, and more where they would go, and save it to your profile to come back to.',
  ...tone(PALETTE.orange),
  icon: 'sparkle',
  createdBy: 'PLACER',
  duration: 'About 5 minutes',
  component: ReimagineASpace,
  launch: true,
  // The introduction to configuring it says no more than the tool's own blurb.
  setupNote: null,
  setup: {
    defaults: defaultSceneSetup,
    problems: sceneProblems,
    Form: SceneStep,
    steps: [
      { title: 'Address and view', Form: SceneStep, problems: sceneProblems },
    ],
  },
  inquiry: {
    summary: (config) => (config?.canvasAssets?.length > 0 ? counted(config.canvasAssets.length, 'thing placed', 'things placed') : ''),
    picture: (config) => (typeof config?.preview === 'string' ? config.preview : null),
  },
  onProjectPage: {
    heading: 'Share your idea for this place',
    Embed: IdeaVisualizerOnPage,
  },
  room: {
    empty: emptyVisual,
    combine: (states) => combineVisuals(states, KNOWN_TYPES),
    label: (config) => roomText(config?.address),
  },
};
