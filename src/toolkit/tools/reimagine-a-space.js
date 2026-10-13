import { ReimagineASpace } from '../../components/toolkit/ReimagineASpace';
import { CHARACTER } from '../../theme';
import { tone } from '../toolParts';

export default {
  id: 'reimagine-a-space',
  added: '2026-10-06',
  category: 'imagine',
  name: 'Idea Visualizer',
  tagline: 'A tool to help anyone quickly create a visual render of an idea they have.',
  blurb: 'Pick a spot on the map and step into its Street View. Place benches, trees, lighting and more where they would go, say what the idea is and why, and post it to the map for others to see.',
  ...tone(CHARACTER.citizen),
  icon: 'sparkle',
  createdBy: 'PLACER',
  duration: 'About 5 minutes',
  component: ReimagineASpace,
  launch: true,
  onProjectPage: {
    heading: 'Share your idea for this place',
  },
};
