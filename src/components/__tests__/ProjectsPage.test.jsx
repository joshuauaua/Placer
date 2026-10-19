import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProjectsPage, sortProjects } from '../ProjectsPage';
import { isSupabaseConfigured, readVisibleProjects } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readVisibleProjects: vi.fn(() => Promise.resolve([])),
  PROJECT_TYPE_NAMES: { steward: 'Have a say over a place', advocate: 'Pushing for change', other: 'Something else' },
  PROJECT_TYPES: [
    { key: 'steward', title: 'I have a say over a place', description: '' },
    { key: 'advocate', title: 'I want to push for change in a place', description: '' },
    { key: 'other', title: 'Something else', description: '' },
  ],
}));

/** A project's card or row, by its name, and not the save icon beside it that names it too. */
const card = (pattern) => (name) => pattern.test(name) && !name.endsWith('favourites');

function setup(props = {}) {
  const handlers = { onNewProject: vi.fn(), onOpenProjectDashboard: vi.fn(), onOpenProjectPage: vi.fn() };
  render(<ProjectsPage t={THEME} accountId="acct-1" {...handlers} {...props} />);
  return handlers;
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    isSupabaseConfigured.mockReturnValue(true);
    readVisibleProjects.mockReset();
    readVisibleProjects.mockResolvedValue([]);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the spinning loader while the projects load', () => {
    readVisibleProjects.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ProjectsPage t={THEME} accountId="acct-1" onNewProject={vi.fn()}
      onOpenProjectDashboard={vi.fn()} onOpenProjectPage={vi.fn()} />);

    expect(container.querySelector('.placer-page-loader')).toBeInTheDocument();
    expect(screen.getByText('Loading projects…')).toBeInTheDocument();
  });

  it('lists everyone\'s projects, opening yours on its dashboard and others\' on their page', async () => {
    readVisibleProjects.mockResolvedValue([
      { id: 'p1', name: 'Harbour steps', description: 'Seating by the water', role: 'owner' },
      { id: 'p2', name: 'School street', description: '', role: null },
      { id: 'p3', name: 'Allotment gate', description: '', role: 'collaborator' },
    ]);
    const { onOpenProjectDashboard, onOpenProjectPage } = setup();

    fireEvent.click(await screen.findByRole('button', { name: card(/Harbour steps/) }));
    fireEvent.click(screen.getByRole('button', { name: card(/School street/) }));
    fireEvent.click(screen.getByRole('button', { name: card(/Allotment gate/) }));

    expect(readVisibleProjects).toHaveBeenCalledWith('acct-1');
    expect(onOpenProjectDashboard.mock.calls).toEqual([['p1'], ['p3']]);
    expect(onOpenProjectPage).toHaveBeenCalledWith('p2');
  });

  it('labels only your own projects as yours, in the grid and the list', async () => {
    readVisibleProjects.mockResolvedValue([
      { id: 'p1', name: 'Harbour steps', role: 'owner' },
      { id: 'p2', name: 'School street', role: null },
      { id: 'p3', name: 'Allotment gate', role: 'collaborator' },
    ]);
    setup();

    expect(await screen.findByRole('button', { name: card(/Your project.*Harbour steps/) })).toBeInTheDocument();
    expect(screen.getAllByText('Your project')).toHaveLength(1);

    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'List' }));
    expect(screen.getByRole('button', { name: card(/Harbour steps.*Your project/) })).toBeInTheDocument();
    expect(screen.getAllByText('Your project')).toHaveLength(1);
  });

  it('offers to create one beside the heading, with projects or without', async () => {
    readVisibleProjects.mockResolvedValue([{ id: 'p1', name: 'Harbour steps', description: '' }]);
    const { onNewProject } = setup();

    await screen.findByRole('button', { name: card(/Harbour steps/) });
    fireEvent.click(screen.getByRole('button', { name: 'Create a Project' }));

    expect(onNewProject).toHaveBeenCalledTimes(1);
  });

  it('has the one create button, not a second, when there are none yet', async () => {
    setup();

    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Create a Project|Start a project/ })).toHaveLength(1);
  });

  it('says so when your projects cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    readVisibleProjects.mockRejectedValue(new Error('boom'));
    setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load projects');
  });

  it('asks for nothing with no Supabase project', async () => {
    isSupabaseConfigured.mockReturnValue(false);
    setup();

    expect(await screen.findByText('Projects are not available in this environment.')).toBeInTheDocument();
    expect(readVisibleProjects).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Create a Project' })).not.toBeInTheDocument();
  });

  describe('the toolbar', () => {
    const PROJECTS = [
      { id: 'p1', name: 'Harbour steps', role: 'owner', projectType: 'steward',
        createdAt: '2026-09-01T00:00:00Z', startDate: '2026-11-01' },
      { id: 'p2', name: 'School street', role: 'collaborator', projectType: 'advocate',
        createdAt: '2026-09-20T00:00:00Z', startDate: null },
      { id: 'p3', name: 'Allotment gate', role: 'owner', projectType: 'other',
        createdAt: '2026-08-15T00:00:00Z', startDate: '2026-10-05' },
      { id: 'p4', name: 'Bus shelter', role: null, projectType: 'advocate',
        createdAt: '2026-07-01T00:00:00Z', startDate: null },
    ];
    const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /^Show:/ }));

    beforeEach(() => {
      readVisibleProjects.mockResolvedValue(PROJECTS);
    });

    it('starts with the newest first, and sorts by name and start date', async () => {
      setup();
      await screen.findByRole('button', { name: card(/Harbour steps/) });
      const sorts = within(screen.getByRole('group', { name: 'Sort' }));

      expect(names()).toEqual(['School street', 'Harbour steps', 'Allotment gate', 'Bus shelter']);
      fireEvent.click(sorts.getByRole('button', { name: 'A-Z' }));
      expect(names()).toEqual(['Allotment gate', 'Bus shelter', 'Harbour steps', 'School street']);
      // Latest start first, and the ones with no start date last.
      fireEvent.click(sorts.getByRole('button', { name: 'Start date' }));
      expect(names()).toEqual(['Harbour steps', 'Allotment gate', 'School street', 'Bus shelter']);
    });

    it('shows only yours, only the ones you collaborate on, only other people\'s, or one kind', async () => {
      setup();
      await screen.findByRole('button', { name: card(/Harbour steps/) });

      openMenu();
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Collaborating on' }));
      expect(names()).toEqual(['School street']);

      openMenu();
      fireEvent.click(screen.getByRole('menuitemradio', { name: "Other people's" }));
      expect(names()).toEqual(['Bus shelter']);

      openMenu();
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Run by you' }));
      openMenu();
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Something else' }));
      expect(screen.getByRole('button', { name: 'Show: Run by you · Something else' })).toBeInTheDocument();
      expect(names()).toEqual(['Allotment gate']);
    });

    it('keeps favourites, shows only them on request, and has a list view', async () => {
      setup();
      await screen.findByRole('button', { name: card(/Harbour steps/) });

      fireEvent.click(screen.getByRole('button', { name: 'Add School street to favourites' }));
      fireEvent.click(screen.getByRole('button', { name: 'Favourites' }));
      expect(names()).toEqual(['School street']);

      fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'List' }));
      expect(screen.getByRole('button', { name: card(/School street/) })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: card(/Harbour steps/) })).not.toBeInTheDocument();
    });

    it('has no toolbar without a Supabase project', async () => {
      isSupabaseConfigured.mockReturnValue(false);
      setup();

      await screen.findByText('Projects are not available in this environment.');
      expect(screen.queryByRole('group', { name: 'Sort' })).not.toBeInTheDocument();
    });
  });
});

describe('sortProjects', () => {
  it('puts a project with no date last, whichever way round', () => {
    const projects = [{ name: 'A', startDate: null }, { name: 'B', startDate: '2026-01-01' },
      { name: 'C', startDate: '2026-05-01' }];

    expect(sortProjects(projects, { id: 'start', direction: 'asc' }).map((p) => p.name)).toEqual(['B', 'C', 'A']);
    expect(sortProjects(projects, { id: 'start', direction: 'desc' }).map((p) => p.name)).toEqual(['C', 'B', 'A']);
  });
});
