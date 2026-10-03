import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { ToolkitPage, toolIdFrom } from '../ToolkitPage';
import { CATEGORIES, TOOLS } from '../../toolkit/tools';
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

/** A tool's tile or row, by its name, and not the heart beside it that names it too. */
const tile = (pattern) => (name) => pattern.test(name) && !name.endsWith('favourites');

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

  it('sends the gallery itself to /toolkit', async () => {
    const { location } = renderAt('/sandbox');

    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit');
  });
});

describe('the gallery', () => {
  it('shows every tool in the register', async () => {
    renderPageAt('/toolkit');

    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    for (const tool of TOOLS) {
      expect(screen.getByRole('button', { name: tile(new RegExp(tool.name, 'i')) })).toBeInTheDocument();
    }
    expect(TOOLS).toHaveLength(8);
  });

  it('shows every tool as one set of cards, each labelled with its category', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    for (const tool of TOOLS) {
      const category = CATEGORIES.find((entry) => entry.id === tool.category);
      expect(screen.getByRole('button', { name: tile(new RegExp(tool.name, 'i')) })).toHaveTextContent(category.name);
    }
  });

  it('switches between grid and list, and remembers the choice', async () => {
    const { unmount } = renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    const view = () => within(screen.getByRole('group', { name: 'View' }));

    expect(view().getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(view().getByRole('button', { name: 'List' }));
    expect(view().getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    // Still every tool, and still openable.
    for (const tool of TOOLS) {
      expect(screen.getByRole('button', { name: tile(new RegExp(tool.name, 'i')) })).toBeInTheDocument();
    }

    unmount();
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    expect(view().getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    localStorage.clear();
  });

  it('opens a tool from the list view too', async () => {
    const { location } = renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'List' }));
    fireEvent.click(screen.getByRole('button', { name: tile(/Open Vote/i) }));

    expect(location.history.at(-1)).toBe('/toolkit/open-vote');
    localStorage.clear();
  });

  it('credits each tool to the organisation that made it', async () => {
    renderPageAt('/toolkit');

    expect(await screen.findByRole('button', { name: tile(/The Social Space Survey/i) }))
      .toHaveTextContent('By Gehl Institute');
  });

  it('has no search box, description or tool count', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Participatory placemaking methods/)).not.toBeInTheDocument();
    expect(screen.queryByText(`${TOOLS.length} tools`)).not.toBeInTheDocument();
  });

  it('filters by category and group use from the category menu', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /^Category:/ }));

    expect(screen.getByRole('button', { name: 'Category: All tools' })).toBeInTheDocument();
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Understand' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Category: Understand' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tile(/Open Vote/i) })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: tile(/Desire Lines/i) })).toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Works with a group' }));
    expect(screen.getByText('No tools match those filters.')).toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'All tools' }));
    expect(screen.getByRole('button', { name: tile(/Open Vote/i) })).toBeInTheDocument();
  });

  it('sorts by Recent, A-Z or Organisation, and turns the current order round', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    const sorts = within(screen.getByRole('group', { name: 'Sort' }));
    const names = () => screen.getAllByRole('button', { name: tile(/./) })
      .map((button) => TOOLS.find((tool) => button.textContent.includes(tool.name))?.name)
      .filter(Boolean);

    // Newest first to begin with: Open Vote is the latest tool added.
    expect(sorts.getByRole('button', { name: 'Recent' })).toHaveAttribute('aria-pressed', 'true');
    expect(names()[0]).toBe('Open Vote');

    fireEvent.click(sorts.getByRole('button', { name: 'A-Z' }));
    const alphabetical = TOOLS.map((tool) => tool.name).sort((a, b) => a.localeCompare(b));
    expect(names()).toEqual(alphabetical);
    fireEvent.click(sorts.getByRole('button', { name: 'A-Z' }));
    expect(names()).toEqual([...alphabetical].reverse());

    fireEvent.click(sorts.getByRole('button', { name: 'Organisation' }));
    expect(names()[0]).toBe('The Social Space Survey');
  });

  it('keeps favourites in this browser, and shows only them on request', async () => {
    const { unmount } = renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    fireEvent.click(screen.getByRole('button', { name: 'Add Desire Lines to favourites' }));
    expect(screen.getByRole('button', { name: 'Remove Desire Lines from favourites' }))
      .toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Favourites' }));
    expect(screen.getByRole('button', { name: tile(/Desire Lines/i) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tile(/Open Vote/i) })).not.toBeInTheDocument();

    unmount();
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    expect(screen.getByRole('button', { name: 'Remove Desire Lines from favourites' })).toBeInTheDocument();
    localStorage.clear();
  });

  it('says how to add a favourite when there are none', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    fireEvent.click(screen.getByRole('button', { name: 'Favourites' }));
    expect(screen.getByText(/No favourites yet/)).toBeInTheDocument();
  });

  it('clears every filter at once', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    fireEvent.click(screen.getByRole('button', { name: /^Category:/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Works with a group' }));
    fireEvent.click(screen.getByRole('button', { name: /^Category:/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Understand' }));
    expect(screen.getByText('No tools match those filters.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('button', { name: 'Category: All tools' })).toBeInTheDocument();
    for (const tool of TOOLS) {
      expect(screen.getByRole('button', { name: tile(new RegExp(tool.name, 'i')) })).toBeInTheDocument();
    }
  });

  it('opens a tool, and puts it in the URL', async () => {
    const { location } = renderPageAt('/toolkit');

    fireEvent.click(screen.getByRole('button', { name: tile(/Street Section Mixer/i) }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit/street-mixer');
  });

  it('comes back to the gallery, and to the plain URL', async () => {
    const { location } = renderPageAt('/toolkit/desire-lines');
    await screen.findByRole('heading', { level: 1, name: 'Desire Lines' });

    fireEvent.click(screen.getByRole('button', { name: /all tools/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit');
  });

  it.each(TOOLS.map((tool) => [tool.id, tool.name]))(
    'opens %s straight from its own link',
    async (id, name) => {
      renderPageAt(`/toolkit/${id}`);
      expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
    }
  );

  it('falls back to the gallery when the link names nothing', async () => {
    renderPageAt('/toolkit/teleporter');

    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('There is no tool called teleporter');
    expect(screen.getByRole('button', { name: tile(/Budget Ballot/i) })).toBeInTheDocument();
  });

  it('opens a tool on its cover page, and shows the tool after Get started', async () => {
    renderPageAt('/toolkit/street-mixer');

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

  it('opens the next tool on its own cover, rather than skipping it', async () => {
    renderPageAt('/toolkit/street-mixer');
    start();

    fireEvent.click(screen.getByRole('button', { name: /all tools/i }));
    fireEvent.click(await screen.findByRole('button', { name: tile(/Desire Lines/i) }));

    expect(await screen.findByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });

  it('says what each tool is for, so a tile is not just a name', () => {
    renderPageAt('/toolkit');
    for (const tool of TOOLS) {
      expect(screen.getByText(tool.tagline)).toBeInTheDocument();
    }
  });
});

describe('the copy link button', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the tool own link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderPageAt('/toolkit/budget-ballot');
    start();
    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/toolkit/budget-ballot')));
    expect(await screen.findByRole('button', { name: /link copied/i })).toBeInTheDocument();
  });

  it('shows the link instead when the browser will not copy it', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });

    renderPageAt('/toolkit/budget-ballot');
    start();
    fireEvent.click(await screen.findByRole('button', { name: /copy link/i }));

    const field = await screen.findByLabelText('Link to this tool');
    expect(field.value).toContain('/toolkit/budget-ballot');
  });
});

describe('inside the app', () => {
  // Signed in, Toolkit and Explore live in the side nav and About and Resources in
  // the footer. Each is scoped so "Toolkit" is not also the page heading.
  const sideNav = () => within(screen.getByRole('navigation', { name: 'App' }));
  const footer = () => within(screen.getByRole('contentinfo'));

  it('reaches the Toolkit from the side nav', async () => {
    const { location } = renderAt('/');

    fireEvent.click(sideNav().getByRole('button', { name: 'Toolkit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit');
  });

  it('keeps the side nav and footer around a tool', async () => {
    renderAt('/toolkit/street-mixer');

    expect(await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(sideNav().getByRole('button', { name: 'Toolkit' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
  });

  it('serves the gallery and a tool from the one route', async () => {
    renderAt('/toolkit');
    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    expect(sideNav().getByRole('button', { name: 'Toolkit' })).toBeInTheDocument();
  });

  it('leaves the Toolkit again, and puts the URL on the new view', async () => {
    // The view is read off the location, so a nav item that only set component state
    // would leave the Toolkit showing over an About URL, or vice versa.
    const { location } = renderAt('/toolkit/street-mixer');
    await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' });

    fireEvent.click(footer().getByText('Who We Are'));

    // The About page is a photo of the team, so its alt text is what marks it.
    expect(
      await screen.findByRole('img', { name: /people behind PLACER/i }),
    ).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/about');
    expect(screen.queryByRole('heading', { level: 1, name: 'Street Section Mixer' })).not.toBeInTheDocument();
  });

  it('goes back into the Toolkit from another view', async () => {
    const { location } = renderAt('/');

    fireEvent.click(footer().getByText('Resources', { selector: '[role="link"]' }));
    await screen.findByRole('heading', { level: 1, name: 'Resources' });
    fireEvent.click(sideNav().getByRole('button', { name: 'Toolkit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit');
  });

  it('marks the nav item as the one showing', async () => {
    renderAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    expect(sideNav().getByRole('button', { name: 'Toolkit' })).toHaveAttribute('aria-current', 'page');
    expect(sideNav().getByRole('button', { name: 'Explore' })).not.toHaveAttribute('aria-current');
  });

  it('does not fall through to the welcome view', async () => {
    renderAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    expect(screen.queryByText('a toolkit for participatory placemaking')).not.toBeInTheDocument();
  });
});
