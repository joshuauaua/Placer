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
}));

const MARA = { id: 'user-1', name: 'Mara Quinn', bio: 'Cyclist and tree enthusiast',
  location: 'Malmö', avatar: 'tree', accountType: 'organisation', contactEmail: 'hi@mara.se',
  website: 'https://mara.se/', cover: 'https://cdn.example/user-1/cover-1.jpg' };

const setup = (props = {}) =>
  render(<PublicProfilePage t={THEME} userId="user-1" {...props} />);

describe('PublicProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readPublicProfile).mockResolvedValue(MARA);
  });

  it('shows the name, bio and location', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' })).toBeInTheDocument();
    expect(screen.getByText('Cyclist and tree enthusiast')).toBeInTheDocument();
    expect(screen.getByText('Malmö')).toBeInTheDocument();
    expect(readPublicProfile).toHaveBeenCalledWith('user-1');
  });

  it('fills in the Details card, with the email and website as links', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'Details' })).toBeInTheDocument();
    // Organisations are their own pages now, so a person's profile no longer claims to be one.
    expect(screen.queryByText('Account type')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hi@mara.se' })).toHaveAttribute('href', 'mailto:hi@mara.se');
    expect(screen.getByRole('link', { name: 'mara.se' })).toHaveAttribute('href', 'https://mara.se/');
  });

  it('says what is not shared rather than leaving a gap', async () => {
    vi.mocked(readPublicProfile).mockResolvedValue({ ...MARA, contactEmail: '', website: '' });
    setup();

    expect(await screen.findAllByText('Not shared')).toHaveLength(2);
  });

  it('puts the cover image behind the name', async () => {
    setup();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' });
    expect(heading.closest('header').style.backgroundImage).toContain('cover-1.jpg');
  });

  it('has no Imaginations section, and does not fetch what they posted', async () => {
    setup();
    await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' });

    expect(screen.queryByRole('heading', { name: 'Imaginations' })).not.toBeInTheDocument();
    expect(readImaginationsByUser).not.toHaveBeenCalled();
  });

  it('looks the same on your own profile, with only the empty bio speaking to you', async () => {
    vi.mocked(readPublicProfile).mockResolvedValue({ ...MARA, bio: '' });
    setup({ accountId: 'user-1' });

    expect(await screen.findByText(/You have not written a bio yet/)).toBeInTheDocument();
    expect(screen.queryByText(/how others see your profile/)).not.toBeInTheDocument();
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
