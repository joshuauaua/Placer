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

/** Past an experiment's cover page, to the tool itself. */
const start = () => fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

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
    expect(EXPERIMENTS).toHaveLength(8);
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

  it('opens an experiment on its cover page, and shows the tool after Get started', async () => {
    renderPageAt('/sandbox/street-mixer');

    await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' });
    expect(screen.getByText('Twenty metres, and everything wants some.')).toBeInTheDocument();
    expect(screen.getByText(/By PLACER/)).toBeInTheDocument();
    // The tool, and the header's copy-link button, wait behind the cover.
    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();

    start();

    expect(screen.getByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('opens the next experiment on its own cover, rather than skipping it', async () => {
    renderPageAt('/sandbox/street-mixer');
    start();

    fireEvent.click(screen.getByRole('button', { name: /all experiments/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Desire Lines/i }));

    expect(await screen.findByRole('button', { name: 'Get started' })).toBeInTheDocument();
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
    start();
    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/sandbox/budget-ballot')));
    expect(await screen.findByRole('button', { name: /link copied/i })).toBeInTheDocument();
  });

  it('shows the link instead when the browser will not copy it', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });

    renderPageAt('/sandbox/budget-ballot');
    start();
    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }));

    const field = await screen.findByLabelText('Link to this experiment');
    expect(field.value).toContain('/sandbox/budget-ballot');
  });
});

describe('inside the app', () => {
  // Signed in, Sandbox and Explore live in the side nav and About and Resources in
  // the footer. Each is scoped so "Sandbox" is not also the page heading.
  const sideNav = () => within(screen.getByRole('navigation', { name: 'App' }));
  const footer = () => within(screen.getByRole('contentinfo'));

  it('reaches the Sandbox from the side nav', async () => {
    const { location } = renderAt('/');

    fireEvent.click(sideNav().getByRole('button', { name: 'Sandbox' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/sandbox');
  });

  it('keeps the side nav and footer around an experiment', async () => {
    renderAt('/sandbox/street-mixer');

    expect(await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(sideNav().getByRole('button', { name: 'Sandbox' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
  });

  it('serves the gallery and an experiment from the one route', async () => {
    renderAt('/sandbox');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(sideNav().getByRole('button', { name: 'Sandbox' })).toBeInTheDocument();
  });

  it('leaves the Sandbox again, and puts the URL on the new view', async () => {
    // The view is read off the location, so a nav item that only set component state
    // would leave the Sandbox showing over an About URL, or vice versa.
    const { location } = renderAt('/sandbox/street-mixer');
    await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' });

    fireEvent.click(footer().getByText('About'));

    // The About page is a photo of the team, so its alt text is what marks it.
    expect(
      await screen.findByRole('img', { name: /people behind PLACER/i }),
    ).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/about');
    expect(screen.queryByRole('heading', { level: 1, name: 'Street Section Mixer' })).not.toBeInTheDocument();
  });

  it('goes back into the Sandbox from another view', async () => {
    const { location } = renderAt('/');

    fireEvent.click(footer().getByText('Resources', { selector: '[role="link"]' }));
    await screen.findByRole('heading', { level: 1, name: 'Resources' });
    fireEvent.click(sideNav().getByRole('button', { name: 'Sandbox' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sandbox' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/sandbox');
  });

  it('marks the nav item as the one showing', async () => {
    renderAt('/sandbox');
    await screen.findByRole('heading', { level: 1, name: 'Sandbox' });

    expect(sideNav().getByRole('button', { name: 'Sandbox' })).toHaveAttribute('aria-current', 'page');
    expect(sideNav().getByRole('button', { name: 'Explore' })).not.toHaveAttribute('aria-current');
  });

  it('does not fall through to the welcome view', async () => {
    renderAt('/sandbox');
    await screen.findByRole('heading', { level: 1, name: 'Sandbox' });

    expect(screen.queryByText('a toolkit for participatory placemaking')).not.toBeInTheDocument();
  });
});
