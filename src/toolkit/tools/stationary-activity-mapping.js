import { StationaryActivityMap } from '../../components/toolkit/StationaryActivityMap';
import { PALETTE } from '../../theme';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, tone } from '../toolParts';

export default {
  id: 'stationary-activity-mapping',
  added: '2026-09-17',
  category: 'understand',
  name: 'Stationary Activity Mapping',
  tagline: 'Posture and activity, one person at a time, plotted on the map.',
  blurb: 'A map-based field observation tool. Record each person as a posture and the activity or activities they are doing while holding it, and watch the map fill with points and the tally table take shape. The map is the canvas; the recording card floats over its left half.',
  ...tone(PALETTE.orange),
  icon: 'grid',
  createdBy: 'PLACER',
  credit: PUBLIC_LIFE_PROTOCOL_CREDIT,
  component: StationaryActivityMap,
};
