import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProjectPage } from '../PublicProjectPage';
import { readImaginationsByProject } from '../../services/imaginations';
import {
  readConfiguredProjectTools, readLinks, readProject, readProjectAccess, readProjectTools, readPublicToolkitActivity, readRelatedProjects,
  requestProjectAccess,
} from '../../services/projects';
import { follow, isFollowing, unfollow } from '../../services/follows';
import { readContributions, readProjectOpenRooms, saveContribution } from '../../services/rooms';
import { THEME } from '../../theme';
import { rememberAnswer } from '../../toolkit/rooms';

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
  // Every tool configured unless a test says otherwise, so a tool added is a tool shown.
  readConfiguredProjectTools: vi.fn(async () => new Set((await import('../../toolkit/tools')).TOOLS.map((tool) => tool.id))),
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

  it("offers the answers the organiser wrote, and counts votes against them", async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([
      { ...POLL, config: { question: 'When should it be car-free?', answers: ['Every day', 'Weekends'] } },
    ]);
    vi.mocked(readContributions).mockResolvedValue([
      { state: { choice: 'Weekends' } }, { state: { choice: 'Every day' } },
    ]);

    setup();
    const section = within(await screen.findByRole('region', { name: 'We want your opinion' }));
    expect(section.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
    fireEvent.click(section.getByRole('button', { name: 'Weekends' }));

    expect(await section.findByText(/2 votes so far/)).toBeInTheDocument();
    expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({ state: { choice: 'Weekends' } }));
    expect(section.getByText(/You voted/)).toHaveTextContent('You voted Weekends.');
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

  it('leaves out a tool that has not been configured for the project yet', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['desire-lines', 'reimagine-a-space']);
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set(['desire-lines']));

    setup();

    expect(await screen.findByRole('heading', { name: 'Try Desire Lines' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Share your idea for this place' })).not.toBeInTheDocument();
  });

  it('still shows the project when it cannot tell which tools are configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProjectTools).mockResolvedValue(['desire-lines']);
    vi.mocked(readConfiguredProjectTools).mockRejectedValueOnce(new Error('network down'));

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  describe('a Co-Budget', () => {
    const BUDGET_ROOM = { id: 'room-2', tool: 'budget-ballot', expiresAt: '2026-11-05T12:00:00Z', config: {
      currency: 'GBP', budget: 10000, ownPosts: true,
      posts: [{ key: 'post-1', label: 'Water fountain', icon: 'sparkle', unitCost: 4000 },
        { key: 'post-2', label: 'Mural', icon: 'art', unitCost: 1500 }],
    } };
    beforeEach(() => vi.mocked(readContributions).mockResolvedValue([]));

    const open = async () => {
      vi.mocked(readProjectTools).mockResolvedValue(['budget-ballot']);
      vi.mocked(readProjectOpenRooms).mockResolvedValue([BUDGET_ROOM]);
      const handlers = setup();
      const section = within(await screen.findByRole('region', { name: 'How would you spend the budget?' }));
      return { section, handlers };
    };

    it('opens out on the page, with the money above the posts', async () => {
      const { section, handlers } = await open();
      const card = section.getByRole('button', { name: /Co-Budget/, expanded: false });

      expect(section.queryByRole('button', { name: 'One more: Mural' })).not.toBeInTheDocument();
      fireEvent.click(card);

      expect(card).toHaveAttribute('aria-expanded', 'true');
      expect(section.getByText('Committed')).toBeInTheDocument();
      expect(section.getByText('£10,000')).toBeInTheDocument();
      expect(section.getByRole('button', { name: 'One more: Mural' })).toBeInTheDocument();
      expect(section.getByRole('button', { name: 'Next' })).toBeDisabled();
      expect(handlers.onOpenRoom).not.toHaveBeenCalled();
    });

    it('shows the ballot on Next, and sends it on Submit', async () => {
      const { section } = await open();
      fireEvent.click(section.getByRole('button', { name: /Co-Budget/ }));

      fireEvent.click(section.getByRole('button', { name: 'One more: Water fountain' }));
      fireEvent.click(section.getByRole('button', { name: 'One more: Mural' }));
      fireEvent.click(section.getByRole('button', { name: 'One more: Mural' }));
      fireEvent.click(section.getByRole('button', { name: 'Next' }));

      expect(section.getByRole('heading', { name: 'Your ballot' })).toBeInTheDocument();
      expect(section.getByText('Water fountain × 1')).toBeInTheDocument();
      expect(section.getByText('Mural × 2')).toBeInTheDocument();
      expect(saveContribution).not.toHaveBeenCalled();

      fireEvent.click(section.getByRole('button', { name: 'Submit' }));

      expect(await section.findByText(/your ballot is in/i, { selector: 'p' })).toBeInTheDocument();
      expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({
        roomId: 'room-2', displayName: null, state: { 'post-1': 1, 'post-2': 2, own: [] },
      }));
      // What they spent is kept to the list of individual ballots, not the card.
      expect(section.queryByText(/You spent/)).not.toBeInTheDocument();
      fireEvent.click(await section.findByRole('button', { name: /See individual ballots/ }));
      const list = within(section.getByRole('list', { name: 'Individual ballots' }));
      const mine = list.getByRole('button', { name: /Your ballot/ });
      expect(mine).toHaveTextContent('£7,000');
      fireEvent.click(mine);
      expect(list.getByText('Water fountain × 1')).toBeInTheDocument();
      expect(list.getByText('Mural × 2')).toBeInTheDocument();
    });

    it('shows the average of every ballot once one is in, and each ballot on its own', async () => {
      vi.mocked(readContributions).mockResolvedValue([
        { displayName: null, updatedAt: '2026-10-10T10:00:00Z', state: { 'post-1': 2, 'post-2': 0, own: [] } },
        { displayName: null, updatedAt: '2026-10-10T11:00:00Z',
          state: { 'post-1': 0, 'post-2': 2, own: [{ label: 'Bike racks', unitCost: 500, quantity: 2 }] } },
      ]);
      const { section } = await open();
      fireEvent.click(section.getByRole('button', { name: /Co-Budget/ }));
      fireEvent.click(section.getByRole('button', { name: 'One more: Mural' }));
      fireEvent.click(section.getByRole('button', { name: 'Next' }));
      fireEvent.click(section.getByRole('button', { name: 'Submit' }));

      // Fountains average (2 + 0) / 2 = 1, murals (0 + 2) / 2 = 1.
      expect(await section.findByRole('heading', { name: "Everybody's average" })).toBeInTheDocument();
      expect(section.getByText(/2 ballots so far/)).toBeInTheDocument();
      expect(section.getByText('Water fountain × 1')).toBeInTheDocument();
      expect(section.getByRole('heading', { name: 'Posts people added' })).toBeInTheDocument();

      fireEvent.click(section.getByRole('button', { name: 'See individual ballots (2)' }));
      expect(section.getByRole('button', { name: /^Your ballot/ })).toHaveTextContent('£1,500');
      const ballots = within(section.getByRole('list', { name: 'Individual ballots' }));
      const second = ballots.getByRole('button', { name: /Ballot 2/ });
      expect(second).toHaveTextContent('£4,000');

      fireEvent.click(second);
      expect(ballots.getByText('Mural × 2')).toBeInTheDocument();
      expect(ballots.getByText(/Bike racks × 2/)).toHaveTextContent('their own post');
    });

    it('opens on the results for somebody who has submitted, with no way to change it', async () => {
      rememberAnswer('room-2', { ballot: { items: [{ key: 'post-2', label: 'Mural', quantity: 1, cost: 1500 }],
        spent: 1500, budget: 10000, currency: 'GBP', state: { own: [], 'post-1': 0, 'post-2': 1 } } });
      vi.mocked(readContributions).mockResolvedValue([
        { displayName: null, updatedAt: 'a', state: { 'post-2': 1, own: [], 'post-1': 0 } },
      ]);
      const { section } = await open();

      expect(section.getByRole('button', { name: /Co-Budget/ })).toHaveAttribute('aria-expanded', 'true');
      expect(await section.findByRole('heading', { name: "Everybody's average" })).toBeInTheDocument();
      fireEvent.click(section.getByRole('button', { name: 'See individual ballots (1)' }));
      // Theirs is the one ballot in the room, so it is listed once, as theirs.
      expect(section.getByRole('button', { name: /^Your ballot/ })).toBeInTheDocument();
      expect(section.queryByRole('button', { name: /Ballot 1/ })).not.toBeInTheDocument();
      expect(section.queryByRole('button', { name: /change my ballot/i })).not.toBeInTheDocument();
      expect(section.queryByRole('button', { name: 'One more: Mural' })).not.toBeInTheDocument();
      expect(section.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    });

    it('stays open on the results right after submitting', async () => {
      const { section } = await open();
      fireEvent.click(section.getByRole('button', { name: /Co-Budget/ }));
      fireEvent.click(section.getByRole('button', { name: 'One more: Mural' }));
      fireEvent.click(section.getByRole('button', { name: 'Next' }));
      fireEvent.click(section.getByRole('button', { name: 'Submit' }));

      expect(await section.findByRole('heading', { name: "Everybody's average" })).toBeInTheDocument();
      expect(section.getByRole('button', { name: /Co-Budget/ })).toHaveAttribute('aria-expanded', 'true');
      expect(section.queryByRole('button', { name: /change my ballot/i })).not.toBeInTheDocument();
    });

    it('goes back from the ballot to change it', async () => {
      const { section } = await open();
      fireEvent.click(section.getByRole('button', { name: /Co-Budget/ }));
      fireEvent.click(section.getByRole('button', { name: 'One more: Mural' }));
      fireEvent.click(section.getByRole('button', { name: 'Next' }));

      fireEvent.click(section.getByRole('button', { name: 'Back' }));

      expect(section.getByLabelText('Mural: how many')).toHaveTextContent('1');
    });

    it('says so when the ballot has closed', async () => {
      vi.mocked(saveContribution).mockResolvedValue(false);
      const { section } = await open();
      fireEvent.click(section.getByRole('button', { name: /Co-Budget/ }));
      fireEvent.click(section.getByRole('button', { name: 'One more: Mural' }));
      fireEvent.click(section.getByRole('button', { name: 'Next' }));
      fireEvent.click(section.getByRole('button', { name: 'Submit' }));

      expect(await section.findByText('This ballot has closed.')).toBeInTheDocument();
    });
  });

  it('does not show a room the project has not added the tool for', async () => {
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('puts the imaginations under Idea Visualizer, which opens the tool for the project', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);
    const { onOpenToolkit } = setup();

    const section = within(await screen.findByRole('region', { name: 'Share your idea for this place' }));
    expect(section.getByText('Pocket park')).toBeInTheDocument();
    fireEvent.click(section.getByRole('button', { name: /Idea Visualizer/ }));
    expect(onOpenToolkit).toHaveBeenCalledWith('proj-1', 'reimagine-a-space');
  });

  it('says so when nothing has been imagined yet', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);

    setup();

    expect(await screen.findByText('Nothing imagined for this project yet.')).toBeInTheDocument();
  });

  it('shows no imaginations when the project has not added Idea Visualizer', async () => {
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
