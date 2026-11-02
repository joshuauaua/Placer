import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { ToolConfiguratorPage, configuredToolIdFrom } from '../ToolConfiguratorPage';
import { ToolkitPage } from '../ToolkitPage';
import { THEME } from '../../theme';
import { listStartedTools, saveStartedTool } from '../../services/startedTools';

// The Poll's question, as its setup form in the Configuration panel labels it.
const QUESTION_LABEL = 'The question';
const panelQuestion = () => within(screen.getByRole('complementary', { name: 'Configuration' })).getByLabelText(QUESTION_LABEL);

function renderAt(path, Page = ToolConfiguratorPage, props = {}) {
  const location = memoryLocation({ path, record: true });
  const result = render(
    <Router hook={location.hook}>
      <Page t={THEME} {...props} />
    </Router>
  );
  return { ...result, location };
}

describe('configuredToolIdFrom', () => {
  it('reads the tool from /toolkit/<id>/configure and nothing else', () => {
    expect(configuredToolIdFrom('/toolkit/word-cloud/configure')).toBe('word-cloud');
    expect(configuredToolIdFrom('/toolkit/word-cloud')).toBeNull();
    expect(configuredToolIdFrom('/toolkit/word-cloud/configure/more')).toBeNull();
  });
});

describe('ToolConfiguratorPage', () => {
  it('has a top bar with the tool, Preview and Publish, a canvas, and the tool’s own configuration', () => {
    renderAt('/toolkit/budget-ballot/configure');

    const bar = screen.getByRole('banner', { name: 'Configure a tool' });
    expect(within(bar).getByText('Co-Budget')).toBeInTheDocument();
    // Its name only: the category is not shown here.
    expect(within(bar).queryByText('Plan')).toBeNull();
    expect(within(bar).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Back to the Toolkit', 'Tool settings', 'Preview', 'Publish']);

    expect(screen.getByRole('main', { name: 'Canvas' })).toBeInTheDocument();
    const panel = screen.getByRole('complementary', { name: 'Configuration' });
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Budget', 'Posts']);
  });

  it('shows the setup on the canvas as it changes, and what is wrong with it while it cannot be used', () => {
    renderAt('/toolkit/budget-ballot/configure');
    const canvas = screen.getByRole('main', { name: 'Canvas' });
    const budget = screen.getByLabelText('Total budget');

    fireEvent.change(budget, { target: { value: '90000' } });
    expect(within(canvas).getAllByText('€90,000').length).toBeGreaterThan(0);

    fireEvent.change(budget, { target: { value: '' } });
    expect(screen.getByText(/Set a budget as a whole number/)).toBeInTheDocument();
    // The canvas falls back to the tool's own defaults rather than an unusable setup.
    expect(within(canvas).queryByText('€90,000')).toBeNull();
  });

  it('has no Slides panel for a tool that runs as one', () => {
    renderAt('/toolkit/budget-ballot/configure');

    expect(screen.queryByRole('navigation', { name: 'Slides' })).toBeNull();
  });

  it('starts a tool with slides on one, and each slide added keeps a setup of its own', () => {
    renderAt('/toolkit/open-vote/configure');
    const slides = screen.getByRole('navigation', { name: 'Slides' });
    const question = panelQuestion;

    expect(within(slides).getAllByRole('button', { name: /^Slide \d$/ })).toHaveLength(1);
    // Nothing to remove while there is only one.
    expect(within(slides).queryByRole('button', { name: /^Remove/ })).toBeNull();
    fireEvent.change(question(), { target: { value: 'Trees or benches?' } });

    fireEvent.click(within(slides).getByRole('button', { name: 'Add slide' }));
    expect(within(slides).getByRole('button', { name: 'Slide 2' })).toHaveAttribute('aria-current', 'true');
    expect(question()).not.toHaveValue('Trees or benches?');
    fireEvent.change(question(), { target: { value: 'More light?' } });

    fireEvent.click(within(slides).getByRole('button', { name: 'Slide 1' }));
    expect(question()).toHaveValue('Trees or benches?');
    fireEvent.click(within(slides).getByRole('button', { name: 'Slide 2' }));
    expect(question()).toHaveValue('More light?');
  });

  it('removes a slide, putting the one before it on the canvas', () => {
    renderAt('/toolkit/open-vote/configure');
    const slides = screen.getByRole('navigation', { name: 'Slides' });

    fireEvent.change(panelQuestion(), { target: { value: 'Trees or benches?' } });
    fireEvent.click(within(slides).getByRole('button', { name: 'Add slide' }));
    fireEvent.click(within(slides).getByRole('button', { name: 'Remove slide 2' }));

    expect(within(slides).getAllByRole('button', { name: /^Slide \d$/ })).toHaveLength(1);
    expect(within(slides).getByRole('button', { name: 'Slide 1' })).toHaveAttribute('aria-current', 'true');
    expect(panelQuestion()).toHaveValue('Trees or benches?');
  });

  it('keeps a tool once something in it changes, not before, and gives its address the id', () => {
    localStorage.clear();
    const { location } = renderAt('/toolkit/open-vote/configure', ToolConfiguratorPage, { accountId: 'acc' });
    expect(listStartedTools('acc')).toEqual([]);

    fireEvent.change(panelQuestion(), { target: { value: 'Trees or benches?' } });
    const [kept] = listStartedTools('acc');
    expect(kept.tool).toBe('open-vote');
    expect(kept.slides[0].setup.question).toBe('Trees or benches?');
    expect(location.history.at(-1)).toBe(`/toolkit/open-vote/configure?draft=${kept.id}`);
  });

  it('opens a started tool again from its id, slides and all', () => {
    localStorage.clear();
    saveStartedTool('acc', { id: 'poll-1', tool: 'open-vote', slides: [
      { id: 's1', setup: { question: 'Trees or benches?', answers: ['Trees', 'Benches'] } },
      { id: 's2', setup: { question: 'More light?', answers: ['Yes', 'No'] } },
    ] });
    renderAt('/toolkit/open-vote/configure?draft=poll-1', ToolConfiguratorPage, { accountId: 'acc' });

    expect(within(screen.getByRole('navigation', { name: 'Slides' })).getAllByRole('button', { name: /^Slide \d$/ }))
      .toHaveLength(2);
    expect(panelQuestion()).toHaveValue('Trees or benches?');
  });

  it('says when a tool has nothing to configure', () => {
    renderAt('/toolkit/fifteen-minute/configure');

    expect(screen.getByText(/nothing to configure/)).toBeInTheDocument();
  });

  it('shows the collaborators’ avatars in the top bar: for now, whoever is signed in', () => {
    renderAt('/toolkit/word-cloud/configure', ToolConfiguratorPage, { profile: { id: 'p1', name: 'Ada Lovelace' } });

    const bar = screen.getByRole('banner', { name: 'Configure a tool' });
    expect(within(bar).getByRole('group', { name: 'Collaborators: Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('has no avatars with nobody signed in', () => {
    renderAt('/toolkit/word-cloud/configure');

    expect(screen.queryByRole('group', { name: /Collaborators/ })).toBeNull();
  });

  it('opens the tool’s settings from the three dots, each saying it is not built yet', () => {
    renderAt('/toolkit/word-cloud/configure');
    const dots = screen.getByRole('button', { name: 'Tool settings' });

    fireEvent.click(dots);
    expect(dots).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent))
      .toEqual(['Rename', 'Duplicate', 'Manage collaborators', 'Delete tool']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete tool' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Delete tool is not built yet.');

    fireEvent.click(dots);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('says Preview and Publish are not built yet', () => {
    renderAt('/toolkit/word-cloud/configure');

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('status')).toHaveTextContent('Preview is not built yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('status')).toHaveTextContent('Publishing is not built yet.');
  });

  it('goes back to the Toolkit, and offers it for a tool that does not exist', () => {
    const { location } = renderAt('/toolkit/no-such-tool/configure');

    expect(screen.getByText('There is no tool here to configure.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the Toolkit' }));
    expect(location.history.at(-1)).toBe('/toolkit');
  });
});

describe('the Toolkit, from Create a tool', () => {
  it('opens on the chosen category, and a tool opens into its configuration', () => {
    const { location } = renderAt('/toolkit?category=plan&create', ToolkitPage);

    expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Understand' })).toBeNull();
    fireEvent.click(screen.getAllByText('Co-Budget')[0]);
    expect(location.history.at(-1)).toBe('/toolkit/budget-ballot/configure');
  });

  it('still opens a tool onto its cover otherwise', () => {
    const { location } = renderAt('/toolkit?category=plan', ToolkitPage);

    fireEvent.click(screen.getAllByText('Co-Budget')[0]);
    expect(location.history.at(-1)).toBe('/toolkit/budget-ballot');
  });
});
