import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';
import { postsAreShared, readImaginations, readLocalImaginations } from '../../services/imaginations';
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

const MINE = [
  { id: 'a', userId: 'user-1', title: 'Pocket park on Lot 7', cat: 'green',
    author: 'Mara Quinn', upvotes: 342, comments: [] },
];

// Made before there were accounts, so only in this browser.
const ON_DEVICE = [
  { id: 'old', title: 'Bench by the canal', cat: 'seating', author: 'Mara Quinn', upvotes: 0, comments: [] },
];

const PROFILE = { name: 'Mara Quinn', bio: '' };

const setup = ({ saved = MINE, local = [], shared = false, handlers = {} } = {}) => {
  vi.mocked(postsAreShared).mockReturnValue(shared);
  vi.mocked(readImaginations).mockResolvedValue(saved);
  vi.mocked(readLocalImaginations).mockResolvedValue(local);
  return render(
    <DashboardPage t={THEME} profile={PROFILE} accountId="user-1" onNavigate={vi.fn()}
      {...handlers} />
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('has no created imaginations, stat tiles, projects list or followed sections', async () => {
    setup({ shared: true, local: ON_DEVICE });
    await screen.findByText('Bench by the canal');

    expect(screen.queryByRole('heading', { name: 'Created imaginations' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pocket park on Lot 7')).not.toBeInTheDocument();
    expect(screen.queryByText('Imaginations posted')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your projects' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Followed/ })).not.toBeInTheDocument();
    expect(readImaginations).not.toHaveBeenCalled();
  });
});

/*
 * Anything made before there were accounts stays in the browser it was made in, and the
 * page says so — it was made under a policy that said it would never leave the device.
 */
describe('DashboardPage, imaginations saved on this device', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists them apart, and says nobody else can see them', async () => {
    setup({ shared: true, local: ON_DEVICE });

    expect(await screen.findByRole('heading', { name: 'Saved on this device' })).toBeInTheDocument();
    expect(screen.getByText('Bench by the canal')).toBeInTheDocument();
    expect(screen.getByText(/nobody else\s+can see them/)).toBeInTheDocument();
    expect(screen.getByText(/nothing has been uploaded/)).toBeInTheDocument();
  });

  it('says nothing about this device when there is nothing left on it', async () => {
    setup({ shared: true, local: [] });
    await waitFor(() => expect(readLocalImaginations).toHaveBeenCalled());

    expect(screen.queryByRole('heading', { name: 'Saved on this device' })).not.toBeInTheDocument();
  });

  it('does not ask the local store at all where it is the only store', () => {
    setup({ shared: false, local: ON_DEVICE });

    expect(readLocalImaginations).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Saved on this device' })).not.toBeInTheDocument();
  });

  it('opens one in a modal, and closes it again', async () => {
    setup({ shared: true, local: ON_DEVICE });
    fireEvent.click((await screen.findByText('Bench by the canal')).closest('[role="button"]'));

    expect(await screen.findByRole('dialog', { name: 'Imagination: Bench by the canal' }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close preview'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
