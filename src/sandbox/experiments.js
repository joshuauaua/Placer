/* PLACER — the Sandbox register.
 *
 * One entry per experiment. Adding a fifth means adding one object here and one
 * component under src/components/sandbox — the gallery, the routing and the copyable
 * link all read from this list.
 *
 * `hint` is the one thing worth trying first, shown under the title. It should send
 * somebody straight at the point of the experiment rather than describe the controls.
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
import { StreetMixer } from '../components/sandbox/StreetMixer';
import { emptyBallot, normalise } from '../lib/budgetBallot';

export const EXPERIMENTS = [
  {
    id: 'street-mixer',
    name: 'Street Section Mixer',
    tagline: 'Twenty metres, and everything wants some.',
    blurb: 'A street is a fixed width. Cycle track, bus lane, trees, parking, footway — they are all bidding for the same metres, and the only way to give one more is to take it from another.',
    hint: 'drag a divider, and see what the metre you just moved was doing before.',
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
    hint: 'walk from the metro to the tram stop, then look at the grass in between.',
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
    hint: "load the council's draft, then look at who lives south of the tracks.",
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
    hint: 'fund the parklets, then watch the shopkeepers’ bar go the other way.',
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
];

const BY_ID = new Map(EXPERIMENTS.map((experiment) => [experiment.id, experiment]));

/** The experiment with this id, or null — an unknown id is a 404, not a crash. */
export function findExperiment(id) {
  return BY_ID.get(id) ?? null;
}
