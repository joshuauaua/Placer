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

  it('renders the landing page at root path, with no nav bar', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'PLACER' })).toBeInTheDocument();
    expect(screen.getByText('a toolkit for participatory placemaking')).toBeInTheDocument();
    expect(screen.getByText(/empowers citizens, design practitioners, and municipal stakeholders/i)).toBeInTheDocument();
    expect(screen.getByText(/bridging community vision with urban design/i)).toBeInTheDocument();
    expect(screen.getByText(/funded by the Swedish Institute/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'STPLN' })).toHaveAttribute('href', 'https://stpln.se/');
    expect(screen.getByRole('link', { name: 'Ankara Aks' })).toHaveAttribute('href', 'https://ankaraaks.com/');
    expect(screen.getByRole('img', { name: 'Funded by Swedish Institute' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the nav bar when it is switched on', () => {
    vi.stubEnv('VITE_SHOW_NAV', 'true');
    renderAt('/');

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'PLACER' })).toBeInTheDocument();
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
    // Reached through the nav's Explore button, since the landing page has no
    // call to action of its own.
    vi.stubEnv('VITE_SHOW_NAV', 'true');
    renderAt('/');

    fireEvent.click(screen.getByText('Explore'));

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
});
