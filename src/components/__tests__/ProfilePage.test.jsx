import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { ProfilePage } from '../ProfilePage';
import { fetchImaginations } from '../../services/api';
import { THEME } from '../../theme';

vi.mock('../../services/api', () => ({
  fetchImaginations: vi.fn(() => Promise.resolve([])),
}));

const MINE = [
  { id: 'a', title: 'Pocket park on Lot 7', cat: 'green', author: 'Mara Quinn', votes: 342, comments: 28 },
  { id: 'b', title: 'Shade along 8th Street', cat: 'seating', author: 'Mara Quinn', votes: 218, comments: 14 },
];
const SOMEONE_ELSE = {
  id: 'c', title: 'Mural under the rail bridge', cat: 'art', author: 'Devon Park', votes: 999, comments: 99,
};

const setup = (saved = [], profile = { name: 'Mara Quinn', bio: '' }) => {
  vi.mocked(fetchImaginations).mockResolvedValue(saved);
  return render(<ProfilePage t={THEME} profile={profile} onNavigate={vi.fn()} />);
};

// The stat tiles put the number and its label in sibling elements, so the tile is
// found by its label and read back through its parent.
const statFor = (label) => screen.getByText(label).parentElement;

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names who you are posting as', async () => {
    setup(MINE);

    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Mara Quinn')).toBeInTheDocument();
  });

  it('lists only your own imaginations', async () => {
    setup([...MINE, SOMEONE_ELSE]);

    expect(await screen.findByText('Pocket park on Lot 7')).toBeInTheDocument();
    expect(screen.getByText('Shade along 8th Street')).toBeInTheDocument();
    expect(screen.queryByText('Mural under the rail bridge')).not.toBeInTheDocument();
  });

  it('totals votes and comments across your own imaginations only', async () => {
    setup([...MINE, SOMEONE_ELSE]);
    await screen.findByText('Pocket park on Lot 7');

    expect(statFor('Imaginations posted')).toHaveTextContent('2');
    expect(statFor('Votes received')).toHaveTextContent('560');
    expect(statFor('Comments received')).toHaveTextContent('42');
  });

  it('invites you to start when you have posted nothing', async () => {
    setup([SOMEONE_ELSE]);

    expect(await screen.findByText('Nothing posted yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start imagining/ })).toBeInTheDocument();
  });

  it('sends you to the map from the empty state', async () => {
    vi.mocked(fetchImaginations).mockResolvedValue([]);
    const onNavigate = vi.fn();
    render(<ProfilePage t={THEME} profile={{ name: 'Mara Quinn', bio: '' }} onNavigate={onNavigate} />);
    (await screen.findByRole('button', { name: /Start imagining/ })).click();

    expect(onNavigate).toHaveBeenCalledWith('map');
  });

  it('says so when the imaginations cannot be loaded', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchImaginations).mockRejectedValue(new Error('storage gone'));
    render(<ProfilePage t={THEME} profile={{ name: 'Mara Quinn', bio: '' }} onNavigate={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load your imaginations/);
    consoleErrorSpy.mockRestore();
  });
});
