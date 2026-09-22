import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { SandboxPage, experimentIdFrom } from '../SandboxPage';
import { EXPERIMENTS } from '../../sandbox/experiments';
import { THEME } from '../../theme';

function renderAt(path) {
  const location = memoryLocation({ path, record: true });
  const result = render(
    <Router hook={location.hook}>
      <App />
    </Router>
  );
  return { ...result, location };
}

/** The page on its own, which is enough for everything but the nav bar. */
function renderPageAt(path) {
  const location = memoryLocation({ path, record: true });
  const result = render(
    <Router hook={location.hook}>
      <SandboxPage t={THEME} />
    </Router>
  );
  return { ...result, location };
}

describe('experimentIdFrom', () => {
  it('finds the experiment in a path', () => {
    expect(experimentIdFrom('/sandbox/street-mixer')).toBe('street-mixer');
  });

  it('has nothing to find on the gallery itself', () => {
    expect(experimentIdFrom('/sandbox')).toBeNull();
    expect(experimentIdFrom('/')).toBeNull();
  });

  it('stops at a query string or a trailing segment', () => {
    expect(experimentIdFrom('/sandbox/street-mixer?from=nav')).toBe('street-mixer');
    expect(experimentIdFrom('/sandbox/street-mixer/deeper')).toBe('street-mixer');
  });

  it('decodes an escaped id without choking on a broken one', () => {
    expect(experimentIdFrom('/sandbox/street%2Dmixer')).toBe('street-mixer');
    expect(experimentIdFrom('/sandbox/%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('the gallery', () => {
  it('shows every experiment in the register', async () => {
    renderPageAt('/sandbox');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    for (const experiment of EXPERIMENTS) {
      expect(screen.getByRole('button', { name: new RegExp(experiment.name, 'i') })).toBeInTheDocument();
    }
    expect(EXPERIMENTS).toHaveLength(7);
  });

  it('opens an experiment, and puts it in the URL', async () => {
    const { location } = renderPageAt('/sandbox');

    fireEvent.click(screen.getByRole('button', { name: /Street Section Mixer/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/sandbox/street-mixer');
  });

  it('comes back to the gallery, and to the plain URL', async () => {
    const { location } = renderPageAt('/sandbox/desire-lines');
    await screen.findByRole('heading', { level: 1, name: 'Desire Lines' });

    fireEvent.click(screen.getByRole('button', { name: /all experiments/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/sandbox');
  });

  it.each(EXPERIMENTS.map((experiment) => [experiment.id, experiment.name]))(
    'opens %s straight from its own link',
    async (id, name) => {
      renderPageAt(`/sandbox/${id}`);
      expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
    }
  );

  it('falls back to the gallery when the link names nothing', async () => {
    renderPageAt('/sandbox/teleporter');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('There is no experiment called teleporter');
    expect(screen.getByRole('button', { name: /Budget Ballot/i })).toBeInTheDocument();
  });

  it('says what each experiment is for, so a tile is not just a name', () => {
    renderPageAt('/sandbox');
    for (const experiment of EXPERIMENTS) {
      expect(screen.getByText(experiment.tagline)).toBeInTheDocument();
    }
  });
});

describe('the copy link button', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the experiment own link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderPageAt('/sandbox/budget-ballot');
    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/sandbox/budget-ballot')));
    expect(await screen.findByRole('button', { name: /link copied/i })).toBeInTheDocument();
  });

  it('shows the link instead when the browser will not copy it', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });

    renderPageAt('/sandbox/budget-ballot');
    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }));

    const field = await screen.findByLabelText('Link to this experiment');
    expect(field.value).toContain('/sandbox/budget-ballot');
  });
});

describe('inside the app', () => {
  it('reaches the Sandbox from the nav bar', async () => {
    const { location } = renderAt('/');

    fireEvent.click(screen.getByText('Sandbox'));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/sandbox');
  });

  it('keeps the nav bar and footer around an experiment', async () => {
    renderAt('/sandbox/street-mixer');

    expect(await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms and Privacy' })).toBeInTheDocument();
  });

  it('serves the gallery and an experiment from the one route', async () => {
    renderAt('/sandbox');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('leaves the Sandbox again, and puts the URL back', async () => {
    // The view is read off the location, so a nav item that only set component state
    // would leave the Sandbox showing over an About URL, or vice versa.
    const { location } = renderAt('/sandbox/street-mixer');
    await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' });

    fireEvent.click(screen.getByText('About'));

    // The About page is the project poster alone, so its alt text is what marks it.
    expect(
      await screen.findByRole('img', { name: /participatory placemaking/i }),
    ).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/');
    expect(screen.queryByRole('heading', { level: 1, name: 'Street Section Mixer' })).not.toBeInTheDocument();
  });

  it('goes back into the Sandbox from another view', async () => {
    const { location } = renderAt('/');

    fireEvent.click(screen.getByText('Resources'));
    await screen.findByRole('heading', { level: 1, name: 'Resources' });
    fireEvent.click(screen.getByText('Sandbox'));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/sandbox');
  });

  it('marks the nav item as the one showing', async () => {
    renderAt('/sandbox');
    await screen.findByRole('heading', { level: 1, name: 'Sandbox' });

    // Scoped to the nav, since "Sandbox" is also the page heading. The active item is
    // the one carrying the panel background rather than nothing.
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByText('Sandbox')).not.toHaveStyle({ background: 'transparent' });
    expect(nav.getByText('About')).toHaveStyle({ background: 'transparent' });
  });

  it('does not fall through to the welcome view', async () => {
    renderAt('/sandbox');
    await screen.findByRole('heading', { level: 1, name: 'Sandbox' });

    expect(screen.queryByText('a toolkit for participatory placemaking')).not.toBeInTheDocument();
  });
});
