import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProjectPage } from '../PublicProjectPage';
import { readImaginationsByProject } from '../../services/imaginations';
import {
  readConfiguredProjectTools, readLinks, readProject, readProjectAccess, readProjectTools, readPublicToolkitActivity, readRelatedProjects,
  requestProjectAccess,
} from '../../services/projects';
import { follow, isFollowing, unfollow } from '../../services/follows';
import {
  postComment, postReply, postUpdate, readComments, readProjectSummary, readReplies, readUpdates, removeComment,
  removeReply,
} from '../../services/projectPage';
import { readOrganisation } from '../../services/organisations';
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
  readContributions: vi.fn(() => Promise.resolve([])),
  saveContribution: vi.fn(() => Promise.resolve(true)),
  subscribeToRoom: vi.fn(() => () => {}),
  isSupabaseConfigured: vi.fn(() => true),
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
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL, IDEA]);

    setup();

    expect(await screen.findByRole('heading', { level: 2, name: 'We want your opinion' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Share your idea for this place' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Tools' })).not.toBeInTheDocument();
  });

  it('puts the sections in the order its organisers chose, under the titles they gave them', async () => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, pageLayout: [
      { key: 'room:room-1', title: 'Should the square be car-free?' }, { key: 'about' },
    ] });
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);

    setup();

    await screen.findByRole('heading', { level: 2, name: 'Should the square be car-free?' });
    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(titles.slice(0, 2)).toEqual(['Should the square be car-free?', 'About the project']);
    expect(screen.queryByRole('heading', { level: 2, name: 'We want your opinion' })).not.toBeInTheDocument();
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

  it('gives Desire Lines the whole width of the page, and a poll the reading width', async () => {
    const site = { id: 's1', name: 'Market square', point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: null };
    vi.mocked(readProjectTools).mockResolvedValue(['desire-lines']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([
      { ...POLL, id: 'room-dl', tool: 'desire-lines', config: { sites: [site] } },
    ]);
    setup();
    const section = await screen.findByRole('region', { name: 'Draw the way you walk' });

    expect(section).toHaveClass('placer-project-section--wide');
    expect(section.parentElement).toHaveClass('placer-project-panel--wide');
    expect(within(section).getByRole('application')).toHaveClass('placer-desire-map');
  });

  it('explains Desire Lines under its heading, with the reason the organisers gave', async () => {
    const site = { id: 's1', name: 'Market square', point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: null };
    vi.mocked(readProjectTools).mockResolvedValue(['desire-lines']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([
      { ...POLL, id: 'room-dl', tool: 'desire-lines', config: { note: 'Shoppers cut across the grass.', sites: [site] } },
    ]);
    setup();
    const section = within(await screen.findByRole('region', { name: 'Draw the way you walk' }));

    expect(section.getByText(/A desire line is the path people actually take/)).toBeInTheDocument();
    expect(section.getByText(/Shoppers cut across the grass\./)).toBeInTheDocument();
    // Said once, here, rather than again in a box beside the map.
    expect(section.queryByText('About this site')).not.toBeInTheDocument();
  });

  it('says why in its own words when the organisers gave no reason', async () => {
    const sites = [
      { id: 's1', name: 'Market square', point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: null },
      { id: 's2', name: 'River park', point: { lat: 52.53, lng: 13.41 }, zoom: 17, bounds: null },
    ];
    vi.mocked(readProjectTools).mockResolvedValue(['desire-lines']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([
      { ...POLL, id: 'room-dl', tool: 'desire-lines', config: { sites } },
    ]);
    setup();

    expect(await screen.findByText(/how people really move through Market square and River park/)).toBeInTheDocument();
  });

  it('gives a tool with nothing to say no paragraph', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);
    setup();
    const section = await screen.findByRole('region', { name: 'We want your opinion' });

    expect(section.querySelector('.placer-tool-intro')).toBeNull();
  });

  it('keeps the reading width when nothing on the page needs more', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL]);
    setup();
    const section = await screen.findByRole('region', { name: 'We want your opinion' });

    expect(section.parentElement).not.toHaveClass('placer-project-panel--wide');
  });

  it('puts each of several polls on the page, under its own question, and votes in each apart', async () => {
    const BENCHES = { ...POLL, id: 'room-2', config: { question: 'Do we need more benches?' } };
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL, BENCHES]);

    setup();

    const square = within(await screen.findByRole('region',
      { name: 'We want your opinion: Should the square be car-free?' }));
    const benches = within(screen.getByRole('region', { name: 'We want your opinion: Do we need more benches?' }));
    fireEvent.click(benches.getByRole('button', { name: 'Yes' }));

    await waitFor(() => expect(saveContribution).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room-2', state: { choice: 'yes' } })));
    expect(saveContribution).toHaveBeenCalledTimes(1);
    expect(square.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
  });

  it('numbers two rooms of a tool that cannot say which is which', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([{ ...POLL, config: null }, { ...POLL, id: 'room-2', config: null }]);

    setup();

    expect(await screen.findByRole('heading', { level: 2, name: 'We want your opinion: 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'We want your opinion: 2' })).toBeInTheDocument();
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

  describe('a word cloud', () => {
    const CLOUD = { id: 'room-2', tool: 'word-cloud', expiresAt: '2026-11-05T12:00:00Z',
      config: { prompt: 'One word for the square?', limit: 2 } };
    const region = async () => within(await screen.findByRole('region', { name: 'Tell us in a word' }));

    beforeEach(() => {
      vi.mocked(readProjectTools).mockResolvedValue(['word-cloud']);
      vi.mocked(readProjectOpenRooms).mockResolvedValue([CLOUD]);
    });

    it("puts the organiser's prompt on the page, with a field to answer it in", async () => {
      setup();

      const section = await region();
      expect(section.getByText('One word for the square?')).toBeInTheDocument();
      expect(section.getByLabelText('Your word')).toBeInTheDocument();
      expect(section.getByRole('button', { name: 'Send my word' })).toBeDisabled();
      expect(section.getByText(/Open until 5 November 2026. Up to 2 words per person./)).toBeInTheDocument();
    });

    it('sends the words, the one still in the field included, then shows the cloud', async () => {
      vi.mocked(readContributions).mockResolvedValue([
        { state: { words: ['green', 'quiet'] } }, { state: { words: ['green'] } },
      ]);

      setup();
      const section = await region();
      fireEvent.change(section.getByLabelText('Your word'), { target: { value: 'Green' } });
      fireEvent.click(section.getByRole('button', { name: 'Add' }));
      fireEvent.change(section.getByLabelText('Your word'), { target: { value: 'quiet' } });
      fireEvent.click(section.getByRole('button', { name: 'Send my words' }));

      expect(await section.findByText(/2 people have answered so far/)).toBeInTheDocument();
      expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({
        roomId: 'room-2', displayName: null, state: { words: ['green', 'quiet'] },
      }));
      expect(section.getByText(/You said/)).toHaveTextContent('You said green, quiet.');
      expect(within(section.getByRole('list', { name: 'Word cloud' })).getAllByRole('listitem')).toHaveLength(2);
      expect(within(section.getByRole('list', { name: /answers and how many times/i })).getAllByRole('listitem')
        .map((item) => item.textContent)).toEqual(['green2', 'quiet1']);
      expect(section.queryByLabelText('Your word')).not.toBeInTheDocument();
    });

    it('shows the cloud straight away to a browser that has already answered', async () => {
      vi.mocked(readContributions).mockResolvedValue([{ state: { words: ['green'] } }]);
      localStorage.setItem('placemaking_room_answers', JSON.stringify({ 'room-2': { words: ['green'] } }));

      setup();

      const section = await region();
      expect(await section.findByText(/1 person has answered so far/)).toBeInTheDocument();
      expect(section.queryByLabelText('Your word')).not.toBeInTheDocument();
    });

    it('shows the cloud in place of the field once a timer has run out or been stopped', async () => {
      vi.mocked(readProjectOpenRooms).mockResolvedValue([{ ...CLOUD, config: { ...CLOUD.config, timer: 30 } }]);
      vi.mocked(readContributions).mockResolvedValue([
        { state: { words: ['green'], timer: { endsAt: Date.now() - 30000 } } },
      ]);

      setup();

      const section = await region();
      expect(await section.findByText(/This word cloud has finished, so no more words are being taken/)).toBeInTheDocument();
      expect(section.queryByLabelText('Your word')).not.toBeInTheDocument();
      expect(within(section.getByRole('list', { name: 'Word cloud' })).getByText('green')).toBeInTheDocument();
    });

    it('says so when the word cloud closed before the words arrived', async () => {
      vi.mocked(saveContribution).mockResolvedValue(false);

      setup();
      const section = await region();
      fireEvent.change(section.getByLabelText('Your word'), { target: { value: 'green' } });
      fireEvent.click(section.getByRole('button', { name: 'Send my word' }));

      expect(await section.findByText('This word cloud has closed.')).toBeInTheDocument();
    });
  });

  it('leaves out a tool that was added but not set up, with no room open for it', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'budget-ballot']);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'We want your opinion' })).not.toBeInTheDocument();
  });

  it('leaves out a tool that has not been configured for the project yet', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['street-mixer', 'reimagine-a-space']);
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set(['street-mixer']));

    setup();

    expect(await screen.findByRole('heading', { name: 'Try Street Section Mixer' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Share your idea for this place' })).not.toBeInTheDocument();
  });

  it('opens a tool out on the page to take part in, rather than leaving for the Toolkit', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['street-mixer']);
    const { onOpenToolkit } = setup();
    const section = within(await screen.findByRole('region', { name: 'Try Street Section Mixer' }));
    const card = section.getByRole('button', { name: /Street Section Mixer/, expanded: false });

    fireEvent.click(card);

    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(section.getAllByRole('button', { name: /^Widen /i }).length).toBeGreaterThan(0);
    expect(onOpenToolkit).not.toHaveBeenCalled();

    fireEvent.click(card);
    expect(section.queryAllByRole('button', { name: /^Widen /i })).toHaveLength(0);
  });

  describe('Site-Specific Spatial Mapping', () => {
    const SITE_ROOM = {
      id: 'room-site', tool: 'site-spatial-mapping', expiresAt: '2026-12-01T00:00:00Z',
      config: {
        name: 'Folkets Park', address: 'Folkets Park, Malmö', point: { lat: 55.59, lng: 13.01 }, zoom: 17,
        bounds: [13.0, 55.585, 13.02, 55.595],
      },
    };
    // Somebody who recorded before: yes to the first question, no to the rest.
    const EARLIER = {
      answers: { seating: true, views: false },
      markers: [{ type: 'barrier', x: 0.5, y: 0.5 }],
      mood: 2,
      notes: { change: 'More shade.' },
      profile: { ageRange: null, gender: null },
      here: null,
    };

    /** The section's cover, then the survey it opens, in its dialog. */
    const openSurvey = async (button = 'Start the survey') => {
      const cover = within(await screen.findByRole('region', { name: 'Map the site with us' }));
      fireEvent.click(cover.getByRole('button', { name: button }));
      return within(screen.getByRole('dialog', { name: 'Map the site with us' }));
    };

    const throughTheSurvey = async (section) => {
      fireEvent.click(await section.findByRole('group', { name: /Tap where you are to drop your pin/ }));
      fireEvent.click(section.getByRole('button', { name: 'Start the survey' }));
      fireEvent.click(section.getByRole('button', { name: 'Continue to the survey' }));
      for (let i = 0; i < 18; i += 1) fireEvent.click(section.getByRole('button', { name: 'Yes' }));
    };

    it('is a map of the room\'s site with its heading on it, opening the survey over the page', async () => {
      vi.mocked(readProjectTools).mockResolvedValue(['site-spatial-mapping']);
      vi.mocked(readProjectOpenRooms).mockResolvedValue([SITE_ROOM]);
      setup();
      const cover = within(await screen.findByRole('region', { name: 'Map the site with us' }));

      expect(cover.getByRole('heading', { level: 2, name: 'Map the site with us' })).toBeInTheDocument();
      expect(cover.queryByRole('img', { name: 'Map of Folkets Park' })).not.toBeInTheDocument();
      expect(cover.getByText('Folkets Park')).toBeInTheDocument();
      expect(cover.queryByText(/Where are you\?/)).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const survey = await openSurvey();
      expect(await survey.findByText('Where are you? · Folkets Park')).toBeInTheDocument();
      expect(survey.queryByLabelText('Site name')).not.toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await openSurvey();
      fireEvent.click(screen.getByRole('button', { name: 'Close the survey' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('records the answers, without contact details, in place of staying involved', async () => {
      vi.mocked(readProjectTools).mockResolvedValue(['site-spatial-mapping']);
      vi.mocked(readProjectOpenRooms).mockResolvedValue([SITE_ROOM]);
      setup();
      const section = await openSurvey();
      await throughTheSurvey(section);

      expect(section.queryByText(/Want to stay involved/)).not.toBeInTheDocument();
      expect(section.getAllByRole('button', { name: 'Finish & export data' }).length).toBeGreaterThan(0);
      expect(section.queryByRole('button', { name: 'See other answers' })).not.toBeInTheDocument();

      fireEvent.click(section.getByRole('button', { name: 'Record my answers' }));

      await waitFor(() => expect(saveContribution).toHaveBeenCalled());
      const { roomId, displayName, state } = vi.mocked(saveContribution).mock.calls[0][0];
      expect(roomId).toBe('room-site');
      expect(displayName).toBeNull();
      expect(state.answers.seating).toBe(true);
      expect(state.here).not.toBeNull();
      expect(state).not.toHaveProperty('contact');
      expect(await section.findByRole('button', { name: 'Answers recorded' })).toBeDisabled();
    });

    it('then shows everybody\'s tally, and all their answers on asking', async () => {
      vi.mocked(readProjectTools).mockResolvedValue(['site-spatial-mapping']);
      vi.mocked(readProjectOpenRooms).mockResolvedValue([SITE_ROOM]);
      setup();
      const section = await openSurvey();
      await throughTheSurvey(section);
      vi.mocked(readContributions).mockResolvedValue([{ state: EARLIER }, { state: { answers: { seating: true } } }]);
      fireEvent.click(section.getByRole('button', { name: 'Record my answers' }));

      // Recording is followed by the room telling the page about it.
      const { subscribeToRoom } = await import('../../services/rooms');
      await act(async () => { vi.mocked(subscribeToRoom).mock.calls.at(-1)[1](); });

      const tally = within(await section.findByRole('heading', { name: "Everyone's answers so far" }).then((h) => h.closest('section')));
      expect(tally.getByText('2 people')).toBeInTheDocument();
      expect(tally.getByText('100% yes')).toBeInTheDocument();

      fireEvent.click(section.getAllByRole('button', { name: 'See other answers' })[0]);

      const all = within(section.getByRole('heading', { name: "Everyone's answers" }).closest('section'));
      expect(all.getByText('1. A variety of seating and resting places')).toBeInTheDocument();
      expect(all.getByText('2/2')).toBeInTheDocument();
      expect(all.getByText('More shade.')).toBeInTheDocument();
    });

    it('carries on from what this browser recorded before', async () => {
      vi.mocked(readProjectTools).mockResolvedValue(['site-spatial-mapping']);
      vi.mocked(readProjectOpenRooms).mockResolvedValue([SITE_ROOM]);
      const every = Object.fromEntries(['seating', 'views', 'slopes', 'gateways', 'exercise', 'playground', 'lawn',
        'plaza', 'vendors', 'storefronts', 'tables', 'teamSports', 'restrooms', 'lighting', 'fences', 'offLimits',
        'grade', 'exclusion'].map((key) => [key, true]));
      rememberAnswer('room-site', { ...EARLIER, answers: every });
      setup();
      const section = await openSurvey('See your answers');

      expect(await section.findByText('Section 1 complete')).toBeInTheDocument();
      expect(section.getByRole('button', { name: 'Answers recorded' })).toBeDisabled();
      expect(section.getAllByRole('button', { name: 'See other answers' }).length).toBeGreaterThan(0);
    });
  });

  it('still shows the project when it cannot tell which tools are configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProjectTools).mockResolvedValue(['street-mixer']);
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
      expect(handlers.onOpenToolkit).not.toHaveBeenCalled();
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
      // A pie of the budget, with a legend that says every slice in words too.
      expect(section.getByRole('img', { name: 'How the average ballot spends £10,000' })).toBeInTheDocument();
      const legend = within(section.getByRole('list', { name: 'Legend' }));
      expect(legend.getByText('Unspent')).toBeInTheDocument();
      expect(legend.getByText('£4,000 · 40%')).toBeInTheDocument();
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

  it('puts Idea Visualizer on the page, on its Street View photo, with Visualize', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([IDEA]);

    setup();

    const section = within(await screen.findByRole('region', { name: 'Share your idea for this place' }));
    expect(section.getByRole('button', { name: 'Visualize' })).toBeInTheDocument();
    expect(section.getByText('Folkets Park, Malmö')).toBeInTheDocument();
    expect(section.getByRole('button', { name: 'See other visualizations' })).toBeInTheDocument();
  });

  it('shows what was posted to the map for the project under it', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([IDEA]);
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);

    setup();

    const section = within(await screen.findByRole('region', { name: 'Share your idea for this place' }));
    expect(section.getByRole('heading', { name: 'Posted to the map' })).toBeInTheDocument();
    expect(section.getByText('Pocket park')).toBeInTheDocument();
  });

  it('does not show Idea Visualizer until its room is open', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);

    setup();

    expect(await screen.findByText('Nothing to take part in yet. Check back soon.')).toBeInTheDocument();
  });

  it('shows no imaginations when the project has not added Idea Visualizer', async () => {
    vi.mocked(readImaginationsByProject).mockResolvedValue([
      { id: 'img-1', title: 'Pocket park', cat: 'green', upvotes: 4 },
    ]);

    setup();

    await screen.findByText('Nothing to take part in yet. Check back soon.');
    expect(screen.queryByText('Pocket park')).not.toBeInTheDocument();
  });

  it('shows its tools under the Project tab, in the order they were added', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space', 'open-vote']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([POLL, IDEA]);

    setup();

    const panel = await screen.findByRole('tabpanel', { name: 'Project' });
    await within(panel).findByRole('heading', { name: 'We want your opinion' });
    expect(within(panel).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual(['About the project', 'Share your idea for this place', 'We want your opinion']);
  });

  it('skips a tool the Toolkit no longer has', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['gone-tool', 'reimagine-a-space']);
    vi.mocked(readProjectOpenRooms).mockResolvedValue([IDEA]);

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
    vi.mocked(readImaginationsByProject).mockResolvedValue([]);
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
