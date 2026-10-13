import { DesireLines } from '../../components/toolkit/DesireLines';
import { CHARACTER } from '../../theme';
import { tone } from '../toolParts';

export default {
  id: 'desire-lines',
  added: '2026-08-27',
  category: 'understand',
  name: 'Desire Lines',
  tagline: 'The path people take, not the one that got paved.',
  blurb: 'A plaza paved the way plazas are paved, with the things people walk between in the corners. Draw the walks you would actually make and the argument for repaving draws itself.',
  ...tone(CHARACTER.practitioner),
  icon: 'path',
  createdBy: 'PLACER',
  component: DesireLines,
};
