import { StationaryActivityMap } from '../../components/toolkit/StationaryActivityMap';
import { InstructionsStep, SurveyAreaCanvas, SurveyAreaStep } from '../../components/toolkit/StationaryActivitySetup';
import {
  combineObservations, defaultProjectSetup, projectSetupProblems, projectSetupToSave,
} from '../../lib/toolkit/stationaryActivity';
import { PALETTE } from '../../theme';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, roomText, tone } from '../toolParts';

export default {
  id: 'stationary-activity-mapping',
  added: '2026-09-17',
  category: 'understand',
  setting: 'field',
  delivery: ['self-paced'],
  name: 'Stationary Activity Mapping',
  tagline: 'Posture and activity, one person at a time, plotted on the map.',
  blurb: 'Mapping people spending time is like taking a snapshot of all activities taking place in the survey area at a given moment. It is not based on a predesignated amount of time — it may take 5 seconds or 20 minutes depending on how many people are spending time in an area. You need to cover the full survey area in your shift, once each hour.',
  ...tone(PALETTE.orange),
  icon: 'grid',
  createdBy: 'Gehl Institute',
  // The tagline is for the Toolkit's tile only; the cover goes from the name and its
  // credit straight to the description, and the instructions page shows only the credits.
  taglineOnCover: false,
  blurbOnCover: true,
  credit: PUBLIC_LIFE_PROTOCOL_CREDIT,
  component: StationaryActivityMap,
  // Its rooms are for the project's team: signed in, on the project, and asked for their
  // name, the date, time and weather first (FieldSessionGate).
  fieldSession: true,
  // A project sets it up as the tool itself starts: the instructions, then the area
  // and location everybody mapping for the project shares (StationaryActivitySetup.jsx).
  setupNote: 'You will outline the area this project maps and name its location. Everybody mapping for the project then starts from them, adding their own name, date, time and weather.',
  setup: {
    defaults: defaultProjectSetup,
    problems: projectSetupProblems,
    toSave: projectSetupToSave,
    // On the configuration page the area is outlined on the canvas, not in the panel.
    Canvas: SurveyAreaCanvas,
    steps: [
      { title: 'Instructions', Form: InstructionsStep, problems: () => [], inPanel: false },
      { title: 'Survey area', Form: SurveyAreaStep, problems: projectSetupProblems },
    ],
  },
  // Each observer's points, shared with the room; its facilitator sees them tallied.
  room: {
    empty: () => ({ observations: [] }),
    combine: (states) => combineObservations(states),
    label: (config) => roomText(config?.location),
  },
};
