import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthPage } from '../AuthPage';
import {
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../../services/auth';
import { THEME } from '../../theme';

vi.mock('../../services/auth', () => ({
  sendPasswordReset: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(() => Promise.resolve()),
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

const setup = (mode = 'signin') => {
  const onNavigate = vi.fn();
  render(<AuthPage t={THEME} mode={mode} onNavigate={onNavigate} />);
  return { onNavigate };
};

const email = () => screen.getByLabelText('Email address');
const password = () => screen.getByLabelText('Password');
const submit = (name) => screen.getByRole('button', { name });

const fill = ({ name, code, address = 'mara@example.com', secret = 'longenough' } = {}) => {
  if (name) fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } });
  if (code) fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.change(email(), { target: { value: address } });
  fireEvent.change(password(), { target: { value: secret } });
};

describe('AuthPage, signing in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signInWithPassword).mockResolvedValue({ id: 'user-1', email: 'mara@example.com' });
  });

  it('asks for an address and a password, and nothing else', () => {
    setup();

    expect(email()).toBeInTheDocument();
    expect(password()).toBeInTheDocument();
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
  });

  it('cannot be submitted empty', () => {
    setup();

    expect(submit('Sign in')).toBeDisabled();
  });

  it('will not accept a password too short to be worth having', () => {
    setup();
    fill({ secret: 'short' });

    expect(submit('Sign in')).toBeDisabled();
  });

  it('signs in and hands back to the app', async () => {
    const { onNavigate } = setup();
    fill();

    fireEvent.click(submit('Sign in'));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('dashboard'));
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'mara@example.com', password: 'longenough',
    });
  });

  it('trims the address, because a trailing space is not a different account', async () => {
    setup();
    fill({ address: '  mara@example.com  ' });

    fireEvent.click(submit('Sign in'));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'mara@example.com' })
    ));
  });

  it('mentions the confirmation link when the details do not match', async () => {
    vi.mocked(signInWithPassword).mockResolvedValue(null);
    const { onNavigate } = setup();
    fill();

    fireEvent.click(submit('Sign in'));

    // The most likely reason for a correct password being refused is an account that
    // has not been confirmed yet, so the message says so rather than only "wrong".
    expect(await screen.findByRole('alert')).toHaveTextContent(/confirmation link/i);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('offers Google as well', async () => {
    setup();

    fireEvent.click(submit('Continue with Google'));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
  });

  it('asks for an address before it will send a reset link', async () => {
    setup();

    fireEvent.click(screen.getByRole('link', { name: 'Email me a reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Type your email address first/i);
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it('says nothing about whether the address has an account', async () => {
    setup();
    fireEvent.change(email(), { target: { value: 'mara@example.com' } });

    fireEvent.click(screen.getByRole('link', { name: 'Email me a reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/If mara@example.com has an account/i);
    expect(sendPasswordReset).toHaveBeenCalledWith('mara@example.com');
  });

  it('leads to signing up', () => {
    const { onNavigate } = setup();

    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));

    expect(onNavigate).toHaveBeenCalledWith('signup');
  });
});

describe('AuthPage, signing up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signUpWithPassword).mockResolvedValue({ needsConfirmation: true });
  });

  it('asks for a name, because an imagination has to be credited to something', () => {
    setup('signup');

    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(submit('Create account')).toBeDisabled();
  });

  it('passes the name through so the profile is created with it', async () => {
    setup('signup');
    fill({ name: 'Mara Quinn', code: 'PLACER-MARA' });

    fireEvent.click(submit('Create account'));

    await waitFor(() => expect(signUpWithPassword).toHaveBeenCalledWith({
      email: 'mara@example.com', password: 'longenough', displayName: 'Mara Quinn',
      inviteCode: 'PLACER-MARA',
    }));
  });

  it('will not create an account without an invite code', () => {
    setup('signup');
    fill({ name: 'Mara Quinn' });

    expect(screen.getByLabelText('Invite code')).toBeInTheDocument();
    expect(submit('Create account')).toBeDisabled();
  });

  it('does not offer Google, which cannot carry an invite code', () => {
    setup('signup');

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
  });

  it('sends somebody to their inbox rather than pretending they are signed in', async () => {
    const { onNavigate } = setup('signup');
    fill({ name: 'Mara Quinn', code: 'PLACER-MARA' });

    fireEvent.click(submit('Create account'));

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(screen.getByText(/mara@example.com/)).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('goes straight in when the project is not asking for confirmation', async () => {
    vi.mocked(signUpWithPassword).mockResolvedValue({ needsConfirmation: false });
    const { onNavigate } = setup('signup');
    fill({ name: 'Mara Quinn', code: 'PLACER-MARA' });

    fireEvent.click(submit('Create account'));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('dashboard'));
  });

  it('shows what went wrong instead of a silent dead end', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(signUpWithPassword).mockRejectedValue(new Error('Could not create your account: nope'));
    setup('signup');
    fill({ name: 'Mara Quinn', code: 'PLACER-MARA' });

    fireEvent.click(submit('Create account'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/nope/);
    consoleError.mockRestore();
  });

  it('leads back to signing in', () => {
    const { onNavigate } = setup('signup');

    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));

    expect(onNavigate).toHaveBeenCalledWith('signin');
  });
});
