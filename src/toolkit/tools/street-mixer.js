import { StreetMixer } from '../../components/toolkit/StreetMixer';
import { PALETTE } from '../../theme';
import { tone } from '../toolParts';

export default {
  id: 'street-mixer',
  added: '2026-08-27',
  category: 'imagine',
  name: 'Street Section Mixer',
  tagline: 'Twenty metres, and everything wants some.',
  blurb: 'A street is a fixed width. Cycle track, bus lane, trees, parking, footway — they are all bidding for the same metres, and the only way to give one more is to take it from another.',
  ...tone(PALETTE.blue),
  icon: 'section',
  createdBy: 'PLACER',
  component: StreetMixer,
  // Not on plcr.org or beta.plcr.org yet; only locally.
  hidden: 'production',
};
