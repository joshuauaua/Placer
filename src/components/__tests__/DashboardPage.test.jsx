import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';
import { readMyProjects } from '../../services/projects';
import { listNotifications } from '../../services/notifications';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  PROJECT_TYPE_NAMES: { steward: 'Have a say over a place', advocate: 'Pushing for change', other: 'Something else' },
  isSupabaseConfigured: vi.fn(() => true),
  readMyProjects: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/notifications', () => ({
  listNotifications: vi.fn(() => Promise.resolve([])),
}));

const PROFILE = { name: 'Mara Quinn', bio: '' };

const setup = ({ handlers = {} } = {}) => {
  return render(
    <DashboardPage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={vi.fn()}
      {...handlers} />
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets you started: a quickstart tutorial and project examples', () => {
    const onNavigate = vi.fn();
    render(<DashboardPage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={onNavigate} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Getting Started' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Quickstart tutorial\s*Create your first Project/ }));
    fireEvent.click(screen.getByRole('button',
      { name: /Project Examples\s*Explore what other projects exist on the platform/ }));

    expect(onNavigate.mock.calls.map(([view]) => view)).toEqual(['quickstart', 'projects']);
  });

  it('lists the quick actions under their own label', () => {
    const onNavigate = vi.fn();
    const onNewProject = vi.fn();
    render(<DashboardPage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={onNavigate}
      onNewProject={onNewProject} />);

    const section = screen.getByRole('region', { name: 'Quick Actions' });
    expect(within(section).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['Edit my profile', 'Explore the map', 'Create a Project']);

    fireEvent.click(within(section).getByRole('button', { name: 'Create a Project' }));
    expect(onNewProject).toHaveBeenCalled();
  });

  it('welcomes you back by name, in place of a "Dashboard" title', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back, Mara Quinn' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByText('Change your name')).not.toBeInTheDocument();
  });

  it('logs you out from beside the heading', () => {
    const onSignOut = vi.fn();
    setup({ handlers: { onSignOut } });

    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }));

    expect(onSignOut).toHaveBeenCalled();
  });

  it('links to your public profile', () => {
    const onOpenPublicProfile = vi.fn();
    setup({ handlers: { onOpenPublicProfile } });

    const link = screen.getByRole('link', { name: 'View your public profile' });
    expect(link).toHaveAttribute('href', '/people/user-1');
    fireEvent.click(link);

    expect(onOpenPublicProfile).toHaveBeenCalledWith('user-1');
  });

  it('offers editing your profile, the map and a new project', () => {
    const onNavigate = vi.fn();
    const onExplore = vi.fn();
    const onNewProject = vi.fn();
    render(<DashboardPage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={onNavigate}
      onExplore={onExplore} onNewProject={onNewProject} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit my profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explore the map' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create a Project' }));

    expect(onNavigate).toHaveBeenCalledWith('settings');
    expect(onExplore).toHaveBeenCalled();
    expect(onNewProject).toHaveBeenCalled();
  });

  it('has no imaginations, stat tiles, projects list or followed sections', async () => {
    setup();
    await waitFor(() => expect(readMyProjects).toHaveBeenCalled());

    expect(screen.queryByRole('heading', { name: 'Created imaginations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Saved on this device' })).not.toBeInTheDocument();
    expect(screen.queryByText('Imaginations posted')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your projects' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Followed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Following' })).not.toBeInTheDocument();
  });
});

