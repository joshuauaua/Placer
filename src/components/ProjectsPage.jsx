/* PLACER — Projects: every project this account owns or collaborates on.
 *
 * Reached from the side nav. Opening one goes to its dashboard, and "Create a
 * Project" at the top right starts a new one. The header's toolbar is the Toolkit's
 * (GalleryToolbar): a menu for whose projects and what kind, an order (Recent, A-Z,
 * Start date), favourites, and grid or list. Projects need an account and a Supabase project either way — see
 * services/projects.js's header — so a checkout without Supabase says so rather
 * than spending a request finding out.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { ProjectCard } from './ProjectCard';
import { FavouriteButton, GalleryToolbar, useFavourites, useGalleryView } from './GalleryToolbar';
import { PROJECT_TYPES, isSupabaseConfigured as projectsAvailable, readMyProjects } from '../services/projects';

// The menu's two questions: whose project it is, and what kind (PROJECT_TYPES' keys,
// named shortly enough for a menu).
const ROLES = [
  { id: null, name: 'All projects' },
  { id: 'owner', name: 'Run by you' },
  { id: 'collaborator', name: 'Collaborating on' },
];

const TYPE_NAMES = { steward: 'Have a say over a place', advocate: 'Pushing for change', other: 'Something else' };

const SORTS = [
  { id: 'recent', name: 'Recent', direction: 'desc' },
  { id: 'az', name: 'A-Z', direction: 'asc' },
  { id: 'start', name: 'Start date', direction: 'desc' },
];

const NO_FILTERS = { role: null, type: null };

/**
 * The projects in one of SORTS' orders, as a new array: Recent by when the project
 * was made, A-Z by name, Start date by its own start date. A project with no date
 * goes last whichever way round.
 */
export function sortProjects(projects, { id, direction }) {
  const sign = direction === 'desc' ? -1 : 1;
  const byDate = (field) => (a, b) => {
    if (!a[field] || !b[field]) return Number(!a[field]) - Number(!b[field]);
    return sign * String(a[field]).localeCompare(String(b[field]));
  };
  const compare = {
    recent: byDate('createdAt'),
    start: byDate('startDate'),
    az: (a, b) => sign * a.name.localeCompare(b.name),
  }[id] ?? (() => 0);
  return [...projects].sort(compare);
}

