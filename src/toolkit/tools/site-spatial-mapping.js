import { SiteMapping } from '../../components/toolkit/SiteMapping';
import { CHARACTER } from '../../theme';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, tone } from '../toolParts';

export default {
  id: 'site-spatial-mapping',
  added: '2026-09-17',
  category: 'understand',
  name: 'Site-Specific Spatial Mapping Tool',
  tagline: 'Pin a site on the map, answer eighteen cards, stay in touch.',
  blurb: 'Pick a specific site on a Google Map with your location, tell us your age range and gender, work through the eighteen-question survey as a stack of cards, then optionally map markers, reflect in words, and leave contact details for follow-ups.',
  ...tone(CHARACTER.cityWorker),
  icon: 'pin',
  createdBy: 'PLACER',
  credit: PUBLIC_LIFE_PROTOCOL_CREDIT,
  component: SiteMapping,
};
