import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationItem } from '../NotificationItem';
import { THEME } from '../../theme';

const note = (overrides) => ({ id: 'n-1', category: 'follower', title: 'New follower',
  body: 'Mara Quinn started following Malmö Stad', readAt: null, createdAt: new Date().toISOString(),
  linkType: null, linkId: null, ...overrides });

describe('NotificationItem', () => {
  it('opens the organisation a notification links to', () => {
    const onOpenOrganisation = vi.fn();
    render(<NotificationItem t={THEME} notification={note({ linkType: 'organisation', linkId: 'org-1' })}
      onOpenProject={vi.fn()} onOpenOrganisation={onOpenOrganisation} />);

    const link = screen.getByRole('link', { name: /New follower/ });
    expect(link).toHaveAttribute('href', '/organisations/org-1');
    fireEvent.click(link);
    expect(onOpenOrganisation).toHaveBeenCalledWith('org-1');
  });

  it('opens the project a notification links to', () => {
    const onOpenProject = vi.fn();
    render(<NotificationItem t={THEME}
      notification={note({ category: 'engagement', title: 'New response', linkType: 'project', linkId: 'proj-1' })}
      onOpenProject={onOpenProject} />);

    fireEvent.click(screen.getByRole('link', { name: /New response/ }));
    expect(onOpenProject).toHaveBeenCalledWith('proj-1');
  });

  it('is a plain row when there is nowhere to open', () => {
    render(<NotificationItem t={THEME} notification={note({ linkType: 'organisation', linkId: 'org-1' })}
      onOpenProject={vi.fn()} />);

    // No handler for organisations was given, so it cannot pretend to be a link.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('New follower')).toBeInTheDocument();
  });
});
