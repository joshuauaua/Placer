/* PLACER — the Sandbox register.
 *
 * One entry per experiment. Adding a fifth means adding one object here and one
 * component under src/components/sandbox — the gallery, the routing and the copyable
 * link all read from this list.
 *
 * `hint` is the one thing worth trying first, shown under the title. It should send
 * somebody straight at the point of the experiment rather than describe the controls.
 */

import { BudgetBallot } from '../components/sandbox/BudgetBallot';
import { DesireLines } from '../components/sandbox/DesireLines';
import { FifteenMinute } from '../components/sandbox/FifteenMinute';
import { StreetMixer } from '../components/sandbox/StreetMixer';
import { CHARACTER } from '../theme';

// Each experiment wears one of the three character colours: `color` is the 700,
// for text, icons and outlines on white, `tint` the 100, for fills with ink on
// them, and `hover` the 300 a character button turns on hover.
const tone = (character) => ({ color: character.c700, tint: character.c100, hover: character.c300, wash: character.c50 });

export const EXPERIMENTS = [
  {
    id: 'street-mixer',
    name: 'Street Section Mixer',
    tagline: 'Twenty metres, and everything wants some.',
    blurb: 'A street is a fixed width. Cycle track, bus lane, trees, parking, footway — they are all bidding for the same metres, and the only way to give one more is to take it from another.',
    hint: 'drag a divider, and see what the metre you just moved was doing before.',
    ...tone(CHARACTER.cityWorker),
    icon: 'section',
    component: StreetMixer,
  },
  {
    id: 'desire-lines',
    name: 'Desire Lines',
    tagline: 'The path people take, not the one that got paved.',
    blurb: 'A plaza paved the way plazas are paved, with the things people walk between in the corners. Draw the walks you would actually make and the argument for repaving draws itself.',
    hint: 'walk from the metro to the tram stop, then look at the grass in between.',
    ...tone(CHARACTER.practitioner),
    icon: 'path',
    component: DesireLines,
  },
  {
    id: 'fifteen-minute',
    name: '15-Minute Reach',
    tagline: 'Everything within a quarter-hour walk. Everything.',
    blurb: 'Place a food shop, a school, a clinic, a park and a transit stop, and see how much of the neighbourhood can really walk to all five — around the railway rather than through it.',
    hint: "load the council's draft, then look at who lives south of the tracks.",
    ...tone(CHARACTER.practitioner),
    icon: 'walk',
    component: FifteenMinute,
  },
  {
    id: 'budget-ballot',
    name: 'Budget Ballot',
    tagline: 'Two hundred and fifty thousand euros. Nine things. Choose.',
    blurb: 'Every line has a real price and a real effect, and the money runs out well before the street is finished. Spending it is easy; explaining who ended up better off is the hard part.',
    hint: 'fund the parklets, then watch the shopkeepers’ bar go the other way.',
    ...tone(CHARACTER.citizen),
    icon: 'coins',
    component: BudgetBallot,
  },
];

const BY_ID = new Map(EXPERIMENTS.map((experiment) => [experiment.id, experiment]));

/** The experiment with this id, or null — an unknown id is a 404, not a crash. */
export function findExperiment(id) {
  return BY_ID.get(id) ?? null;
}
