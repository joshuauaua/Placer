import { describe, it, expect } from 'vite-plus/test';
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

/** The category a tool is in. */
const findCategoryOf = (tool) => CATEGORIES.find((category) => category.id === tool.category);

/** A tool's tile or row, by its name, and not the save icon beside it that names it too. */
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
  });

  it.each(['List', 'Grid'])('sorts the tools into a section per category, in its colour, in the %s view', async (name) => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name }));

    const shown = CATEGORIES.filter((category) => TOOLS.some((tool) => tool.category === category.id));
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual(shown.map((category) => category.name));
    for (const category of shown) {
      const heading = screen.getByRole('heading', { level: 2, name: category.name });
      expect(heading).toHaveStyle({ color: category.colour.c700 });
      const section = screen.getByRole('region', { name: category.name });
      for (const tool of TOOLS.filter((entry) => entry.category === category.id)) {
        expect(within(section).getByRole('button', { name: tile(new RegExp(tool.name, 'i')) }))
          .toHaveTextContent(category.name);
      }
    }
    localStorage.clear();
  });

  it('opens on the list, switches to the grid, and remembers the choice', async () => {
    const { unmount } = renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    const view = () => within(screen.getByRole('group', { name: 'View' }));

    expect(view().getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(view().getByRole('button', { name: 'Grid' }));
    expect(view().getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    // Still every tool, and still openable.
    for (const tool of TOOLS) {
      expect(screen.getByRole('button', { name: tile(new RegExp(tool.name, 'i')) })).toBeInTheDocument();
    }

    unmount();
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    expect(view().getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    localStorage.clear();
  });

  it('opens a tool from the grid view too', async () => {
    const { location } = renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Grid' }));
    fireEvent.click(screen.getByRole('button', { name: tile(/Poll/i) }));

    expect(location.history.at(-1)).toBe('/toolkit/open-vote');
    localStorage.clear();
  });

  it('colours each icon in the list by its category, as the grid does', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'List' }));

    // Street Section Mixer is an Imagine tool in a City Worker colour of its own.
    const imagine = CATEGORIES.find(({ id }) => id === 'imagine').colour;
    const mixer = TOOLS.find(({ id }) => id === 'street-mixer');
    expect(mixer.color).not.toBe(imagine.c700);
    const icon = screen.getByRole('button', { name: tile(/Street Section Mixer/i) }).firstElementChild;
    expect(icon).toHaveStyle({ background: imagine.c100, color: imagine.c700 });
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
    expect(screen.queryByRole('button', { name: tile(/Poll/i) })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: tile(/15-Minute/i) })).toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Works with a group' }));
    expect(screen.getByRole('button', { name: tile(/Pop Quiz/i) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: tile(/Word Cloud/i) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tile(/15-Minute/i) })).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'All tools' }));
    expect(screen.getByRole('button', { name: tile(/Poll/i) })).toBeInTheDocument();
  });

  it('sorts each category by Recent, A-Z or Organisation, and turns the current order round', async () => {
    renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });
    const sorts = within(screen.getByRole('group', { name: 'Sort' }));
    const shown = CATEGORIES.filter((category) => TOOLS.some((tool) => tool.category === category.id));
    const inCategory = (category) => TOOLS.filter((tool) => tool.category === category.id);
    const names = (category) => within(screen.getByRole('region', { name: category.name }))
      .getAllByRole('button', { name: tile(/./) })
      .map((button) => TOOLS.find((tool) => button.textContent.includes(tool.name))?.name)
      .filter(Boolean);

    // Newest first to begin with: within each category, whichever were added last.
    expect(sorts.getByRole('button', { name: 'Recent' })).toHaveAttribute('aria-pressed', 'true');
    for (const category of shown) {
      const added = names(category).map((name) => TOOLS.find((tool) => tool.name === name).added);
      expect(added).toEqual([...added].sort().reverse());
    }

    fireEvent.click(sorts.getByRole('button', { name: 'A-Z' }));
    for (const category of shown) {
      expect(names(category)).toEqual(inCategory(category).map((tool) => tool.name).sort((a, b) => a.localeCompare(b)));
    }
    fireEvent.click(sorts.getByRole('button', { name: 'A-Z' }));
    for (const category of shown) {
      expect(names(category)).toEqual(inCategory(category).map((tool) => tool.name)
        .sort((a, b) => a.localeCompare(b)).reverse());
    }

    fireEvent.click(sorts.getByRole('button', { name: 'Organisation' }));
    const survey = TOOLS.find((tool) => tool.name === 'The Social Space Survey');
    // Gehl Institute's three come first, by name.
    expect(names(findCategoryOf(survey)).slice(0, 3))
      .toEqual(['Site-Specific Spatial Mapping Tool', 'Stationary Activity Mapping', 'The Social Space Survey']);
  });

  it('keeps favourites in this browser, and shows only them on request', async () => {
    const { unmount } = renderPageAt('/toolkit');
    await screen.findByRole('heading', { level: 1, name: 'Toolkit' });

    fireEvent.click(screen.getByRole('button', { name: 'Add Desire Lines to favourites' }));
    expect(screen.getByRole('button', { name: 'Remove Desire Lines from favourites' }))
      .toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Favourites' }));
    expect(screen.getByRole('button', { name: tile(/Desire Lines/i) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tile(/Poll/i) })).not.toBeInTheDocument();

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

    // A favourite that does not run in a room, so favourites with a group match nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Add Street Section Mixer to favourites' }));
    fireEvent.click(screen.getByRole('button', { name: 'Favourites' }));
    fireEvent.click(screen.getByRole('button', { name: /^Category:/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Works with a group' }));
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
    expect(screen.getByRole('button', { name: tile(/Co-Budget/i) })).toBeInTheDocument();
  });

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

  it('opens the same tool on its cover again, after going back to the gallery', async () => {
    renderPageAt('/toolkit/street-mixer');
    start();

    fireEvent.click(screen.getByRole('button', { name: /all tools/i }));
    fireEvent.click(await screen.findByRole('button', { name: tile(/Street Section Mixer/i) }));

    expect(await screen.findByRole('button', { name: 'Get started' })).toBeInTheDocument();
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

describe('inside the app', () => {
  // Signed in, Toolkit and Explore live in the side nav, and there is no footer.
  // Scoped so "Toolkit" is not also the page heading.
  const sideNav = () => within(screen.getByRole('navigation', { name: 'App' }));

  it('reaches the Toolkit from the side nav', async () => {
    const { location } = renderAt('/');

    fireEvent.click(sideNav().getByRole('button', { name: 'Toolkit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Toolkit' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit');
  });

  it('keeps the side nav around a tool, without the footer', async () => {
    renderAt('/toolkit/street-mixer');

    expect(await screen.findByRole('heading', { level: 1, name: 'Street Section Mixer' })).toBeInTheDocument();
    expect(sideNav().getByRole('button', { name: 'Toolkit' })).toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
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

    fireEvent.click(sideNav().getByRole('button', { name: 'Settings' }));

    await waitFor(() => expect(location.history.at(-1)).toBe('/settings'));
    expect(screen.queryByRole('heading', { level: 1, name: 'Street Section Mixer' })).not.toBeInTheDocument();
  });

  it('goes back into the Toolkit from another view', async () => {
    const { location } = renderAt('/resources');

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

  it('starts at an address of its own, keeping the project it was opened for', () => {
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
