/* PLACER — the sections of a project's page, in the order and under the titles its
 * organisers chose.
 *
 * The Project tab of a project's page (PublicProjectPage) is a run of sections: About
 * the project, Goals, Photos, any photo shown on its own, then one per live tool. projectSections lists them as
 * they come by default, each with a `key` that names it for good and a `defaultTitle`;
 * arrangeSections puts them in the order of the project's `pageLayout`
 * (supabase/project-page-layout.sql) and under its titles, and hides the titles it says
 * to (`hideTitle`): kept for screen readers, not shown. Edit project's Page field
 * (PageLayoutEditor) lists the same sections to arrange, so what is arranged there is
 * exactly what the page shows.
 *
 * The keys:
 *
 *   about, goals, photos   the project's own sections; photos is the gallery, of the
 *                          photos not shown on their own
 *   photo:<path>           a photo shown on its own (supabase/project-gallery-standalone.sql),
 *                          its title hidden unless somebody shows it
 *   tool:<tool id>         a tool configured for the project that runs on its own
 *   room:<room id>         an open room of a tool that runs in one — a project can run
 *                          several Polls at once, each with a section of its own
 *
 * A room's key is its room's, so a title given to one Poll does not pass to the next
 * one opened.
 */

import { isToolLive, projectSetupKind } from '../toolkit/tools';

// How long a title can be, here and in the editor's field.
export const SECTION_TITLE_MAX = 120;

/**
 * The project's description and goals as the page shows them: the description first,
 * or for a project set up before it had one, its goals in that place instead.
 */
export function projectIntro(project) {
  return {
    intro: project.summary || project.description || '',
    goals: project.summary ? project.description || '' : '',
  };
}

/**
 * Every section the page has, in the default order. `tools` are registry entries,
 * `openRooms` the project's open rooms (readProjectOpenRooms) and `configured` the
 * ids of the tools configured for it (readConfiguredProjectTools). Each section is
 * { key, kind, defaultTitle, domId } plus `tool` and `room` for a tool's: `domId` is
 * the element id the page gives it, which links to a section go by.
 */
export function projectSections({ project, tools = [], openRooms = [], configured = new Set() }) {
  const { intro, goals } = projectIntro(project);
  const sections = [];
  if (intro) sections.push({ key: 'about', kind: 'about', defaultTitle: 'About the project', domId: 'project-about' });
  if (goals) sections.push({ key: 'goals', kind: 'goals', defaultTitle: 'Goals', domId: 'project-goals' });
  const gallery = (project.gallery ?? []).filter((photo) => !photo.standalone);
  if (gallery.length > 0) {
    sections.push({ key: 'photos', kind: 'photos', defaultTitle: 'Photos', domId: 'project-photos', photos: gallery });
  }
  (project.gallery ?? []).filter((photo) => photo.standalone).forEach((photo, index) => {
    sections.push({ key: `photo:${photo.path}`, kind: 'photo', defaultTitle: 'Photo', domId: `project-photo-${index + 1}`,
      photo, defaultHidden: true });
  });

  // How the tools are put to the visitor: each under a heading said to them
  // (onProjectPage in toolkit/tools.js), and only the live ones (isToolLive). A tool
  // that runs in a room gets a section per open room, newest first; their headings say
  // which is which (`room.label`), or number them when they cannot.
  for (const tool of tools) {
    const heading = tool.onProjectPage?.heading ?? `Try ${tool.name}`;
    if (projectSetupKind(tool) !== 'room') {
      if (!isToolLive(tool, { configured: configured.has(tool.id) })) continue;
      sections.push({ key: `tool:${tool.id}`, kind: 'tool', defaultTitle: heading, domId: `project-tool-${tool.id}`,
        tool, room: null });
      continue;
    }
    const rooms = openRooms.filter((candidate) => candidate.tool === tool.id);
    rooms.forEach((room, index) => {
      const label = rooms.length > 1 ? tool.room?.label?.(room.config) ?? `${index + 1}` : null;
      sections.push({
        key: `room:${room.id}`,
        kind: 'tool',
        defaultTitle: label ? `${heading}: ${label}` : heading,
        domId: index === 0 ? `project-tool-${tool.id}` : `project-tool-${tool.id}-${room.id}`,
        tool,
        room,
      });
    });
  }
  return sections;
}

/**
 * `sections` in the order of `layout`, each with its `title`: the layout's for it if
 * it gave one, else its default; and `hideTitle`: the layout's if it said, else the
 * section's own default (a photo on its own hides its title). Sections the layout does not mention follow, in their
 * default order; entries for sections that are not there are passed over.
 */
export function arrangeSections(sections, layout = []) {
  const entries = new Map();
  for (const entry of Array.isArray(layout) ? layout : []) {
    if (entry && typeof entry.key === 'string' && !entries.has(entry.key)) entries.set(entry.key, entry);
  }
  const byKey = new Map(sections.map((section) => [section.key, section]));
  const placed = [...entries.keys()].filter((key) => byKey.has(key)).map((key) => byKey.get(key));
  const rest = sections.filter((section) => !entries.has(section.key));
  return [...placed, ...rest].map((section) => {
    // `customTitle` as it was written, so a field editing it keeps what is being typed.
    const custom = entries.get(section.key)?.title;
    const customTitle = typeof custom === 'string' ? custom : '';
    const hidden = entries.get(section.key)?.hideTitle;
    const hideTitle = typeof hidden === 'boolean' ? hidden : Boolean(section.defaultHidden);
    return { ...section, title: customTitle.trim() || section.defaultTitle, customTitle, hideTitle };
  });
}

/**
 * What to save as the project's pageLayout for these sections, in this order: every
 * one of them, so a section added later goes after them all, with a title only where
 * it differs from the default, and `hideTitle` only where that does.
 */
export function layoutFor(sections) {
  return sections.map(({ key, customTitle, defaultTitle, hideTitle, defaultHidden }) => {
    const title = (customTitle ?? '').trim().slice(0, SECTION_TITLE_MAX);
    const entry = title && title !== defaultTitle ? { key, title } : { key };
    if (hideTitle !== undefined && Boolean(hideTitle) !== Boolean(defaultHidden)) entry.hideTitle = Boolean(hideTitle);
    return entry;
  });
}
