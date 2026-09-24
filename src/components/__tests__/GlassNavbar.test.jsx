import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlassNavbar } from '../GlassNavbar';
import { THEME } from '../../theme';

function setup(props = {}) {
  const handlers = {
    onNavigate: vi.fn(),
    onSignIn: vi.fn(),
    onCreateAccount: vi.fn(),
    onSignOut: vi.fn(),
  };
  render(<GlassNavbar t={THEME} profile={null} loading={false} {...handlers} {...props} />);
  return handlers;
}

describe('GlassNavbar', () => {
  it('goes home from the wordmark', () => {
    const { onNavigate } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'PLACER home' }));

    expect(onNavigate).toHaveBeenCalledWith('welcome');
  });

  describe('logged out', () => {
    it('shows Create Account and Log In, and no account menu', () => {
      setup();

      expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Account menu/ })).not.toBeInTheDocument();
    });

    it('wires each button to its own handler', () => {
      const { onCreateAccount, onSignIn } = setup();

      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
      expect(onCreateAccount).toHaveBeenCalledTimes(1);
      expect(onSignIn).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
      expect(onSignIn).toHaveBeenCalledTimes(1);
    });
  });

  it('shows nothing on the right while the session is still being read', () => {
    setup({ loading: true });

    expect(screen.queryByRole('button', { name: 'Create Account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log In' })).not.toBeInTheDocument();
  });

  describe('logged in', () => {
    const profile = { name: 'Mara Quinn' };

    it('shows only the account menu — no site menu or notifications', () => {
      setup({ profile });

      expect(screen.getByRole('button', { name: 'Account menu — Mara Quinn' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create Account' })).not.toBeInTheDocument();
    });
  });
});
