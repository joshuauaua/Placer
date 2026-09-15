import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserMenu } from '../UserMenu';
import { THEME } from '../../theme';

const trigger = () => screen.getByRole('button', { name: 'Account menu' });
const menu = () => screen.queryByRole('menu');
const item = (name) => screen.getByRole('menuitem', { name });

const setup = (overrides = {}) => {
  const props = {
    t: THEME,
    profile: { name: 'Mara Quinn', bio: '' },
    onNavigate: vi.fn(),
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
  render(<UserMenu {...props} />);
  return props;
};

describe('UserMenu', () => {
  it('shows the display name next to the avatar', () => {
    setup();

    expect(trigger()).toHaveTextContent('Mara Quinn');
    // Avatar renders initials rather than the name.
    expect(screen.getByText('MQ')).toBeInTheDocument();
  });

  it('starts closed', () => {
    setup();

    expect(menu()).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on the trigger and closes again', () => {
    setup();

    fireEvent.click(trigger());
    expect(menu()).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(trigger());
    expect(menu()).not.toBeInTheDocument();
  });

  it('offers profile, settings and log out once open', () => {
    setup();
    fireEvent.click(trigger());

    expect(item('Profile')).toBeInTheDocument();
    expect(item('Settings')).toBeInTheDocument();
    expect(item('Log out')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    setup();
    fireEvent.click(trigger());

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(menu()).not.toBeInTheDocument();
  });

  it('closes when the pointer goes down outside it', () => {
    setup();
    fireEvent.click(trigger());

    fireEvent.mouseDown(document.body);

    expect(menu()).not.toBeInTheDocument();
  });

  it('stays open when the pointer goes down inside it', () => {
    setup();
    fireEvent.click(trigger());

    fireEvent.mouseDown(item('Profile'));

    expect(menu()).toBeInTheDocument();
  });

  it('navigates to the profile and closes', () => {
    const { onNavigate } = setup();
    fireEvent.click(trigger());

    fireEvent.click(item('Profile'));

    expect(onNavigate).toHaveBeenCalledWith('profile');
    expect(menu()).not.toBeInTheDocument();
  });

  it('navigates to the settings', () => {
    const { onNavigate } = setup();
    fireEvent.click(trigger());

    fireEvent.click(item('Settings'));

    expect(onNavigate).toHaveBeenCalledWith('settings');
  });

  it('logs out', () => {
    const { onSignOut } = setup();
    fireEvent.click(trigger());

    fireEvent.click(item('Log out'));

    expect(onSignOut).toHaveBeenCalled();
    expect(menu()).not.toBeInTheDocument();
  });

  describe('logged out', () => {
    it('offers a way back in instead of the menu', () => {
      setup({ profile: null });

      expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('shows no avatar at all', () => {
      setup({ profile: null });

      // Avatar renders initials, so their absence is the avatar's absence. A greyed
      // one for nobody only invited a click that went nowhere.
      expect(screen.queryByText('G')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('signs in', () => {
      const { onSignIn } = setup({ profile: null });

      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(onSignIn).toHaveBeenCalled();
    });
  });
});
