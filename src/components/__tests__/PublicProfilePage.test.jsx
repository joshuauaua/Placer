import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PublicProfilePage } from '../PublicProfilePage';
import { isSupabaseConfigured, readPublicProfile } from '../../services/auth';
import { readProfileActivity, readProfileComments } from '../../services/profileActivity';
import { deleteInquiry } from '../../services/inquiries';
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

vi.mock('../../services/profileActivity', () => ({
  readProfileActivity: vi.fn(),
  readProfileComments: vi.fn(),
}));

vi.mock('../../services/inquiries', () => ({
  readInquiries: vi.fn(() => Promise.resolve([{ id: 'i1', tool: 'desire-lines', title: 'Market square', note: 'Worn bare.',
    createdAt: '2026-10-15T09:00:00Z', config: {} }])),
  deleteInquiry: vi.fn(),
}));

const MARA = { id: 'user-1', name: 'Mara Quinn', bio: 'Cyclist and tree enthusiast',
  location: 'Malmö', avatar: 'tree', accountType: 'organisation', contactEmail: 'hi@mara.se',
  website: 'https://mara.se/', cover: 'https://cdn.example/user-1/cover-1.jpg' };

const setup = (props = {}) =>
  render(<PublicProfilePage t={THEME} userId="user-1" {...props} />);

describe('saved inquiries, under Activity', () => {
  beforeEach(() => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readPublicProfile).mockResolvedValue(MARA);
    vi.mocked(readProfileActivity).mockResolvedValue({ joinedAt: '2025-03-10T10:00:00Z', projects: [] });
    vi.mocked(readProfileComments).mockResolvedValue([]);
  });

  it("are on somebody's own profile, above their comments", async () => {
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('tab', { name: /^Activity/ }));

    const panel = within(screen.getByRole('tabpanel', { name: /^Activity/ }));
    expect(await panel.findByRole('list', { name: 'Saved inquiries' })).toHaveTextContent('Market square');
    const [kept, said] = panel.getAllByRole('heading', { level: 2 });
    expect(kept).toHaveTextContent('Saved inquiries');
    expect(said).toHaveTextContent('Comments');
    expect(panel.getByText('You have not commented on any projects yet.')).toBeInTheDocument();
  });

  it("count toward the Activity tab on your own profile, and drop from it when deleted", async () => {
    vi.mocked(readProfileComments).mockResolvedValue([{ id: 'c1', projectId: 'p1', projectName: 'Greenway',
      body: 'Nice.', createdAt: '2026-10-01T10:00:00Z' }]);
    vi.mocked(deleteInquiry).mockResolvedValue();
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('tab', { name: 'Activity (2)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Market square' }));
    expect(await screen.findByRole('tab', { name: 'Activity (1)' })).toBeInTheDocument();
  });

  it("are not counted on anybody else's profile", async () => {
    vi.mocked(readProfileComments).mockResolvedValue([{ id: 'c1', projectId: 'p1', projectName: 'Greenway',
      body: 'Nice.', createdAt: '2026-10-01T10:00:00Z' }]);
    setup({ accountId: 'user-2' });
    expect(await screen.findByRole('tab', { name: 'Activity (1)' })).toBeInTheDocument();
  });

  it("are not on anybody else's profile, nor for somebody signed out", async () => {
    const { unmount } = setup({ accountId: 'user-2' });
    fireEvent.click(await screen.findByRole('tab', { name: 'Activity' }));
    expect(screen.queryByRole('heading', { name: 'Saved inquiries' })).not.toBeInTheDocument();
    expect(screen.getByText('Mara Quinn has not commented on any projects yet.')).toBeInTheDocument();
    unmount();

    setup();
    fireEvent.click(await screen.findByRole('tab', { name: 'Activity' }));
    expect(screen.queryByRole('heading', { name: 'Saved inquiries' })).not.toBeInTheDocument();
  });
});

