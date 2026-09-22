import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImaginationPreview } from '../ImaginationPreview';
import { THEME } from '../../theme';

const postsAreShared = vi.fn(() => false);
const readComments = vi.fn(() => Promise.resolve([]));
const readMyVote = vi.fn(() => Promise.resolve(null));
const postComment = vi.fn(() => Promise.resolve(null));
const voteImagination = vi.fn(() => Promise.resolve(null));

vi.mock('../../services/imaginations', () => ({
  postsAreShared: (...a) => postsAreShared(...a),
  readComments: (...a) => readComments(...a),
  readMyVote: (...a) => readMyVote(...a),
  postComment: (...a) => postComment(...a),
  voteImagination: (...a) => voteImagination(...a),
}));

const IMAGINATION = {
  id: 'img-1',
  title: 'Pocket park',
  cat: 'green',
  blurb: 'Swap the asphalt for trees, a lawn, and a few benches.',
  loc: '55.6100, 12.9900',
  author: 'You There',
  preview: 'data:image/jpeg;base64,mockPreview',
  canvasAssets: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
  upvotes: 5,
};

const COMMENT = { id: 'c1', author: 'Sam', text: 'Love this.', createdAt: '2026-09-10T12:00:00.000Z' };

beforeEach(() => {
  postsAreShared.mockReturnValue(false);
  readComments.mockResolvedValue([]);
  readMyVote.mockResolvedValue(null);
  postComment.mockResolvedValue({ id: 'c2', author: 'You There', text: 'Nice idea', createdAt: '2026-09-20T10:00:00.000Z' });
  voteImagination.mockResolvedValue({ upvotes: 6, myVote: 'up' });
});

// Waits out the effect that loads comments and the standing vote, so every test
// starts from the settled state rather than racing it.
const setup = async (overrides = {}) => {
  const onClose = vi.fn();
  render(
    <ImaginationPreview
      t={THEME}
      imagination={IMAGINATION}
      onClose={onClose}
      accountId="user-1"
      authorName="You There"
      {...overrides}
    />
  );
  await waitFor(() => expect(screen.queryByText('Loading comments…')).not.toBeInTheDocument());
  return { onClose };
};

