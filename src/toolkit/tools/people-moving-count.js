import { PeopleMovingCount } from '../../components/toolkit/PeopleMovingCount';
import { CountLineStep, InstructionsStep } from '../../components/toolkit/PeopleMovingSetup';
import { defaultProjectSetup, projectSetupProblems, projectSetupToSave } from '../../lib/toolkit/peopleMoving';
import { PALETTE } from '../../theme';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, tone } from '../toolParts';

export default {
  id: 'people-moving-count',
  added: '2026-11-06',
  category: 'understand',
  setting: 'field',
  delivery: ['self-paced'],
  name: 'People Moving Count',
  tagline: 'Everybody crossing a line, tapped in by how they move.',
  blurb: 'Counting people moving tells you how many people pass through a place, and how. Stand by the count line for ten minutes and tap once for each person who crosses it, in either direction: walking, running or jogging, supported, carried or rolling — all of them pedestrians — or on a bicycle.',
  ...tone(PALETTE.blue),
  icon: 'walk',
  createdBy: 'Gehl Institute',
  // The tagline is for the Toolkit's tile only; the cover goes from the name and its
  // credit straight to the description.
  taglineOnCover: false,
  blurbOnCover: true,
  credit: PUBLIC_LIFE_PROTOCOL_CREDIT,
  component: PeopleMovingCount,
  // A project sets it up as the tool itself starts: the instructions, then the line and
  // location everybody counting for the project shares (PeopleMovingSetup.jsx).
  setupNote: 'You will draw the line this project counts people crossing and name its location. Everybody counting for the project then starts from them, and cannot move the line; they add their own name, date, time and weather.',
  setup: {
    defaults: defaultProjectSetup,
    problems: projectSetupProblems,
    toSave: projectSetupToSave,
    steps: [
      { title: 'Instructions', Form: InstructionsStep, problems: () => [], inPanel: false },
      { title: 'Count line', Form: CountLineStep, problems: projectSetupProblems },
    ],
  },
};
