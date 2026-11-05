import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProjectPage } from '../PublicProjectPage';
import {
  readConfiguredProjectTools, readLinks, readProject, readProjectAccess, readProjectTools, readPublicToolkitActivity, readRelatedProjects,
  readWorkshopTools, requestProjectAccess,
} from '../../services/projects';
import { follow, isFollowing, unfollow } from '../../services/follows';
import {
  postComment, postReply, postUpdate, readComments, readProjectSummary, readReplies, readUpdates, removeComment,
  removeReply,
} from '../../services/projectPage';
import { readOrganisation } from '../../services/organisations';
import {
  readContributions, readProjectOpenRooms, readProjectRoomSchedule, readProjectToolResults, saveContribution,
} from '../../services/rooms';
import { THEME } from '../../theme';
import { rememberAnswer } from '../../toolkit/rooms';

vi.mock('../../services/projects', () => ({
  readProject: vi.fn(),
  readLinks: vi.fn(() => Promise.resolve([])),
  recordProjectView: vi.fn(() => Promise.resolve()),
  readPublicToolkitActivity: vi.fn(() => Promise.resolve(0)),
  readRelatedProjects: vi.fn(() => Promise.resolve([])),
  readProjectTools: vi.fn(() => Promise.resolve([])),
  readWorkshopTools: vi.fn(() => Promise.resolve(new Set())),
  // Every tool configured unless a test says otherwise, so a tool added is a tool shown.
  readConfiguredProjectTools: vi.fn(async () => new Set((await import('../../toolkit/tools')).TOOLS.map((tool) => tool.id))),
  readProjectToolConfig: vi.fn(() => Promise.resolve(null)),
  saveProjectToolConfig: vi.fn(() => Promise.resolve()),
  uploadSceneImage: vi.fn(() => Promise.resolve('scenes/proj-1/scene-1.webp')),
  readProjectAccess: vi.fn(() => Promise.resolve(null)),
  requestProjectAccess: vi.fn(() => Promise.resolve('pending')),
  readOrganisationProjects: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/projectPage', () => ({
  UPDATE_MAX: 4000,
  COMMENT_MAX: 2000,
  REPLY_MAX: 2000,
  readProjectSummary: vi.fn(() => Promise.resolve(null)),
  readReplies: vi.fn(() => Promise.resolve([])),
  postReply: vi.fn(),
  removeReply: vi.fn(() => Promise.resolve()),
  readUpdates: vi.fn(() => Promise.resolve([])),
  readComments: vi.fn(() => Promise.resolve([])),
  postUpdate: vi.fn(),
  postComment: vi.fn(),
  removeUpdate: vi.fn(() => Promise.resolve()),
  removeComment: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/organisations', () => ({
  readOrganisation: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rooms', () => ({
  readProjectOpenRooms: vi.fn(() => Promise.resolve([])),
  readProjectRoomSchedule: vi.fn(() => Promise.resolve([])),
  readContributions: vi.fn(() => Promise.resolve([])),
  saveContribution: vi.fn(() => Promise.resolve(true)),
  subscribeToRoom: vi.fn(() => () => {}),
  isSupabaseConfigured: vi.fn(() => true),
  readProjectToolResults: vi.fn(() => Promise.resolve([])),
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
    expect(screen.getByText('By', { exact: false })).toHaveTextContent('By Mara Quinn');
    expect(screen.getByText('1 Jan 2026 – 31 Dec 2026')).toBeInTheDocument();
    expect(screen.getByText('Malmö, Folkets Park')).toBeInTheDocument();
    expect(screen.getByText(/Turn the old rail corridor/)).toBeInTheDocument();
  });

  it('shows the photos added beside the header image as a gallery, in their order', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, gallery: [
      { path: 'gallery/proj-1/photo-1.webp', url: 'https://media.test/gallery/proj-1/photo-1.webp' },
      { path: 'gallery/proj-1/photo-2.webp', url: 'https://media.test/gallery/proj-1/photo-2.webp' },
    ] });

    setup();

    const section = within(await screen.findByRole('region', { name: 'Photos' }));
    expect(section.getByRole('link', { name: 'Photo 1 of 2, full size' }))
      .toHaveAttribute('href', 'https://media.test/gallery/proj-1/photo-1.webp');
    fireEvent.click(section.getByRole('button', { name: 'Next photo' }));
    expect(section.getByRole('link', { name: 'Photo 2 of 2, full size' }))
      .toHaveAttribute('href', 'https://media.test/gallery/proj-1/photo-2.webp');
  });

  it('shows a photo chosen to be on its own by itself, with its caption and no title, out of the gallery', async () => {
    const photo = (n, more = {}) => ({ path: `gallery/proj-1/photo-${n}.webp`,
      url: `https://media.test/gallery/proj-1/photo-${n}.webp`, ...more });
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, gallery: [
      photo(1), photo(2, { standalone: true, caption: 'The underpass, 2019' }), photo(3),
    ] });

    setup();

    const gallery = within(await screen.findByRole('region', { name: 'Photos' }));
    expect(gallery.getByText('1 / 2')).toBeInTheDocument();

    const alone = screen.getByRole('region', { name: 'Photo' });
    expect(within(alone).getByRole('heading', { name: 'Photo' })).toHaveClass('placer-visually-hidden');
    expect(within(alone).getByText('The underpass, 2019')).toBeInTheDocument();
    expect(within(alone).getByRole('link', { name: 'The underpass, 2019, full size' }))
      .toHaveAttribute('href', photo(2).url);
  });

  it('leaves off the titles the layout hides, and shows a photo\'s it shows', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, summary: 'A park.',
      gallery: [{ path: 'g/1.webp', url: 'https://media.test/g/1.webp', standalone: true }],
      pageLayout: [{ key: 'about', hideTitle: true }, { key: 'photo:g/1.webp', title: 'Then', hideTitle: false }] });

    setup();

    expect(await screen.findByRole('heading', { name: 'About the project' })).toHaveClass('placer-visually-hidden');
    expect(screen.getByRole('heading', { name: 'Then' })).not.toHaveClass('placer-visually-hidden');
    expect(screen.getByRole('heading', { name: 'Goals' })).not.toHaveClass('placer-visually-hidden');
  });

  it('has no Photos section without any', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    setup();

    await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });
    expect(screen.queryByRole('heading', { name: 'Photos' })).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('tab', { name: /Reference Material/ }));
    expect(screen.getByRole('link', { name: /Council report/ })).toHaveAttribute('href', 'https://example.com/report');
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

  it('asks a signed-out visitor to sign in to follow', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);

    const { onSignIn } = setup({ accountId: null, onSignIn: vi.fn() });
    fireEvent.click(await screen.findByRole('button', { name: 'Follow this project' }));

    expect(onSignIn).toHaveBeenCalled();
    expect(follow).not.toHaveBeenCalled();
  });

  it('follows and unfollows the project', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(isFollowing).mockResolvedValue(false);

    setup({ accountId: 'user-2' });
    const button = await screen.findByRole('button', { name: 'Follow this project' });

    fireEvent.click(button);

    await waitFor(() => expect(follow).toHaveBeenCalledWith('project', 'proj-1', 'Riverside Greenway'));
    expect(await screen.findByRole('button', { name: 'Following this project' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Following this project' }));

    await waitFor(() => expect(unfollow).toHaveBeenCalledWith('project', 'proj-1'));
  });

  it('keeps a click on Follow when whether you follow it is only answered afterwards', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    let answer;
    vi.mocked(isFollowing).mockReturnValue(new Promise((resolve) => { answer = resolve; }));

    setup({ accountId: 'user-2' });
    fireEvent.click(await screen.findByRole('button', { name: 'Follow this project' }));
    await waitFor(() => expect(isFollowing).toHaveBeenCalledWith('project', 'proj-1'));
    await act(async () => { answer(false); });

    expect(screen.getByRole('button', { name: 'Following this project' })).toBeInTheDocument();
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
  const IDEA = { id: 'room-idea', tool: 'reimagine-a-space', expiresAt: '2026-11-05T12:00:00Z',
    config: { address: 'Folkets Park, Malmö', point: { lat: 55.59, lng: 13.01 }, imagePath: 'scenes/proj-1/scene-1.webp', view: null } };

  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
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

  it('runs one workshop at a time, named at the top, with the schedule beside it to switch', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'reimagine-a-space']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL, IDEA]);
    vi.mocked(readWorkshopTools).mockResolvedValueOnce(new Set(['open-vote', 'reimagine-a-space']));
    vi.mocked(readProjectRoomSchedule).mockResolvedValueOnce([
      { id: 'room-1', tool: 'open-vote', status: 'open', opensAt: '2026-11-05T10:00:00Z', closesAt: POLL.expiresAt, config: null },
      { id: 'room-idea', tool: 'reimagine-a-space', status: 'open', opensAt: '2026-11-05T10:00:00Z', closesAt: IDEA.expiresAt, config: null },
      { id: 'room-later', tool: 'open-vote', status: 'scheduled', opensAt: '2026-11-06T09:00:00Z', closesAt: '2026-11-06T11:00:00Z', config: null },
    ]);

    setup();

    fireEvent.click(await screen.findByRole('tab', { name: 'Workshop Room' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Current workshop: Poll for “Riverside Greenway”' })).toBeInTheDocument();
    // The tool's own section title gives way to it.
    expect(screen.queryByRole('heading', { level: 2, name: 'We want your opinion' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Current workshop: Poll for “Riverside Greenway”' })).toBeInTheDocument();

    const schedule = screen.getByRole('complementary', { name: 'Schedule' });
    // The room still to come is listed, but cannot be opened yet.
    expect(within(schedule).getByText('Up next')).toBeInTheDocument();
    expect(within(schedule).getAllByRole('button')).toHaveLength(2);

    fireEvent.click(within(schedule).getByRole('button', { name: /Idea Visualizer/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Current workshop: Idea Visualizer for “Riverside Greenway”' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Share your idea for this place' })).not.toBeInTheDocument();
  });

  it('lists the workshops of earlier days under Archived, the latest five until asked for all', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);
    vi.mocked(readWorkshopTools).mockResolvedValueOnce(new Set(['open-vote']));
    const old = [1, 2, 3, 4, 5, 6].map((day) => ({ id: `room-old-${day}`, tool: 'open-vote', status: 'expired',
      opensAt: `2025-03-0${day}T10:00:00Z`, closesAt: `2025-03-0${day}T12:00:00Z`, config: null }));
    vi.mocked(readProjectRoomSchedule).mockResolvedValueOnce([
      ...old,
      { id: 'room-1', tool: 'open-vote', status: 'open', opensAt: '2026-11-05T10:00:00Z', closesAt: POLL.expiresAt, config: null },
    ]);

    setup();

    fireEvent.click(await screen.findByRole('tab', { name: 'Workshop Room' }));
    const archive = await screen.findByRole('region', { name: 'Archived' });
    expect(within(archive).getAllByRole('listitem')).toHaveLength(5);
    // Old workshops are history: nothing in the archive opens one.
    expect(within(archive).getAllByRole('button')).toHaveLength(1);

    fireEvent.click(within(archive).getByRole('button', { name: 'Show all 6' }));
    expect(within(archive).getAllByRole('listitem')).toHaveLength(6);
  });

  it('leaves out a tool that was added but not set up, with no room open for it', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'budget-ballot']);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'We want your opinion' })).not.toBeInTheDocument();
  });

  it('still shows the project when it cannot tell which tools are configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProjectTools).mockResolvedValue(['street-mixer']);
    vi.mocked(readConfiguredProjectTools).mockRejectedValueOnce(new Error('network down'));

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('does not show a room the project has not added the tool for', async () => {
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('does not show Idea Visualizer until its room is open', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('still loads when the tools or rooms cannot be read', async () => {
    vi.mocked(readProjectTools).mockRejectedValue(new Error('relation does not exist'));
    vi.mocked(readProjectOpenRooms).mockRejectedValue(new Error('function does not exist'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' })).toBeInTheDocument();
    expect(screen.getByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('does not say how many Toolkit sessions have run', async () => {
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(2);

    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' })).toBeInTheDocument();
    expect(screen.queryByText(/Toolkit sessions? run/)).not.toBeInTheDocument();
    expect(readPublicToolkitActivity).not.toHaveBeenCalled();
  });
});

describe('PublicProjectPage, a private project', () => {
  const LOCKED = { name: 'Folkets Park Square', visibility: 'private', canView: false, requestStatus: null };

  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(null);
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

describe('PublicProjectPage, its header, tabs and people', () => {
  const SUMMARY = {
    views: 1234, followers: 7, interactions: 42,
    owner: { id: 'user-1', name: 'Mara Quinn', bio: 'Landscape architect.', location: 'Malmö', photo: null,
      joinedAt: '2025-03-10T10:00:00Z', projects: 3 },
    collaborators: [{ id: 'user-3', name: 'Ines Berg', photo: null }],
  };
  const UPDATE = { id: 'u1', authorId: 'user-1', authorName: 'Mara Quinn', body: 'Workshop on Saturday.',
    createdAt: '2026-05-02T10:00:00Z' };
  const COMMENT = { id: 'c1', authorId: 'user-9', authorName: 'Oskar', body: 'Love this.',
    createdAt: '2026-05-03T10:00:00Z' };

  beforeEach(() => {
    vi.mocked(readReplies).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(0);
    vi.mocked(readRelatedProjects).mockResolvedValue([
      { id: 'proj-2', name: 'Harbour Steps', ownerName: 'Ines', description: '', locations: [], createdAt: '2026-02-01' },
    ]);
    vi.mocked(readProjectTools).mockResolvedValue([]);
    vi.mocked(isFollowing).mockResolvedValue(false);
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, summary: 'A park along the old railway.',
      subtitle: 'A park for the whole neighbourhood' });
    vi.mocked(readProjectSummary).mockResolvedValue(SUMMARY);
    vi.mocked(readUpdates).mockResolvedValue([UPDATE]);
    vi.mocked(readComments).mockResolvedValue([COMMENT]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the time left, views and followers beside the image', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-21T12:00:00Z'));
    setup();

    const glance = within(await screen.findByRole('complementary', { name: 'Project at a glance' }));
    expect(await glance.findByText('1,234')).toBeInTheDocument();
    expect(glance.getByText('views')).toBeInTheDocument();
    expect(glance.getByText('7')).toBeInTheDocument();
    expect(glance.getByText('followers')).toBeInTheDocument();
    expect(glance.getByText('10')).toBeInTheDocument();
    expect(glance.getByText('days left')).toBeInTheDocument();
    expect(glance.getByRole('button', { name: 'Follow this project' })).toBeInTheDocument();
    expect(glance.queryByText(/Interactions|Tools live|People involved/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('opens the Project tab with the description, then the goals', async () => {
    setup();

    const panel = within(await screen.findByRole('tabpanel', { name: 'Project' }));
    expect(panel.getAllByRole('heading', { level: 2 }).slice(0, 2).map((heading) => heading.textContent))
      .toEqual(['About the project', 'Goals']);
    expect(panel.getByText('A park along the old railway.')).toBeInTheDocument();
    expect(panel.getByText(/Turn the old rail corridor/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Updates/ }));
    expect(screen.queryByRole('heading', { name: 'About the project' })).not.toBeInTheDocument();
  });

  it('offers its owner and collaborators Edit project, which opens its dashboard', async () => {
    const { onEdit } = setup({ accountId: 'user-3', onEdit: vi.fn() });

    fireEvent.click(await screen.findByRole('button', { name: /Edit project/ }));
    expect(onEdit).toHaveBeenCalledWith('proj-1');
  });

  it('has no Edit project for anybody else, signed in or not', async () => {
    setup({ accountId: 'user-9', onEdit: vi.fn() });
    await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });
    await waitFor(() => expect(readProjectSummary).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Edit project/ })).not.toBeInTheDocument();
  });

  it('has no Edit project for an admin of its organisation who is not on the project', async () => {
    vi.mocked(readProjectSummary).mockResolvedValue({ ...SUMMARY, canPostUpdate: true });
    setup({ accountId: 'user-9', onEdit: vi.fn() });
    await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });
    await waitFor(() => expect(readProjectSummary).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Edit project/ })).not.toBeInTheDocument();
  });

  it('heads the page with the title and its own subtitle, and the byline under the image', async () => {
    setup();

    const title = await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });
    expect(title.parentElement.nextElementSibling).toHaveTextContent('A park for the whole neighbourhood');
    expect(title.parentElement.nextElementSibling).not.toHaveTextContent('A park along the old railway.');
    const byline = screen.getByText('1 Jan 2026 – 31 Dec 2026').closest('div');
    expect(byline).toHaveTextContent('By Mara Quinn');
    expect(byline).toHaveTextContent('Malmö, Folkets Park');
    // After the image in the page, not between it and the title.
    expect(title.compareDocumentPosition(byline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(byline.previousElementSibling.tagName).not.toBe('H1');
  });

  it('has no subtitle when the project has none, rather than repeating its description', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, summary: 'A park along the old railway.' });
    setup();

    await screen.findByRole('heading', { level: 1, name: 'Riverside Greenway' });
    expect(document.querySelector('.placer-project-subtitle')).not.toBeInTheDocument();
  });

  it('has four tabs, and keeps the people and related projects under every one', async () => {
    setup();

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent.replace(/\d+$/, ''))).toEqual(['Project', 'Updates', 'Comments', 'Reference Material']);
    expect(screen.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true');

    for (const name of [/Updates/, /Comments/, /Reference Material/]) {
      fireEvent.click(screen.getByRole('tab', { name }));
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('heading', { name: 'Organizer' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Collaborators' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Related Projects' })).toBeInTheDocument();
    }
  });

  it('moves between tabs with the arrow keys', async () => {
    setup();

    const project = await screen.findByRole('tab', { name: 'Project' });
    fireEvent.keyDown(project, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Updates/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Updates/ }), { key: 'ArrowLeft' });
    fireEvent.keyDown(project, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: /Reference Material/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('introduces the organiser, with what it has made and when it joined', async () => {
    const props = setup({ accountId: 'user-2', onOpenProfile: vi.fn() });

    const organizer = within((await screen.findByRole('heading', { name: 'Organizer' })).closest('section'));
    expect(await organizer.findByText('Landscape architect.')).toBeInTheDocument();
    expect(organizer.getByText('3 projects created')).toBeInTheDocument();
    expect(organizer.getByText('On PLACER since March 2025')).toBeInTheDocument();
    expect(organizer.getByText('Malmö')).toBeInTheDocument();
    expect(organizer.getByRole('button', { name: 'Follow' })).toBeInTheDocument();

    fireEvent.click(organizer.getByRole('link', { name: 'Mara Quinn' }));
    expect(props.onOpenProfile).toHaveBeenCalledWith('user-1');
  });

  it('introduces the organisation instead, when the project is run for one', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, organisationId: 'org-1' });
    vi.mocked(readOrganisation).mockResolvedValue({ id: 'org-1', name: 'STPLN', description: 'A culture hub.',
      location: 'Malmö, Sweden', address: '', avatar: null, createdAt: '2026-10-01T00:00:00Z' });
    const { readOrganisationProjects } = await import('../../services/projects');
    vi.mocked(readOrganisationProjects).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const props = setup({ onOpenOrganisation: vi.fn() });

    const organizer = within((await screen.findByRole('heading', { name: 'Organizer' })).closest('section'));
    expect(await organizer.findByText('A culture hub.')).toBeInTheDocument();
    expect(await organizer.findByText('2 projects created')).toBeInTheDocument();
    expect(organizer.getByText('Organisation')).toBeInTheDocument();

    fireEvent.click(organizer.getByRole('link', { name: 'STPLN' }));
    expect(props.onOpenOrganisation).toHaveBeenCalledWith('org-1');
  });

  it('lists the owner and the collaborators', async () => {
    const props = setup({ onOpenProfile: vi.fn() });

    const list = within(await screen.findByRole('list', { name: 'Collaborators' }));
    await list.findByText('Ines Berg');
    const links = list.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Mara QuinnProject owner');
    expect(links[1]).toHaveTextContent('Ines BergCollaborator');

    fireEvent.click(list.getByRole('link', { name: /Ines Berg/ }));
    expect(props.onOpenProfile).toHaveBeenCalledWith('user-3');
  });

  it('credits a collaborating organisation, linking to its page', async () => {
    vi.mocked(readProjectSummary).mockResolvedValue({
      ...SUMMARY, organisations: [{ id: 'org-7', name: 'Studio Nord', photo: null }],
    });
    const props = setup({ onOpenOrganisation: vi.fn(), onOpenProfile: vi.fn() });

    const list = within(await screen.findByRole('list', { name: 'Collaborators' }));
    const link = await list.findByRole('link', { name: /Studio Nord/ });
    expect(link).toHaveTextContent('Studio NordCollaborating organisation');
    expect(link).toHaveAttribute('href', '/organisations/org-7');

    fireEvent.click(link);
    expect(props.onOpenOrganisation).toHaveBeenCalledWith('org-7');
    expect(props.onOpenProfile).not.toHaveBeenCalled();
  });

  it('still shows the owner when the numbers cannot be read', async () => {
    vi.mocked(readProjectSummary).mockRejectedValue(new Error('function does not exist'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup();

    const list = within(await screen.findByRole('list', { name: 'Collaborators' }));
    expect(list.getByText('Mara Quinn')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Project at a glance' })).toHaveTextContent('–views');
  });

  it('shows updates to everyone, and lets the owner post them', async () => {
    vi.mocked(readProjectSummary).mockResolvedValue({ ...SUMMARY, canPostUpdate: true });
    vi.mocked(postUpdate).mockResolvedValue({ id: 'u2', authorId: 'user-1', authorName: 'Mara Quinn',
      body: 'Plans are up.', createdAt: '2026-05-04T10:00:00Z' });
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('tab', { name: /Updates/ }));
    expect(screen.getByText('Workshop on Saturday.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Post an update'), { target: { value: 'Plans are up.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post update' }));

    await waitFor(() => expect(postUpdate).toHaveBeenCalledWith('proj-1', 'Plans are up.', null));
    const posts = within(screen.getByRole('list', { name: 'Updates' }));
    expect(posts.getAllByRole('listitem')[0]).toHaveTextContent('Plans are up.');
  });

  it('does not offer to post an update to a visitor', async () => {
    setup({ accountId: 'user-2' });

    fireEvent.click(await screen.findByRole('tab', { name: /Updates/ }));

    expect(screen.getByText('Workshop on Saturday.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Post an update')).not.toBeInTheDocument();
  });

  it('does not offer a collaborator to post an update', async () => {
    setup({ accountId: 'user-3' });

    fireEvent.click(await screen.findByRole('tab', { name: /Updates/ }));

    expect(await screen.findByText('Workshop on Saturday.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Post an update')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove update/ })).not.toBeInTheDocument();
  });

  it("lets an admin of the project's organisation post an update", async () => {
    vi.mocked(readProjectSummary).mockResolvedValue({ ...SUMMARY, canPostUpdate: true });
    setup({ accountId: 'user-7' });

    fireEvent.click(await screen.findByRole('tab', { name: /Updates/ }));

    expect(await screen.findByLabelText('Post an update')).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in to comment', async () => {
    const props = setup({ onSignIn: vi.fn() });

    fireEvent.click(await screen.findByRole('tab', { name: /Comments/ }));

    expect(screen.getByText('Love this.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add a comment')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to comment' }));
    expect(props.onSignIn).toHaveBeenCalled();
  });

  it('lets a signed-in visitor comment, and remove only their own', async () => {
    vi.mocked(readComments).mockResolvedValue([COMMENT,
      { id: 'c2', authorId: 'user-2', authorName: 'Lee', body: 'Count me in.', createdAt: '2026-05-01T10:00:00Z' }]);
    vi.mocked(postComment).mockResolvedValue({ id: 'c3', authorId: 'user-2', authorName: 'Lee',
      body: 'When is it?', createdAt: '2026-05-05T10:00:00Z' });
    setup({ accountId: 'user-2' });

    fireEvent.click(await screen.findByRole('tab', { name: /Comments/ }));
    expect(screen.queryByRole('button', { name: 'Remove comment by Oskar' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'When is it?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(postComment).toHaveBeenCalledWith('proj-1', 'When is it?', null));
    expect(await screen.findByText('When is it?')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove comment by Lee' })[1]);
    await waitFor(() => expect(removeComment).toHaveBeenCalledWith('c2'));
    await waitFor(() => expect(screen.queryByText('Count me in.')).not.toBeInTheDocument());
  });

  it('shows the replies under each post, and lets a signed-in visitor reply to a comment', async () => {
    vi.mocked(readReplies).mockResolvedValue([
      { id: 'r1', updateId: null, commentId: 'c1', authorId: 'user-1', authorName: 'Mara Quinn',
        body: 'Thank you!', createdAt: '2026-05-04T10:00:00Z' },
    ]);
    vi.mocked(postReply).mockResolvedValue({ id: 'r2', updateId: null, commentId: 'c1', authorId: 'user-2',
      authorName: 'Lee', body: 'Me too.', createdAt: '2026-05-05T10:00:00Z' });
    setup({ accountId: 'user-2' });

    fireEvent.click(await screen.findByRole('tab', { name: /Comments/ }));
    const thread = within(await screen.findByRole('list', { name: 'Replies to Oskar' }));
    expect(thread.getByText('Thank you!')).toBeInTheDocument();
    expect(thread.queryByRole('button', { name: /Remove reply/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reply to comment by Oskar' }));
    fireEvent.change(screen.getByLabelText('Reply to Oskar'), { target: { value: 'Me too.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() => expect(postReply).toHaveBeenCalledWith({ commentId: 'c1' }, 'Me too.', null));
    expect(await screen.findByText('Me too.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reply to Oskar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove reply by Lee' }));
    await waitFor(() => expect(removeReply).toHaveBeenCalledWith('r2'));
    await waitFor(() => expect(screen.queryByText('Me too.')).not.toBeInTheDocument());
  });

  it('lets a visitor reply to an update, and the team remove any reply', async () => {
    vi.mocked(readReplies).mockResolvedValue([
      { id: 'r1', updateId: 'u1', commentId: null, authorId: 'user-9', authorName: 'Oskar',
        body: 'See you there.', createdAt: '2026-05-04T10:00:00Z' },
    ]);
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('tab', { name: /Updates/ }));
    expect(await screen.findByText('See you there.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove reply by Oskar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reply to update by Mara Quinn' }));
    expect(screen.getByLabelText('Reply to Mara Quinn')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Reply to Mara Quinn')).not.toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in to reply', async () => {
    const props = setup({ onSignIn: vi.fn() });

    fireEvent.click(await screen.findByRole('tab', { name: /Comments/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reply to comment by Oskar' }));

    expect(props.onSignIn).toHaveBeenCalled();
    expect(screen.queryByLabelText('Reply to Oskar')).not.toBeInTheDocument();
  });

  it("lets the project's people remove anybody's comment", async () => {
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('tab', { name: /Comments/ }));

    expect(screen.getByRole('button', { name: 'Remove comment by Oskar' })).toBeInTheDocument();
  });

  it('counts updates, comments and links on their tabs', async () => {
    vi.mocked(readLinks).mockResolvedValue([{ id: 'l1', title: 'Report', url: 'https://example.com' }]);
    setup();

    expect(await screen.findByRole('tab', { name: 'Updates (1)' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Comments (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Reference Material (1)' })).toBeInTheDocument();
  });

  it('says when there are no links yet', async () => {
    setup();

    fireEvent.click(await screen.findByRole('tab', { name: /Reference Material/ }));

    expect(screen.getByText('No links shared yet.')).toBeInTheDocument();
  });

  describe('posting as the organisation', () => {
    const ORG = { id: 'org-1', name: 'STPLN', description: '', location: '', address: '', avatar: null,
      createdAt: '2026-10-01T00:00:00Z' };

    beforeEach(() => {
      vi.mocked(readProject).mockResolvedValue({ ...PROJECT, organisationId: 'org-1' });
      vi.mocked(readOrganisation).mockResolvedValue(ORG);
      vi.mocked(readProjectSummary).mockResolvedValue({ ...SUMMARY, canPostUpdate: true, canPostAsOrganisation: true });
      vi.mocked(postUpdate).mockImplementation(async (projectId, body, organisationId) => ({
        id: 'u9', authorId: 'user-1', authorName: organisationId ? 'STPLN' : 'Mara Quinn', organisationId,
        body, createdAt: '2026-05-04T10:00:00Z' }));
      vi.mocked(postComment).mockImplementation(async (projectId, body, organisationId) => ({
        id: 'c9', authorId: 'user-1', authorName: organisationId ? 'STPLN' : 'Mara Quinn', organisationId,
        body, createdAt: '2026-05-04T10:00:00Z' }));
    });

    const openTab = async (name) => {
      await screen.findAllByRole('link', { name: 'STPLN' });
      fireEvent.click(screen.getByRole('tab', { name }));
    };

    it('lets an organiser post an update as the organisation, which it starts on', async () => {
      const props = setup({ accountId: 'user-1', accountName: 'Mara Quinn', onOpenOrganisation: vi.fn() });
      await openTab(/Updates/);

      const postAs = within(screen.getByRole('group', { name: 'Post as' }));
      expect(postAs.getByRole('radio', { name: /STPLN/ })).toBeChecked();
      expect(postAs.getByRole('radio', { name: /Mara Quinn/ })).not.toBeChecked();

      fireEvent.change(screen.getByLabelText('Post an update'), { target: { value: 'Opening hours are up.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Post update' }));

      await waitFor(() => expect(postUpdate).toHaveBeenCalledWith('proj-1', 'Opening hours are up.', 'org-1'));
      const first = within(within(screen.getByRole('list', { name: 'Updates' })).getAllByRole('listitem')[0]);
      fireEvent.click(first.getByRole('link', { name: 'STPLN' }));
      expect(props.onOpenOrganisation).toHaveBeenCalledWith('org-1');
    });

    it('lets an organiser post an update as themselves instead', async () => {
      setup({ accountId: 'user-1', accountName: 'Mara Quinn' });
      await openTab(/Updates/);

      fireEvent.click(screen.getByRole('radio', { name: /Mara Quinn/ }));
      fireEvent.change(screen.getByLabelText('Post an update'), { target: { value: 'Back next week.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Post update' }));

      await waitFor(() => expect(postUpdate).toHaveBeenCalledWith('proj-1', 'Back next week.', null));
    });

    it('starts an organiser comment as themselves, and can switch it to the organisation', async () => {
      setup({ accountId: 'user-1', accountName: 'Mara Quinn' });
      await openTab(/Comments/);

      expect(screen.getByRole('radio', { name: /Mara Quinn/ })).toBeChecked();
      fireEvent.click(screen.getByRole('radio', { name: /STPLN/ }));
      fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Thanks all!' } });
      fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

      await waitFor(() => expect(postComment).toHaveBeenCalledWith('proj-1', 'Thanks all!', 'org-1'));
    });

    it('lets a collaborator post an update, but only as themselves', async () => {
      vi.mocked(readProjectSummary).mockResolvedValue({ ...SUMMARY, canPostUpdate: true, canPostAsOrganisation: false });
      setup({ accountId: 'user-2', accountName: 'Ines Berg' });
      await openTab(/Updates/);

      expect(screen.queryByRole('group', { name: 'Post as' })).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Post an update'), { target: { value: 'Workshop on Friday.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Post update' }));

      await waitFor(() => expect(postUpdate).toHaveBeenCalledWith('proj-1', 'Workshop on Friday.', null));
    });

    it('gives anybody else no choice', async () => {
      vi.mocked(readProjectSummary).mockResolvedValue({ ...SUMMARY, canPostUpdate: false });
      setup({ accountId: 'user-3', accountName: 'Ines Berg' });
      await openTab(/Comments/);

      expect(screen.getByLabelText('Add a comment')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Post as' })).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Count me in.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
      await waitFor(() => expect(postComment).toHaveBeenCalledWith('proj-1', 'Count me in.', null));
    });

    it('offers no choice on a project that is not run for an organisation', async () => {
      vi.mocked(readProject).mockResolvedValue(PROJECT);
      setup({ accountId: 'user-1', accountName: 'Mara Quinn' });

      fireEvent.click(await screen.findByRole('tab', { name: /Updates/ }));

      expect(await screen.findByLabelText('Post an update')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Post as' })).not.toBeInTheDocument();
    });
  });

  it("shows each comment's author photo, and the initials for someone without one", async () => {
    vi.mocked(readComments).mockResolvedValue([
      { ...COMMENT, authorPhoto: 'https://media.example/avatars/user-9.jpg' },
      { id: 'c2', authorId: 'user-4', authorName: 'Lee Park', authorPhoto: null, body: 'Me too.',
        createdAt: '2026-05-02T10:00:00Z' },
    ]);
    setup();

    fireEvent.click(await screen.findByRole('tab', { name: /Comments/ }));

    const [withPhoto, without] = within(screen.getByRole('list', { name: 'Comments' })).getAllByRole('listitem');
    expect(withPhoto.querySelector('img')).toHaveAttribute('src', 'https://media.example/avatars/user-9.jpg');
    expect(without.querySelector('img')).toBeNull();
    expect(without).toHaveTextContent('LP');
  });

});

describe('PublicProjectPage, its tools as cards', () => {
  const POLL = { id: 'room-1', tool: 'open-vote', expiresAt: '2026-11-05T12:00:00Z',
    config: { question: 'Should the square be car-free?' } };
  const IDEA = { id: 'room-idea', tool: 'reimagine-a-space', expiresAt: '2026-11-05T12:00:00Z',
    config: { address: 'Folkets Park, Malmö', point: { lat: 55.59, lng: 13.01 }, imagePath: 'scenes/proj-1/scene-1.webp', view: null } };
  const CLOUD = { id: 'room-cloud', tool: 'word-cloud', expiresAt: '2026-11-05T12:00:00Z',
    config: { prompt: 'One word for the river', limit: 3, timer: null } };
  const card = (name) => screen.findByRole('button', { name });

  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readPublicToolkitActivity).mockResolvedValue(0);
    vi.mocked(readRelatedProjects).mockResolvedValue([]);
    vi.mocked(readProjectTools).mockResolvedValue([]);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([]);
    vi.mocked(readContributions).mockResolvedValue([]);
    vi.mocked(isFollowing).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('shows each tool only as a card with its title, under Take part', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'reimagine-a-space']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL, IDEA]);

    setup();

    expect(await card('We want your opinion, Poll, Live')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share your idea for this place, Idea Visualizer, Live' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Take part' })).toBeInTheDocument();
    // No tool on the page itself: no headings of their own, no question to answer.
    expect(screen.queryByRole('heading', { level: 2, name: 'We want your opinion' })).not.toBeInTheDocument();
    expect(screen.queryByText('Should the square be car-free?')).not.toBeInTheDocument();
  });

  it('keeps them in the order they were added, after the project\'s own sections', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space', 'open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL, IDEA]);

    setup();

    const panel = await screen.findByRole('tabpanel', { name: 'Project' });
    await within(panel).findByRole('button', { name: /We want your opinion/ });
    expect(within(panel).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual(['About the project', 'Take part']);
    expect(within(within(panel).getByRole('list')).getAllByRole('button').map((button) => button.getAttribute('aria-label')))
      .toEqual(['Share your idea for this place, Idea Visualizer, Live', 'We want your opinion, Poll, Live']);
  });

  it('puts the cards where the organisers put the first tool, under the titles they gave it', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, pageLayout: [
      { key: 'room:room-1', title: 'Should the square be car-free?' }, { key: 'about' },
    ] });
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    await card('Should the square be car-free?, Poll, Live');
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent).slice(0, 2))
      .toEqual(['Take part', 'About the project']);
  });

  it('leaves out a tool not configured yet, or one the Toolkit no longer has', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['street-mixer', 'reimagine-a-space', 'gone-tool']);
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set(['street-mixer']));

    setup();

    expect(await card('Try Street Section Mixer, Street Section Mixer, Open')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share your idea for this place/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gone-tool/ })).not.toBeInTheDocument();
  });

  it('keeps a tool kept for the Workshop Room off the Project tab, and has no such tab when nothing is in it', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'reimagine-a-space']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL, IDEA]);
    vi.mocked(readWorkshopTools).mockResolvedValueOnce(new Set(['open-vote']));

    setup();

    expect(await card('Share your idea for this place, Idea Visualizer, Live')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /We want your opinion/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Workshop Room' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Current workshop: Poll for “Riverside Greenway”' })).toBeInTheDocument();
  });

  it('takes somebody who has not answered a live tool on to its room, to take part', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['word-cloud']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([CLOUD]);

    setup();

    fireEvent.click(await card('Tell us in a word, Word Cloud, Live'));
    expect(`${window.location.pathname}${window.location.search}`)
      .toBe('/toolkit/word-cloud?room=room-cloud&project=proj-1');
  });

  it('shows somebody who has answered everybody\'s results instead, in a dialog', async () => {
    rememberAnswer('room-cloud', { words: ['green'] });
    vi.mocked(readProjectTools).mockResolvedValue(['word-cloud']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([CLOUD]);
    vi.mocked(readProjectToolResults).mockResolvedValue([{
      roomId: 'room-cloud', tool: 'word-cloud', config: CLOUD.config, status: 'open',
      openedAt: '2026-11-01T10:00:00Z', endsAt: '2026-11-05T12:00:00Z',
      states: [{ words: ['green'] }, { words: ['green', 'calm'] }],
    }]);

    setup();

    fireEvent.click(await card('Tell us in a word, Word Cloud, Answered'));
    const dialog = within(screen.getByRole('dialog', { name: 'Tell us in a word' }));
    expect(await dialog.findByText('2 people · 2 words')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the results of a tool that has ended, as Completed', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['word-cloud']);
    vi.mocked(readProjectToolResults).mockResolvedValue([{
      roomId: 'room-1', tool: 'word-cloud', config: { prompt: 'One word for the river' }, status: 'ended',
      openedAt: '2026-10-01T10:00:00Z', endsAt: '2026-10-02T10:00:00Z',
      states: [{ words: ['green'] }, { words: ['green', 'calm'] }],
    }]);

    setup();

    fireEvent.click(await card('Word Cloud results: One word for the river, Word Cloud, Completed'));
    const dialog = within(screen.getByRole('dialog', { name: 'Word Cloud results: One word for the river' }));
    expect(dialog.getByText(/^Completed/)).toBeInTheDocument();
    expect(dialog.getByText('2 people · 2 words')).toBeInTheDocument();
  });
});
