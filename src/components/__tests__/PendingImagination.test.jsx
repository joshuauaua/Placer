import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { useIdentity } from '../useIdentity';

/*
 * The other half of requiring an account to post.
 *
 * Signing in with Google, or confirming a new account by email, reloads the page — and
 * everything somebody has made up to that point lives in MainApp's React state. So it is
 * written to localStorage on the way out and picked up here on the way back. Without
 * this, gating the Post step would mean losing a drawing to sign in, which would be a
 * worse app than the one that had no accounts.
 *
 * useIdentity is mocked because what is under test is what App does with the answer, not
 * how the answer is arrived at — that is useIdentity.test.jsx.
 */
vi.mock('../useIdentity', () => ({ useIdentity: vi.fn() }));

const PENDING_KEY = 'placemaking_pending_imagination';

const PENDING = {
  capturedView: {
    position: { lat: 51.507351, lng: -0.127758 },
    pov: { heading: 90, pitch: 0, zoom: 1 },
    fov: 90,
    source: 'streetview',
    screenshot: 'data:image/jpeg;base64,mockScreenshot',
  },
  canvasAssets: [{ id: 'a1' }, { id: 'a2' }],
  draft: { title: 'Pocket park', cat: 'green', blurb: 'Swap the asphalt for trees.' },
  preview: 'data:image/jpeg;base64,mockPreview',
};

const park = (over = {}) => {
  localStorage.setItem(PENDING_KEY, JSON.stringify({
    ...PENDING,
    stashedAt: new Date().toISOString(),
    ...over,
  }));
};

const identity = (over = {}) => {
  vi.mocked(useIdentity).mockReturnValue({
    profile: { name: 'Mara Quinn', bio: '' },
    status: 'signedIn',
    accountId: 'user-1',
    email: 'mara@example.com',
    signIn: vi.fn(),
    signOut: vi.fn(),
    saveProfile: vi.fn(),
    ...over,
  });
};

const renderApp = (path = '/') => {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <App />
    </Router>
  );
};

describe('an imagination parked while signing in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identity();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('puts somebody back on the Post step with their imagination on it', async () => {
    park();

    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'Ready to post' })).toBeInTheDocument();
    expect(screen.getByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByText('Swap the asphalt for trees.')).toBeInTheDocument();
  });

  it('brings the drawing back, not just the words', async () => {
    park();

    renderApp();

    await screen.findByRole('heading', { level: 1, name: 'Ready to post' });
    // The composited preview is the drawing; the counts prove the editable arrays came
    // back with it, so going back a step would still have something to edit.
    expect(screen.getByAltText('Your imagination'))
      .toHaveAttribute('src', 'data:image/jpeg;base64,mockPreview');
    expect(screen.getByText(/assets placed/)).toHaveTextContent('2 assets placed');
  });

  it('offers the Post button, now that there is an account behind it', async () => {
    park();

    renderApp();

    expect(await screen.findByRole('button', { name: /Post to community/ })).toBeEnabled();
  });

  it('forgets the parked copy once it has been restored', async () => {
    park();

    renderApp();

    await screen.findByRole('heading', { level: 1, name: 'Ready to post' });
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('leaves it parked for somebody who has not signed in yet', async () => {
    identity({ profile: null, status: 'signedOut', accountId: null, email: null });
    park();

    renderApp();

    expect(await screen.findByText('a toolkit for participatory placemaking')).toBeInTheDocument();
    // Still theirs to come back to, rather than thrown away on the way past.
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
  });

  it('does not restore anything while the session is still being read', async () => {
    identity({ profile: null, status: 'loading', accountId: null, email: null });
    park();

    renderApp();

    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
  });

  // With nothing to restore, signing in lands where it always does: the dashboard.
  it('stays out of the way when nothing was parked', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('ignores a stale parked imagination rather than resurrecting it', async () => {
    park({ stashedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() });

    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe('where somebody signed in starts', () => {
  const renderRecording = (path) => {
    const location = memoryLocation({ path, record: true });
    render(
      <Router hook={location.hook}>
        <App />
      </Router>
    );
    return location;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    identity();
  });

  it('opens on the dashboard rather than the landing page', async () => {
    const location = renderRecording('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('a toolkit for participatory placemaking')).not.toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/dashboard');
  });

  it('still shows the landing page to somebody signed out', async () => {
    identity({ profile: null, status: 'signedOut', accountId: null, email: null });
    const location = renderRecording('/');

    expect(await screen.findByText('a toolkit for participatory placemaking')).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/');
  });
});
