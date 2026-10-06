/* PLACER — the Toolkit register.
 *
 * The Toolkit hosts tools: participatory methods, each made by an organisation
 * (`createdBy`) and each in one of three categories (`category`, see CATEGORIES) —
 * understanding how a place is used, imagining how it could change, or planning
 * that change in one place.
 *
 * `added` is the day the tool joined the Toolkit (YYYY-MM-DD), which is what the
 * gallery's Recent order goes by.
 *
 * One entry per tool. Adding another means adding one object here and one
 * component under src/components/toolkit — the gallery, the routing and the copyable
 * link all read from this list.
 *
 * `room` is optional, and its presence is what lets a tool be played by a
 * roomful of people at once rather than one person. Two functions:
 *
 *   empty()          — the state a participant starts from
 *   combine(states)  — everybody's state folded into one, in whatever way actually
 *                      means something for this tool
 *
 * The tool also has to be in the enumerated list in supabase/rooms.sql, which
 * is the other half of the pair: the database will not host a room for a tool
 * it has not been told about.
 *
 * `setup` is optional too, and only means something next to `room`: it is what the
 * organiser chooses before the room opens, so that a tool run for a project is about
 * that project's place rather than the Toolkit's made-up one. Three parts:
 *
 *   defaults()        — the setup a new room starts from
 *   problems(setup)   — what is wrong with it, as sentences; empty when it can open
 *   Form              — the component that edits it: { t, tool, setup, onChange }
 *
 * The setup is fixed when the room opens (supabase/rooms-config.sql) and reaches the
 * tool as `room.config`. A room opened without one — or before there was such a
 * thing — has a null `room.config`, and the tool behaves as it does outside a room.
 *
 * `launch` marks a tool that is a flow of App's own rather than a component on the
 * Toolkit's page: Get started on its cover hands over to that flow (ToolkitPage's
 * onLaunchTool), carrying the project it was opened for. Reimagine a Space is one —
 * the imagination flow runs full-bleed, step by step, and keeps its draft in App.
 * Its `component` is only what shows where nothing takes the hand-over.
 *
 * `onProjectPage` is how a project's public page presents the tool once its organisers
 * have added it and, for a room-capable tool, opened a room for it — which is what
 * setting it up for the project means. A tool added but not yet opened is not shown
 * there at all. Two parts, both optional:
 *
 *   heading  — the section's title, said to the visitor ("We want your opinion"),
 *              rather than the tool's name; the name is the fallback
 *   Embed    — the tool itself, set into the page: { t, tool, room }, where `room` is
 *              { id, expiresAt, config }. Without one, the page links to the room.
 */

import { BudgetBallot } from '../components/toolkit/BudgetBallot';
import { BudgetBallotSetup } from '../components/toolkit/BudgetBallotSetup';
import { DesireLines } from '../components/toolkit/DesireLines';
import { FifteenMinute } from '../components/toolkit/FifteenMinute';
import { OpenVote } from '../components/toolkit/OpenVote';
import { OpenVoteSetup } from '../components/toolkit/OpenVoteSetup';
import { OpenVoteOnPage } from '../components/toolkit/OpenVoteOnPage';
import { ReimagineASpace } from '../components/toolkit/ReimagineASpace';
import { SiteMapping } from '../components/toolkit/SiteMapping';
import { SocialSpaceSurvey } from '../components/toolkit/SocialSpaceSurvey';
import { StationaryActivityMap } from '../components/toolkit/StationaryActivityMap';
import { StreetMixer } from '../components/toolkit/StreetMixer';
import { CHARACTER } from '../theme';
import { ballotSetupProblems, defaultBallotSetup, emptyBallot, normalise } from '../lib/budgetBallot';
import { defaultVoteSetup, emptyVote, tally as tallyVotes, voteSetupProblems } from '../lib/openVote';

// Each tool wears one of the three character colours: `color` is the 700,
// for text, icons and outlines on white, and `tint` the 100, for fills with ink
// on them, `hover` the 300 a character button turns on hover. The brand kit has no other colours to give.
const tone = (character) => ({ color: character.c700, tint: character.c100, hover: character.c300, wash: character.c50 });

/**
 * The three kinds of tool, in the order the Toolkit lists them. Every tool's
 * `category` is one of these ids.
 */
