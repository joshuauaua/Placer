/* PLACER — the Sandbox register.
 *
 * One entry per experiment. Adding another means adding one object here and one
 * component under src/components/sandbox — the gallery, the routing and the copyable
 * link all read from this list.
 *
 * `room` is optional, and its presence is what lets an experiment be played by a
 * roomful of people at once rather than one person. Two functions:
 *
 *   empty()          — the state a participant starts from
 *   combine(states)  — everybody's state folded into one, in whatever way actually
 *                      means something for this experiment
 *
 * The experiment also has to be in the enumerated list in supabase/rooms.sql, which
 * is the other half of the pair: the database will not host a room for an experiment
 * it has not been told about.
 */

import { BudgetBallot } from '../components/sandbox/BudgetBallot';
import { DesireLines } from '../components/sandbox/DesireLines';
import { FifteenMinute } from '../components/sandbox/FifteenMinute';
import { OpenVote } from '../components/sandbox/OpenVote';
import { SiteMapping } from '../components/sandbox/SiteMapping';
import { SocialSpaceSurvey } from '../components/sandbox/SocialSpaceSurvey';
import { StationaryActivityMap } from '../components/sandbox/StationaryActivityMap';
import { StreetMixer } from '../components/sandbox/StreetMixer';
import { emptyBallot, normalise } from '../lib/budgetBallot';
import { emptyVote, tally as tallyVotes } from '../lib/openVote';

export const EXPERIMENTS = [
  {
    id: 'street-mixer',
    name: 'Street Section Mixer',
    tagline: 'Twenty metres, and everything wants some.',
    blurb: 'A street is a fixed width. Cycle track, bus lane, trees, parking, footway — they are all bidding for the same metres, and the only way to give one more is to take it from another.',
    color: '#2F7BD6',
    icon: 'section',
    submittedBy: 'PLACER',
    component: StreetMixer,
  },
  {
    id: 'desire-lines',
    name: 'Desire Lines',
    tagline: 'The path people take, not the one that got paved.',
    blurb: 'A plaza paved the way plazas are paved, with the things people walk between in the corners. Draw the walks you would actually make and the argument for repaving draws itself.',
    color: '#D4407E',
    icon: 'path',
    submittedBy: 'PLACER',
    component: DesireLines,
  },
  {
    id: 'fifteen-minute',
    name: '15-Minute Reach',
    tagline: 'Everything within a quarter-hour walk. Everything.',
    blurb: 'Place a food shop, a school, a clinic, a park and a transit stop, and see how much of the neighbourhood can really walk to all five — around the railway rather than through it.',
    color: '#3E9D4E',
    icon: 'walk',
    submittedBy: 'PLACER',
    component: FifteenMinute,
  },
  {
    id: 'budget-ballot',
    name: 'Budget Ballot',
    tagline: 'Two hundred and fifty thousand euros. Nine things. Choose.',
    blurb: 'Every line has a real price and a real effect, and the money runs out well before the street is finished. Spending it is easy; explaining who ended up better off is the hard part.',
    color: '#E08A2B',
    icon: 'coins',
    submittedBy: 'PLACER',
    component: BudgetBallot,
    room: {
      empty: emptyBallot,
      /*
       * The room's ballot is the average of everybody's, not the total.
       *
       * A ballot is one fixed budget spent one way, so adding twenty of them
       * together gives a five-million-euro wishlist and throws away the only thing
       * the experiment is about. The mean is itself a ballot somebody could have
       * cast: it says what the room would fund, and it still has to fit in €250,000.
       */
      combine: (states) => {
        if (states.length === 0) return emptyBallot();

        const total = emptyBallot();
        for (const state of states) {
          for (const key of Object.keys(total)) total[key] += Number(state?.[key]) || 0;
        }
        for (const key of Object.keys(total)) {
          total[key] = Math.round(total[key] / states.length);
        }
        return normalise(total);
      },
    },
  },
  {
    id: 'open-vote',
    name: 'Open Vote',
    tagline: 'Ask anything. Yes, No, or Undecided.',
    blurb: 'Type whatever you want to put to a room, then let people vote. There is no scale to calibrate and nothing to configure — just a question, three options, and a live tally as people pick.',
    color: '#EAB308',
    icon: 'flag',
    submittedBy: 'PLACER',
    component: OpenVote,
    room: {
      empty: emptyVote,
      combine: tallyVotes,
    },
  },
  {
    id: 'social-space-survey',
    name: 'The Social Space Survey',
    tagline: 'Eighteen checks that read a space for strangers.',
    blurb: 'A field tool from the Gehl Institute: tick what invites and what blocks, map the spatial patterns that bring strangers together, and judge how well different people could share the place. Walk it in five minutes — take the data with you.',
    color: '#7A52E0',
    icon: 'bench',
    submittedBy: 'PLACER',
    component: SocialSpaceSurvey,
  },
  {
    id: 'site-spatial-mapping',
    name: 'Site-Specific Spatial Mapping Tool',
    tagline: 'Pin a site on the map, answer eighteen cards, stay in touch.',
    blurb: 'Pick a specific site on a Google Map with your location, tell us your age range and gender, work through the eighteen-question survey as a stack of cards, then optionally map markers, reflect in words, and leave contact details for follow-ups.',
    color: '#16766B',
    icon: 'pin',
    submittedBy: 'PLACER',
    component: SiteMapping,
  },
  {
    id: 'stationary-activity-mapping',
    name: 'Stationary Activity Mapping',
    tagline: 'Posture and activity, one person at a time, plotted on the map.',
    blurb: 'A map-based field observation tool. Record each person as a posture and the activity or activities they are doing while holding it, and watch the map fill with points and the tally table take shape. The map is the canvas; the recording card floats over its left half.',
    color: '#D6452F',
    icon: 'grid',
    submittedBy: 'PLACER',
    component: StationaryActivityMap,
  },
];

const BY_ID = new Map(EXPERIMENTS.map((experiment) => [experiment.id, experiment]));

/** The experiment with this id, or null — an unknown id is a 404, not a crash. */
export function findExperiment(id) {
  return BY_ID.get(id) ?? null;
}
