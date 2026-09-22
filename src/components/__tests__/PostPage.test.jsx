import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PostPage } from '../PostPage';
import { THEME } from '../../theme';
import { postImagination, postsAreShared } from '../../services/imaginations';
import { signInWithGoogle, signInWithPassword, signUpWithPassword } from '../../services/auth';

vi.mock('../../services/imaginations', () => ({
  postImagination: vi.fn(),
  // False by default, matching the rest of the suite: src/test/setup.js runs every test as
  // though no Supabase project were configured.
  postsAreShared: vi.fn(() => false),
}));

// PostPage renders the sign-in form inline for anyone who reaches it without an account,
// so it reaches services/auth through AuthForm.
vi.mock('../../services/auth', () => ({
  sendPasswordReset: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(() => Promise.resolve()),
  signInWithPassword: vi.fn(() => Promise.resolve({ id: 'user-1', email: 'mara@example.com' })),
  signUpWithPassword: vi.fn(() => Promise.resolve({ needsConfirmation: true })),
}));

const DRAFT = { title: 'Pocket park', cat: 'green', blurb: 'Swap the asphalt for trees.' };
const CAPTURED = {
  position: { lat: 51.507351, lng: -0.127758 },
  pov: { heading: 90, pitch: 0, zoom: 1 },
  fov: 90,
  source: 'streetview',
  screenshot: 'data:image/jpeg;base64,mockScreenshot',
};

const setup = (props = {}) => {
  const onPosted = vi.fn();
  const onBack = vi.fn();
  render(
    <PostPage
      t={THEME}
      draft={DRAFT}
      preview="data:image/jpeg;base64,mockPreview"
      capturedView={CAPTURED}
      canvasAssets={[{ id: 'a1' }, { id: 'a2' }]}
      onPosted={onPosted}
      onBack={onBack}
      {...props}
    />
  );
  return { onPosted, onBack };
};

