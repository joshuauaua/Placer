import { PeopleMovingCount } from '../../components/toolkit/PeopleMovingCount';
import { CountSiteCanvas, CountSiteStep, InstructionsStep, TimerStep } from '../../components/toolkit/PeopleMovingSetup';
import {
  combineCounts, defaultProjectSetup, emptyCounts, locationProblems, projectSetupProblems, projectSetupToSave, siteProblems, timerProblems,
} from '../../lib/toolkit/peopleMoving';
import { PALETTE } from '../../theme';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, roomText, tone } from '../toolParts';

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
  // A project sets it up as the tool itself starts: the instructions, then the area, the
  // line on top of it and the location everybody counting for the project shares, and
  // the timer (PeopleMovingSetup.jsx).
  setupNote: 'You will outline the area this project counts in, draw the line people are counted crossing on top of it, name its location and set the timer. Everybody counting for the project then starts from them, and cannot change them; they add their own name, date, time and weather.',
  // Its rooms are for the project's team: signed in, on the project, and asked for their
  // name, the date, time and weather first (FieldSessionGate).
  fieldSession: true,
  // One count site per slide — an area, its line and its timer — for a run of them.
  slides: true,
  setup: {
    defaults: defaultProjectSetup,
    problems: projectSetupProblems,
    toSave: projectSetupToSave,
    // The location is the slide's title, typed into on the canvas.
    title: { key: 'location', placeholder: 'Name the location', max: 120 },
    // The area, then the line, drawn on the canvas's map (CountSiteCanvas).
    Canvas: CountSiteCanvas,
    steps: [
      { title: 'Instructions', Form: InstructionsStep, problems: () => [], inPanel: false },
      // On the configuration page the panel only says how far the drawing on the canvas
      // has got, and what is missing there and in the title.
      { title: 'Count site', Form: CountSiteStep, problems: (setup) => [...siteProblems(setup), ...locationProblems(setup)] },
      { title: 'Timer', panelTitle: null, Form: TimerStep, problems: timerProblems },
    ],
  },
  // Each counter's tally, shared with the room; its facilitator sees them added up.
  room: {
    empty: () => ({ counts: emptyCounts() }),
    combine: (states) => combineCounts(states),
    label: (config) => roomText(config?.location),
  },
};
