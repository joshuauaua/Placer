import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProjectPage } from '../PublicProjectPage';
import { readImaginationsByProject } from '../../services/imaginations';
import {
  readLinks, readProject, readProjectTools, readPublicToolkitActivity, readRelatedProjects,
} from '../../services/projects';
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
  readProjectTools: vi.fn(() => Promise.resolve([])),
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
    onBack: vi.fn(), onOpenProject: vi.fn(), onOpenToolkit: vi.fn(),
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
    // Two tools added, so the tools section has something in it by default.
    vi.mocked(readProjectTools).mockResolvedValue(['budget-ballot', 'reimagine-a-space']);
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

  it('lists the imaginations posted to it, under Reimagine a Space', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);

    setup();

    expect(await screen.findByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Imagined with Reimagine a Space' })).toBeInTheDocument();
    // Not a section of its own any more.
    expect(screen.queryByRole('heading', { level: 2, name: /imaginations/i })).not.toBeInTheDocument();
  });

  it('says so when nothing has been imagined yet', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup();

    expect(await screen.findByText(/Nothing imagined for this project yet/)).toBeInTheDocument();
  });

  it('shows no imaginations when the project has not added Reimagine a Space', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readProjectTools).mockResolvedValue(['budget-ballot']);
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);

    setup();

    await screen.findByRole('button', { name: /Budget Ballot/ });
    expect(screen.queryByText('Pocket park')).not.toBeInTheDocument();
  });

  it('shows only the tools the project added, in the order they were added', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space', 'open-vote']);

    setup();

    const tools = within(await screen.findByRole('region', { name: 'Tools' }));
    await tools.findByRole('button', { name: /Open Vote/ });
    expect(tools.getAllByRole('button').map((button) => button.textContent))
      .toEqual([expect.stringContaining('Reimagine a Space'), expect.stringContaining('Open Vote')]);
    expect(tools.queryByRole('button', { name: /Budget Ballot/ })).not.toBeInTheDocument();
  });

  it('says so when the project has not added any tools', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readProjectTools).mockResolvedValue([]);

    setup();

    expect(await screen.findByText('This project has not added any tools yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Budget Ballot/ })).not.toBeInTheDocument();
  });

  it('skips a tool the Toolkit no longer has', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readProjectTools).mockResolvedValue(['gone-tool', 'open-vote']);

    setup();

    expect(await screen.findByRole('button', { name: /Open Vote/ })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Tools' })).getAllByRole('button')).toHaveLength(1);
  });

  it('still shows the project when its tools cannot be read', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readProjectTools).mockRejectedValue(new Error('relation does not exist'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' })).toBeInTheDocument();
    expect(screen.getByText('This project has not added any tools yet.')).toBeInTheDocument();
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
      .toEqual(['Overview', 'Tools']);
    expect(toc.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'location');

    fireEvent.click(toc.getByRole('link', { name: 'Tools' }));
    expect(toc.getByRole('link', { name: 'Tools' })).toHaveAttribute('aria-current', 'location');
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

  it('imagines for the project through Reimagine a Space, with no separate button for it', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    const { onOpenToolkit } = setup();

    fireEvent.click(await screen.findByRole('button', { name: /Reimagine a Space/ }));

    expect(onOpenToolkit).toHaveBeenCalledWith('proj-1', 'reimagine-a-space');
    expect(screen.queryByRole('button', { name: /Imagine something for this project/ })).not.toBeInTheDocument();
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
