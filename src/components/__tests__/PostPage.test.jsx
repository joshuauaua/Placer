import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PostPage } from '../PostPage';
import { THEME } from '../../theme';
import { saveInquiry } from '../../services/inquiries';
import { isSupabaseConfigured } from '../../services/supabase';
import { signInWithPassword, signUpWithPassword } from '../../services/auth';

vi.mock('../../services/inquiries', () => ({ saveInquiry: vi.fn() }));
vi.mock('../../services/supabase', async (importOriginal) => ({
  ...(await importOriginal()),
  isSupabaseConfigured: vi.fn(() => true),
}));

// PostPage renders the sign-in form inline for anyone who reaches it without an account,
// so it reaches services/auth through AuthForm.
vi.mock('../../services/auth', () => ({
  sendPasswordReset: vi.fn(() => Promise.resolve()),
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
      accountId="user-1"
      {...props}
    />
  );
  return { onPosted, onBack };
};

describe('PostPage', () => {
  beforeEach(() => {
    vi.mocked(saveInquiry).mockReset();
    vi.mocked(saveInquiry).mockResolvedValue({ id: 'inq-1' });
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  });

  it('renders the StepBar with step 3 ("Save") active', () => {
    setup();
    expect(screen.getByText('Save')).toHaveStyle({ fontWeight: 800 });
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

  it('counts what was drawn, and keeps the lines with the idea', async () => {
    const lines = [{ id: 'l1', tool: 'pen', color: '#3A39FF', size: 8, opacity: 1, points: [0, 0, 10, 10] }];
    setup({ lines });

    expect(screen.getByText(/lines drawn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));
    await waitFor(() => expect(saveInquiry).toHaveBeenCalled());
    expect(saveInquiry.mock.calls[0][0].config.lines).toEqual(lines);
  });

  it('names the address the photo was pinned at, when there is one', () => {
    setup({ capturedView: { ...CAPTURED, address: 'Folkets Park, Malmö' } });
    expect(screen.getByText('Folkets Park, Malmö')).toBeInTheDocument();
  });

  it('shows the place today and who it is for, and keeps them with the idea', async () => {
    setup({ draft: { ...DRAFT, scene: 'A sunny car park.', audience: 'Parents at the gate.' },
      capturedView: { ...CAPTURED, source: 'upload', address: 'Folkets Park, Malmö' } });

    expect(screen.getByText('A sunny car park.')).toBeInTheDocument();
    expect(screen.getByText('Parents at the gate.')).toBeInTheDocument();
    expect(screen.getByText('Your own photo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));
    await waitFor(() => expect(saveInquiry).toHaveBeenCalled());
    expect(saveInquiry.mock.calls[0][0].config).toMatchObject({
      scene: 'A sunny car park.', audience: 'Parents at the gate.', address: 'Folkets Park, Malmö',
      loc: 'Folkets Park, Malmö', source: 'upload',
    });
  });

  it('falls back to "Not recorded" when the capture has no position', () => {
    setup({ capturedView: { ...CAPTURED, position: null } });
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });

  it('prefers the composite preview over the bare screenshot', () => {
    setup();
    expect(screen.getByAltText('Your idea')).toHaveAttribute('src', 'data:image/jpeg;base64,mockPreview');
  });

  it('falls back to the bare screenshot when the composite export failed', () => {
    setup({ preview: null });
    expect(screen.getByAltText('Your idea')).toHaveAttribute('src', 'data:image/jpeg;base64,mockScreenshot');
  });

  it('keeps the idea on the profile as an Idea Visualizer inquiry', async () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));

    expect(await screen.findByRole('heading', { name: 'Saved to your profile' })).toBeInTheDocument();
    expect(saveInquiry).toHaveBeenCalledWith({
      tool: 'reimagine-a-space',
      title: 'Pocket park',
      note: 'Swap the asphalt for trees.',
      config: {
        category: 'green',
        loc: '51.5074, -0.1278',
        scene: null,
        audience: null,
        address: null,
        position: CAPTURED.position,
        source: 'streetview',
        pov: CAPTURED.pov,
        fov: 90,
        canvasAssets: [{ id: 'a1' }, { id: 'a2' }],
        lines: [],
        projectId: null,
      },
      preview: 'data:image/jpeg;base64,mockPreview',
    });
  });

  it('sends the bare screenshot as the picture when there is no composite', async () => {
    setup({ preview: null });

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));

    await waitFor(() => expect(saveInquiry).toHaveBeenCalled());
    expect(saveInquiry.mock.calls[0][0].preview).toBe('data:image/jpeg;base64,mockScreenshot');
  });

  it('keeps the project the flow was entered for', async () => {
    setup({ projectId: 'proj-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));

    await waitFor(() => expect(saveInquiry).toHaveBeenCalled());
    expect(saveInquiry.mock.calls[0][0].config.projectId).toBe('proj-1');
  });

  it('finishes with Done, and points to the saved inquiries', async () => {
    const { onPosted } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));
    expect(await screen.findByRole('link', { name: 'See your saved inquiries' })).toHaveAttribute('href', '/people/user-1');
    expect(onPosted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onPosted).toHaveBeenCalledTimes(1);
  });

  it('shows a saving state while the write is in flight', async () => {
    vi.mocked(saveInquiry).mockImplementation(() => new Promise(() => {}));
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('surfaces an error and does not finish when the save fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(saveInquiry).mockRejectedValue(new Error('network down'));
    const { onPosted } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Check your connection/);
    expect(onPosted).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('says it is kept privately, on the profile', () => {
    setup();

    expect(screen.getByText(/only you can see it/)).toBeInTheDocument();
  });

  it('cannot save with no Supabase project, since there are no accounts', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    setup({ accountId: null });

    expect(screen.getByRole('button', { name: 'Save to my profile' })).toBeDisabled();
    expect(screen.getByText(/no Supabase project/)).toBeInTheDocument();
  });

  it('calls onBack from "Back to describe"', () => {
    const { onBack } = setup();

    fireEvent.click(screen.getByText('Back to describe'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

/*
 * An account is required to save, and this is where that is enforced. What matters as
 * much as the enforcing is that it costs nobody their work: the panel is rendered in
 * place, so signing in with a password never moves the page, and the two routes that do
 * move it — Google, and confirming a new account by email — get a chance to park the
 * idea first.
 */
describe('PostPage, reached without an account', () => {
  const signedOut = (props = {}) => setup({ needsAccount: true, accountId: null, onStashDraft: vi.fn(), ...props });

  beforeEach(() => {
    vi.mocked(signInWithPassword).mockClear();
    vi.mocked(signUpWithPassword).mockClear();
  });

  it('offers no way to save', () => {
    signedOut();

    expect(screen.queryByRole('button', { name: 'Save to my profile' })).not.toBeInTheDocument();
    expect(screen.getByText('Sign in below to save')).toBeInTheDocument();
  });

  it('asks for a sign in, in place, rather than sending anybody away', () => {
    signedOut();

    expect(screen.getByRole('heading', { name: 'Sign in to save this' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    // Still showing the idea it is about, which is the point of doing it here.
    expect(screen.getByText('Pocket park')).toBeInTheDocument();
  });

  it('promises the work survives, because it does', () => {
    signedOut();

    expect(screen.getByText(/Nothing you have made is lost/)).toBeInTheDocument();
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

  it('parks the idea before a signup that has to be confirmed by email', async () => {
    const onStashDraft = vi.fn();
    signedOut({ onStashDraft });

    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'PLACER-MARA' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'Mara Quinn' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(signUpWithPassword).toHaveBeenCalled());
    expect(onStashDraft.mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(signUpWithPassword).mock.invocationCallOrder[0]);
  });

  it('sends the confirmation link back to the tool, where the parked idea is picked up', async () => {
    signedOut({ returnTo: '/toolkit/reimagine-a-space?project=proj-1&start' });

    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'PLACER-MARA' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'Mara Quinn' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(signUpWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: '/toolkit/reimagine-a-space?project=proj-1&start' })));
  });

  it('says where the idea has gone once a confirmation is pending', async () => {
    signedOut();

    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'PLACER-MARA' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'Mara Quinn' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText(/kept on this device and will be waiting/)).toBeInTheDocument();
  });

  it('never saves anything while signed out', () => {
    signedOut();

    expect(saveInquiry).not.toHaveBeenCalled();
  });
});

describe('PostPage, while the session is still being read', () => {
  it('holds the Save button rather than letting a save race the answer', () => {
    setup({ checkingAccount: true });

    expect(screen.getByRole('button', { name: 'Save to my profile' })).toBeDisabled();
  });
});