describe('ImaginationPreview', () => {
  it('shows the title, description, category, and location', async () => {
    await setup();

    expect(screen.getByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByText(/Swap the asphalt for trees/)).toBeInTheDocument();
    expect(screen.getByText('Green space')).toBeInTheDocument();
    expect(screen.getByText('55.6100, 12.9900')).toBeInTheDocument();
  });

  it('shows the saved composite preview image', async () => {
    await setup();

    expect(screen.getByAltText('Preview of Pocket park')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockPreview'
    );
  });

  it('shows the asset count and the author', async () => {
    await setup();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/You There/)).toBeInTheDocument();
  });

  it('is exposed as a dialog named after the imagination', async () => {
    await setup();
    expect(screen.getByRole('dialog', { name: 'Imagination: Pocket park' })).toBeInTheDocument();
  });

  it('calls onClose from the close button', async () => {
    const { onClose } = await setup();

    fireEvent.click(screen.getByLabelText('Close preview'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders without an image when the record has no preview', async () => {
    await setup({ imagination: { ...IMAGINATION, preview: null } });

    expect(screen.queryByAltText(/Preview of/)).not.toBeInTheDocument();
    expect(screen.getByText('Pocket park')).toBeInTheDocument();
  });

  it('falls back to a placeholder title when the record has none', async () => {
    await setup({ imagination: { ...IMAGINATION, title: '' } });
    expect(screen.getByText('Untitled imagination')).toBeInTheDocument();
  });

  it('survives a sparse record with no assets, category, location, or votes', async () => {
    await setup({ imagination: { id: 'img-2', title: 'Bare', preview: null } });

    expect(screen.getByText('Bare')).toBeInTheDocument();
    // The asset count and the vote score both render as zero rather than crashing
    // on the missing arrays/fields.
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('renders user text as text, never as markup', async () => {
    await setup({ imagination: { ...IMAGINATION, title: '<img src=x onerror="alert(1)">', preview: null } });

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
  });

  describe('voting', () => {
    it('shows the score the imagination was loaded with', async () => {
      await setup();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows which way this viewer has already voted', async () => {
      readMyVote.mockResolvedValue('up');
      await setup();

      expect(screen.getByLabelText('Vote up')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Vote down')).toHaveAttribute('aria-pressed', 'false');
    });

    it('casts a vote and shows the server-confirmed score', async () => {
      await setup();

      fireEvent.click(screen.getByLabelText('Vote up'));

      expect(voteImagination).toHaveBeenCalledWith('img-1', 'up', { accountId: 'user-1' });
      await waitFor(() => expect(screen.getByText('6')).toBeInTheDocument());
      expect(screen.getByLabelText('Vote up')).toHaveAttribute('aria-pressed', 'true');
    });

    it('updates the score right away, before the request resolves', async () => {
      let resolveVote;
      voteImagination.mockReturnValue(new Promise((resolve) => { resolveVote = resolve; }));
      await setup();

      fireEvent.click(screen.getByLabelText('Vote up'));

      // 5 -> 6 immediately, not waiting on the request the mock is holding open.
      expect(screen.getByText('6')).toBeInTheDocument();
      resolveVote({ upvotes: 6, myVote: 'up' });
    });

    it('reverts the optimistic score when the vote request fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      voteImagination.mockRejectedValue(new Error('offline'));
      await setup();

      fireEvent.click(screen.getByLabelText('Vote up'));

      await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
      expect(screen.getByLabelText('Vote up')).toHaveAttribute('aria-pressed', 'false');
      consoleError.mockRestore();
    });
  });

  describe('comments', () => {
    it('lists what is already there', async () => {
      readComments.mockResolvedValue([COMMENT]);
      await setup();

      expect(screen.getByText('Sam')).toBeInTheDocument();
      expect(screen.getByText('Love this.')).toBeInTheDocument();
      expect(screen.getByText('Comments · 1')).toBeInTheDocument();
    });

    it('says so when there are none yet', async () => {
      await setup();
      expect(screen.getByText(/No comments yet/)).toBeInTheDocument();
    });

    it('posts a new comment and appends it to the thread', async () => {
      await setup();

      fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Nice idea' } });
      fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

      expect(postComment).toHaveBeenCalledWith('img-1', {
        authorName: 'You There',
        accountId: 'user-1',
        text: 'Nice idea',
      });
      expect(await screen.findByText('Nice idea')).toBeInTheDocument();
      expect(screen.getByLabelText('Add a comment')).toHaveValue('');
    });

    it('will not post a blank comment', async () => {
      await setup();

      expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    });

    it('shows an error and keeps the draft when posting fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      postComment.mockRejectedValue(new Error('offline'));
      await setup();

      fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Nice idea' } });
      fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/Could not post your comment/);
      expect(screen.getByLabelText('Add a comment')).toHaveValue('Nice idea');
      consoleError.mockRestore();
    });
  });

  describe('with posts shared and nobody signed in', () => {
    it('gates voting and commenting behind signing in', async () => {
      postsAreShared.mockReturnValue(true);
      const onSignIn = vi.fn();
      await setup({ accountId: null, onSignIn });

      expect(screen.getByText(/Sign in to vote or comment/)).toBeInTheDocument();
      expect(screen.getByLabelText('Vote up')).toBeDisabled();
      expect(screen.queryByLabelText('Add a comment')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(onSignIn).toHaveBeenCalledTimes(1);
    });

    it('still shows the existing comments and votes to a signed-out visitor', async () => {
      postsAreShared.mockReturnValue(true);
      readComments.mockResolvedValue([COMMENT]);
      await setup({ accountId: null });

      expect(screen.getByText('Sam')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('allows voting and commenting once signed in', async () => {
      postsAreShared.mockReturnValue(true);
      await setup({ accountId: 'user-1' });

      expect(screen.queryByText(/Sign in to vote or comment/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Vote up')).not.toBeDisabled();
      expect(screen.getByLabelText('Add a comment')).toBeInTheDocument();
    });
  });
});