describe('PostPage', () => {
  beforeEach(() => {
    vi.mocked(postImagination).mockReset();
    vi.mocked(postImagination).mockResolvedValue({ id: 'img-1' });
    vi.mocked(postsAreShared).mockReturnValue(false);
  });

  it('renders the StepBar with step 3 ("Post") active', () => {
    setup();
    expect(screen.getByText('Post')).toHaveStyle({ fontWeight: 800 });
    expect(screen.getByText('Place assets')).toHaveStyle({ fontWeight: 600 });
    expect(screen.getByText('Describe')).toHaveStyle({ fontWeight: 600 });
  });

  it('shows the draft for review', () => {
    setup();

    expect(screen.getByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByText('Swap the asphalt for trees.')).toBeInTheDocument();
    expect(screen.getByText('Green space')).toBeInTheDocument();
  });

  it('shows the asset count', () => {
    setup();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/assets placed/)).toBeInTheDocument();
  });

  it('formats the captured coordinates as the location', () => {
    setup();
    expect(screen.getByText('51.5074, -0.1278')).toBeInTheDocument();
  });

  it('falls back to "Not recorded" when the capture has no position', () => {
    setup({ capturedView: { ...CAPTURED, position: null } });
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });

  it('prefers the composite preview over the bare screenshot', () => {
    setup();
    expect(screen.getByAltText('Your imagination')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockPreview'
    );
  });

  it('falls back to the bare screenshot when the composite export failed', () => {
    setup({ preview: null });
    expect(screen.getByAltText('Your imagination')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockScreenshot'
    );
  });

  it('saves the imagination and then calls onPosted', async () => {
    const { onPosted } = setup();

    fireEvent.click(screen.getByText('Post to community'));

    await waitFor(() => expect(onPosted).toHaveBeenCalledTimes(1));
    expect(postImagination).toHaveBeenCalledWith({
      userId: null,
      title: 'Pocket park',
      cat: 'green',
      blurb: 'Swap the asphalt for trees.',
      loc: '51.5074, -0.1278',
      author: 'You There',
      source: 'streetview',
      position: CAPTURED.position,
      pov: CAPTURED.pov,
      fov: 90,
      canvasAssets: [{ id: 'a1' }, { id: 'a2' }],
      preview: 'data:image/jpeg;base64,mockPreview',
      projectId: null,
    });
  });

  it('attaches a project when the capture flow was entered for one', async () => {
    const { onPosted } = setup({ projectId: 'proj-1' });

    fireEvent.click(screen.getByText('Post to community'));

    await waitFor(() => expect(onPosted).toHaveBeenCalledTimes(1));
    expect(postImagination).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'proj-1' }));
  });

  it('shows a saving state while the write is in flight', async () => {
    vi.mocked(postImagination).mockImplementation(() => new Promise(() => {}));
    setup();

    fireEvent.click(screen.getByText('Post to community'));

    expect(await screen.findByText('Posting…')).toBeDisabled();
  });

  it('surfaces an error and does not advance when the save fails', async () => {
    vi.mocked(postImagination).mockRejectedValue(new Error('nope'));
    const { onPosted } = setup();

    fireEvent.click(screen.getByText('Post to community'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not save your imagination/);
    expect(onPosted).not.toHaveBeenCalled();
  });

  it('explains a full localStorage quota specifically', async () => {
    const quotaError = new Error('quota');
    quotaError.name = 'QuotaExceededError';
    vi.mocked(postImagination).mockRejectedValue(quotaError);
    setup();

    fireEvent.click(screen.getByText('Post to community'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Out of local storage space/);
  });

  it('calls onBack from "Back to describe"', () => {
    const { onBack } = setup();

    fireEvent.click(screen.getByText('Back to describe'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

/*
 * An account is required to post, and this is where that is enforced. What matters as
 * much as the enforcing is that it costs nobody their work: the panel is rendered in
 * place, so signing in with a password never moves the page, and the two routes that do
 * move it — Google, and confirming a new account by email — get a chance to park the
 * imagination first.
 */
describe('PostPage, reached without an account', () => {
  const signedOut = (props = {}) => setup({ needsAccount: true, onStashDraft: vi.fn(), ...props });

  beforeEach(() => {
    vi.mocked(signInWithGoogle).mockClear();
    vi.mocked(signInWithPassword).mockClear();
    vi.mocked(signUpWithPassword).mockClear();
  });

  it('offers no way to post', () => {
    signedOut();

    expect(screen.queryByRole('button', { name: /Post to community/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sign in below to post')).toBeInTheDocument();
  });

  it('asks for a sign in, in place, rather than sending anybody away', () => {
    signedOut();

    expect(screen.getByRole('heading', { name: 'Sign in to post this' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    // Still showing the imagination it is about, which is the point of doing it here.
    expect(screen.getByText('Pocket park')).toBeInTheDocument();
  });

  it('promises the work survives, because it does', () => {
    signedOut();

    expect(screen.getByText(/Nothing you have made is lost/)).toBeInTheDocument();
  });

  it('drops the browser-storage note, which is not what happens next', () => {
    signedOut();

    expect(screen.queryByText(/Nothing is uploaded to a server yet/)).not.toBeInTheDocument();
  });

  it('signs in without parking anything, since the page does not move', async () => {
    const onStashDraft = vi.fn();
    signedOut({ onStashDraft });

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(onStashDraft).not.toHaveBeenCalled();
  });

  it('parks the imagination before handing off to Google', async () => {
    const onStashDraft = vi.fn();
    signedOut({ onStashDraft });

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    // Order is the assertion: a redirect that beat the save would lose the drawing.
    expect(onStashDraft).toHaveBeenCalled();
    expect(onStashDraft.mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(signInWithGoogle).mock.invocationCallOrder[0]);
  });

  it('parks the imagination before a signup that has to be confirmed by email', async () => {
    const onStashDraft = vi.fn();
    signedOut({ onStashDraft });

    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mara Quinn' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(signUpWithPassword).toHaveBeenCalled());
    expect(onStashDraft.mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(signUpWithPassword).mock.invocationCallOrder[0]);
  });

  it('says where the imagination has gone once a confirmation is pending', async () => {
    signedOut();

    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mara Quinn' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText(/saved on this device and will be waiting/)).toBeInTheDocument();
  });

  it('never writes an imagination while signed out', () => {
    signedOut();

    expect(postImagination).not.toHaveBeenCalled();
  });
});

describe('PostPage, while the session is still being read', () => {
  it('holds the Post button rather than letting a post race the answer', () => {
    setup({ checkingAccount: true });

    expect(screen.getByRole('button', { name: /Post to community/ })).toBeDisabled();
  });
});

describe('PostPage, posting to a community rather than a browser', () => {
  beforeEach(() => {
    vi.mocked(postImagination).mockReset();
    vi.mocked(postImagination).mockResolvedValue({ id: 'img-1' });
    vi.mocked(postsAreShared).mockReturnValue(true);
  });

  it('says the imagination is going somewhere other people can see it', () => {
    setup({ accountId: 'user-1' });

    expect(screen.getByText(/Posting puts this on the community map/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing is uploaded to a server yet/)).not.toBeInTheDocument();
  });

  it('credits it to the name it will carry', () => {
    setup({ accountId: 'user-1', authorName: 'Mara Quinn' });

    expect(screen.getByText(/credited\s+to Mara Quinn/)).toBeInTheDocument();
  });

  it('says it can be taken down again, because it can', () => {
    setup({ accountId: 'user-1' });

    expect(screen.getByText(/remove it again from your profile/)).toBeInTheDocument();
  });

  it('sends the account the imagination belongs to', async () => {
    const { onPosted } = setup({ accountId: 'user-1' });

    fireEvent.click(screen.getByRole('button', { name: /Post to community/ }));

    await waitFor(() => expect(onPosted).toHaveBeenCalled());
    expect(postImagination).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    );
  });

  it('blames the connection rather than local storage when a post fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(postImagination).mockRejectedValue(new Error('network down'));
    setup({ accountId: 'user-1' });

    fireEvent.click(screen.getByRole('button', { name: /Post to community/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Check your connection/);
    consoleError.mockRestore();
  });
});
