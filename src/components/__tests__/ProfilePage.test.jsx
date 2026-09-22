import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProfilePage } from '../ProfilePage';
import { postsAreShared, readImaginations, readLocalImaginations } from '../../services/imaginations';
import { readFollows, unfollow } from '../../services/follows';
import { isSupabaseConfigured, readMyProjects } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/imaginations', () => ({
  postsAreShared: vi.fn(() => false),
  readImaginations: vi.fn(() => Promise.resolve([])),
  readLocalImaginations: vi.fn(() => Promise.resolve([])),
  // The modal a card opens (see ImaginationPreview) reaches for these itself; a
  // wholesale mock of this module has to answer them too or it crashes on open.
  readComments: vi.fn(() => Promise.resolve([])),
  readMyVote: vi.fn(() => Promise.resolve(null)),
  postComment: vi.fn(() => Promise.resolve({ id: 'c1', author: 'You', text: '', createdAt: null })),
  voteImagination: vi.fn(() => Promise.resolve({ upvotes: 0, myVote: null })),
}));

vi.mock('../../services/follows', () => ({
  FOLLOW_TYPES: ['user', 'imagination', 'project', 'city'],
  readFollows: vi.fn(() => Promise.resolve([])),
  unfollow: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => false),
  readMyProjects: vi.fn(() => Promise.resolve([])),
}));

/*
 * The fixtures carry `upvotes` and a `comments` array, which is the shape a record
 * actually has — saveImagination writes upvotes: 0 and comments: [], and the database
 * columns match. They used to say `votes: 342, comments: 28`, a shape nothing in the app
 * has ever produced, which is why the two stat tiles beside "Imaginations posted" read
 * zero in the real app while passing here.
 */
const comments = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));

const MINE = [
  {
    id: 'a', userId: 'user-1', title: 'Pocket park on Lot 7', cat: 'green',
    author: 'Mara Quinn', upvotes: 342, comments: comments(28),
  },
  {
    id: 'b', userId: 'user-1', title: 'Shade along 8th Street', cat: 'seating',
    author: 'Mara Quinn', upvotes: 218, comments: comments(14),
  },
];

const SOMEONE_ELSE = {
  id: 'c', userId: 'user-2', title: 'Mural under the rail bridge', cat: 'art',
  author: 'Devon Park', upvotes: 999, comments: comments(99),
};

const PROFILE = { name: 'Mara Quinn', bio: '' };

const setup = (saved = [], { profile = PROFILE, local = [], shared = false, accountId = 'user-1' } = {}) => {
  vi.mocked(postsAreShared).mockReturnValue(shared);
  vi.mocked(readImaginations).mockResolvedValue(saved);
  vi.mocked(readLocalImaginations).mockResolvedValue(local);
  return render(
    <ProfilePage t={THEME} profile={profile} accountId={accountId} onNavigate={vi.fn()} />
  );
};

