import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { PublicProfilePage } from '../PublicProfilePage';
import { isSupabaseConfigured, readPublicProfile } from '../../services/auth';
import { readImaginationsByUser } from '../../services/imaginations';
import { THEME } from '../../theme';

vi.mock('../../services/auth', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readPublicProfile: vi.fn(),
}));

vi.mock('../../services/imaginations', () => ({
  readImaginationsByUser: vi.fn(() => Promise.resolve([])),
  readComments: vi.fn(() => Promise.resolve([])),
  readMyVote: vi.fn(() => Promise.resolve(null)),
  postComment: vi.fn(),
  voteImagination: vi.fn(),
}));

const MARA = { id: 'user-1', name: 'Mara Quinn', bio: 'Cyclist and tree enthusiast',
  location: 'Malmö', avatar: 'tree' };

const setup = (props = {}) =>
  render(<PublicProfilePage t={THEME} userId="user-1" authorName="You" {...props} />);

describe('PublicProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readPublicProfile).mockResolvedValue(MARA);
    vi.mocked(readImaginationsByUser).mockResolvedValue([]);
  });

  it('shows the name, bio and location', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' })).toBeInTheDocument();
    expect(screen.getByText('Cyclist and tree enthusiast')).toBeInTheDocument();
    expect(screen.getByText('Malmö')).toBeInTheDocument();
    expect(readPublicProfile).toHaveBeenCalledWith('user-1');
  });

  it('lists what they have posted', async () => {
    vi.mocked(readImaginationsByUser).mockResolvedValue([
      { id: 'a', userId: 'user-1', title: 'Pocket park on Lot 7', cat: 'green', upvotes: 3, comments: [] },
    ]);
    setup();

    expect(await screen.findByText('Pocket park on Lot 7')).toBeInTheDocument();
    expect(readImaginationsByUser).toHaveBeenCalledWith('user-1');
  });

  it('says so when nothing is posted yet', async () => {
    setup();

    expect(await screen.findByText('Nothing posted yet.')).toBeInTheDocument();
  });

  it('tells you when you are looking at your own profile', async () => {
    setup({ accountId: 'user-1' });

    expect(await screen.findByText('This is how others see your profile.')).toBeInTheDocument();
  });

  it('says the profile is not found for an unknown account', async () => {
    vi.mocked(readPublicProfile).mockResolvedValue(null);
    setup();

    expect(await screen.findByText('Profile not found')).toBeInTheDocument();
  });

  it('treats a link that is not an account id as not found, not as an error', async () => {
    vi.mocked(readPublicProfile).mockRejectedValue(
      new Error('Could not load this profile: invalid input syntax for type uuid: "nope"'));
    setup({ userId: 'nope' });

    expect(await screen.findByText('Profile not found')).toBeInTheDocument();
  });

  it('has no profiles to show without a Supabase project', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    setup();

    expect(await screen.findByText('Profile not found')).toBeInTheDocument();
    expect(readPublicProfile).not.toHaveBeenCalled();
  });
});
