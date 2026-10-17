/* PLACER — the Toolkit register.
 *
 * The Toolkit hosts tools: participatory methods, each made by an organisation
 * (`createdBy`) and each in one of three categories (`category`, see CATEGORIES) —
 * understanding how a place is used, imagining how it could change, or planning
 * that change in one place.
 *
 * `added` is the day the tool joined the Toolkit (YYYY-MM-DD), which is what the
 * gallery's Recent order goes by, and what its card gives as the published date.
 *
 * `image` is optional: an imported picture for the tool's card in the gallery.
 * Without one, the card draws a cover from the tool's icon on its category's colour.
 *
 * One file per tool, src/toolkit/tools/<id>.js, whose default export is its entry.
 * Adding another means adding one file there and one component under
 * src/components/toolkit — the gallery, the routing and the copyable link all read
 * from TOOLS, which gathers them. Its tests go in files of its own as well:
 * src/components/__tests__/Tool<Name>.test.jsx, and Tool<Name>Room.test.jsx for one
 * that runs in a room.
 *
 * `room` is optional, and its presence is what lets a tool be played by a
 * roomful of people at once rather than one person. Two functions:
 *
 *   empty()          — the state a participant starts from
 *   combine(states, config)
 *                    — everybody's state folded into one, in whatever way actually
 *                      means something for this tool; `config` is the room's setup,
 *                      or null
 *
 * and optionally label(config): which room this is, from its setup — a Poll's
 * question — or null. A project can have several rooms of one tool open at once, and
 * this is what tells them apart on its dashboard and its public page.
 *
 * The tool also needs a row in the database's toolkit_room_tools, which is the other
 * half of the pair: the database will not host a room for a tool it has not been told
 * about. That is a file of its own too, supabase/room-tools/<id>.sql, and its
 * migration (see supabase/room-tools.sql).
 *
 * `setup` is optional too, and only means something next to `room`: it is what the
 * organiser chooses before the room opens, so that a tool run for a project is about
 * that project's place rather than the Toolkit's made-up one. Three parts:
 *
 *   defaults()        — the setup a new room starts from
 *   problems(setup)   — what is wrong with it, as sentences; empty when it can open
 *   Form              — the component that edits it: { t, tool, setup, onChange }
 *
 * and optionally `steps`, for a setup asked for in stages rather than on one screen:
 * each a { title, Form, problems } over the same setup, with `problems` covering only
 * its own part (setupSteps, and SetupSteps which walks through them). A tool with
 * steps, even one, has when its room starts and how long it stays open as a stage of
 * its own after them.
 *
 * The setup is fixed when the room opens (supabase/rooms-config.sql) and reaches the
 * tool as `room.config`. A room opened without one — or before there was such a
 * thing — has a null `room.config`, and the tool behaves as it does outside a room.
 *
 * `hidden` is optional, and is the switch for taking a tool off the platform without
 * deleting it — one still being made, say, that is not ready by a deadline. Set it to
 * true and the tool is left out of TOOLS and findTool, so it is gone everywhere they
 * are read: the Toolkit's gallery and its page (a 404), what a project can add, and,
 * for a project that already has it, its dashboard and its public page. Nothing is
 * deleted: a project keeps its row in project_tools, and its rooms, and taking the
 * line out again brings it all back.
 *
 * `credit` is optional: a sentence acknowledging where the method comes from, shown
 * under who made it wherever the tool describes itself (ToolCover, ToolLayout,
 * ConfigureToolDialog).
 *
 * `setupNote` is optional: what ConfigureToolDialog's introduction says configuring
 * the tool involves, in place of the sentence for its kind of setup — or null to say
 * nothing past the tool's own blurb.
 *
 * `launch` marks a tool that is a flow of App's own rather than a component on the
 * Toolkit's page: Get started on its cover hands over to that flow (ToolkitPage's
 * onLaunchTool), carrying the project it was opened for. Idea Visualizer is one —
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

import { PALETTE } from '../theme';

/**
 * The three kinds of tool, in the order the Toolkit lists them. Every tool's
 * `category` is one of these ids. Each has a theme colour, for its tag and
 * its cards' hover: blue to understand, orange to imagine, purple to plan.
 */
export const CATEGORIES = [
  {
    id: 'understand',
    name: 'Understand',
    description: 'Tools for understanding how a place is used today.',
    colour: PALETTE.blue,
  },
  {
    id: 'imagine',
    name: 'Imagine',
    description: 'Tools for imagining how a place could change.',
    colour: PALETTE.orange,
  },
  {
    id: 'plan',
    name: 'Plan',
    description: 'Tools for planning the change, together, in one place.',
    colour: PALETTE.purple,
  },
];

/**
 * Every tool, oldest first: by `added`, then by id. Each lives in its own file under
 * ./tools, named for its id, so a branch adding one adds a file rather than editing a
 * list that every other new tool edits too.
 */
export const REGISTERED_TOOLS = Object.entries(import.meta.glob('./tools/*.js', { eager: true, import: 'default' }))
  .map(([path, tool]) => {
    const file = path.slice('./tools/'.length, -'.js'.length);
    if (tool?.id !== file) throw new Error(`src/toolkit/tools/${file}.js: its id is ${tool?.id}, not ${file}`);
    return tool;
  })
  .sort((a, b) => a.added.localeCompare(b.added) || a.id.localeCompare(b.id));

/** The tools that are not switched off with `hidden`, in the order they were given. */
export function shownTools(tools) {
  return tools.filter((tool) => !tool.hidden);
}

/**
 * Every tool on the platform: the register less the hidden ones. Everything but the
 * register's own tests reads this, never REGISTERED_TOOLS.
 */
export const TOOLS = shownTools(REGISTERED_TOOLS);

const BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

/** The stages a tool's setup is asked for in: its `steps`, or its one Form as a stage of its own. */
export function setupSteps(tool) {
  if (!tool?.setup) return [];
  return tool.setup.steps ?? [{ title: null, Form: tool.setup.Form, problems: tool.setup.problems }];
}

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
 * day keep their order in TOOLS, later entries counting as newer.
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

/**
 * Tools are templates: the Toolkit page shows each on its own, to understand and try
 * out, and a project adds the ones it wants and fills them in for itself from its own
 * page (ConfigureToolDialog). How a tool is filled in for a project:
 *
 *   'site'   — Site-Specific Spatial Mapping: the site's name, and the view of it on
 *              the map that everybody maps it in
 *   'room'   — a tool that runs in a room: its `setup`, if it has one, and how long the
 *              project's room stays open. Opening that room is what puts it live.
 *   'none'   — nothing to fill in; configuring it only puts it live
 */
export function projectSetupKind(tool) {
  if (tool.id === 'site-spatial-mapping') return 'site';
  if (tool.room) return 'room';
  return 'none';
}

/**
 * Whether a project's tool is live: shown on its public page for people to use. A
 * tool that runs in a room is live while the project has a room open for it; any
 * other once it has been configured (project_tools.config, which is null until then).
 * Until it is live, the dashboard offers to configure it.
 */
export function isToolLive(tool, { configured = false, openRoom = null } = {}) {
  return projectSetupKind(tool) === 'room' ? Boolean(openRoom) : configured;
}

/** The category with this id, or null. */
export function findCategory(id) {
  return CATEGORIES.find((category) => category.id === id) ?? null;
}

/** The tool with this id, or null — an unknown or hidden id is a 404, not a crash. */
export function findTool(id) {
  return BY_ID.get(id) ?? null;
}
