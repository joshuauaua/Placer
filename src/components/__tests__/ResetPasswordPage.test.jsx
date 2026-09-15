import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { readSession, updatePassword } from '../../services/auth';
import { THEME } from '../../theme';

vi.mock('../../services/auth', () => ({
  readSession: vi.fn(),
  updatePassword: vi.fn(() => Promise.resolve()),
}));

// record: true so navigating away (back to sign in, or back to PLACER) can be
// asserted from the history, the same way JoinPage.test.jsx does it.
function renderPage() {
  const location = memoryLocation({ path: '/reset', record: true });
  render(
    <Router hook={location.hook}>
      <ResetPasswordPage t={THEME} />
    </Router>
  );
  return location;
}

const newPassword = () => screen.getByLabelText('New password');
const save = () => screen.getByRole('button', { name: 'Save new password' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResetPasswordPage, before the session is confirmed', () => {
  it('says so while the session from the link is still being checked', () => {
    vi.mocked(readSession).mockReturnValue(new Promise(() => {})); // never resolves

    renderPage();

    expect(screen.getByText('One moment…')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage, with no session to pick up', () => {
  it('says the link is dead and offers to sign in again', async () => {
    vi.mocked(readSession).mockResolvedValue(null);
    const location = renderPage();

    expect(await screen.findByText(/expired or has already been used/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(location.history.at(-1)).toBe('/signin');
  });

  it('treats a failed session check the same as no session, rather than getting stuck', async () => {
    vi.mocked(readSession).mockRejectedValue(new Error('network is down'));
    renderPage();

    expect(await screen.findByText(/expired or has already been used/i)).toBeInTheDocument();
  });
});

describe('ResetPasswordPage, with a confirmed session', () => {
  beforeEach(() => {
    vi.mocked(readSession).mockResolvedValue({ id: 'user-1', email: 'mara@example.com' });
  });

  it('asks for a new password once the link is confirmed real', async () => {
    renderPage();

    expect(await screen.findByLabelText('New password')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('will not accept a password too short to be worth having', async () => {
    renderPage();
    await screen.findByLabelText('New password');

    fireEvent.change(newPassword(), { target: { value: 'short' } });

    expect(save()).toBeDisabled();
  });

  it('changes the password and confirms it', async () => {
    const location = renderPage();
    await screen.findByLabelText('New password');

    fireEvent.change(newPassword(), { target: { value: 'longenough' } });
    fireEvent.click(save());

    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been changed.');
    expect(updatePassword).toHaveBeenCalledWith('longenough');

    fireEvent.click(screen.getByRole('button', { name: 'Back to PLACER' }));
    expect(location.history.at(-1)).toBe('/');
  });

  it('says so when the change fails instead of pretending it worked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(updatePassword).mockRejectedValue(new Error('Could not change your password: nope'));
    renderPage();
    await screen.findByLabelText('New password');

    fireEvent.change(newPassword(), { target: { value: 'longenough' } });
    fireEvent.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(/nope/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
