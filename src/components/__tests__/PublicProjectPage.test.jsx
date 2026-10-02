import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProjectPage } from '../PublicProjectPage';
import { readImaginationsByProject } from '../../services/imaginations';
import { readLinks, readProject, readPublicToolkitActivity, readRelatedProjects } from '../../services/projects';
import { follow, isFollowing, unfollow } from '../../services/follows';
import { THEME } from '../../theme';

vi.mock('../../services/imaginations', () => ({
  readImaginationsByProject: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/projects', () => ({
  readProject: vi.fn(),
  readLinks: vi.fn(() => Promise.resolve([])),
  recordProjectView: vi.fn(() => Promise.resolve()),
  readPublicToolkitActivity: vi.fn(() => Promise.resolve(0)),
  readRelatedProjects: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/follows', () => ({
  follow: vi.fn(() => Promise.resolve()),
  unfollow: vi.fn(() => Promise.resolve()),
  isFollowing: vi.fn(() => Promise.resolve(false)),
}));

const PROJECT = {
  id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
  description: 'Turn the old rail corridor into a park.', startDate: '2026-01-01', endDate: '2026-12-31',
  locations: ['Malmö', 'Folkets Park'],
};

const setup = (overrides = {}) => {
  const props = {
    t: THEME, projectId: 'proj-1', accountId: null,
    onImagineForProject: vi.fn(), onBack: vi.fn(), onOpenProject: vi.fn(), onOpenToolkit: vi.fn(),
    ...overrides,
  };
  render(<PublicProjectPage {...props} />);
  return props;
};

describe('PublicProjectPage', () => {
  beforeEach(() => {
    vi.mocked(readImaginationsByProject).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(0);
    vi.mocked(readRelatedProjects).mockResolvedValue([]);
    vi.mocked(isFollowing).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the project once loaded', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' })).toBeInTheDocument();
    expect(screen.getByText('By Mara Quinn')).toBeInTheDocument();
    expect(screen.getByText('1 Jan 2026 – 31 Dec 2026')).toBeInTheDocument();
    expect(screen.getByText('Malmö, Folkets Park')).toBeInTheDocument();
    expect(screen.getByText(/Turn the old rail corridor/)).toBeInTheDocument();
  });

  it('says so when the project cannot be found', async () => {
    vi.mocked(readProject).mockResolvedValue(null);

    setup();

    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('says so when loading fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProject).mockRejectedValue(new Error('network down'));

    setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load this project/);
    consoleError.mockRestore();
  });

  it('lists the imaginations posted to it', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);

    setup();

    expect(await screen.findByText('Pocket park')).toBeInTheDocument();
  });

  it('says so when nothing has been posted yet', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup();

    expect(await screen.findByText(/Nothing posted to this project yet/)).toBeInTheDocument();
  });

  it('lists news and resource links', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readLinks).mockResolvedValue([
      { id: 'link-1', title: 'Council report', url: 'https://example.com/report' },
    ]);

    setup();

    expect(await screen.findByRole('link', { name: /Council report/ })).toHaveAttribute('href', 'https://example.com/report');
  });

  it('shows how many Toolkit sessions have run, once there are any', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(2);

    setup();

    expect(await screen.findByText(/2 Toolkit sessions run/)).toBeInTheDocument();
  });

  it('dates a project without dates by the day it was started', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, startDate: null, endDate: null,
      createdAt: '2026-03-05T10:00:00Z' });

    setup();

    expect(await screen.findByText('5 Mar 2026')).toBeInTheDocument();
  });

  it('goes back to all projects', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    const { onBack } = setup();

    fireEvent.click(await screen.findByRole('button', { name: /All Projects/ }));

    expect(onBack).toHaveBeenCalled();
  });

  it('opens a Toolkit tool with the project attached', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    const { onOpenToolkit } = setup();

    fireEvent.click(await screen.findByRole('button', { name: /Budget Ballot/ }));

    expect(onOpenToolkit).toHaveBeenCalledWith('proj-1', 'budget-ballot');
  });

  it('has a table of contents for the sections on the page', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup();

    const toc = within(await screen.findByRole('navigation', { name: 'On this page' }));
    expect(toc.getAllByRole('link').map((link) => link.textContent))
      .toEqual(['Overview', 'Tools', 'Imaginations']);
    expect(toc.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'location');

    fireEvent.click(toc.getByRole('link', { name: 'Imaginations' }));
    expect(toc.getByRole('link', { name: 'Imaginations' })).toHaveAttribute('aria-current', 'location');
  });

  it('ends with related projects, which open', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readRelatedProjects).mockResolvedValue([
      { id: 'proj-2', name: 'Harbour Steps', ownerName: 'Ines', description: '', locations: [], createdAt: '2026-02-01' },
      { id: 'proj-3', name: 'Market Square', ownerName: 'Oskar', description: '', locations: [], createdAt: '2026-02-02' },
      { id: 'proj-4', name: 'School Street', ownerName: 'Lee', description: '', locations: [], createdAt: '2026-02-03' },
    ]);
    const { onOpenProject } = setup();

    expect(await screen.findByRole('heading', { name: 'Related Projects' })).toBeInTheDocument();
    expect(readRelatedProjects).toHaveBeenCalledWith(PROJECT);
    expect(screen.getByRole('link', { name: 'Related projects' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Market Square/ }));
    expect(onOpenProject).toHaveBeenCalledWith('proj-3');
  });

  it('still shows the project when related projects fail to load', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readRelatedProjects).mockRejectedValue(new Error('network down'));

    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' })).toBeInTheDocument();
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Related Projects' })).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('has no Follow button for a signed-out visitor', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup({ accountId: null });
    await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });

    expect(screen.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument();
  });

  it('follows and unfollows the project', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(isFollowing).mockResolvedValue(false);

    setup({ accountId: 'user-2' });
    const button = await screen.findByRole('button', { name: 'Follow' });

    fireEvent.click(button);

    await waitFor(() => expect(follow).toHaveBeenCalledWith('project', 'proj-1', 'Riverside Greenway'));
    expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Following' }));

    await waitFor(() => expect(unfollow).toHaveBeenCalledWith('project', 'proj-1'));
  });

  it('sends you into the capture flow to imagine something for the project', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    const { onImagineForProject } = setup();

    fireEvent.click(await screen.findByRole('button', { name: /Imagine something for this project/ }));

    expect(onImagineForProject).toHaveBeenCalledWith('proj-1');
  });

  it('shows a map of the drawn location outline at the top, when the project has one', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    vi.mocked(readProject).mockResolvedValue({
      ...PROJECT,
      locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
    });

    setup();

    const img = await screen.findByRole('img', { name: /Riverside Greenway/ });
    expect(img.src).toContain('https://maps.googleapis.com/maps/api/staticmap?');
    vi.unstubAllEnvs();
  });

  it('has no map when the project has no drawn location outline', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup();

    await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
