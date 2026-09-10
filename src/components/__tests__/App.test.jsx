import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.getByText('Reimagine Your City')).toBeInTheDocument();
  });

  it('renders SurveyPage at /survey', async () => {
    renderAt('/survey');
    expect(
      await screen.findByText(/tell us how your neighborhood should change/i)
    ).toBeInTheDocument();
  });

  it('renders AdminGate restricted view at /admin when admin is disabled', () => {
    renderAt('/admin');
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });

  it('ErrorBoundary catches errors thrown by route content instead of crashing the app', async () => {
    renderAt('/');

    fireEvent.click(screen.getByText('Start imagining'));

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

    const trigger = () => screen.getByRole('button', { name: 'Account menu' });

    afterEach(() => {
      // The profile lives in localStorage, which nothing else resets.
      localStorage.clear();
    });

    it('shows the display name in the nav bar', () => {
      renderRecording();

      expect(trigger()).toHaveTextContent('You There');
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

    it('goes back to the root URL when another nav item is picked', async () => {
      const location = renderRecording('/profile');
      await screen.findByRole('heading', { level: 1, name: 'Profile' });

      fireEvent.click(screen.getByText('Resources'));

      expect(await screen.findByRole('heading', { level: 1, name: 'Resources' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/');
    });

    it('offers a way back in after logging out', () => {
      renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument();
    });

    it('says so when /profile is reached while logged out', () => {
      localStorage.setItem('placemaking_profile', JSON.stringify({ signedIn: false }));
      renderRecording('/profile');

      expect(screen.getByText('You are logged out')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: 'Profile' })).not.toBeInTheDocument();
    });
  });
});