describe('DashboardPage, beyond the quick actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('projects, next steps and activity', () => {
    // Today, and a month either side of it, so the dates stay live whenever this runs.
    const day = (offset) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const PROJECTS = [
      { id: 'p1', name: 'Riverside Greenway', projectType: 'steward', image: null, locationShapes: [{ path: [] }],
        startDate: day(-10), endDate: day(10) },
      { id: 'p2', name: 'Market Square', projectType: 'advocate', image: 'a.webp', locationShapes: [{ path: [] }],
        startDate: day(-30), endDate: day(60) },
      { id: 'p3', name: 'Old Harbour', projectType: 'other', image: 'b.webp', locationShapes: [{ path: [] }],
        startDate: day(-90), endDate: day(-1) },
      { id: 'p4', name: 'School Street', projectType: 'steward', image: 'c.webp', locationShapes: [{ path: [] }],
        startDate: day(5), endDate: day(90) },
    ];
    const NOTE = { id: 'n1', category: 'engagement', title: 'Sam commented on Riverside Greenway',
      body: 'Love the trees.', linkType: 'project', linkId: 'p1', readAt: null,
      createdAt: new Date().toISOString() };

    const renderWith = ({ projects = [], notifications = [], ...handlers } = {}) => {
      vi.mocked(readMyProjects).mockResolvedValue(projects);
      vi.mocked(listNotifications).mockResolvedValue(notifications);
      render(<DashboardPage t={THEME} profile={{ ...PROFILE, location: 'Malmö' }} accountId="user-1"
        onNavigate={vi.fn()} {...handlers} />);
    };

    it('shows the three most pressing projects, with a bar of the time gone', async () => {
      renderWith({ projects: PROJECTS });
      const section = screen.getByRole('region', { name: 'Projects' });
      await within(section).findByText('Riverside Greenway');

      const names = within(section).getAllByRole('button').map((card) => card.textContent);
      expect(names.filter((text) => /Greenway|Square|Harbour|School/.test(text))).toEqual([
        expect.stringContaining('Riverside Greenway'),
        expect.stringContaining('Market Square'),
        expect.stringContaining('School Street'),
      ]);
      expect(within(section).getByText('Pushing for change')).toBeInTheDocument();
      const bar = within(section).getByRole('progressbar', { name: 'Time gone on Riverside Greenway' });
      expect(bar).toHaveAttribute('aria-valuenow', '50');
      expect(bar).toHaveAttribute('aria-valuetext', '10 days left');
    });

    it('opens a project on its dashboard, and all of them from View all projects', async () => {
      const onOpenProject = vi.fn();
      const onNavigate = vi.fn();
      renderWith({ projects: PROJECTS, onOpenProject, onNavigate });
      const section = screen.getByRole('region', { name: 'Projects' });

      fireEvent.click(await within(section).findByText('Market Square'));
      fireEvent.click(within(section).getByRole('button', { name: 'View all projects' }));

      expect(onOpenProject).toHaveBeenCalledWith('p2');
      expect(onNavigate).toHaveBeenCalledWith('projects');
    });

    it('says so when there are no projects yet', async () => {
      renderWith();
      expect(await screen.findByText(/no projects yet/i)).toBeInTheDocument();
    });

    it('lists next steps, soonest first, and acts on one', async () => {
      const onOpenProject = vi.fn();
      renderWith({ projects: PROJECTS, onOpenProject });
      const card = screen.getByRole('region', { name: 'Your Next Steps' });

      const first = await within(card).findByRole('button', { name: /school street starts in 5 days/i });
      const items = within(card).getAllByRole('listitem').map((item) => item.textContent);
      expect(items[0]).toMatch(/Milestone.*School Street starts in 5 days/);
      expect(items[1]).toMatch(/Deadline.*Riverside Greenway ends in 10 days/);

      fireEvent.click(first);
      expect(onOpenProject).toHaveBeenCalledWith('p4');
    });

    it('shows the latest activity, and the full feed from View All', async () => {
      const onNavigate = vi.fn();
      const onOpenProjectPage = vi.fn();
      renderWith({ notifications: [NOTE], onNavigate, onOpenProjectPage });
      const card = screen.getByRole('region', { name: 'Your Activity' });

      const row = await within(card).findByRole('link', { name: /sam commented on riverside greenway/i });
      fireEvent.click(row);
      fireEvent.click(within(card).getByRole('button', { name: 'View All' }));

      expect(onOpenProjectPage).toHaveBeenCalledWith('p1');
      expect(onNavigate).toHaveBeenCalledWith('activity');
    });

    it('says when there is no activity yet', async () => {
      renderWith();
      expect(await within(screen.getByRole('region', { name: 'Your Activity' })).findByText(/nothing yet/i))
        .toBeInTheDocument();
    });
  });
});
