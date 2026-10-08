import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProjectPage } from '../PublicProjectPage';
import { readImaginationsByProject } from '../../services/imaginations';
import {
  readLinks, readProject, readProjectAccess, readProjectTools, readPublicToolkitActivity, readRelatedProjects,
  requestProjectAccess,
} from '../../services/projects';
import { follow, isFollowing, unfollow } from '../../services/follows';
import { readContributions, readProjectOpenRooms, saveContribution } from '../../services/rooms';
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
  readProjectToolConfig: vi.fn(() => Promise.resolve(null)),
  saveProjectToolConfig: vi.fn(() => Promise.resolve()),
  uploadSceneImage: vi.fn(() => Promise.resolve('scenes/proj-1/scene-1.webp')),
  readProjectAccess: vi.fn(() => Promise.resolve(null)),
  requestProjectAccess: vi.fn(() => Promise.resolve('pending')),
}));

vi.mock('../../services/rooms', () => ({
  readProjectOpenRooms: vi.fn(() => Promise.resolve([])),
  readContributions: vi.fn(() => Promise.resolve([])),
  saveContribution: vi.fn(() => Promise.resolve(true)),
  subscribeToRoom: vi.fn(() => () => {}),
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
    onBack: vi.fn(), onOpenProject: vi.fn(), onOpenToolkit: vi.fn(), onOpenRoom: vi.fn(),
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

  it('lists news and resource links', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readLinks).mockResolvedValue([
      { id: 'link-1', title: 'Council report', url: 'https://example.com/report' },
    ]);

    setup();

    expect(await screen.findByRole('link', { name: /Council report/ })).toHaveAttribute('href', 'https://example.com/report');
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

  it('keeps a click on Follow when whether you follow it is only answered afterwards', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    let answer;
    vi.mocked(isFollowing).mockReturnValue(new Promise((resolve) => { answer = resolve; }));

    setup({ accountId: 'user-2' });
    fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    await waitFor(() => expect(isFollowing).toHaveBeenCalled());
    await act(async () => { answer(false); });

    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
  });

  it('shows a map of the drawn location outline at the top, when the project has one', async () => {
    vi.mocked(readProject).mockResolvedValue({
      ...PROJECT,
      locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
    });

    setup();

    expect(await screen.findByRole('img', { name: /Map of the area for Riverside Greenway/ })).toBeInTheDocument();
  });

  it('has no map when the project has no drawn location outline', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup();

    await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('PublicProjectPage, taking part', () => {
  const POLL = { id: 'room-1', tool: 'open-vote', expiresAt: '2026-11-05T12:00:00Z',
    config: { question: 'Should the square be car-free?' } };

  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readImaginationsByProject).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(0);
    vi.mocked(readRelatedProjects).mockResolvedValue([]);
    vi.mocked(readProjectTools).mockResolvedValue([]);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([]);
    vi.mocked(readContributions).mockResolvedValue([]);
    vi.mocked(saveContribution).mockResolvedValue(true);
    vi.mocked(isFollowing).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('has no Tools section, only a section per tool, headed for the visitor', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'reimagine-a-space']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    expect(await screen.findByRole('heading', { level: 2, name: 'We want your opinion' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Share your idea for this place' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Tools' })).not.toBeInTheDocument();
  });

  it('puts the organiser\'s poll on the page, under its question', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    const section = within(await screen.findByRole('region', { name: 'We want your opinion' }));
    expect(section.getByText('Should the square be car-free?')).toBeInTheDocument();
    for (const option of ['Yes', 'No', 'Undecided']) {
      expect(section.getByRole('button', { name: option })).toBeInTheDocument();
    }
    expect(section.getByText(/Open until 5 November 2026/)).toBeInTheDocument();
  });

  it('sends a vote, then shows the results in place of the buttons', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);
    vi.mocked(readContributions).mockResolvedValue([
      { state: { choice: 'yes' } }, { state: { choice: 'yes' } }, { state: { choice: 'no' } },
    ]);

    setup();
    const section = within(await screen.findByRole('region', { name: 'We want your opinion' }));
    fireEvent.click(section.getByRole('button', { name: 'Yes' }));

    expect(await section.findByText(/3 votes so far/)).toBeInTheDocument();
    expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 'room-1', displayName: null, state: { choice: 'yes' },
    }));
    expect(section.getByText(/You voted/)).toHaveTextContent('You voted Yes.');
    expect(section.queryByRole('button', { name: 'No' })).not.toBeInTheDocument();
  });

  it('shows the results straight away to a browser that has already voted', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);
    vi.mocked(readContributions).mockResolvedValue([{ state: { choice: 'no' } }]);
    localStorage.setItem('placemaking_room_answers', JSON.stringify({ 'room-1': { choice: 'no' } }));

    setup();

    const section = within(await screen.findByRole('region', { name: 'We want your opinion' }));
    expect(await section.findByText(/1 vote so far/)).toBeInTheDocument();
    expect(section.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
  });

  it('says so when the poll closed before the vote arrived', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);
    vi.mocked(saveContribution).mockResolvedValue(false);

    setup();
    const section = within(await screen.findByRole('region', { name: 'We want your opinion' }));
    fireEvent.click(section.getByRole('button', { name: 'Undecided' }));

    expect(await section.findByText('This poll has closed.')).toBeInTheDocument();
  });

  it('leaves out a tool that was added but not set up, with no room open for it', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'budget-ballot']);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'We want your opinion' })).not.toBeInTheDocument();
  });

  it('links to a set-up tool it cannot put on the page, opening its room', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['budget-ballot']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([{ id: 'room-2', tool: 'budget-ballot', expiresAt: null, config: {} }]);
    const { onOpenRoom } = setup();

    const section = within(await screen.findByRole('region', { name: 'How would you spend the budget?' }));
    fireEvent.click(section.getByRole('button', { name: /Budget Ballot/ }));

    expect(onOpenRoom).toHaveBeenCalledWith('budget-ballot', 'room-2');
  });

  it('does not show a room the project has not added the tool for', async () => {
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('puts the imaginations under Reimagine a Space, which opens the tool for the project', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);
    const { onOpenToolkit } = setup();

    const section = within(await screen.findByRole('region', { name: 'Share your idea for this place' }));
    expect(section.getByText('Pocket park')).toBeInTheDocument();
    fireEvent.click(section.getByRole('button', { name: /Reimagine a Space/ }));
    expect(onOpenToolkit).toHaveBeenCalledWith('proj-1', 'reimagine-a-space');
  });

  it('says so when nothing has been imagined yet', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);

    setup();

    expect(await screen.findByText('Nothing imagined for this project yet.')).toBeInTheDocument();
  });

  it('shows no imaginations when the project has not added Reimagine a Space', async () => {
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);

    setup();

    await screen.findByText('Nothing to take part in yet. Check back soon.');
    expect(screen.queryByText('Pocket park')).not.toBeInTheDocument();
  });

  it('lists its sections in the table of contents by their headings', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space', 'open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    const toc = within(await screen.findByRole('navigation', { name: 'On this page' }));
    await screen.findByRole('heading', { name: 'We want your opinion' });
    expect(toc.getAllByRole('link').map((link) => link.textContent))
      .toEqual(['Overview', 'Share your idea for this place', 'We want your opinion']);
  });

  it('skips a tool the Toolkit no longer has', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['gone-tool', 'reimagine-a-space']);

    setup();

    expect(await screen.findByRole('heading', { level: 2, name: 'Share your idea for this place' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .not.toContain('Try gone-tool');
  });

  it('still loads when the tools or rooms cannot be read', async () => {
    vi.mocked(readProjectTools).mockRejectedValue(new Error('relation does not exist'));
    vi.mocked(readProjectOpenRooms).mockRejectedValue(new Error('function does not exist'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' })).toBeInTheDocument();
    expect(screen.getByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('shows how many Toolkit sessions have run, once there are any', async () => {
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(2);

    setup();

    expect(await screen.findByText(/2 Toolkit sessions run for this project/)).toBeInTheDocument();
  });
});

describe('PublicProjectPage, a private project', () => {
  const LOCKED = { name: 'Folkets Park Square', visibility: 'private', canView: false, requestStatus: null };

  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(null);
    vi.mocked(readImaginationsByProject).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(0);
    vi.mocked(readRelatedProjects).mockResolvedValue([]);
    vi.mocked(readProjectTools).mockResolvedValue([]);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([]);
    vi.mocked(isFollowing).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows only its name to somebody who cannot see it, and asks them to sign in', async () => {
    vi.mocked(readProjectAccess).mockResolvedValue(LOCKED);
    const onSignIn = vi.fn();
    setup({ onSignIn });

    expect(await screen.findByRole('heading', { level: 1, name: 'Folkets Park Square' })).toBeInTheDocument();
    expect(screen.getByText(/This is a private project/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ask to see it' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('lets somebody signed in ask, and says the request is waiting', async () => {
    vi.mocked(readProjectAccess).mockResolvedValue(LOCKED);
    setup({ accountId: 'user-2', accountName: 'Ana' });

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to see this project' }));

    expect(await screen.findByText(/You have asked to see this project/)).toBeInTheDocument();
    expect(requestProjectAccess).toHaveBeenCalledWith('proj-1', 'Ana');
  });

  it('remembers a request already made, and one declined', async () => {
    vi.mocked(readProjectAccess).mockResolvedValueOnce({ ...LOCKED, requestStatus: 'declined' });
    setup({ accountId: 'user-2' });

    expect(await screen.findByText('Its organisers have not let you in.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask to see this project' })).not.toBeInTheDocument();
  });

  it('says not found for a project that does not exist at all', async () => {
    vi.mocked(readProjectAccess).mockResolvedValue(null);
    setup();

    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('marks a private project as private for the people who can see it', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, visibility: 'private' });
    setup({ accountId: 'user-1' });

    expect(await screen.findByText('Private project')).toBeInTheDocument();
    expect(readProjectAccess).not.toHaveBeenCalled();
  });
});
