import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FollowButton } from '../FollowButton';
import { follow, isFollowing, unfollow } from '../../services/follows';
import { THEME } from '../../theme';

vi.mock('../../services/follows', () => ({
  follow: vi.fn(() => Promise.resolve()),
  unfollow: vi.fn(() => Promise.resolve()),
  isFollowing: vi.fn(),
}));

const setup = () => render(<FollowButton t={THEME} type="organisation" targetId="org-1" label="Malmö Stad" />);

describe('FollowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFollowing).mockResolvedValue(false);
  });

  it('follows, snapshotting the name, and unfollows again', async () => {
    setup();

    fireEvent.click(await screen.findByRole('button', { name: /^Follow$/ }));
    expect(await screen.findByRole('button', { name: /Following/ })).toBeInTheDocument();
    expect(follow).toHaveBeenCalledWith('organisation', 'org-1', 'Malmö Stad');

    fireEvent.click(screen.getByRole('button', { name: /Following/ }));
    await waitFor(() => expect(unfollow).toHaveBeenCalledWith('organisation', 'org-1'));
    expect(screen.getByRole('button', { name: /^Follow$/ })).toBeInTheDocument();
  });

  it('starts as Following when already followed', async () => {
    vi.mocked(isFollowing).mockResolvedValue(true);
    setup();

    expect(await screen.findByRole('button', { name: /Following/ })).toBeEnabled();
  });

  it('goes back when the follow is refused', async () => {
    vi.mocked(follow).mockRejectedValue(new Error('nope'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup();

    fireEvent.click(await screen.findByRole('button', { name: /^Follow$/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^Follow$/ })).toBeInTheDocument());
  });
});