// The stat tiles put the number and its label in sibling elements, so the tile is
// found by its label and read back through its parent.
const statFor = (label) => screen.getByText(label).parentElement;

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names who you are posting as', async () => {
    setup(MINE);

    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Mara Quinn')).toBeInTheDocument();
  });

  it('lists only your own imaginations', async () => {
    setup([...MINE, SOMEONE_ELSE]);

    expect(await screen.findByText('Pocket park on Lot 7')).toBeInTheDocument();
    expect(screen.getByText('Shade along 8th Street')).toBeInTheDocument();
    expect(screen.queryByText('Mural under the rail bridge')).not.toBeInTheDocument();
  });

  it('totals votes and comments across your own imaginations only', async () => {
    setup([...MINE, SOMEONE_ELSE]);
    await screen.findByText('Pocket park on Lot 7');

    expect(statFor('Imaginations posted')).toHaveTextContent('2');
    expect(statFor('Votes received')).toHaveTextContent('560');
    expect(statFor('Comments received')).toHaveTextContent('42');
  });

  it('invites you to start when you have posted nothing', async () => {
    setup([SOMEONE_ELSE]);

    expect(await screen.findByText('Nothing posted yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start imagining/ })).toBeInTheDocument();
  });

  it('sends you to the map from the empty state', async () => {
    vi.mocked(postsAreShared).mockReturnValue(false);
    vi.mocked(readImaginations).mockResolvedValue([]);
    vi.mocked(readLocalImaginations).mockResolvedValue([]);
    const onNavigate = vi.fn();
    render(<ProfilePage t={THEME} profile={PROFILE} onNavigate={onNavigate} />);
    (await screen.findByRole('button', { name: /Start imagining/ })).click();

    expect(onNavigate).toHaveBeenCalledWith('map');
  });

  it('says so when the imaginations cannot be loaded', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(postsAreShared).mockReturnValue(false);
    vi.mocked(readImaginations).mockRejectedValue(new Error('storage gone'));
    vi.mocked(readLocalImaginations).mockResolvedValue([]);
    render(<ProfilePage t={THEME} profile={PROFILE} onNavigate={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load your imaginations/);
    consoleErrorSpy.mockRestore();
  });

  it('shows the bio and location when they are set', async () => {
    setup(MINE, { profile: { name: 'Mara Quinn', bio: 'Cyclist and tree enthusiast', location: 'Malmö' } });
    await screen.findByText('Pocket park on Lot 7');

    expect(screen.getByText('Cyclist and tree enthusiast')).toBeInTheDocument();
    expect(screen.getByText('Malmö')).toBeInTheDocument();
  });

  it('shows neither line when the bio and location are blank', async () => {
    setup(MINE, { profile: PROFILE });
    await screen.findByText('Pocket park on Lot 7');

    expect(screen.queryByText('Malmö')).not.toBeInTheDocument();
  });

  it('opens an imagination in a modal when its card is clicked', async () => {
    setup(MINE);
    await screen.findByText('Pocket park on Lot 7');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Pocket park on Lot 7').closest('[role="button"]'));

    expect(await screen.findByRole('dialog', { name: 'Imagination: Pocket park on Lot 7' }))
      .toBeInTheDocument();
  });

  it('closes the imagination modal from its close button', async () => {
    setup(MINE);
    await screen.findByText('Pocket park on Lot 7');
    fireEvent.click(screen.getByText('Pocket park on Lot 7').closest('[role="button"]'));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByLabelText('Close preview'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ProfilePage, followed sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readImaginations).mockResolvedValue([]);
    vi.mocked(readLocalImaginations).mockResolvedValue([]);
    vi.mocked(postsAreShared).mockReturnValue(false);
  });

  it('shows an honest empty state for each of the four kinds of following', async () => {
    vi.mocked(readFollows).mockResolvedValue([]);
    render(<ProfilePage t={THEME} profile={PROFILE} onNavigate={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Followed imaginations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Followed users' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Followed projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Followed cities' })).toBeInTheDocument();
    expect(screen.getByText(/nowhere in PLACER to follow another person/)).toBeInTheDocument();
    expect(screen.getByText(/follow a project from its public page/)).toBeInTheDocument();
    expect(screen.getByText(/no city pages to follow/)).toBeInTheDocument();
  });

  it('resolves a followed imagination against the imaginations already on the page', async () => {
    vi.mocked(readImaginations).mockResolvedValue([
      { id: 'img-1', userId: 'user-1', title: 'Mural under the rail bridge', cat: 'art',
        author: 'Devon Park', upvotes: 5, comments: [] },
    ]);
    vi.mocked(readFollows).mockImplementation((type) => Promise.resolve(
      type === 'imagination' ? [{ id: 'f1', type: 'imagination', targetId: 'img-1', label: 'Mural under the rail bridge' }] : [],
    ));

    render(<ProfilePage t={THEME} profile={PROFILE} onNavigate={vi.fn()} />);

    expect(await screen.findAllByText('Mural under the rail bridge')).not.toHaveLength(0);
  });

  it('lists followed projects and cities by their saved label', async () => {
    vi.mocked(readFollows).mockImplementation((type) => Promise.resolve(
      type === 'project' ? [{ id: 'f1', type: 'project', targetId: 'slug-1', label: 'Riverside Greenway' }]
      : type === 'city' ? [{ id: 'f2', type: 'city', targetId: 'malmo', label: 'Malmö' }]
      : [],
    ));

    render(<ProfilePage t={THEME} profile={PROFILE} onNavigate={vi.fn()} />);

    expect(await screen.findByText('Riverside Greenway')).toBeInTheDocument();
    expect(screen.getByText('Malmö')).toBeInTheDocument();
  });

  it('unfollows and removes the row', async () => {
    vi.mocked(readFollows).mockImplementation((type) => Promise.resolve(
      type === 'city' ? [{ id: 'f2', type: 'city', targetId: 'malmo', label: 'Malmö' }] : [],
    ));

    render(<ProfilePage t={THEME} profile={PROFILE} onNavigate={vi.fn()} />);
    (await screen.findByText('Malmö')).closest('div').querySelector('button').click();

    await waitFor(() => expect(unfollow).toHaveBeenCalledWith('city', 'malmo'));
    expect(screen.queryByText('Malmö')).not.toBeInTheDocument();
  });

  it('says so when following cannot be loaded', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readFollows).mockRejectedValue(new Error('storage gone'));

    render(<ProfilePage t={THEME} profile={PROFILE} onNavigate={vi.fn()} />);

    expect(await screen.findAllByText(/Could not load followed/i)).not.toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });
});

