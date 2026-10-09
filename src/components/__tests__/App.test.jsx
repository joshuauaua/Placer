import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { readReimagineScene } from '../../services/projects';

vi.mock('../MapContainer', () => ({
  default: () => {
    throw new Error('Map failed to load');
  },
}));

// Konva has no canvas to draw on here. Stood in for by the picture it would draw on.
vi.mock('../ImaginationCanvas', () => ({
  default: ({ backgroundImage }) => <img alt="Canvas background" src={backgroundImage ?? ''} />,
}));

// Null unless a test sets a project's scene up.
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal()),
  readReimagineScene: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../ExplorePage', () => ({
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
    expect(screen.getByText(/Placer is the open toolkit for co-designing shared spaces/)).toBeInTheDocument();
  });

  it('sets the landing copy on a card over the city drawing, as decoration', () => {
    const { container } = renderAt('/');

    // The drawings are a CSS background, so they never reach assistive tech:
    // a landscape one, and a portrait one that index.css swaps in on a phone.
    const page = container.querySelector('.placer-landing');
    expect(page.style.getPropertyValue('--placer-landing-city')).toMatch(/landing-city\.svg/);
    expect(page.style.getPropertyValue('--placer-landing-city-mobile')).toMatch(/landing-city-mobile\.svg/);
    expect(page.querySelector('.placer-landing-column')).toHaveTextContent(
      /Placer is the open toolkit for co-designing shared spaces/i
    );
    expect(screen.getByText(/funded by the Swedish Institute/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Funded by Swedish Institute' })).toBeInTheDocument();
  });

  it('offers the waitlist and User Labs from the landing page', async () => {
    renderAt('/');

    expect(screen.getByRole('button', { name: 'Join the Waitlist' })).toBeInTheDocument();

    // User Labs is the carousel's second card, so bring it round first.
    fireEvent.click(screen.getByRole('button', { name: 'Show card 2: Help shape what we build' }));
    fireEvent.click(screen.getByRole('link', { name: 'Apply to User Labs' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'User Labs' })).toBeInTheDocument();
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

    fireEvent.click(within(screen.getByRole('navigation', { name: 'App' })).getByRole('button', { name: 'Explore' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('puts Explore at its own address, /explore', () => {
    const { hook, history } = memoryLocation({ path: '/', record: true });
    render(<Router hook={hook}><App /></Router>);

    fireEvent.click(within(screen.getByRole('navigation', { name: 'App' })).getByRole('button', { name: 'Explore' }));

    expect(history.at(-1)).toBe('/explore');
  });

  it('starts an imagination from the Toolkit\'s Reimagine a Space, on its own map', async () => {
    const { hook, history } = memoryLocation({ path: '/toolkit/reimagine-a-space', record: true });
    render(<Router hook={hook}><App /></Router>);

    fireEvent.click(await screen.findByRole('button', { name: 'Get started' }));

    // The mocked map throws, so reaching the boundary means the imagine map rendered —
    // and the Toolkit's URL has been left, since that flow has none.
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(history.at(-1)).toBe('/');
  });

  it('skips the map for a project that has set Reimagine a Space up, drawing on its base image', async () => {
    vi.mocked(readReimagineScene).mockResolvedValueOnce({
      address: 'Folkets Park, Malmö', position: { lat: 55.59, lng: 13.01 }, screenshot: 'data:image/webp;base64,AAAA',
    });
    const { hook, searchHook, history } = memoryLocation({
      path: '/toolkit/reimagine-a-space?project=proj-1', record: true,
    });
    render(<Router hook={hook} searchHook={searchHook}><App /></Router>);

    fireEvent.click(await screen.findByRole('button', { name: 'Get started' }));

    expect(await screen.findByRole('button', { name: /Back to project/ })).toBeInTheDocument();
    expect(readReimagineScene).toHaveBeenCalledWith('proj-1');
    expect(await screen.findByRole('img', { name: 'Canvas background' }))
      .toHaveAttribute('src', 'data:image/webp;base64,AAAA');
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back to project/ }));
    expect(history.at(-1)).toBe('/projects/proj-1');
  });

  it('starts from the map when the project\'s scene cannot be loaded', async () => {
    vi.mocked(readReimagineScene).mockRejectedValueOnce(new Error('blocked by CORS'));
    const { hook, searchHook } = memoryLocation({ path: '/toolkit/reimagine-a-space?project=proj-1' });
    render(<Router hook={hook} searchHook={searchHook}><App /></Router>);

    fireEvent.click(await screen.findByRole('button', { name: 'Get started' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('opens Explore on a direct visit to /explore', async () => {
    renderAt('/explore');
    // The mocked page throws, so reaching the boundary means /explore rendered it.
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

    it('opens the dashboard from the menu and puts it in the URL', async () => {
      const location = renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Dashboard' }));

      expect(await screen.findByRole('heading', { level: 1, name: /^Welcome back/ })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/dashboard');
    });

    it('opens the settings from the menu', async () => {
      const location = renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/settings');
    });

    it('opens the dashboard on a direct visit, so the URL survives a refresh', async () => {
      renderRecording('/dashboard');

      expect(await screen.findByRole('heading', { level: 1, name: /^Welcome back/ })).toBeInTheDocument();
    });

    it('still opens the dashboard at its old /profile address', async () => {
      renderRecording('/profile');

      expect(await screen.findByRole('heading', { level: 1, name: /^Welcome back/ })).toBeInTheDocument();
    });

    it('lands on the dashboard after logging in from the nav bar', async () => {
      localStorage.setItem('placemaking_profile', JSON.stringify({ signedIn: false }));
      const location = renderRecording();

      fireEvent.click(screen.getByRole('button', { name: 'Log In' }));

      expect(await screen.findByRole('heading', { level: 1, name: /^Welcome back/ })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/dashboard');
    });

    it('navigates to a nav item\'s own URL when one is picked', async () => {
      const location = renderRecording('/dashboard');
      await screen.findByRole('heading', { level: 1, name: /^Welcome back/ });

      fireEvent.click(within(screen.getByRole('navigation', { name: 'App' })).getByRole('button', { name: 'Toolkit' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/toolkit');
    });

    it('offers Create Account and Log In after logging out, and nothing else', () => {
      renderRecording();

      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

      expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Account menu/ })).not.toBeInTheDocument();
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

    it('says so when /dashboard is reached while logged out', () => {
      localStorage.setItem('placemaking_profile', JSON.stringify({ signedIn: false }));
      renderRecording('/dashboard');

      expect(screen.getByText('You are logged out')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: /^Welcome back/ })).not.toBeInTheDocument();
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

      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    });

    it('renders the sign-up form at /signup, which asks for a username as well', async () => {
      renderAt('/signup');

      expect(await screen.findByRole('heading', { level: 1, name: 'Create an account' })).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('keeps the nav bar on the auth views, so signing in is not a dead end', async () => {
      renderAt('/signin');
      await screen.findByRole('heading', { level: 1, name: 'Welcome back' });

      // The same nav every other view inside MainApp gets. It is what makes it possible
      // to change your mind and go back to the map without using the browser's back
      // button, and it is a consequence of these being views rather than routes.
      expect(screen.getByRole('button', { name: 'PLACER home' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Account menu/ })).toBeInTheDocument();
    });

    it('moves between the two forms without leaving MainApp', async () => {
      const location = renderRecording('/signin');
      await screen.findByRole('heading', { level: 1, name: 'Welcome back' });

      fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));

      expect(await screen.findByLabelText('Username')).toBeInTheDocument();
      expect(location.history.at(-1)).toBe('/signup');
    });
  });
});
