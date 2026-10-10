/* PLACER — Toolkit: the participatory methods PLACER hosts, as tools to use.
 *
 * Each tool is a method made by an organisation, in one of three categories —
 * Understand, Imagine or Plan. The gallery shows them as one set, under a header
 * whose toolbar picks a category, an order (Recent, A-Z, Organisation), favourites
 * and grid or list. Each is self-contained: no sign-in, nothing saved, and something moving within a
 * second of arriving. The register of tools is src/toolkit/tools.js.
 *
 * The page is a place to try the tools and see what each one does. They are used for
 * real inside a project: added to it, configured from its dashboard
 * (ConfigureToolDialog) and put in front of people on its public page. So nothing here
 * opens a room. A room a project opened is still shown here, though — this page owns it
 * off the URL, in ?room=, and hands it to the tool as a prop — because that is where
 * people who join with a PIN or a QR code land, and where the dashboard sends its
 * facilitator.
 *
 * The page owns the /toolkit part of the URL itself rather than taking the selected
 * tool as a prop, so every tool has a link that can be shared.
 */

import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { Breadcrumb, PageHeader, WORKSPACE_CRUMB } from './PageHeader';
import { FavouriteButton, GalleryToolbar, useFavourites, useGalleryView } from './GalleryToolbar';
import { Btn } from './UI';
import { ToolLayout } from './ToolLayout';
import { RoomBar } from './toolkit/RoomBar';
import { ToolCover } from './toolkit/ToolCover';
import { ContributeToolDialog } from './ContributeToolDialog';
import { useRoom } from './toolkit/useRoom';
import { useProjectSite } from './toolkit/useProjectSite';
import { CATEGORIES, SORTS, TOOLS, filterTools, findCategory, findTool, sortTools } from '../toolkit/tools';
import { projectIdFrom, roomIdFrom } from '../toolkit/rooms';
import { isSupabaseConfigured } from '../services/rooms';
import { readProjectCrumb } from '../services/projects';

/**
 * The way back from a tool opened for a project. For somebody who can edit it — the
 * organiser who added the tool — that is My Workspace / Projects / the project's
 * dashboard; for anybody else, who came from its public page, just that page. Named
 * "Project" until its name is in.
 */
export function projectTrail(projectId, crumb) {
  const name = crumb?.name || 'Project';
  if (crumb?.canEdit) {
    return [WORKSPACE_CRUMB, { label: 'Projects', href: '/projects' },
      { label: name, href: `/projects/${projectId}/dashboard` }];
  }
  return [{ label: name, href: `/projects/${projectId}` }];
}

