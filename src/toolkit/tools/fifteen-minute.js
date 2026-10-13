import { FifteenMinute } from '../../components/toolkit/FifteenMinute';
import { CHARACTER } from '../../theme';
import { tone } from '../toolParts';

export default {
  id: 'fifteen-minute',
  added: '2026-08-27',
  category: 'understand',
  name: '15-Minute Reach',
  tagline: 'Everything within a quarter-hour walk. Everything.',
  blurb: 'Place a food shop, a school, a clinic, a park and a transit stop, and see how much of the neighbourhood can really walk to all five — around the railway rather than through it.',
  ...tone(CHARACTER.practitioner),
  icon: 'walk',
  createdBy: 'PLACER',
  component: FifteenMinute,
};