/** One project as a row, for the list view. */
function ProjectRow({ t, project, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(project.id)} className="placer-toolkit-row"
      style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0, textAlign: 'left',
        cursor: 'pointer', padding: '16px 20px', border: 'none', background: 'transparent', color: t.ink,
        fontFamily: 'var(--placer-font)' }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, flex: '0 0 auto', overflow: 'hidden',
        background: t.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {project.image
          ? <img src={project.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icon name="grid" size={20} stroke={2} />}
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{project.name}</span>
        {project.description && (
          <span style={{ fontSize: 14, color: t.inkDim, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' }}>
            {project.description}
          </span>
        )}
      </span>
      <Icon name="arrowRight" size={18} stroke={2.2} style={{ color: t.inkDim }} />
    </button>
  );
}

export function ProjectsPage({ t, accountId = null, onNewProject, onOpenProjectDashboard }) {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ id: SORTS[0].id, direction: SORTS[0].direction });
  const [favourites, toggleFavourite] = useFavourites('placer_projects_favourites');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [view, changeView] = useGalleryView('placer_projects_view');

  useEffect(() => {
    if (!projectsAvailable() || !accountId) {
      setProjects([]);
      setStatus('ready');
      return undefined;
    }

    let cancelled = false;

    readMyProjects(accountId)
      .then((found) => {
        if (cancelled) return;
        setProjects(found);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your projects:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [accountId]);

  const matching = sortProjects(projects.filter((project) => {
    const owned = project.ownerId === accountId;
    if (filters.role === 'owner' && !owned) return false;
    if (filters.role === 'collaborator' && owned) return false;
    if (filters.type && project.projectType !== filters.type) return false;
    return !favouritesOnly || favourites.includes(project.id);
  }), sort);
  const clearFilters = () => { setFilters(NO_FILTERS); setFavouritesOnly(false); };
  const roleName = ROLES.find((role) => role.id === filters.role).name;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '0 32px 48px' }} className="placer-scroll">
      <PageHeader t={t} title="Projects" inset={32} maxWidth="none"
        actions={projectsAvailable() && onNewProject ? (
          <Btn t={t} variant="primary" icon="plus" onClick={onNewProject}>
            Create a Project
          </Btn>
        ) : null}
        toolbar={projectsAvailable() ? (
          <GalleryToolbar t={t} sorts={SORTS} sort={sort} onSort={setSort}
            favouritesOnly={favouritesOnly} onFavouritesOnly={setFavouritesOnly}
            view={view} onView={changeView}
            menu={{
              label: 'Show',
              current: filters.type ? `${roleName} · ${TYPE_NAMES[filters.type]}` : roleName,
              sections: [
                ROLES.map((role) => ({ key: role.id ?? 'all', label: role.name, selected: filters.role === role.id,
                  onSelect: () => setFilters({ ...filters, role: role.id }) })),
                [
                  { key: 'any', label: 'Any kind', selected: !filters.type,
                    onSelect: () => setFilters({ ...filters, type: null }) },
                  ...PROJECT_TYPES.map((type) => ({ key: type.key, label: TYPE_NAMES[type.key] ?? type.title,
                    title: type.description, selected: filters.type === type.key,
                    onSelect: () => setFilters({ ...filters, type: type.key }) })),
                ],
              ],
            }} />
        ) : null} />
      <div>
        {!projectsAvailable() && (
          <p style={{ fontSize: 14, color: t.inkFaint }}>
            Projects are not available in this environment.
          </p>
        )}

        {projectsAvailable() && status === 'loading' && (
          <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>Loading projects…</div>
        )}

        {projectsAvailable() && status === 'error' && (
          <div role="alert" style={{ padding: 16, borderRadius: 12, background: '#F5F5F5',
            borderLeft: '4px solid #B3261E', fontSize: 14, fontWeight: 500, color: t.ink }}>
            Could not load your projects. See the console for details.
          </div>
        )}

        {projectsAvailable() && status === 'ready' && projects.length === 0 && (
          <p style={{ fontSize: 14, color: t.inkFaint }}>
            Nothing yet. A project gets a dashboard, a public page, and lets people
            collaborate with you on it.
          </p>
        )}

        {projectsAvailable() && status === 'ready' && projects.length > 0 && matching.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: t.inkDim }}>
            <p style={{ fontSize: 16, marginBottom: 16 }}>
              {favouritesOnly && favourites.length === 0
                ? 'No favourites yet. Tap the heart on a project to keep it here.'
                : 'No projects match those filters.'}
            </p>
            <Btn t={t} variant="outline" onClick={clearFilters}>Clear filters</Btn>
          </div>
        )}

        {projectsAvailable() && status === 'ready' && matching.length > 0 && view === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20 }}>
            {matching.map((project) => (
              <div key={project.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <ProjectCard t={t} project={project} onOpen={onOpenProjectDashboard} />
                <FavouriteButton t={t} name={project.name} favourite={favourites.includes(project.id)}
                  onToggle={() => toggleFavourite(project.id)}
                  style={{ position: 'absolute', top: 10, right: 10, background: t.surface,
                    boxShadow: t.shadow }} />
              </div>
            ))}
          </div>
        )}

        {projectsAvailable() && status === 'ready' && matching.length > 0 && view === 'list' && (
          <div style={{ borderTop: `1px solid ${t.line}` }}>
            {matching.map((project) => (
              <div key={project.id} style={{ display: 'flex', alignItems: 'center',
                borderBottom: `1px solid ${t.line}` }}>
                <ProjectRow t={t} project={project} onOpen={onOpenProjectDashboard} />
                <FavouriteButton t={t} name={project.name} favourite={favourites.includes(project.id)}
                  onToggle={() => toggleFavourite(project.id)} style={{ margin: '0 12px' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectsPage;
