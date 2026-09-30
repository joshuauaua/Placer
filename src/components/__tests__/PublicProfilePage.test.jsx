import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProfilePage } from '../PublicProfilePage';
import { isSupabaseConfigured, readPublicProfile } from '../../services/auth';
import { readImaginationsByUser } from '../../services/imaginations';
import { THEME } from '../../theme';

vi.mock('../../services/auth', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readPublicProfile: vi.fn(),
}));

vi.mock('../../services/follows', () => ({
  follow: vi.fn(() => Promise.resolve()),
  unfollow: vi.fn(() => Promise.resolve()),
  isFollowing: vi.fn(() => Promise.resolve(false)),
  readFollowCounts: vi.fn(() => Promise.resolve({ followers: 3, following: 1 })),
  readFollowers: vi.fn(() => Promise.resolve([{ type: 'user', id: 'user-2', name: 'Sam Berg', image: null }])),
  readFollowing: vi.fn(() => Promise.resolve([{ type: 'organisation', id: 'org-1', name: 'Malmö Stad', image: null }])),
}));

vi.mock('../../services/organisations', () => ({
  readProfileOrganisations: vi.fn(() => Promise.resolve([{ id: 'org-1', name: 'Malmö Stad' }])),
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

  it('offers somebody signed in a Follow button, but never on their own profile', async () => {
    const { unmount } = setup({ accountId: 'user-2' });
    expect(await screen.findByRole('button', { name: /^Follow$/ })).toBeInTheDocument();
    unmount();

    setup({ accountId: 'user-1' });
    await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' });
    expect(screen.queryByRole('button', { name: /^Follow$/ })).not.toBeInTheDocument();
  });

  it('offers no Follow button to a visitor who is signed out', async () => {
    setup();
    await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' });

    expect(screen.queryByRole('button', { name: /^Follow$/ })).not.toBeInTheDocument();
  });

  it('shows how many follow the account and how many things it follows, and opens each list', async () => {
    const onOpen = vi.fn();
    setup({ onOpen });

    fireEvent.click(await screen.findByRole('button', { name: /3 Followers/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: /Sam Berg/ }));
    expect(onOpen).toHaveBeenCalledWith('user', 'user-2');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1 Following/ }));
    expect(await within(await screen.findByRole('dialog')).findByText('Malmö Stad')).toBeInTheDocument();
  });

  it('counts a new follower as soon as the follow goes through', async () => {
    setup({ accountId: 'user-2' });
    const button = await screen.findByRole('button', { name: /^Follow$/ });
    await screen.findByRole('button', { name: /3 Followers/ });
    // Disabled until it knows whether this account already follows.
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    expect(await screen.findByRole('button', { name: /4 Followers/ })).toBeInTheDocument();
  });

  it('lists the organisations the account is an admin of in its details', async () => {
    const onOpen = vi.fn();
    setup({ onOpen });

    fireEvent.click(await screen.findByRole('link', { name: 'Malmö Stad' }));
    expect(onOpen).toHaveBeenCalledWith('organisation', 'org-1');
  });
});
