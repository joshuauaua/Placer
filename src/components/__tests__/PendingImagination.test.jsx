import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { useIdentity } from '../useIdentity';

/*
 * The other half of requiring an account to save an idea.
 *
 * Confirming a new account by email reloads the page — and everything somebody has made
 * up to that point lives in Idea Visualizer's React state. So it is written to
 * localStorage on the way out, and picked up by the tool when the confirmation link
 * brings the new account back to it. Without this, gating the Save step would mean
 * losing a drawing to sign in, which would be a worse app than the one that had no
 * accounts.
 *
 * useIdentity is mocked because what is under test is what the tool does with the
 * answer, not how the answer is arrived at — that is useIdentity.test.jsx.
 */
vi.mock('../useIdentity', () => ({ useIdentity: vi.fn() }));

// The map step, where the tool starts when there is nothing to pick up.
vi.mock('../MapContainer', () => ({ default: () => <div data-testid="idea-map" /> }));

// Where the confirmation link comes back to: the tool, started.
const TOOL_PATH = '/toolkit/reimagine-a-space?start';

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

const renderApp = (path = TOOL_PATH) => {
  const { hook, searchHook } = memoryLocation({ path });
  return render(
    <Router hook={hook} searchHook={searchHook}>
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

  it('puts somebody back on the Save step with their idea on it', async () => {
    park();

    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'Ready to save' })).toBeInTheDocument();
    expect(screen.getByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByText('Swap the asphalt for trees.')).toBeInTheDocument();
  });

  it('brings the drawing back, not just the words', async () => {
    park();

    renderApp();

    await screen.findByRole('heading', { level: 1, name: 'Ready to save' });
    // The composited preview is the drawing; the counts prove the editable arrays came
    // back with it, so going back a step would still have something to edit.
    expect(screen.getByAltText('Your idea'))
      .toHaveAttribute('src', 'data:image/jpeg;base64,mockPreview');
    expect(screen.getByText(/assets placed/)).toHaveTextContent('2 assets placed');
  });

  it('offers the Save button rather than a sign-in, now that there is an account behind it', async () => {
    park();

    renderApp();

    expect(await screen.findByRole('button', { name: 'Save to my profile' })).toBeInTheDocument();
    expect(screen.queryByText('Sign in below to save')).not.toBeInTheDocument();
  });

  it('forgets the parked copy once it has been restored', async () => {
    park();

    renderApp();

    await screen.findByRole('heading', { level: 1, name: 'Ready to save' });
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('leaves it parked for somebody who has not signed in yet', async () => {
    identity({ profile: null, status: 'signedOut', accountId: null, email: null });
    park();

    renderApp();

    expect(await screen.findByTestId('idea-map')).toBeInTheDocument();
    // Still theirs to come back to, rather than thrown away on the way past.
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
  });

  it('does not restore anything while the session is still being read', async () => {
    identity({ profile: null, status: 'loading', accountId: null, email: null });
    park();

    renderApp();

    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByTestId('idea-map')).not.toBeInTheDocument();
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
  });

  // With nothing to restore, the tool starts where it always does: the map.
  it('stays out of the way when nothing was parked', async () => {
    renderApp();

    expect(await screen.findByTestId('idea-map')).toBeInTheDocument();
  });

  it('ignores a stale parked imagination rather than resurrecting it', async () => {
    park({ stashedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() });

    renderApp();

    expect(await screen.findByTestId('idea-map')).toBeInTheDocument();
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  // It belongs to the tool now, so signing in anywhere else lands where it always does.
  it('leaves it for the tool rather than taking over the dashboard', async () => {
    park();

    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /^Welcome back/ })).toBeInTheDocument();
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
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

    expect(await screen.findByRole('heading', { level: 1, name: /^Welcome back/ })).toBeInTheDocument();
    expect(screen.queryByText(/The open toolkit for participatory placemaking/)).not.toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/dashboard');
  });

  it('still shows the landing page to somebody signed out', async () => {
    identity({ profile: null, status: 'signedOut', accountId: null, email: null });
    const location = renderRecording('/');

    expect(await screen.findByText(/The open toolkit for participatory placemaking/)).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/');
  });
});
