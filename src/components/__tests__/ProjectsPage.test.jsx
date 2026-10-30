import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ProjectsPage, sortProjects } from '../ProjectsPage';
import {
  isSupabaseConfigured, readPendingCollaboratorInvitations, readVisibleProjects, respondToCollaboratorInvitation,
} from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readVisibleProjects: vi.fn(() => Promise.resolve([])),
  readPendingCollaboratorInvitations: vi.fn(() => Promise.resolve([])),
  respondToCollaboratorInvitation: vi.fn(() => Promise.resolve({ success: true })),
  PROJECT_TYPE_NAMES: { steward: 'Have a say over a place', advocate: 'Pushing for change', other: 'Something else' },
  PROJECT_TYPES: [
    { key: 'steward', title: 'I have a say over a place', description: '' },
    { key: 'advocate', title: 'I want to push for change in a place', description: '' },
    { key: 'other', title: 'Something else', description: '' },
  ],
}));

const IMAGE = 'https://media.example/cover.jpg';

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
    readPendingCollaboratorInvitations.mockReset();
    readPendingCollaboratorInvitations.mockResolvedValue([]);
    respondToCollaboratorInvitation.mockReset();
    respondToCollaboratorInvitation.mockResolvedValue({ success: true });
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
      { id: 'p1', name: 'Harbour steps', image: IMAGE, description: 'Seating by the water', role: 'owner' },
      { id: 'p2', name: 'School street', image: IMAGE, description: '', role: null },
      { id: 'p3', name: 'Allotment gate', image: IMAGE, description: '', role: 'collaborator' },
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
      { id: 'p1', name: 'Harbour steps', image: IMAGE, role: 'owner' },
      { id: 'p2', name: 'School street', image: IMAGE, role: null },
      { id: 'p3', name: 'Allotment gate', image: IMAGE, role: 'collaborator' },
    ]);
    setup();

    expect(await screen.findByRole('button', { name: card(/Your project.*Harbour steps/) })).toBeInTheDocument();
    expect(screen.getAllByText('Your project')).toHaveLength(1);

    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'List' }));
    expect(screen.getByRole('button', { name: card(/Harbour steps.*Your project/) })).toBeInTheDocument();
    expect(screen.getAllByText('Your project')).toHaveLength(1);
  });

  it('leaves out projects without an image', async () => {
    readVisibleProjects.mockResolvedValue([
      { id: 'p1', name: 'Harbour steps', image: IMAGE, role: 'owner' },
      { id: 'p2', name: 'School street', image: null, role: null },
    ]);
    setup();

    expect(await screen.findByRole('button', { name: card(/Harbour steps/) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: card(/School street/) })).not.toBeInTheDocument();
  });

  it('offers to create one beside the heading, with projects or without', async () => {
    readVisibleProjects.mockResolvedValue([{ id: 'p1', name: 'Harbour steps', image: IMAGE, description: '' }]);
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

  it('lets an invited account accept and opens the project dashboard', async () => {
    readPendingCollaboratorInvitations.mockResolvedValue([
      { projectId: 'p-invited', projectName: 'Harbour steps', inviterName: 'Mara Quinn' },
    ]);
    const { onOpenProjectDashboard } = setup();

    expect(await screen.findByText('Harbour steps')).toBeInTheDocument();
    expect(screen.getByText('Invited by Mara Quinn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(respondToCollaboratorInvitation).toHaveBeenCalledWith('p-invited', true));
    expect(onOpenProjectDashboard).toHaveBeenCalledWith('p-invited');
  });

  it('lets an invited account decline without opening the project', async () => {
    readPendingCollaboratorInvitations.mockResolvedValue([
      { projectId: 'p-invited', projectName: 'Harbour steps', inviterName: 'Mara Quinn' },
    ]);
    const { onOpenProjectDashboard } = setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(respondToCollaboratorInvitation).toHaveBeenCalledWith('p-invited', false));
    expect(onOpenProjectDashboard).not.toHaveBeenCalled();
    expect(screen.queryByText('Harbour steps')).not.toBeInTheDocument();
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
      { id: 'p1', name: 'Harbour steps', image: IMAGE, role: 'owner', projectType: 'steward',
        createdAt: '2026-09-01T00:00:00Z', startDate: '2026-11-01' },
      { id: 'p2', name: 'School street', image: IMAGE, role: 'collaborator', projectType: 'advocate',
        createdAt: '2026-09-20T00:00:00Z', startDate: null },
      { id: 'p3', name: 'Allotment gate', image: IMAGE, role: 'owner', projectType: 'other',
        createdAt: '2026-08-15T00:00:00Z', startDate: '2026-10-05' },
      { id: 'p4', name: 'Bus shelter', image: IMAGE, role: null, projectType: 'advocate',
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
