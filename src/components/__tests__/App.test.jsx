import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';

vi.mock('../MapContainer', () => ({
  default: () => {
    throw new Error('Map failed to load');
  },
}));

function renderAt(path) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <App />
    </Router>
  );
}

describe('App', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders MainApp welcome view at root path', () => {
    renderAt('/');
    expect(screen.getByText('a toolkit for participatory placemaking')).toBeInTheDocument();
  });

  it('renders SurveyPage at /survey', async () => {
    renderAt('/survey');
    expect(
      await screen.findByRole('heading', { name: /citizen engagement in public space development/i })
    ).toBeInTheDocument();
  });

  it('renders AdminGate restricted view at /admin when admin is disabled', () => {
    renderAt('/admin');
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });

  it('ErrorBoundary catches errors thrown by route content instead of crashing the app', async () => {
    renderAt('/');

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Site' })).getByRole('button', { name: 'Explore' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  describe('/admin/imaginations route', () => {
    let originalValue;

    beforeEach(() => {
      originalValue = import.meta.env.VITE_ADMIN_ENABLED;
    });

    afterEach(() => {
      import.meta.env.VITE_ADMIN_ENABLED = originalValue;
    });

    it('renders the imaginations admin page when admin is enabled', async () => {
      import.meta.env.VITE_ADMIN_ENABLED = 'true';
      renderAt('/admin/imaginations');

      // Reads through the real api against jsdom localStorage, so with nothing
      // saved it settles on the empty state.
      expect(await screen.findByText('Nothing posted yet')).toBeInTheDocument();
    });

    it('does not fall through to the main dashboard', async () => {
      import.meta.env.VITE_ADMIN_ENABLED = 'true';
      renderAt('/admin/imaginations');
      await screen.findByText('Nothing posted yet');

      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    });

    it('is gated behind VITE_ADMIN_ENABLED like the dashboard', async () => {
      delete import.meta.env.VITE_ADMIN_ENABLED;
      renderAt('/admin/imaginations');

      expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
      expect(screen.queryByText('Imaginations')).not.toBeInTheDocument();
    });
  });
  describe('account menu', () => {
    // record: true, unlike the shared helper, so the URL the menu navigates to
    // can be asserted.
    const renderRecording = (path = '/') => {
      const location = memoryLocation({ path, record: true });
      render(
        <Router hook={location.hook}>
          <App />
        </Router>
      );
      return location;
    };

    const trigger = () => screen.getByRole('button', { name: /^Account menu/ });

    afterEach(() => {
      // The profile lives in localStorage, which nothing else resets.
      localStorage.clear();
    });

    it('shows the display name on the account menu button, for assistive tech', () => {
      renderRecording();

      expect(trigger()).toHaveAccessibleName('Account menu — You There');
    });

    it('opens the profile from the menu and puts it in the URL', async () => {
      const location = renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Profile' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/profile');
    });

    it('opens the settings from the menu', async () => {
      const location = renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/settings');
    });

    it('opens the profile on a direct visit, so the URL survives a refresh', async () => {
      renderRecording('/profile');

      expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    });

    it('navigates to a nav item\'s own URL when one is picked', async () => {
      const location = renderRecording('/profile');
      await screen.findByRole('heading', { level: 1, name: 'Profile' });

      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      fireEvent.click(within(screen.getByRole('navigation', { name: 'Site' })).getByText('Resources'));

      expect(await screen.findByRole('heading', { level: 1, name: 'Resources' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/resources');
    });

    it('offers Create Account and Log In after logging out, and nothing else', () => {
      renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

      expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Account menu/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    });

    it('logs back in from the nav bar', () => {
      localStorage.setItem('placemaking_profile', JSON.stringify({ signedIn: false }));
      renderRecording();

      fireEvent.click(screen.getByRole('button', { name: 'Log In' }));

      // No project in the suite, so Log In is the instant local sign-in.
      expect(trigger()).toBeInTheDocument();
    });

    it('shows the side nav when signed in, and it navigates by URL', async () => {
      const location = renderRecording();

      const sideNav = within(screen.getByRole('navigation', { name: 'App' }));
      fireEvent.click(sideNav.getByRole('button', { name: 'Settings' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/settings');
      expect(sideNav.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    });

    it('drops the side nav after logging out', () => {
      renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

      expect(screen.queryByRole('navigation', { name: 'App' })).not.toBeInTheDocument();
    });

    it('opens Projects from the side nav and puts it in the URL', async () => {
      const location = renderRecording();

      fireEvent.click(within(screen.getByRole('navigation', { name: 'App' })).getByRole('button', { name: 'Projects' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/projects');
    });

    it('says so when /projects is reached while logged out', () => {
      localStorage.setItem('placemaking_profile', JSON.stringify({ signedIn: false }));
      renderRecording('/projects');

      expect(screen.getByText('You are logged out')).toBeInTheDocument();
    });

    it('says so when /profile is reached while logged out', () => {
      localStorage.setItem('placemaking_profile', JSON.stringify({ signedIn: false }));
      renderRecording('/profile');

      expect(screen.getByText('You are logged out')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: 'Profile' })).not.toBeInTheDocument();
    });
  });

  /*
   * These run with no Supabase project, like everything else in the suite (see
   * src/test/setup.js), so signing in here would go nowhere — what is under test is that
   * the routes exist and land on the right screen. The forms themselves are covered in
   * AuthPage.test.jsx and the branch between a real account and the browser record in
   * useIdentity.test.jsx.
   */
  describe('the account routes', () => {
    const renderRecording = (path = '/') => {
      const location = memoryLocation({ path, record: true });
      render(
        <Router hook={location.hook}>
          <App />
        </Router>
      );
      return location;
    };

    afterEach(() => {
      localStorage.clear();
    });

    it('renders the sign-in form at /signin', async () => {
      renderAt('/signin');

      expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    });

    it('renders the sign-up form at /signup, which asks for a name as well', async () => {
      renderAt('/signup');

      expect(await screen.findByRole('heading', { level: 1, name: 'Create an account' })).toBeInTheDocument();
      expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    });

    it('keeps the nav bar on the auth views, so signing in is not a dead end', async () => {
      renderAt('/signin');
      await screen.findByRole('heading', { level: 1, name: 'Sign in' });

      // The same nav every other view inside MainApp gets. It is what makes it possible
      // to change your mind and go back to the map without using the browser's back
      // button, and it is a consequence of these being views rather than routes.
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(within(screen.getByRole('navigation', { name: 'Site' })).getByText('Resources')).toBeInTheDocument();
    });

    it('moves between the two forms without leaving MainApp', async () => {
      const location = renderRecording('/signin');
      await screen.findByRole('heading', { level: 1, name: 'Sign in' });

      fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));

      expect(await screen.findByLabelText('Your name')).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/signup');
    });
  });
});
