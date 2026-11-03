import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { ToolkitPage, toolIdFrom } from '../ToolkitPage';
import { TOOLS } from '../../toolkit/tools';
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
      <ToolkitPage t={THEME} />
    </Router>
  );
  return { ...result, location };
}

/** Past a tool's cover page, to the tool itself. */
const start = () => fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

describe('toolIdFrom', () => {
  it('finds the tool in a path', () => {
    expect(toolIdFrom('/toolkit/street-mixer')).toBe('street-mixer');
  });

  it('has nothing to find on the gallery itself', () => {
    expect(toolIdFrom('/toolkit')).toBeNull();
    expect(toolIdFrom('/')).toBeNull();
  });

  it('stops at a query string or a trailing segment', () => {
    expect(toolIdFrom('/toolkit/street-mixer?from=nav')).toBe('street-mixer');
    expect(toolIdFrom('/toolkit/street-mixer/deeper')).toBe('street-mixer');
  });

  it('decodes an escaped id without choking on a broken one', () => {
    expect(toolIdFrom('/toolkit/street%2Dmixer')).toBe('street-mixer');
    expect(toolIdFrom('/toolkit/%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('the old /sandbox links', () => {
  it('sends a tool link on to the same tool under /toolkit', async () => {
    const { location } = renderAt('/sandbox/desire-lines');

    expect(await screen.findByRole('heading', { level: 1, name: 'Desire Lines' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit/desire-lines');
  });

  it('keeps the query string, so a room link still lands in the room', async () => {
    const { location } = renderAt('/sandbox/open-vote?room=room-1');

    await waitFor(() => expect(location.history.at(-1)).toBe('/toolkit/open-vote?room=room-1'));
  });

  it('sends the old gallery link home, as there is no gallery any more', async () => {
    const { location } = renderAt('/sandbox');

    // Home: which, for a real account, App sends on to the dashboard.
    await waitFor(() => expect(location.history.at(-1)).toBe('/'));
    expect(screen.queryByRole('heading', { level: 1, name: 'Toolkit' })).not.toBeInTheDocument();
  });
});

describe("a tool's own page", () => {
  it.each(TOOLS.map((tool) => [tool.id, tool.name]))(
    'opens %s straight from its own link',
    async (id, name) => {
      renderPageAt(`/toolkit/${id}`);
      expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
    }
  );

  it('opens a tool on its cover page, and shows the tool after Get started', async () => {
    renderPageAt('/toolkit/street-mixer');

    await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' });
    expect(screen.getByText('Twenty metres, and everything wants some.')).toBeInTheDocument();
    expect(screen.getByText(/By PLACER/)).toBeInTheDocument();
    start();

    expect(screen.getByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    // No button to copy the tool's link: the address bar has it.
    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('credits Stationary Activity Mapping under its name, and keeps its tagline for the tile', async () => {
    renderPageAt('/toolkit/stationary-activity-mapping');

    const title = await screen.findByRole('heading', { level: 1, name: 'Stationary Activity Mapping' });
    expect(title.nextElementSibling).toHaveTextContent('By Gehl Institute');
    expect(screen.queryByText(/one person at a time/)).not.toBeInTheDocument();
    expect(screen.getByText(/Mapping people spending time/)).toBeInTheDocument();
    expect(screen.getByText(/Public Life Data Protocol/)).toBeInTheDocument();
    start();

    // The instructions page: the credits, without the description again.
    expect(screen.getByText('By Gehl Institute')).toBeInTheDocument();
    expect(screen.getByText(/Public Life Data Protocol/)).toBeInTheDocument();
    expect(screen.queryByText(/Mapping people spending time/)).not.toBeInTheDocument();
  });

  it('goes home when the link names no tool there is', async () => {
    const { location } = renderPageAt('/toolkit/teleporter');

    await waitFor(() => expect(location.history.at(-1)).toBe('/'));
  });

  it('goes home from /toolkit on its own: there is no gallery', async () => {
    const { location } = renderPageAt('/toolkit');

    await waitFor(() => expect(location.history.at(-1)).toBe('/'));
  });

  it('goes back home from a tool', async () => {
    const { location } = renderPageAt('/toolkit/desire-lines');
    await screen.findByRole('heading', { level: 1, name: 'Desire Lines' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(location.history.at(-1)).toBe('/');
  });
});

describe('inside the app', () => {
  // Signed in, the side nav is around every page, and there is no footer.
  const sideNav = () => within(screen.getByRole('navigation', { name: 'App' }));

  it('has no Toolkit in the side nav', async () => {
    renderAt('/toolkit/street-mixer');

    await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' });
    expect(sideNav().queryByRole('button', { name: 'Toolkit' })).not.toBeInTheDocument();
  });

  it('keeps the side nav around a tool, without the footer', async () => {
    renderAt('/toolkit/street-mixer');

    expect(await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(sideNav().getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('sends /toolkit on its own home', async () => {
    const { location } = renderAt('/toolkit');

    await waitFor(() => expect(location.history.at(-1)).toBe('/'));
  });

  it('leaves a tool again, and puts the URL on the new view', async () => {
    // The view is read off the location, so a nav item that only set component state
    // would leave the tool showing over a Settings URL, or vice versa.
    const { location } = renderAt('/toolkit/street-mixer');
    await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' });

    fireEvent.click(sideNav().getByRole('button', { name: 'Settings' }));

    await waitFor(() => expect(location.history.at(-1)).toBe('/settings'));
    expect(screen.queryByRole('heading', { level: 1, name: 'Street Section Mixer' })).not.toBeInTheDocument();
  });
});

describe('Idea Visualizer', () => {
  const renderWith = (path, searchPath) => {
    const location = memoryLocation({ path, searchPath, record: true });
    render(
      <Router hook={location.hook} searchHook={location.searchHook}>
        <ToolkitPage t={THEME} />
      </Router>
    );
    return location;
  };

  it('is a tool in the Imagine category, with its own cover', () => {
    renderWith('/toolkit/reimagine-a-space', '');

    expect(screen.getByRole('heading', { name: 'Idea Visualizer' })).toBeInTheDocument();
    expect(screen.getByText('A tool to help anyone quickly create a visualization of an idea they have.')).toBeInTheDocument();
    expect(screen.getByText('Imagine')).toBeInTheDocument();
  });

  it('starts at an address of its own, keeping the board it was opened for', () => {
    const location = renderWith('/toolkit/reimagine-a-space', 'project=proj-1');

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

    expect(location.history.at(-1)).toBe('/toolkit/reimagine-a-space?project=proj-1&start');
  });

  it('leaves every other tool opening on its own page', () => {
    const location = renderWith('/toolkit/budget-ballot', '');

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

    expect(location.history.at(-1)).toBe('/toolkit/budget-ballot');
    expect(screen.getByText('What the street could have')).toBeInTheDocument();
  });
});