/** The tool id in a path like /toolkit/street-mixer, if there is one. */
export function toolIdFrom(path) {
  const match = /^\/toolkit\/([^/?#]+)/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** A tool's `added` date as the card shows it: 27 Aug 2026. */
function publishedOn(added) {
  return new Date(`${added}T00:00:00Z`).toLocaleDateString('en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * One tool as a card, for the grid: its picture with the category's tag at the top
 * left and an arrow at the top right, then its name, its tagline and when it was
 * published. On hover the picture zooms a little, the arrow turns up to the right
 * and a shadow in the category's colour shows along the picture's top and right
 * (index.css). A tool without a picture gets a cover drawn from its icon.
 */
function Tile({ t, tool, onOpen }) {
  const colour = findCategory(tool.category)?.colour;
  return (
    <button
      onClick={onOpen}
      className="placer-toolkit-tile"
      style={{ '--tile-shadow': colour?.c300 ?? tool.hover, color: t.ink }}>
      <span className="placer-toolkit-tile-frame">
        {tool.image ? (
          <img className="placer-toolkit-tile-image" src={tool.image} alt="" />
        ) : (
          <span className="placer-toolkit-tile-image" aria-hidden="true"
            style={{ background: colour?.c100 ?? tool.tint, color: colour?.c700 ?? tool.color }}>
            <Icon name={tool.icon} size={88} stroke={1.4} />
          </span>
        )}
        <span className="placer-toolkit-tile-tag"
          style={{ background: colour?.c100, color: colour?.c900, borderColor: colour?.c700 }}>
          {findCategory(tool.category)?.name}
        </span>
        <span className="placer-toolkit-tile-arrow" aria-hidden="true">
          <Icon name="arrowRight" size={18} stroke={2.2} />
        </span>
      </span>

      <span className="placer-h3">{tool.name}</span>
      <span style={{ fontSize: 15, lineHeight: '22px', color: t.inkDim }}>{tool.tagline}</span>
      {/* Room on the right for the heart, which sits over the card (see the grid). */}
      <span className="placer-caption" style={{ color: t.inkDim, paddingRight: 44 }}>
        {publishedOn(tool.added)}{tool.createdBy && ` · By ${tool.createdBy}`}
      </span>
    </button>
  );
}

/** The tool's category, small and in capitals, so it reads without the grouping. */
function CategoryLabel({ t, tool }) {
  return (
    <span className="placer-caption" style={{ textTransform: 'uppercase', fontWeight: 700,
      letterSpacing: '0.06em', color: t.ink }}>
      {findCategory(tool.category)?.name}
    </span>
  );
}

/** One tool as a row, for the list view: the same facts as a tile, side by side. */
function Row({ t, tool, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="placer-toolkit-row"
      style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', cursor: 'pointer',
        flex: 1, minWidth: 0, padding: '16px 20px', border: 'none', background: 'transparent',
        color: t.ink, fontFamily: 'var(--placer-font)' }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: tool.tint, flex: '0 0 auto',
        boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={tool.icon} size={22} stroke={2.1} />
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{tool.name}</span>
        <span style={{ fontSize: 14, color: t.inkDim }}>{tool.tagline}</span>
      </span>
      <span className="placer-toolkit-row-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        gap: 2, flex: '0 0 auto' }}>
        <CategoryLabel t={t} tool={tool} />
        {tool.createdBy && (
          <span className="placer-caption" style={{ color: t.inkDim }}>By {tool.createdBy}</span>
        )}
      </span>
      <Icon name="arrowRight" size={18} stroke={2.2} style={{ color: t.inkDim }} />
    </button>
  );
}

const NO_FILTERS = { category: null, groupOnly: false };

/**
 * `onLaunchTool(toolId, projectId)` takes over from a tool marked `launch` (see
 * toolkit/tools.js) when its cover's Get started is pressed — App, which runs that
 * tool's flow. Without it, such a tool opens like any other.
 */
export function ToolkitPage({ t, displayName = null, onLaunchTool }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const requestedId = toolIdFrom(location);
  const tool = requestedId ? findTool(requestedId) : null;
  const missing = requestedId && !tool ? requestedId : null;

  const projectId = projectIdFrom(search);

  // The project's name and whether this account can edit it, for the breadcrumb. The
  // page stands without it: a failure leaves the crumb reading "Project".
  const [crumb, setCrumb] = useState(null);
  useEffect(() => {
    setCrumb(null);
    if (!projectId || !isSupabaseConfigured()) return undefined;
    let cancelled = false;
    readProjectCrumb(projectId)
      .then((found) => { if (!cancelled) setCrumb(found); })
      .catch((err) => console.error('Could not load the project for the breadcrumb:', err));
    return () => { cancelled = true; };
  }, [projectId]);

  // A tool set up on a site for the project is used on that site (useProjectSite).
  const { site: projectSite, loading: siteLoading } = useProjectSite(tool, projectId);

  const room = useRoom({
    tool,
    roomId: roomIdFrom(search),
    // Whatever the person calls themselves, so a facilitator can see who has answered.
    // Passed in from App rather than read here: with accounts the name comes from a
    // request, and this is a render body. It is still a label rather than proof of
    // identity — a room is joined with its PIN, not with an account.
    displayName,
  });

  useEffect(() => {
    if (!tool) return;
    posthog.capture('sandbox_experiment_opened', { experiment: tool.id });
  }, [tool]);

  // Which tool has been started past its cover. An id rather than a flag, so
  // opening a different tool lands on that one's cover rather than skipping it,
  // and opening a room (which only changes the query string) does not bring it back.
  const [startedId, setStartedId] = useState(null);

  // The Contribute button's pop-up form, for offering a tool to the PLACER Toolkit.
  const [contributing, setContributing] = useState(false);

  // The gallery's filters. Held here rather than in the URL: they are a
  // way of browsing, not something worth a link of its own.
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ id: SORTS[0].id, direction: SORTS[0].direction });
  const [favourites, toggleFavourite] = useFavourites('placer_toolkit_favourites');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const matching = sortTools(
    filterTools(TOOLS, filters).filter((entry) => !favouritesOnly || favourites.includes(entry.id)),
    sort.id, sort.direction);
  const [view, changeView] = useGalleryView('placer_toolkit_view');
  const clearFilters = () => { setFilters(NO_FILTERS); setFavouritesOnly(false); };

  const Tool = tool?.component;
  const breadcrumb = tool && projectId ? (
    <Breadcrumb t={t} trail={projectTrail(projectId, crumb)} current={tool.name} style={{ marginBottom: 24 }} />
  ) : null;

  // Every tool opens on its cover, full-bleed rather than inside the padded
  // column the tool itself sits in.
  if (tool && Tool && startedId !== tool.id) {
    return (
      <ToolCover t={t} tool={tool} breadcrumb={breadcrumb}
        onStart={() => {
          if (tool.launch && onLaunchTool) onLaunchTool(tool.id, projectId);
          else setStartedId(tool.id);
        }}
        onBack={() => navigate('/toolkit')} />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: tool && Tool ? '48px 40px 80px' : '0 32px 80px' }}>
      {!(tool && Tool) && (
        <PageHeader t={t} title="Toolkit" inset={32} maxWidth="none"
          actions={(
            <Btn t={t} variant="outline" icon="arrowRight" onClick={() => setContributing(true)}>
              Contribute
            </Btn>
          )}
          toolbar={(
            <GalleryToolbar t={t} sorts={SORTS} sort={sort} onSort={setSort}
              favouritesOnly={favouritesOnly} onFavouritesOnly={setFavouritesOnly}
              view={view} onView={changeView}
              menu={{
                label: 'Category',
                current: findCategory(filters.category)?.name ?? 'All tools',
                badge: filters.groupOnly ? 'user' : null,
                sections: [
                  [
                    { key: 'all', label: 'All tools', selected: !filters.category,
                      onSelect: () => setFilters({ ...filters, category: null }) },
                    ...CATEGORIES.map((category) => ({ key: category.id, label: category.name,
                      selected: filters.category === category.id,
                      onSelect: () => setFilters({ ...filters, category: category.id }) })),
                  ],
                  [
                    { key: 'group', kind: 'checkbox', label: 'Works with a group', selected: filters.groupOnly,
                      title: 'Tools that can be run in a room, with people joining by PIN or QR code',
                      onSelect: () => setFilters({ ...filters, groupOnly: !filters.groupOnly }) },
                  ],
                ],
              }} />
          )} />
      )}
      {/* An open tool keeps to a centred column; the gallery runs the page's width, under
          a header that does too. */}
      <div style={tool && Tool ? { maxWidth: 1200, margin: '0 auto' } : undefined}>
        {tool && Tool ? (
          <ToolLayout
            t={t}
            tool={tool}
            breadcrumb={breadcrumb}
            onBack={() => navigate('/toolkit')}>
            <RoomBar t={t} tool={tool} room={room} />
            {siteLoading ? (
              <p style={{ fontSize: 14, color: t.inkDim }}>Loading the project&rsquo;s site…</p>
            ) : (
              <Tool t={t} tool={tool} room={room} projectSite={projectSite}
                onLaunch={tool.launch && onLaunchTool ? () => onLaunchTool(tool.id, projectId) : undefined} />
            )}
          </ToolLayout>
        ) : (
          <>
            {missing && (
              <p role="status" style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12,
                background: t.surfaceAlt, border: `1px solid ${t.line}`, fontSize: 14, color: t.ink }}>
                There is no tool called <span className="placer-mono">{missing}</span>. Here is everything there is.
              </p>
            )}

            {matching.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 20px', color: t.inkDim }}>
                <Icon name="search" size={40} stroke={1.6} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ fontSize: 16, marginBottom: 16 }}>
                  {favouritesOnly && favourites.length === 0
                    ? 'No favourites yet. Tap the heart on a tool to keep it here.'
                    : 'No tools match those filters.'}
                </p>
                <Btn t={t} variant="outline" onClick={clearFilters}>Clear filters</Btn>
              </div>
            )}

            {matching.length > 0 && view === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {matching.map((entry) => (
                  <div key={entry.id} style={{ position: 'relative', display: 'flex', alignSelf: 'start' }}>
                    <Tile t={t} tool={entry} onOpen={() => navigate(`/toolkit/${entry.id}`)} />
                    <FavouriteButton t={t} name={entry.name} favourite={favourites.includes(entry.id)}
                      onToggle={() => toggleFavourite(entry.id)}
                      style={{ position: 'absolute', right: 0, bottom: -7 }} />
                  </div>
                ))}
              </div>
            )}

            {matching.length > 0 && view === 'list' && (
              <div style={{ borderTop: `1px solid ${t.line}` }}>
                {matching.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center',
                    borderBottom: `1px solid ${t.line}` }}>
                    <Row t={t} tool={entry} onOpen={() => navigate(`/toolkit/${entry.id}`)} />
                    <FavouriteButton t={t} name={entry.name} favourite={favourites.includes(entry.id)}
                      onToggle={() => toggleFavourite(entry.id)} style={{ margin: '0 12px' }} />
                  </div>
                ))}
              </div>
            )}

            {contributing && (
              <ContributeToolDialog t={t} onClose={() => setContributing(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ToolkitPage;
