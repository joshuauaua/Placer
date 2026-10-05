import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ActivityPage } from '../ActivityPage';
import { isSupabaseConfigured, listNotifications, markAllRead } from '../../services/notifications';
import { THEME } from '../../theme';

vi.mock('../../services/notifications', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  listNotifications: vi.fn(() => Promise.resolve([])),
  markAllRead: vi.fn(() => Promise.resolve()),
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

  it('opens a project a notification is about', async () => {
    const onOpenProject = vi.fn();
    render(<ActivityPage t={THEME} onOpenProject={onOpenProject} />);
    fireEvent.click(await screen.findByRole('link', { name: /sam commented/i }));
    expect(onOpenProject).toHaveBeenCalledWith('p1');
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