describe('PublicProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readPublicProfile).mockResolvedValue(MARA);
    vi.mocked(readProfileActivity).mockResolvedValue({ joinedAt: '2025-03-10T10:00:00Z', projects: [
      { id: 'proj-1', name: 'Riverside Greenway', summary: 'A park.', description: '', image: null, role: 'owner' },
      { id: 'proj-2', name: 'Harbour Steps', summary: '', description: 'Seats by the water.', image: null,
        role: 'collaborator' },
    ] });
    vi.mocked(readProfileComments).mockResolvedValue([
      { id: 'c1', body: 'Count me in.', createdAt: '2026-05-01T10:00:00Z', projectId: 'proj-3', projectName: 'Market Square' },
    ]);
  });

  it('shows the name, bio and location', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' })).toBeInTheDocument();
    expect(screen.getByText('Cyclist and tree enthusiast')).toBeInTheDocument();
    expect(screen.getByText('Malmö')).toBeInTheDocument();
    expect(readPublicProfile).toHaveBeenCalledWith('user-1');
  });

  it('lists the email and website as links under About', async () => {
    setup();

    expect(await screen.findByRole('tabpanel', { name: 'About' })).toBeInTheDocument();
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

  it('shows no cover image behind the name, even one saved before covers were dropped', async () => {
    setup();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' });
    expect(heading.closest('header').style.backgroundImage).not.toContain('cover-1.jpg');
  });

  it('has no Imaginations section', async () => {
    setup();
    await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' });

    expect(screen.queryByRole('heading', { name: 'Imaginations' })).not.toBeInTheDocument();
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

  it('centres the photo, then the name, then when they joined', async () => {
    setup();

    const name = await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' });
    expect(await screen.findByText('Joined March 2025')).toBeInTheDocument();
    expect(name.closest('header')).toHaveClass('placer-profile-head');
    expect(name.compareDocumentPosition(screen.getByText('Joined March 2025')) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('has About, Projects and Activity tabs, starting on About', async () => {
    setup();

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent.replace(/\d+$/, ''))).toEqual(['About', 'Projects', 'Activity']);
    expect(screen.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'About' })).toHaveTextContent('Cyclist and tree enthusiast');
  });

  it('lists the projects they own or collaborate on, which open', async () => {
    const onOpen = vi.fn();
    setup({ onOpen });

    fireEvent.click(await screen.findByRole('tab', { name: 'Projects (2)' }));

    const panel = within(screen.getByRole('tabpanel', { name: /Projects/ }));
    expect(panel.getByRole('button', { name: /Owner.*Riverside Greenway/ })).toBeInTheDocument();
    fireEvent.click(panel.getByRole('button', { name: /Collaborator.*Harbour Steps/ }));
    expect(onOpen).toHaveBeenCalledWith('project', 'proj-2');
  });

  it('lists the comments they have left, each linking to its project', async () => {
    const onOpen = vi.fn();
    setup({ onOpen });

    fireEvent.click(await screen.findByRole('tab', { name: 'Activity (1)' }));

    const panel = within(screen.getByRole('tabpanel', { name: /Activity/ }));
    expect(panel.getByText('Count me in.')).toBeInTheDocument();
    fireEvent.click(panel.getByRole('link', { name: 'Market Square' }));
    expect(onOpen).toHaveBeenCalledWith('project', 'proj-3');
    expect(readProfileComments).toHaveBeenCalledWith('user-1');
  });

  it('says so when there are no projects or comments yet', async () => {
    vi.mocked(readProfileActivity).mockResolvedValue({ joinedAt: null, projects: [] });
    vi.mocked(readProfileComments).mockResolvedValue([]);
    setup();

    fireEvent.click(await screen.findByRole('tab', { name: 'Projects' }));
    expect(await screen.findByText('Mara Quinn is not involved in any projects yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByText('Mara Quinn has not commented on any projects yet.')).toBeInTheDocument();
    expect(screen.queryByText(/^Joined/)).not.toBeInTheDocument();
  });

  it('still shows the profile when its projects and comments cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProfileActivity).mockRejectedValue(new Error('function does not exist'));
    vi.mocked(readProfileComments).mockRejectedValue(new Error('column does not exist'));
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mara Quinn' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Projects' }));
    // Generous: under the full suite's load the failed read can take a moment to land.
    expect(await screen.findByText(/Projects could not be loaded/, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    setup();

    fireEvent.keyDown(await screen.findByRole('tab', { name: 'About' }), { key: 'ArrowLeft' });

    expect(screen.getByRole('tab', { name: /Activity/ })).toHaveAttribute('aria-selected', 'true');
  });
});
