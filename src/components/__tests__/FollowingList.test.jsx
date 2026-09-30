import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { FollowingList } from '../FollowingList';
import { readFollows } from '../../services/follows';
import { THEME } from '../../theme';

vi.mock('../../services/follows', () => ({ readFollows: vi.fn() }));

const FOLLOWS = {
  user: [{ id: 'f1', type: 'user', targetId: 'user-2', label: 'Sam Berg' }],
  organisation: [{ id: 'f2', type: 'organisation', targetId: 'org-1', label: 'Malmö Stad' }],
  project: [],
};

describe('FollowingList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFollows).mockImplementation((type) => Promise.resolve(FOLLOWS[type] ?? []));
  });

  it('lists what this account follows, grouped, and opens each', async () => {
    const onOpen = vi.fn();
    render(<FollowingList t={THEME} onOpen={onOpen} />);

    fireEvent.click(await screen.findByRole('link', { name: /Malmö Stad/ }));
    expect(onOpen).toHaveBeenCalledWith('organisation', 'org-1');
    expect(screen.getByRole('link', { name: /Sam Berg/ })).toHaveAttribute('href', '/people/user-2');
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    // An empty kind is left out rather than shown as an empty box.
    expect(screen.queryByRole('heading', { name: 'Projects' })).not.toBeInTheDocument();
  });

  it('says how to follow something when nothing is followed yet', async () => {
    vi.mocked(readFollows).mockResolvedValue([]);
    render(<FollowingList t={THEME} onOpen={vi.fn()} />);

    expect(await screen.findByText(/Use Follow on a person/)).toBeInTheDocument();
  });
});
