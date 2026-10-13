import { DreamIt } from '../../components/toolkit/DreamIt';
import { CHARACTER } from '../../theme';
import { tone } from '../toolParts';

export default {
  id: 'dream-it',
  added: '2026-10-12',
  category: 'imagine',
  name: 'Dream It',
  tagline: 'A prompt to set a room imagining, at the press of a button.',
  blurb: 'An activity for unlocking imagination and making a safe space to share personal visions, desires and emotional connections to a place. Generate a prompt, and let people speak, imagine and listen to each other — about how the place could feel, function or inspire, rather than what is practical today.',
  ...tone(CHARACTER.citizen),
  icon: 'sparkle',
  createdBy: 'PLACER',
  component: DreamIt,
};