/*
 * With a project configured, "yours" is a question about the account rather than about
 * the display name. That is the fix for a real defect: renaming yourself in Settings used
 * to orphan everything you had already posted, because ownership was a string comparison
 * against the name you happened to be using at the time.
 */
describe('ProfilePage, with imaginations in the database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims what the account posted, whatever the name on it says', async () => {
    const renamedSince = {
      ...MINE[0], author: 'The Name I Used Then', title: 'Pocket park on Lot 7',
    };
    setup([renamedSince, SOMEONE_ELSE], { shared: true, accountId: 'user-1' });

    expect(await screen.findByText('Pocket park on Lot 7')).toBeInTheDocument();
    expect(screen.queryByText('Mural under the rail bridge')).not.toBeInTheDocument();
  });

  it('claims nothing on a name match alone', async () => {
    // Same display name, different account. A stranger who picks your name does not
    // thereby get your imaginations on their profile.
    const impostor = { ...SOMEONE_ELSE, author: 'Mara Quinn' };
    setup([impostor], { shared: true, accountId: 'user-1' });

    expect(await screen.findByText('Nothing posted yet')).toBeInTheDocument();
  });

  it('keeps what is only in this browser apart, and says nobody else can see it', async () => {
    setup(MINE, {
      shared: true,
      local: [{ id: 'old', title: 'Bench by the canal', cat: 'seating', author: 'Mara Quinn', upvotes: 0, comments: [] }],
    });

    expect(await screen.findByRole('heading', { name: 'Saved on this device' })).toBeInTheDocument();
    expect(screen.getByText('Bench by the canal')).toBeInTheDocument();
    expect(screen.getByText(/nobody else\s+can see them/)).toBeInTheDocument();
    expect(screen.getByText(/nothing has been uploaded/)).toBeInTheDocument();
  });

  it('leaves the older ones out of the posted totals', async () => {
    setup(MINE, {
      shared: true,
      local: [{ id: 'old', title: 'Bench by the canal', upvotes: 500, comments: comments(9) }],
    });
    await screen.findByText('Bench by the canal');

    // They were never posted, so they are not something the community has voted on.
    expect(statFor('Imaginations posted')).toHaveTextContent('2');
    expect(statFor('Votes received')).toHaveTextContent('560');
  });

  it('says nothing about this device when there is nothing left on it', async () => {
    setup(MINE, { shared: true, local: [] });
    await screen.findByText('Pocket park on Lot 7');

    expect(screen.queryByRole('heading', { name: 'Saved on this device' })).not.toBeInTheDocument();
  });

  it('does not ask the local store at all where the two are the same thing', async () => {
    setup(MINE, { shared: false });
    await screen.findByText('Pocket park on Lot 7');

    expect(readLocalImaginations).not.toHaveBeenCalled();
  });
});

describe('ProfilePage, your projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readImaginations).mockResolvedValue([]);
    vi.mocked(readLocalImaginations).mockResolvedValue([]);
    vi.mocked(postsAreShared).mockReturnValue(false);
    vi.mocked(readFollows).mockResolvedValue([]);
  });

  it('has no projects section at all with no Supabase project', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);

    render(<ProfilePage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={vi.fn()} />);
    await screen.findByText('Pocket park on Lot 7').catch(() => {});

    expect(screen.queryByRole('heading', { name: 'Your projects' })).not.toBeInTheDocument();
    expect(readMyProjects).not.toHaveBeenCalled();
  });

  it('offers to start a project, and shows an empty state with none yet', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readMyProjects).mockResolvedValue([]);
    const onNewProject = vi.fn();

    render(<ProfilePage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={vi.fn()} onNewProject={onNewProject} />);

    expect(await screen.findByRole('heading', { name: 'Your projects' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet\. A project gets a dashboard/)).toBeInTheDocument();

    screen.getByRole('button', { name: /Start a project/ }).click();
    expect(onNewProject).toHaveBeenCalled();
  });

  it('lists the projects you own or collaborate on', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readMyProjects).mockResolvedValue([
      { id: 'proj-1', name: 'Riverside Greenway', description: 'Turn the old rail corridor into a park.' },
    ]);
    const onOpenProjectDashboard = vi.fn();

    render(<ProfilePage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={vi.fn()}
      onOpenProjectDashboard={onOpenProjectDashboard} />);

    expect(await screen.findByText('Riverside Greenway')).toBeInTheDocument();
    screen.getByText('Riverside Greenway').closest('button').click();
    expect(onOpenProjectDashboard).toHaveBeenCalledWith('proj-1');
  });

  it('says so when your projects cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readMyProjects).mockRejectedValue(new Error('network down'));

    render(<ProfilePage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={vi.fn()} />);

    expect(await screen.findByText(/Could not load your projects/)).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
