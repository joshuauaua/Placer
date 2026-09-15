import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthCallback } from '../AuthCallback';
import { readSession } from '../../services/auth';
import { THEME } from '../../theme';

vi.mock('../../services/auth', () => ({
  readSession: vi.fn(),
}));

// AuthCallback reads the query string straight off window.location (it has to run
// before wouter's Router even exists) and only uses wouter for the redirect
// afterwards, so wouter itself is mocked here rather than reached for through a
// memory Router the way JoinPage.test.jsx and ResetPasswordPage.test.jsx do it.
const navigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/auth/callback', navigate],
}));

function renderAt(search) {
  window.history.pushState({}, '', `/auth/callback${search}`);
  render(<AuthCallback t={THEME} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthCallback, a link that says why it failed', () => {
  it('shows the reason instead of trying to read a session that is not there', async () => {
    renderAt('?error=access_denied&error_description=Link%20has%20expired');

    expect(await screen.findByText('That did not work')).toBeInTheDocument();
    expect(screen.getByText('Link has expired')).toBeInTheDocument();
    expect(readSession).not.toHaveBeenCalled();
  });

  it('leads back to signing in', async () => {
    renderAt('?error=access_denied&error_description=Link%20has%20expired');
    await screen.findByText('That did not work');

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    expect(navigate).toHaveBeenCalledWith('/signin', { replace: true });
  });
});

describe('AuthCallback, a link that established a session', () => {
  beforeEach(() => {
    vi.mocked(readSession).mockResolvedValue({ id: 'user-1', email: 'mara@example.com' });
  });

  it('shows a spinner while the session is being read', () => {
    vi.mocked(readSession).mockReturnValue(new Promise(() => {})); // never resolves
    renderAt('');

    expect(screen.getByText('Finishing your sign in…')).toBeInTheDocument();
  });

  it('moves on to where the link said to go', async () => {
    renderAt('?next=%2Freset');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/reset', { replace: true }));
  });

  it('defaults to the app itself when the link did not say where to go', async () => {
    renderAt('');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
  });
});

describe('AuthCallback, a link with nothing left to redeem', () => {
  it('says the link is dead when there is no session to pick up', async () => {
    vi.mocked(readSession).mockResolvedValue(null);
    renderAt('');

    expect(await screen.findByText(/expired or has already been used/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows what went wrong when the session check itself fails, rather than spinning forever', async () => {
    vi.mocked(readSession).mockRejectedValue(new Error('the database is unreachable'));
    renderAt('');

    expect(await screen.findByText(/unreachable/)).toBeInTheDocument();
  });
});