export const CATEGORIES = [
  {
    id: 'understand',
    name: 'Understand',
    description: 'Tools for understanding how a place is used today.',
  },
  {
    id: 'imagine',
    name: 'Imagine',
    description: 'Tools for imagining how a place could change.',
  },
  {
    id: 'plan',
    name: 'Plan',
    description: 'Tools for planning the change, together, in one place.',
  },
];

export const TOOLS = [
  {
    id: 'street-mixer',
    added: '2026-08-27',
    category: 'imagine',
    name: 'Street Section Mixer',
    tagline: 'Twenty metres, and everything wants some.',
    blurb: 'A street is a fixed width. Cycle track, bus lane, trees, parking, footway — they are all bidding for the same metres, and the only way to give one more is to take it from another.',
    ...tone(CHARACTER.cityWorker),
    icon: 'section',
    createdBy: 'PLACER',
    component: StreetMixer,
  },
  {
    id: 'desire-lines',
    added: '2026-08-27',
    category: 'understand',
    name: 'Desire Lines',
    tagline: 'The path people take, not the one that got paved.',
    blurb: 'A plaza paved the way plazas are paved, with the things people walk between in the corners. Draw the walks you would actually make and the argument for repaving draws itself.',
    ...tone(CHARACTER.practitioner),
    icon: 'path',
    createdBy: 'PLACER',
    component: DesireLines,
  },
  {
    id: 'fifteen-minute',
    added: '2026-08-27',
    category: 'understand',
    name: '15-Minute Reach',
    tagline: 'Everything within a quarter-hour walk. Everything.',
    blurb: 'Place a food shop, a school, a clinic, a park and a transit stop, and see how much of the neighbourhood can really walk to all five — around the railway rather than through it.',
    ...tone(CHARACTER.practitioner),
    icon: 'walk',
    createdBy: 'PLACER',
    component: FifteenMinute,
  },
  {
    id: 'budget-ballot',
    added: '2026-08-27',
    category: 'plan',
    name: 'Budget Ballot',
    tagline: 'Two hundred and fifty thousand euros. Nine things. Choose.',
    blurb: 'Every line has a real price and a real effect, and the money runs out well before the street is finished. Spending it is easy; explaining who ended up better off is the hard part.',
    ...tone(CHARACTER.citizen),
    icon: 'coins',
    createdBy: 'PLACER',
    component: BudgetBallot,
    onProjectPage: {
      heading: 'How would you spend the budget?',
    },
    setup: {
      defaults: defaultBallotSetup,
      problems: ballotSetupProblems,
      Form: BudgetBallotSetup,
    },
    room: {
      empty: emptyBallot,
      /*
       * The room's ballot is the average of everybody's, not the total.
       *
       * A ballot is one fixed budget spent one way, so adding twenty of them
       * together gives a five-million-euro wishlist and throws away the only thing
       * the tool is about. The mean is itself a ballot somebody could have
       * cast: it says what the room would fund, and it still fits the room's budget.
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
    added: '2026-09-22',
    category: 'plan',
    name: 'Open Vote',
    tagline: 'Ask anything. Yes, No, or Undecided.',
    blurb: 'Type whatever you want to put to a room, then let people vote. There is no scale to calibrate — just a question, three options, and a live tally as people pick.',
    ...tone(CHARACTER.cityWorker),
    icon: 'flag',
    createdBy: 'PLACER',
    component: OpenVote,
    setup: {
      defaults: defaultVoteSetup,
      problems: voteSetupProblems,
      Form: OpenVoteSetup,
    },
    onProjectPage: {
      heading: 'We want your opinion',
      Embed: OpenVoteOnPage,
    },
    room: {
      empty: emptyVote,
      combine: tallyVotes,
    },
  },
  {
    id: 'social-space-survey',
    added: '2026-09-17',
    category: 'understand',
    name: 'The Social Space Survey',
    tagline: 'Eighteen checks that read a space for strangers.',
    blurb: 'A field tool from the Gehl Institute: tick what invites and what blocks, map the spatial patterns that bring strangers together, and judge how well different people could share the place. Walk it in five minutes — take the data with you.',
    ...tone(CHARACTER.practitioner),
    icon: 'bench',
    createdBy: 'Gehl Institute',
    component: SocialSpaceSurvey,
  },
  {
    id: 'site-spatial-mapping',
    added: '2026-09-17',
    category: 'understand',
    name: 'Site-Specific Spatial Mapping Tool',
    tagline: 'Pin a site on the map, answer eighteen cards, stay in touch.',
    blurb: 'Pick a specific site on a Google Map with your location, tell us your age range and gender, work through the eighteen-question survey as a stack of cards, then optionally map markers, reflect in words, and leave contact details for follow-ups.',
    ...tone(CHARACTER.cityWorker),
    icon: 'pin',
    createdBy: 'PLACER',
    component: SiteMapping,
  },
  {
    id: 'stationary-activity-mapping',
    added: '2026-09-17',
    category: 'understand',
    name: 'Stationary Activity Mapping',
    tagline: 'Posture and activity, one person at a time, plotted on the map.',
    blurb: 'A map-based field observation tool. Record each person as a posture and the activity or activities they are doing while holding it, and watch the map fill with points and the tally table take shape. The map is the canvas; the recording card floats over its left half.',
    ...tone(CHARACTER.citizen),
    icon: 'grid',
    createdBy: 'PLACER',
    component: StationaryActivityMap,
  },
  {
    id: 'reimagine-a-space',
    added: '2026-10-06',
    category: 'imagine',
    name: 'Reimagine a Space',
    tagline: 'A tool to help anyone quickly create a visual render of an idea they have.',
    blurb: 'Pick a spot on the map and step into its Street View. Place benches, trees, lighting and more where they would go, say what the idea is and why, and post it to the map for others to see.',
    ...tone(CHARACTER.citizen),
    icon: 'sparkle',
    createdBy: 'PLACER',
    duration: 'About 5 minutes',
    component: ReimagineASpace,
    launch: true,
    onProjectPage: {
      heading: 'Share your idea for this place',
    },
  },
];

const BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

/** Every organisation with a tool in the register, alphabetically. */
export const ORGANISATIONS = [...new Set(TOOLS.map((tool) => tool.createdBy))]
  .sort((a, b) => a.localeCompare(b));

/**
 * The tools that match the Toolkit page's search and filters.
 *
 * `query` matches the name, tagline, description and organisation, ignoring case
 * and accents, and every word in it has to match somewhere. `category` and
 * `organisation` are exact, and null means any. `groupOnly` keeps the tools that
 * can be run with a group in a room.
 */
export function filterTools(tools, { query = '', category = null, organisation = null, groupOnly = false } = {}) {
  const fold = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);

  return tools.filter((tool) => {
    if (category && tool.category !== category) return false;
    if (organisation && tool.createdBy !== organisation) return false;
    if (groupOnly && !tool.room) return false;
    const haystack = fold([tool.name, tool.tagline, tool.blurb, tool.createdBy].join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

/** The orders the gallery can be put in, each with the direction it starts in. */
export const SORTS = [
  { id: 'recent', name: 'Recent', direction: 'desc' },
  { id: 'az', name: 'A-Z', direction: 'asc' },
  { id: 'organisation', name: 'Organisation', direction: 'asc' },
];

/**
 * The tools in one of the SORTS orders, as a new array. Recent goes by `added`,
 * A-Z by name, and Organisation by `createdBy` and then name. Tools added on the same
 * day keep their register order, later entries counting as newer.
 */
export function sortTools(tools, sort = 'recent', direction = 'desc') {
  const byName = (a, b) => a.tool.name.localeCompare(b.tool.name);
  const compare = {
    recent: (a, b) => a.tool.added.localeCompare(b.tool.added) || a.index - b.index,
    az: byName,
    organisation: (a, b) => a.tool.createdBy.localeCompare(b.tool.createdBy) || byName(a, b),
  }[sort] ?? (() => 0);
  const sign = direction === 'desc' ? -1 : 1;
  return tools
    .map((tool, index) => ({ tool, index }))
    .sort((a, b) => sign * compare(a, b))
    .map(({ tool }) => tool);
}

/** The category with this id, or null. */
export function findCategory(id) {
  return CATEGORIES.find((category) => category.id === id) ?? null;
}

/** The tool with this id, or null — an unknown id is a 404, not a crash. */
export function findTool(id) {
  return BY_ID.get(id) ?? null;
}
