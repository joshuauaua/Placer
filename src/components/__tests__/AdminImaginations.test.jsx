import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminImaginations } from '../AdminImaginations';
import { THEME } from '../../theme';
import { fetchImaginations, deleteImagination } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchImaginations: vi.fn(() => Promise.resolve([])),
  deleteImagination: vi.fn(() => Promise.resolve({ success: true })),
}));

const OLDER = {
  id: 'img-1',
  title: 'Pocket park',
  cat: 'green',
  blurb: 'Swap the asphalt for trees.',
  loc: '55.6100, 12.9900',
  author: 'You There',
  preview: 'data:image/jpeg;base64,mockPreview',
  createdAt: '2026-08-20T10:00:00.000Z',
  upvotes: 4,
  canvasAssets: [{ id: 'a1' }, { id: 'a2' }],
  lines: [{ id: 'l1' }],
};

const NEWER = {
  id: 'img-2',
  title: 'Shade on 8th',
  cat: 'seating',
  blurb: 'Street trees every block.',
  createdAt: '2026-08-26T10:00:00.000Z',
  upvotes: 0,
  canvasAssets: [],
  lines: [],
};

const setup = (saved = [OLDER, NEWER]) => {
  vi.mocked(fetchImaginations).mockResolvedValue(saved);
  render(<AdminImaginations t={THEME} />);
};

describe('AdminImaginations', () => {
  beforeEach(() => {
    vi.mocked(fetchImaginations).mockReset().mockResolvedValue([]);
    vi.mocked(deleteImagination).mockReset().mockResolvedValue({ success: true });
  });

  it('shows a loading state before the records arrive', () => {
    setup();
    expect(screen.getByText('Loading imaginations…')).toBeInTheDocument();
  });

  it('lists every saved imagination with its details', async () => {
    setup();

    expect(await screen.findByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByText('Shade on 8th')).toBeInTheDocument();
    expect(screen.getByText('Green space')).toBeInTheDocument();
    expect(screen.getByText('Public seating')).toBeInTheDocument();
    expect(screen.getByText('55.6100, 12.9900')).toBeInTheDocument();
    expect(screen.getByText('2 assets')).toBeInTheDocument();
    expect(screen.getByText('4 votes')).toBeInTheDocument();
  });

  it('orders the list newest first', async () => {
    setup();
    await screen.findByText('Pocket park');

    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Shade on 8th', 'Pocket park']);
  });

  it('formats the created date without depending on the machine locale', async () => {
    setup();
    expect(await screen.findByText('2026-08-20')).toBeInTheDocument();
  });

  it('reports how many are saved', async () => {
    setup();
    expect(await screen.findByText('2 saved')).toBeInTheDocument();
  });

  it('shows the preview thumbnail, and a placeholder when there is none', async () => {
    setup();
    await screen.findByText('Pocket park');

    expect(screen.getByAltText('Preview of Pocket park')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockPreview'
    );
    // The newer record has no preview.
    expect(screen.getByLabelText('No preview')).toBeInTheDocument();
  });

  it('shows an empty state when nothing has been posted', async () => {
    setup([]);
    expect(await screen.findByText('Nothing posted yet')).toBeInTheDocument();
    expect(screen.getByText('0 saved')).toBeInTheDocument();
  });

  it('shows an error state when the records cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchImaginations).mockRejectedValue(new Error('storage unavailable'));
    render(<AdminImaginations t={THEME} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load imaginations/);
    consoleError.mockRestore();
  });

  describe('deleting', () => {
    it('asks for confirmation instead of deleting on the first click', async () => {
      setup();
      await screen.findByText('Pocket park');

      fireEvent.click(screen.getByLabelText('Delete Pocket park'));

      expect(screen.getByLabelText('Confirm deleting Pocket park')).toBeInTheDocument();
      expect(deleteImagination).not.toHaveBeenCalled();
    });

    it('abandons the delete on Cancel', async () => {
      setup();
      await screen.findByText('Pocket park');
      fireEvent.click(screen.getByLabelText('Delete Pocket park'));

      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.getByLabelText('Delete Pocket park')).toBeInTheDocument();
      expect(deleteImagination).not.toHaveBeenCalled();
    });

    it('deletes only the confirmed record and drops it from the list', async () => {
      setup();
      await screen.findByText('Pocket park');

      fireEvent.click(screen.getByLabelText('Delete Pocket park'));
      fireEvent.click(screen.getByLabelText('Confirm deleting Pocket park'));

      await waitFor(() => expect(screen.queryByText('Pocket park')).not.toBeInTheDocument());
      expect(deleteImagination).toHaveBeenCalledWith('img-1');
      expect(deleteImagination).toHaveBeenCalledTimes(1);
      // The other record is untouched.
      expect(screen.getByText('Shade on 8th')).toBeInTheDocument();
      expect(screen.getByText('1 saved')).toBeInTheDocument();
    });

    it('confirms per row, so one row does not arm another', async () => {
      setup();
      await screen.findByText('Pocket park');

      fireEvent.click(screen.getByLabelText('Delete Pocket park'));

      expect(screen.getByLabelText('Delete Shade on 8th')).toBeInTheDocument();
      expect(screen.queryByLabelText('Confirm deleting Shade on 8th')).not.toBeInTheDocument();
    });

    it('keeps the record and reports the failure when the delete fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(deleteImagination).mockRejectedValue(new Error('nope'));
      setup();
      await screen.findByText('Pocket park');

      fireEvent.click(screen.getByLabelText('Delete Pocket park'));
      fireEvent.click(screen.getByLabelText('Confirm deleting Pocket park'));

      expect(await screen.findByRole('alert')).toHaveTextContent(/Could not delete/);
      expect(screen.getByText('Pocket park')).toBeInTheDocument();
      consoleError.mockRestore();
    });

    it('shows a deleting state while the write is in flight', async () => {
      vi.mocked(deleteImagination).mockImplementation(() => new Promise(() => {}));
      setup();
      await screen.findByText('Pocket park');

      fireEvent.click(screen.getByLabelText('Delete Pocket park'));
      fireEvent.click(screen.getByLabelText('Confirm deleting Pocket park'));

      expect(await screen.findByText('Deleting…')).toBeInTheDocument();
    });

    it('renders user text as text, never as markup', async () => {
      setup([{ ...OLDER, title: '<img src=x onerror="alert(1)">', preview: null }]);

      expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
