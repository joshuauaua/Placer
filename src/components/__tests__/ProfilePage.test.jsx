import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { ProfilePage } from '../ProfilePage';
import { postsAreShared, readImaginations, readLocalImaginations } from '../../services/imaginations';
import { THEME } from '../../theme';

vi.mock('../../services/imaginations', () => ({
  postsAreShared: vi.fn(() => false),
  readImaginations: vi.fn(() => Promise.resolve([])),
  readLocalImaginations: vi.fn(() => Promise.resolve([])),
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
