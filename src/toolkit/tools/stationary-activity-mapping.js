import { StationaryActivityMap } from '../../components/toolkit/StationaryActivityMap';
import { InstructionsStep, SurveyAreaStep } from '../../components/toolkit/StationaryActivitySetup';
import { defaultProjectSetup, projectSetupProblems, projectSetupToSave } from '../../lib/toolkit/stationaryActivity';
import { PALETTE } from '../../theme';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, tone } from '../toolParts';

export default {
  id: 'stationary-activity-mapping',
  added: '2026-09-17',
  category: 'understand',
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
  // A project sets it up as the tool itself starts: the instructions, then the area
  // and location everybody mapping for the project shares (StationaryActivitySetup.jsx).
  setupNote: 'You will outline the area this project maps and name its location. Everybody mapping for the project then starts from them, adding their own name, date, time and weather.',
  setup: {
    defaults: defaultProjectSetup,
    problems: projectSetupProblems,
    toSave: projectSetupToSave,
    steps: [
      { title: 'Instructions', Form: InstructionsStep, problems: () => [] },
      { title: 'Survey area', Form: SurveyAreaStep, problems: projectSetupProblems },
    ],
  },
};
