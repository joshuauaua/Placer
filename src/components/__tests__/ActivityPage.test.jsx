import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ActivityPage } from '../ActivityPage';
import { isSupabaseConfigured, listNotifications, markAllRead } from '../../services/notifications';
import { readInquiries } from '../../services/inquiries';
import { readPendingCollaboratorInvitations, respondToCollaboratorInvitation } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/notifications', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  listNotifications: vi.fn(() => Promise.resolve([])),
  markAllRead: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/inquiries', () => ({
  readInquiries: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/projects', () => ({
  readPendingCollaboratorInvitations: vi.fn(() => Promise.resolve([])),
  respondToCollaboratorInvitation: vi.fn(() => Promise.resolve({ success: true })),
}));

const NOTES = [
  { id: 'n1', category: 'engagement', title: 'Sam commented on Riverside Greenway', body: 'Love it.',
    linkType: 'project', linkId: 'p1', readAt: null, createdAt: new Date().toISOString() },
  { id: 'n2', category: 'follower', title: 'Ali followed you', body: null,
    linkType: null, linkId: null, readAt: '2026-10-01T10:00:00Z', createdAt: '2026-09-01T10:00:00Z' },
];

describe('ActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(listNotifications).mockResolvedValue(NOTES);
    vi.mocked(markAllRead).mockResolvedValue();
    vi.mocked(readInquiries).mockResolvedValue([]);
    vi.mocked(readPendingCollaboratorInvitations).mockResolvedValue([]);
    vi.mocked(respondToCollaboratorInvitation).mockResolvedValue({ success: true });
  });

  it('lists every notification, newest first, under the breadcrumb back to the dashboard', async () => {
    render(<ActivityPage t={THEME} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Workspace' })).toHaveAttribute('href', '/dashboard');

    const items = within(await screen.findByRole('list', { name: 'Activity' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Sam commented on Riverside Greenway'),
      expect.stringContaining('Ali followed you'),
    ]);
    expect(screen.getAllByRole('img', { name: 'Unread' })).toHaveLength(1);
  });

  it('mixes in the inquiries kept from standalone tools, by date, opening your profile', async () => {
    vi.mocked(readInquiries).mockResolvedValue([{ id: 'q1', tool: 'desire-lines', title: 'Shortcut by the station',
      note: '', config: {}, createdAt: '2026-09-15T10:00:00Z' }]);
    const onOpenProfile = vi.fn();
    render(<ActivityPage t={THEME} accountId="user-1" onOpenProfile={onOpenProfile} />);

    const list = await screen.findByRole('list', { name: 'Activity' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Sam commented on Riverside Greenway'),
      expect.stringContaining('You saved Shortcut by the station'),
      expect.stringContaining('Ali followed you'),
    ]);
    expect(screen.getAllByRole('img', { name: 'Unread' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('link', { name: /you saved shortcut by the station/i }));
    expect(onOpenProfile).toHaveBeenCalledWith('user-1');
  });

  it('still lists the notifications when the inquiries cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readInquiries).mockRejectedValue(new Error('no table'));
    render(<ActivityPage t={THEME} />);
    expect(await screen.findByText('Sam commented on Riverside Greenway')).toBeInTheDocument();
  });

  it('opens a project a notification is about', async () => {
    const onOpenProject = vi.fn();
    render(<ActivityPage t={THEME} onOpenProject={onOpenProject} />);
    fireEvent.click(await screen.findByRole('link', { name: /sam commented/i }));
    expect(onOpenProject).toHaveBeenCalledWith('p1');
  });

  it('shows pending project invitations on Activity and opens the dashboard after accepting', async () => {
    vi.mocked(readPendingCollaboratorInvitations).mockResolvedValue([
      { projectId: 'p-invited', projectName: 'Harbour steps', inviterName: 'Mara Quinn' },
    ]);
    const onOpenProjectDashboard = vi.fn();
    render(<ActivityPage t={THEME} accountId="user-1" onOpenProjectDashboard={onOpenProjectDashboard} />);

    expect(await screen.findByText('Harbour steps')).toBeInTheDocument();
    expect(screen.getByText('Invited by Mara Quinn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(respondToCollaboratorInvitation).toHaveBeenCalledWith('p-invited', true));
    expect(onOpenProjectDashboard).toHaveBeenCalledWith('p-invited');
    expect(screen.queryByText('Harbour steps')).not.toBeInTheDocument();
  });

  it('lets an invited account decline from Activity without opening the project', async () => {
    vi.mocked(readPendingCollaboratorInvitations).mockResolvedValue([
      { projectId: 'p-invited', projectName: 'Harbour steps', inviterName: 'Mara Quinn' },
    ]);
    const onOpenProjectDashboard = vi.fn();
    render(<ActivityPage t={THEME} accountId="user-1" onOpenProjectDashboard={onOpenProjectDashboard} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(respondToCollaboratorInvitation).toHaveBeenCalledWith('p-invited', false));
    expect(onOpenProjectDashboard).not.toHaveBeenCalled();
    expect(screen.queryByText('Harbour steps')).not.toBeInTheDocument();
  });

  it('marks everything read', async () => {
    render(<ActivityPage t={THEME} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(markAllRead).toHaveBeenCalled());
    expect(screen.queryByRole('img', { name: 'Unread' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });

  it('says so when there is nothing yet', async () => {
    vi.mocked(listNotifications).mockResolvedValue([]);
    render(<ActivityPage t={THEME} />);
    expect(await screen.findByText(/nothing yet/i)).toBeInTheDocument();
  });

  it('does not try without a Supabase project', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    render(<ActivityPage t={THEME} />);
    expect(listNotifications).not.toHaveBeenCalled();
    expect(screen.getByText(/needs a placer account/i)).toBeInTheDocument();
  });
});
